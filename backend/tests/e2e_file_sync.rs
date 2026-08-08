// Integration tests for filesystem watcher <-> API consistency:
// - manually created files appear, manually removed files disappear
// - files moved out of the uploads folder are treated as removed
// - files copied back after an API delete become visible again
// - re-uploading a file with the same name after an API delete works
mod common;
use common::*;
use serde_json::Value;
use std::time::Duration;
use tokio::time::sleep;

const POLL_INTERVAL: Duration = Duration::from_millis(200);
const MAX_POLLS: u32 = 200; // ~40s deadline, keeps polling robust under CI load

struct Fixture {
    app: TestApp,
    owner_token: String,
    visitor_token: String,
}

async fn setup(visitor_upload: bool) -> Fixture {
    let app = TestApp::spawn().await;
    app.post_init_db().await;
    app.create_owner_direct("sync_owner", "sync_owner_password123")
        .await;
    let owner_token = app
        .login_and_get_token("sync_owner", "sync_owner_password123")
        .await;

    let visitor_token = if visitor_upload {
        app.create_visitor_via_api_as_owner(
            &owner_token,
            "sync_visitor",
            "sync_visitor_password123",
            VisitorOptions {
                can_upload: true,
                can_delete_own_files: true,
                has_upload_limits: false,
                upload_limit: 0,
            },
        )
        .await;
        app.login_and_get_token("sync_visitor", "sync_visitor_password123")
            .await
    } else {
        String::new()
    };

    Fixture {
        app,
        owner_token,
        visitor_token,
    }
}

fn file_ids_by_name(body: &Value, name: &str) -> Vec<i64> {
    body["data"]["items"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter(|it| it["name"].as_str().is_some_and(|n| n == name))
                .filter_map(|it| it["id"].as_i64())
                .collect()
        })
        .unwrap_or_default()
}

async fn list_files(app: &TestApp, token: &str) -> Value {
    let resp = app
        .api
        .get("/api/files")
        .with_token(token)
        .with_query_param("limit", "100")
        .send()
        .await
        .expect("list files request failed");
    assert!(
        resp.status().is_success(),
        "list files failed: {}",
        resp.status()
    );
    resp.json().await.expect("invalid json")
}

async fn wait_until_listed(app: &TestApp, token: &str, name: &str) -> i64 {
    for _ in 0..MAX_POLLS {
        let body = list_files(app, token).await;
        let ids = file_ids_by_name(&body, name);
        if let Some(id) = ids.first() {
            return *id;
        }
        sleep(POLL_INTERVAL).await;
    }
    panic!("file '{name}' never appeared in the file list");
}

async fn wait_until_absent(app: &TestApp, token: &str, name: &str) {
    for _ in 0..MAX_POLLS {
        let body = list_files(app, token).await;
        if file_ids_by_name(&body, name).is_empty() {
            return;
        }
        sleep(POLL_INTERVAL).await;
    }
    panic!("file '{name}' never disappeared from the file list");
}

/// A file dropped into the uploads folder must disappear from the API when
/// it is manually removed from disk (plain file deletion).
#[tokio::test(flavor = "multi_thread")]
async fn test_manual_remove_makes_file_disappear() {
    let fixture = setup(false).await;
    let name = "manual_remove_me.txt";
    let path = fixture.app.uploads_path.join(name);
    tokio::fs::write(&path, b"remove me")
        .await
        .expect("write failed");

    wait_until_listed(&fixture.app, &fixture.owner_token, name).await;

    tokio::fs::remove_file(&path).await.expect("remove failed");
    wait_until_absent(&fixture.app, &fixture.owner_token, name).await;

    fixture.app.cleanup();
}

/// A file moved (renamed) out of the uploads folder is effectively removed
/// from the system's point of view and must disappear from the API.
#[tokio::test(flavor = "multi_thread")]
async fn moved_out_file_disappears() {
    let fixture = setup(false).await;
    let name = "move_me_out.txt";
    let in_path = fixture.app.uploads_path.join(name);
    let out_path = std::env::temp_dir().join(format!("sync_rename_out_{name}"));
    tokio::fs::write(&in_path, b"will be moved")
        .await
        .expect("write failed");

    wait_until_listed(&fixture.app, &fixture.owner_token, name).await;

    tokio::fs::rename(&in_path, &out_path)
        .await
        .expect("rename failed");
    wait_until_absent(&fixture.app, &fixture.owner_token, name).await;

    let _ = tokio::fs::remove_file(&out_path).await;
    fixture.app.cleanup();
}

