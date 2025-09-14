mod common;
use chrono::Utc;
use common::{TestApp, VisitorOptions};
use tracing::info;

use sqlx::Row;
use std::path::PathBuf;
use tokio::fs;

#[tokio::test]
async fn delete_file_with_permission() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    app.create_owner_direct("owner1", "password").await;
    let owner_token = app.login_and_get_token("owner1", "password").await;

    let visitor_opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: true,
        has_upload_limits: false,
        upload_limit: 0,
    };
    app.create_visitor_via_api_as_owner(&owner_token, "visitor1", "vpass", visitor_opts.clone())
        .await;

    let visitor_token = app.login_and_get_token("visitor1", "vpass").await;

    let filename = format!(
        "test-file-{}.txt",
        Utc::now().timestamp_nanos_opt().unwrap()
    );

    let content = b"Hello world for testing".to_vec();
    let upload_resp = app
        .upload_single_chunk_file(&visitor_token, "fileid-1", &filename, content.clone())
        .await;

    assert!(
        upload_resp.status().is_success(),
        "upload expected success, got {}",
        upload_resp.status()
    );

    let maybe_id = app
        .find_file_id_by_name(&visitor_token, &filename)
        .await
        .expect("find_file_id_by_name request failed");
    let file_id = maybe_id.expect("uploaded file not found by name");

    let row = sqlx::query("SELECT internal_path, is_deleted FROM Files WHERE id = ?")
        .bind(file_id)
        .fetch_one(&app.pool)
        .await
        .expect("select file row failed");

    let internal_path: String = row.try_get("internal_path").expect("read internal_path");
    let is_deleted_before: i64 = row.try_get("is_deleted").expect("read is_deleted");

    assert_eq!(
        is_deleted_before, 0,
        "file should not be deleted before DELETE"
    );

    let full_path = if internal_path.starts_with('/') {
        PathBuf::from(&internal_path)
    } else {
        app.uploads_path.join(&internal_path)
    };

    assert!(
        fs::metadata(&full_path).await.is_ok(),
        "physical file should exist before deletion: {full_path:?}"
    );

    let resp = app
        .delete_file_by_id(&visitor_token, file_id)
        .await
        .expect("delete request failed");

    assert!(
        resp.status().is_success(),
        "delete expected 2xx, got {}",
        resp.status()
    );

    let row_after = sqlx::query("SELECT is_deleted, internal_path FROM Files WHERE id = ?")
        .bind(file_id)
        .fetch_one(&app.pool)
        .await
        .expect("select file row after delete failed");

    let is_deleted_after: i64 = row_after
        .try_get("is_deleted")
        .expect("read is_deleted after");

    assert_eq!(is_deleted_after, 1, "file should be marked deleted in DB");

    let internal_path_after: String = row_after
        .try_get("internal_path")
        .expect("read internal_path after");

    let full_path_after = if internal_path_after.starts_with('/') {
        PathBuf::from(&internal_path_after)
    } else {
        app.uploads_path.join(&internal_path_after)
    };

    match fs::metadata(&full_path_after).await {
        Ok(_) => panic!("file should be removed from disk but still exists: {full_path_after:?}"),
        Err(_) => {
            info!("physical file removed as expected: {:?}", full_path_after);
        }
    }

    app.cleanup();
}

#[tokio::test]
async fn delete_file_without_permission_forbidden() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    app.create_owner_direct("owner2", "password").await;
    let owner_token = app.login_and_get_token("owner2", "password").await;

    let visitor_opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: false,
        has_upload_limits: false,
        upload_limit: 0,
    };

    app.create_visitor_via_api_as_owner(&owner_token, "visitor2", "vpass2", visitor_opts.clone())
        .await;

    let visitor_token = app.login_and_get_token("visitor2", "vpass2").await;

    let filename = format!(
        "test-file-no-delete-{}.txt",
        Utc::now().timestamp_nanos_opt().unwrap()
    );

    let content = b"Hello world for delete testing".to_vec();
    let upload_resp = app
        .upload_single_chunk_file(&visitor_token, "fileid-2", &filename, content.clone())
        .await;

    assert!(
        upload_resp.status().is_success(),
        "upload expected success, got {}",
        upload_resp.status()
    );

    let maybe_id = app
        .find_file_id_by_name(&visitor_token, &filename)
        .await
        .expect("find_file_id_by_name request failed");

    let file_id = maybe_id.expect("uploaded file not found by name");

    let resp_result = app.delete_file_by_id(&visitor_token, file_id).await;

    match resp_result {
        Ok(resp) => {
            assert_eq!(
                resp.status().as_u16(),
                403,
                "expected 403 Forbidden when deleting without permission, got {}",
                resp.status()
            );

            let row = sqlx::query("SELECT is_deleted FROM Files WHERE id = ?")
                .bind(file_id)
                .fetch_one(&app.pool)
                .await
                .expect("select file row failed");
            let is_deleted: i64 = row.try_get("is_deleted").expect("read is_deleted");
            assert_eq!(is_deleted, 0, "file should NOT be marked deleted in DB");
        }
        Err(e) => panic!("delete request failed unexpectedly: {e}"),
    }

    app.cleanup();
}
