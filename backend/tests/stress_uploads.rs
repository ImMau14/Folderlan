// Stress tests: many files observed/uploaded at the same time.
//
// The watcher design goal is that a burst of filesystem events (e.g. a folder
// full of photos copied in one go) is absorbed by the DB queue: events are
// deduplicated per file and written serially, so no "database is locked" /
// readonly errors should ever surface and every file must end up registered
// exactly once.
mod common;
use common::{TestApp, VisitorOptions};
use serde_json::Value;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

const POLL_INTERVAL: Duration = Duration::from_millis(200);
const MAX_POLLS: u32 = 400; // ~80s deadline under CI load

// Files dropped into the watched folder in one burst.
const WATCHER_BURST: usize = 300;
// Concurrent multipart uploads.
const API_BURST: usize = 40;

struct Fixture {
    app: Arc<TestApp>,
    owner_token: String,
    visitor_token: String,
}

impl Clone for Fixture {
    fn clone(&self) -> Self {
        Fixture {
            app: self.app.clone(),
            owner_token: self.owner_token.clone(),
            visitor_token: self.visitor_token.clone(),
        }
    }
}

async fn setup(visitor_upload: bool) -> Fixture {
    let app = TestApp::spawn().await;
    app.post_init_db().await;
    app.create_owner_direct("stress_owner", "stress_owner_password123")
        .await;
    let owner_token = app
        .login_and_get_token("stress_owner", "stress_owner_password123")
        .await;

    let visitor_token = if visitor_upload {
        app.create_visitor_via_api_as_owner(
            &owner_token,
            "stress_visitor",
            "stress_visitor_password123",
            VisitorOptions {
                can_upload: true,
                can_delete_own_files: true,
                has_upload_limits: false,
                upload_limit: 0,
            },
        )
        .await;
        app.login_and_get_token("stress_visitor", "stress_visitor_password123")
            .await
    } else {
        String::new()
    };

    Fixture {
        app: Arc::new(app),
        owner_token,
        visitor_token,
    }
}

/// Total number of visible files (independent of pagination: `total` in body).
async fn total_files(app: &TestApp, token: &str) -> usize {
    let resp = app
        .api
        .get("/api/files")
        .with_token(token)
        .with_query_param("limit", "100")
        .send()
        .await
        .expect("list files request failed");
    assert!(resp.status().is_success(), "list failed: {}", resp.status());
    let body: Value = resp.json().await.expect("invalid json");
    body["data"]["total"].as_i64().unwrap_or(-1) as usize
}

async fn wait_until_total(app: &TestApp, token: &str, expected: usize) {
    for _ in 0..MAX_POLLS {
        if total_files(app, token).await == expected {
            return;
        }
        sleep(POLL_INTERVAL).await;
    }
    panic!(
        "total never reached {expected} (last seen {})",
        total_files(app, token).await
    );
}

