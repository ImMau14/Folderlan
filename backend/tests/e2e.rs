// Integration tests for the full API workflow, error handling, and pagination features
mod common;
use common::*;
use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;

/// Tests the complete API workflow including database initialization, user management, file operations, and cleanup
#[tokio::test(flavor = "multi_thread")]
async fn test_full_api_workflow() {
    if cfg!(windows) {
        tokio::time::sleep(Duration::from_secs(2)).await;
    }

    // Phase 1: Application and database initialization
    let app = TestApp::spawn().await;

    // Verify database does not exist initially
    let resp = app
        .api
        .get("/api/db")
        .send()
        .await
        .expect("GET /api/db failed");
    assert!(resp.status().is_success());
    let body: serde_json::Value = resp.json().await.expect("invalid json");
    assert_eq!(body["exists"], false);

    // Initialize database via API
    app.post_init_db().await;

    // Confirm database creation (tables exist, but no owner yet)
    let resp = app
        .api
        .get("/api/db")
        .send()
        .await
        .expect("GET /api/db failed");
    assert!(resp.status().is_success());
    let body: serde_json::Value = resp.json().await.expect("invalid json");
    assert_eq!(body["exists"], false);

    // Phase 2: User authentication and creation
    app.create_owner_direct("test_owner", "owner_password123")
        .await;

    let owner_token = app
        .login_and_get_token("test_owner", "owner_password123")
        .await;
    assert!(!owner_token.is_empty(), "Owner token should not be empty");

    // Phase 2.1: Test owner password change functionality
    let change_owner_resp = app
        .change_owner_password("new_owner_password123")
        .await
        .expect("Owner password change failed");
    assert!(
        change_owner_resp.status().is_success(),
        "Owner password change should succeed. Status: {}",
        change_owner_resp.status()
    );

    // Verify owner can login with new password
    let new_owner_token = app
        .login_and_get_token("test_owner", "new_owner_password123")
        .await;
    assert!(
        !new_owner_token.is_empty(),
        "New owner token should not be empty"
    );
    let owner_token = new_owner_token;

    // Create visitor with full permissions
    let visitor_opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: true,
        has_upload_limits: false,
        upload_limit: 0,
    };

    app.create_visitor_via_api_as_owner(
        &owner_token,
        "test_visitor",
        "visitor_password123",
        visitor_opts,
    )
    .await;

    let visitor_token = app
        .login_and_get_token("test_visitor", "visitor_password123")
        .await;
    assert!(
        !visitor_token.is_empty(),
        "Visitor token should not be empty"
    );

    // Phase 2.2: Test visitor password change functionality
    let change_visitor_resp = app
        .change_visitor_password(&owner_token, "test_visitor", "new_visitor_password123")
        .await
        .expect("Visitor password change failed");
    assert!(
        change_visitor_resp.status().is_success(),
        "Visitor password change should succeed. Status: {}",
        change_visitor_resp.status()
    );

    // Verify visitor can login with new password
    let new_visitor_token = app
        .login_and_get_token("test_visitor", "new_visitor_password123")
        .await;
    assert!(
        !new_visitor_token.is_empty(),
        "New visitor token should not be empty"
    );
    let visitor_token = new_visitor_token;

    // Create restricted visitor with upload limits
    let limited_visitor_opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: false,
        has_upload_limits: true,
        upload_limit: 100000,
    };

    app.create_visitor_via_api_as_owner(
        &owner_token,
        "limited_visitor",
        "limited123",
        limited_visitor_opts,
    )
    .await;

    let limited_visitor_token = app
        .login_and_get_token("limited_visitor", "limited123")
        .await;

    // Phase 3: Filesystem watcher end-to-end testing
    let watcher_test_name = "e2e_watcher_test.txt";
    let initial = b"watcher initial content".to_vec();
    let modified = b"watcher modified content".to_vec();
    let path = app.uploads_path.join(watcher_test_name);

    tokio::fs::write(&path, &initial)
        .await
        .expect("Failed to write watcher test file");

    let mut found_id: Option<i64> = None;
    for _ in 0..80 {
        if let Ok(Some(fid)) = app
            .find_file_id_by_name(&owner_token, watcher_test_name)
            .await
        {
            found_id = Some(fid);
            break;
        }
        sleep(Duration::from_millis(150)).await;
    }
    let watcher_file_id = found_id.expect("Watcher did not register created file in time");

    let got = app
        .download_file_bytes(&owner_token, watcher_file_id)
        .await
        .expect("Failed to download watcher-registered file");
    assert_eq!(got, initial, "Watcher-registered file content mismatch");

    tokio::fs::write(&path, &modified)
        .await
        .expect("Failed to modify watcher test file");

    let mut seen_modified = false;
    for _ in 0..80 {
        match app.download_file_bytes(&owner_token, watcher_file_id).await {
            Ok(bytes) if bytes == modified => {
                seen_modified = true;
                break;
            }
            _ => {
                sleep(Duration::from_millis(150)).await;
            }
        }
    }
    assert!(
        seen_modified,
        "Watcher did not pick up modified file content in time"
    );

    tokio::fs::remove_file(&path)
        .await
        .expect("Failed to remove watcher test file");

    let mut seen_deleted = false;
    for _ in 0..80 {
        if app
            .download_file_bytes(&owner_token, watcher_file_id)
            .await
            .is_err()
        {
            seen_deleted = true;
            break;
        }
        sleep(Duration::from_millis(150)).await;
    }
    assert!(seen_deleted, "Watcher did not mark file deleted in time");

    // Phase 4: File operations testing
    let file_content = b"This is a test file for the E2E test".to_vec();
    let upload_resp = app
        .upload_single_chunk_file(
            &visitor_token,
            "test_file_1",
            "test_document.txt",
            file_content.clone(),
        )
        .await;

    assert!(
        upload_resp.status().is_success(),
        "Upload should succeed. Status: {}, Body: {:?}",
        upload_resp.status(),
        upload_resp.text().await.ok()
    );

    let file_id = app
        .find_file_id_by_name(&visitor_token, "test_document.txt")
        .await
        .expect("Find file failed")
        .expect("File should exist after upload");

    let files_resp = app
        .get_files(&visitor_token, &[("limit", "10")])
        .await
        .expect("List files failed");
    assert!(files_resp.status().is_success());

    let files_body: serde_json::Value = files_resp.json().await.expect("Invalid json");
    assert!(files_body["success"].as_bool().unwrap());
    assert!(!files_body["data"]["items"].as_array().unwrap().is_empty());

    let downloaded_bytes = app
        .download_file_bytes(&visitor_token, file_id)
        .await
        .expect("Download failed");
    assert_eq!(downloaded_bytes, file_content);

    // Phase 5: User management operations
    let users_resp = app
        .get_users_via_api(&owner_token, &[("limit", "10")])
        .await
        .expect("GET /api/users failed");
    assert!(users_resp.status().is_success());

    let users_body: serde_json::Value = users_resp.json().await.expect("Invalid json");
    assert!(users_body["success"].as_bool().unwrap());
    assert!(users_body["data"]["items"].as_array().unwrap().len() >= 3);

    let visitor_id = app
        .find_user_id_by_username(&owner_token, "test_visitor")
        .await
        .expect("Find user failed")
        .expect("Visitor should exist");

    let limited_visitor_id = app
        .find_user_id_by_username(&owner_token, "limited_visitor")
        .await
        .expect("Find user failed")
        .expect("Limited visitor should exist");

    let toggle_resp = app
        .toggle_user_active_via_api(&owner_token, visitor_id)
        .await
        .expect("Toggle user failed");
    assert!(toggle_resp.status().is_success());

    let users_after_toggle = app
        .list_users_page(&owner_token, &[("is_active", "false")])
        .await
        .expect("List users failed");

    let inactive_users: Vec<serde_json::Value> =
        serde_json::from_value(users_after_toggle["data"]["items"].clone()).unwrap();
    assert!(inactive_users.iter().any(|u| u["id"] == visitor_id));

    app.toggle_user_active_via_api(&owner_token, visitor_id)
        .await
        .expect("Toggle user back failed");

    let perms_payload = json!({
        "can_upload": true,
        "has_upload_limits": true,
        "upload_limit": 50000
    });

    let perms_resp = app
        .update_user_perms_via_api(&owner_token, visitor_id, &perms_payload)
        .await
        .expect("Update perms failed");
    assert!(perms_resp.status().is_success());

    // Phase 6: File permission management
    let grant_resp = app
        .grant_or_update_permission_via_api(&visitor_token, file_id, limited_visitor_id, "viewer")
        .await
        .expect("Grant permission failed");
    assert!(grant_resp.status().is_success());

    let perms_list = app
        .list_permissions_via_api(&visitor_token, file_id)
        .await
        .expect("List permissions failed");
    assert!(!perms_list["data"].as_array().unwrap().is_empty());

    let limited_access_bytes = app
        .download_file_bytes(&limited_visitor_token, file_id)
        .await
        .expect("Limited visitor should be able to download");
    assert_eq!(limited_access_bytes, file_content);

    let revoke_resp = app
        .revoke_permission_via_api(&visitor_token, file_id, limited_visitor_id)
        .await
        .expect("Revoke permission failed");
    assert!(revoke_resp.status().is_success());

    app.revoke_permission_and_assert_removed(&visitor_token, file_id, limited_visitor_id)
        .await
        .expect("Permission should be removed");

    // Phase 7: Large file upload (single multipart request)
    let large_content: Vec<u8> = (0..5000).map(|i| (i % 256) as u8).collect();

    let large_upload_resp = app
        .upload_single_chunk_file(
            &visitor_token,
            "large_file_test",
            "large_file.bin",
            large_content.clone(),
        )
        .await;

    assert!(
        large_upload_resp.status().is_success(),
        "Large file upload should succeed. Status: {}",
        large_upload_resp.status()
    );

    let large_file_id = app
        .find_file_id_by_name(&visitor_token, "large_file.bin")
        .await
        .expect("Find large file failed")
        .expect("Large file should exist");

    let downloaded_large = app
        .download_file_bytes(&visitor_token, large_file_id)
        .await
        .expect("Download large file failed");
    assert_eq!(downloaded_large, large_content);

    // Phase 8: Accessible files endpoint testing
    let accessible_files = app
        .list_accessible_files(&visitor_token, visitor_id)
        .await
        .expect("Get accessible files failed");

    assert!(
        accessible_files.len() >= 2,
        "Should have access to uploaded files"
    );

    let filenames: Vec<String> = accessible_files.iter().map(|f| f.name.clone()).collect();
    assert!(filenames.contains(&"test_document.txt".to_string()));
    assert!(filenames.contains(&"large_file.bin".to_string()));

    // Phase 9: Audit log verification
    let audit_resp = app
        .get_audit_logs_via_api(&owner_token, &[("limit", "20")])
        .await
        .expect("Get audit logs failed");
    assert!(audit_resp.status().is_success());

    let audit_body: serde_json::Value = audit_resp.json().await.expect("Invalid json");
    assert!(audit_body["success"].as_bool().unwrap());

    app.assert_audit_contains_event(&owner_token, "FILE_UPLOAD", Some(file_id))
        .await
        .expect("FILE_UPLOAD event should be in audit logs");

    // Phase 10: File deletion
    let delete_resp = app
        .delete_file_by_id(&visitor_token, file_id)
        .await
        .expect("Delete file failed");
    assert!(delete_resp.status().is_success());

    let accessible_after_delete = app
        .list_accessible_files(&visitor_token, visitor_id)
        .await
        .expect("Get accessible files after delete failed");

    let filenames_after: Vec<String> = accessible_after_delete
        .iter()
        .map(|f| f.name.clone())
        .collect();
    assert!(!filenames_after.contains(&"test_document.txt".to_string()));

    // Phase 11: User deletion
    let delete_user_resp = app
        .delete_user_via_api(&owner_token, visitor_id)
        .await
        .expect("Delete user failed");
    assert!(delete_user_resp.status().is_success());

    let users_after_delete = app
        .list_users_page(
            &owner_token,
            &[("is_active", "false"), ("include_deleted", "true")],
        )
        .await
        .expect("List users after delete failed");

    let inactive_after: Vec<serde_json::Value> =
        serde_json::from_value(users_after_delete["data"]["items"].clone()).unwrap();
    assert!(inactive_after.iter().any(|u| u["id"] == visitor_id));

    app.cleanup();
}