/// After deleting a file through the API, dropping the same file back into
/// the folder must make it visible again.
#[tokio::test(flavor = "multi_thread")]
async fn copy_back_after_api_delete_reappears() {
    let fx = setup(false).await;
    let name = "resurrect.txt";
    let bytes: Vec<u8> = b"resurrected content".to_vec();
    let path = fx.app.uploads_path.join(name);
    tokio::fs::write(&path, &bytes).await.expect("write failed");

    let file_id = wait_until_listed(&fx.app, &fx.owner_token, name).await;

    let del = fx
        .app
        .delete_file_by_id(&fx.owner_token, file_id)
        .await
        .expect("delete request failed");
    assert!(del.status().is_success(), "delete status: {}", del.status());

    wait_until_absent(&fx.app, &fx.owner_token, name).await;

    // Copy the file back into the folder manually.
    tokio::fs::write(&path, &bytes)
        .await
        .expect("re-copy failed");

    let new_id = wait_until_listed(&fx.app, &fx.owner_token, name).await;
    let downloaded = fx
        .app
        .download_file_bytes(&fx.owner_token, new_id)
        .await
        .expect("download of resurrected file failed");
    assert_eq!(downloaded, bytes);

    fx.app.cleanup();
}

/// Uploading a file with the same name as one that was previously deleted
/// via the API must produce a downloadable file.
#[tokio::test(flavor = "multi_thread")]
async fn reupload_same_name_after_api_delete_downloads() {
    let fx = setup(true).await;
    let name = "same_name.bin";
    let content1: Vec<u8> = b"first generation".to_vec();
    let content2: Vec<u8> = (0..2048u32).map(|i| (i % 251) as u8).collect();

    let resp = fx
        .app
        .upload_single_chunk_file(&fx.visitor_token, "sync", name, content1.clone())
        .await;
    assert!(
        resp.status().is_success(),
        "first upload failed: {}",
        resp.status()
    );

    let file_id = wait_until_listed(&fx.app, &fx.visitor_token, name).await;
    let downloaded = fx
        .app
        .download_file_bytes(&fx.visitor_token, file_id)
        .await
        .expect("download after first upload failed");
    assert_eq!(downloaded, content1);

    let del = fx
        .app
        .delete_file_by_id(&fx.visitor_token, file_id)
        .await
        .expect("delete request failed");
    assert!(del.status().is_success(), "delete status: {}", del.status());

    wait_until_absent(&fx.app, &fx.visitor_token, name).await;

    let resp = fx
        .app
        .upload_single_chunk_file(&fx.visitor_token, "sync", name, content2.clone())
        .await;
    assert!(
        resp.status().is_success(),
        "second upload failed: {}",
        resp.status()
    );

    let new_id = wait_until_listed(&fx.app, &fx.visitor_token, name).await;
    let downloaded2 = fx
        .app
        .download_file_bytes(&fx.visitor_token, new_id)
        .await
        .expect("download after re-upload failed");
    assert_eq!(downloaded2, content2);

    fx.app.cleanup();
}

/// Replacing a file's contents on disk must be reflected when downloading.
#[tokio::test(flavor = "multi_thread")]
async fn modify_on_disk_updates_downloadable_content() {
    let fx = setup(true).await;
    let name = "live_update.txt";
    let old: Vec<u8> = b"old".to_vec();
    let new: Vec<u8> = b"new content that is longer".to_vec();
    let path = fx.app.uploads_path.join(name);
    tokio::fs::write(&path, &old).await.expect("write failed");
    let file_id = wait_until_listed(&fx.app, &fx.owner_token, name).await;

    tokio::fs::write(&path, &new).await.expect("write failed");
    for _ in 0..MAX_POLLS {
        match fx.app.download_file_bytes(&fx.owner_token, file_id).await {
            Ok(bytes) if bytes == new => break,
            _ => sleep(POLL_INTERVAL).await,
        }
    }
    let got = fx
        .app
        .download_file_bytes(&fx.owner_token, file_id)
        .await
        .expect("download failed");
    assert_eq!(got, new);

    fx.app.cleanup();
}