/// Every page has unique file ids (no duplicate rows leaked into the listing).
async fn assert_no_duplicate_ids(app: &TestApp, token: &str) {
    let mut seen = HashSet::new();
    let mut offset = 0usize;
    loop {
        let resp = app
            .api
            .get("/api/files")
            .with_token(token)
            .with_query_param("limit", "100")
            .with_query_param("offset", &offset.to_string())
            .send()
            .await
            .expect("api/files");
        let body: Value = resp.json().await.expect("invalid json");
        let items = body["data"]["items"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        if items.is_empty() {
            break;
        }
        for it in &items {
            let id = it["id"].as_i64().expect("id missing");
            assert!(seen.insert(id), "duplicate file id {id} in listing");
        }
        offset += items.len();
    }
}

async fn find_file_id(app: &TestApp, token: &str, name: &str) -> i64 {
    for _ in 0..MAX_POLLS {
        let resp = app
            .api
            .get("/api/files")
            .with_token(token)
            .with_query_param("name", name)
            .send()
            .await
            .expect("api/files");
        let body: Value = resp.json().await.expect("invalid json");
        if let Some(id) = body["data"]["items"]
            .as_array()
            .and_then(|a| a.iter().find(|it| it["name"] == name))
            .and_then(|it| it["id"].as_i64())
        {
            return id;
        }
        sleep(POLL_INTERVAL).await;
    }
    panic!("file {name} never appeared");
}

/// A full folder of files dropped in at once must all be registered,
/// exactly once per file, with no duplicate rows.
#[tokio::test(flavor = "multi_thread")]
async fn flood_watcher_files_all_registered_exactly_once() {
    let fixture = setup(false).await;
    let names: Vec<String> = (0..WATCHER_BURST)
        .map(|i| format!("flood_{i}.txt"))
        .collect();

    // Write the whole burst concurrently so events stack up at once.
    let mut handles = Vec::new();
    for (i, name) in names.iter().enumerate() {
        let path = fixture.app.uploads_path.join(name);
        let content = format!("burst content {i}\n");
        handles.push(tokio::spawn(async move {
            tokio::fs::write(&path, content)
                .await
                .expect("write failed");
        }));
    }
    for h in handles {
        h.await.expect("bolt failed");
    }

    wait_until_total(&fixture.app, &fixture.owner_token, WATCHER_BURST).await;

    // Let late events (open/modify) land: the count must NOT grow.
    sleep(Duration::from_secs(2)).await;
    assert_eq!(
        total_files(&fixture.app, &fixture.owner_token).await,
        WATCHER_BURST,
        "total grew after settle; duplicates were registered"
    );
    assert_no_duplicate_ids(&fixture.app, &fixture.owner_token).await;

    // Downloads still serve the right content.
    for i in (0..WATCHER_BURST).step_by(97) {
        let name = &names[i];
        let file_id = find_file_id(&fixture.app, &fixture.owner_token, name).await;
        let downloaded = fixture
            .app
            .download_file_bytes(&fixture.owner_token, file_id)
            .await
            .expect("download failed");
        assert_eq!(
            String::from_utf8_lossy(&downloaded),
            format!("burst content {i}\n"),
            "mismatch for {name}"
        );
    }

    if let Ok(app) = Arc::try_unwrap(fixture.app) {
        app.cleanup();
    }
}

/// Many concurrent multipart uploads through the API must all land.
#[tokio::test(flavor = "multi_thread")]
async fn flood_api_uploads_concurrent() {
    let fixture = setup(true).await;
    let names: Vec<String> = (0..API_BURST)
        .map(|i| format!("api_flood_{i}.bin"))
        .collect();

    let mut handles = Vec::new();
    for (i, name) in names.iter().enumerate() {
        let fixture = fixture.clone();
        let name = name.clone();
        handles.push(tokio::spawn(async move {
            let bytes: Vec<u8> = (0..4096usize).map(|j| ((i * 31 + j) % 251) as u8).collect();
            let status = fixture
                .app
                .upload_single_chunk_file(&fixture.visitor_token, "sync", &name, bytes)
                .await
                .status()
                .as_u16();
            (name, status)
        }));
    }
    for h in handles {
        let (name, status) = h.await.expect("task failed");
        assert!(
            status == 200 || status == 201,
            "upload {name} failed with {status}"
        );
    }

    wait_until_total(&fixture.app, &fixture.visitor_token, API_BURST).await;
    assert_no_duplicate_ids(&fixture.app, &fixture.visitor_token).await;

    // Every uploaded file is individually correct.
    for i in (0..API_BURST).step_by(5) {
        let name = &names[i];
        let file_id = find_file_id(&fixture.app, &fixture.visitor_token, name).await;
        let downloaded = fixture
            .app
            .download_file_bytes(&fixture.visitor_token, file_id)
            .await
            .expect("download failed");
        let expected: Vec<u8> = (0..4096usize).map(|j| ((i * 31 + j) % 251) as u8).collect();
        assert_eq!(downloaded, expected, "content mismatch for {name}");
    }

    if let Ok(app) = Arc::try_unwrap(fixture.app) {
        app.cleanup();
    }
}

/// Watcher-detected files and API uploads racing each other.
#[tokio::test(flavor = "multi_thread")]
async fn watcher_and_api_flood_mixed_race() {
    let fixture = setup(true).await;
    let watcher_names: Vec<String> = (0..200).map(|i| format!("mix_watcher_{i}.txt")).collect();
    let api_names: Vec<String> = (0..API_BURST).map(|i| format!("mix_api_{i}.bin")).collect();

    let mut handles_watcher = Vec::new();

    // Watcher side: drop files.
    for (i, name) in watcher_names.iter().enumerate() {
        let path = fixture.app.uploads_path.join(name);
        let content = format!("mix watcher {i}\n");
        handles_watcher.push(tokio::spawn(async move {
            tokio::fs::write(&path, content)
                .await
                .expect("write failed");
        }));
    }

    // API side: concurrent uploads.
    let mut handles_api = Vec::new();
    for (i, name) in api_names.iter().enumerate() {
        let fixture = fixture.clone();
        let name = name.clone();
        handles_api.push(tokio::spawn(async move {
            let bytes: Vec<u8> = (0..512usize).map(|j| ((i * 7 + j) % 251) as u8).collect();
            let status = fixture
                .app
                .upload_single_chunk_file(&fixture.visitor_token, "sync", &name, bytes)
                .await
                .status()
                .as_u16();
            (name, status)
        }));
    }

    for h in handles_watcher {
        h.await.expect("watcher write task failed");
    }
    for h in handles_api {
        let (name, status) = h.await.expect("upload task failed");
        assert!(
            status == 200 || status == 201,
            "upload {name} failed with {status}"
        );
    }

    let expected = watcher_names.len() + api_names.len();
    wait_until_total(&fixture.app, &fixture.owner_token, expected).await;
    assert_no_duplicate_ids(&fixture.app, &fixture.owner_token).await;

    // Spot-check a watcher file and an API file.
    let watcher_id = find_file_id(&fixture.app, &fixture.owner_token, "mix_watcher_17.txt").await;
    let downloaded = fixture
        .app
        .download_file_bytes(&fixture.owner_token, watcher_id)
        .await
        .expect("download mix_watcher_17 failed");
    assert_eq!(String::from_utf8_lossy(&downloaded), "mix watcher 17\n");

    let api_id = find_file_id(&fixture.app, &fixture.owner_token, "mix_api_7.bin").await;
    let downloaded = fixture
        .app
        .download_file_bytes(&fixture.owner_token, api_id)
        .await
        .expect("download mix_api failed");
    let expected: Vec<u8> = (0..512usize).map(|j| ((7 * 7 + j) % 251) as u8).collect();
    assert_eq!(downloaded, expected);

    if let Ok(app) = Arc::try_unwrap(fixture.app) {
        app.cleanup();
    }
}
