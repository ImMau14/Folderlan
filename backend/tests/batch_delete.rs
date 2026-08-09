// Integration tests for the batch delete endpoint (DELETE /api/files with ids payload).
mod common;
use common::*;
use serde_json::Value;
use std::time::Duration;
use tokio::time::sleep;

async fn upload_and_get_id(app: &TestApp, token: &str, name: &str) -> i64 {
    let resp = app
        .upload_single_chunk_file(token, "batch_test", name, b"batch delete test".to_vec())
        .await;
    assert!(
        resp.status().is_success(),
        "Upload {} failed: {}",
        name,
        resp.status()
    );
    app.find_file_id_by_name(token, name)
        .await
        .expect("Find file failed")
        .expect("File should exist after upload")
}

async fn wait_until_absent(app: &TestApp, token: &str, name: &str) {
    for _ in 0..60 {
        if app
            .find_file_id_by_name(token, name)
            .await
            .ok()
            .flatten()
            .is_none()
        {
            return;
        }
        sleep(Duration::from_millis(150)).await;
    }
    panic!("File {name} still visible after wait")
}

#[tokio::test(flavor = "multi_thread")]
async fn test_batch_delete_mixed_results() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;
    app.create_owner_direct("batch_owner", "owner_password123")
        .await;
    let token = app
        .login_and_get_token("batch_owner", "owner_password123")
        .await;

    let f1 = upload_and_get_id(&app, &token, "batch_a.txt").await;
    let f2 = upload_and_get_id(&app, &token, "batch_b.txt").await;
    let f3 = upload_and_get_id(&app, &token, "batch_c.txt").await;

    let resp = app
        .delete_files_batch(&token, &[f1, 99999999, f2, f3])
        .await
        .expect("batch delete failed");
    assert!(resp.status().is_success());

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(body["success"], true);
    assert_eq!(body["data"]["deleted"], 3);
    assert_eq!(body["data"]["skipped"], 1);

    let items = body["data"]["items"].as_array().unwrap();
    let by_id: std::collections::HashMap<i64, String> = items
        .iter()
        .map(|i| {
            (
                i["id"].as_i64().unwrap(),
                i["status"].as_str().unwrap().to_string(),
            )
        })
        .collect();

    assert_eq!(by_id[&f1], "deleted");
    assert_eq!(by_id[&f2], "deleted");
    assert_eq!(by_id[&f3], "deleted");
    assert_eq!(by_id[&99999999], "not_found");

    wait_until_absent(&app, &token, "batch_a.txt").await;
    wait_until_absent(&app, &token, "batch_b.txt").await;
    wait_until_absent(&app, &token, "batch_c.txt").await;

    app.cleanup();
}

#[tokio::test(flavor = "multi_thread")]
async fn test_batch_delete_empty_and_duplicate_ids() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;
    app.create_owner_direct("batch_owner2", "owner_password123")
        .await;
    let token = app
        .login_and_get_token("batch_owner2", "owner_password123")
        .await;

    let empty_resp = app
        .delete_files_batch(&token, &[])
        .await
        .expect("empty batch failed");
    assert_eq!(empty_resp.status().as_u16(), 400);

    let f = upload_and_get_id(&app, &token, "batch_d.txt").await;

    let resp = app
        .delete_files_batch(&token, &[f, f, f])
        .await
        .expect("duplicate batch failed");
    assert!(resp.status().is_success());

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(
        body["data"]["deleted"], 1,
        "duplicate ids must not double-count"
    );
    assert_eq!(body["data"]["skipped"], 0);

    wait_until_absent(&app, &token, "batch_d.txt").await;

    let again = app
        .delete_files_batch(&token, &[f])
        .await
        .expect("re-delete batch failed");
    let body: Value = again.json().await.expect("invalid json");
    assert_eq!(body["data"]["deleted"], 0);
    assert_eq!(body["data"]["skipped"], 1);
    assert_eq!(body["data"]["items"][0]["status"], "not_found");

    app.cleanup();
}
