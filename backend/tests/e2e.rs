// Integration tests for the full API workflow, error handling, and pagination features
mod common;
use common::*;
use serde_json::json;
use std::time::Duration;

/// Tests the complete API workflow including database initialization, user management, file operations, and cleanup
#[tokio::test(flavor = "multi_thread")]
async fn test_full_api_workflow() {
    // Windows-specific configuration delay
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

    // Initialize database
    app.post_init_db().await;

    // Confirm database creation
    let resp = app
        .api
        .get("/api/db")
        .send()
        .await
        .expect("GET /api/db failed");
    assert!(resp.status().is_success());
    let body: serde_json::Value = resp.json().await.expect("invalid json");
    assert_eq!(body["exists"], true);

    // Phase 2: User authentication and creation
    app.create_owner_direct("test_owner", "owner_password123")
        .await;

    let owner_token = app
        .login_and_get_token("test_owner", "owner_password123")
        .await;
    assert!(!owner_token.is_empty(), "Owner token should not be empty");

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

    // Phase 3: File operations testing
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

    // Retrieve uploaded file ID for subsequent operations
    let file_id = app
        .find_file_id_by_name(&visitor_token, "test_document.txt")
        .await
        .expect("find file failed")
        .expect("file should exist after upload");

    // List files endpoint verification
    let files_resp = app
        .get_files(&visitor_token, &[("limit", "10")])
        .await
        .expect("list files failed");
    assert!(files_resp.status().is_success());

    let files_body: serde_json::Value = files_resp.json().await.expect("invalid json");
    assert!(files_body["success"].as_bool().unwrap());
    assert!(!files_body["data"]["items"].as_array().unwrap().is_empty());

    // File download functionality verification
    let downloaded_bytes = app
        .download_file_bytes(&visitor_token, file_id)
        .await
        .expect("download failed");
    assert_eq!(downloaded_bytes, file_content);

    // Phase 4: User management operations
    let users_resp = app
        .get_users_via_api(&owner_token, &[("limit", "10")])
        .await
        .expect("GET /api/users failed");
    assert!(users_resp.status().is_success());

    let users_body: serde_json::Value = users_resp.json().await.expect("invalid json");
    assert!(users_body["success"].as_bool().unwrap());
    assert!(users_body["data"]["items"].as_array().unwrap().len() >= 3);

    // Find user IDs for permission management
    let visitor_id = app
        .find_user_id_by_username(&owner_token, "test_visitor")
        .await
        .expect("find user failed")
        .expect("visitor should exist");

    let limited_visitor_id = app
        .find_user_id_by_username(&owner_token, "limited_visitor")
        .await
        .expect("find user failed")
        .expect("limited visitor should exist");

    // User activation/deactivation testing
    let toggle_resp = app
        .toggle_user_active_via_api(&owner_token, visitor_id)
        .await
        .expect("toggle user failed");
    assert!(toggle_resp.status().is_success());

    // Verify user deactivation in user list
    let users_after_toggle = app
        .list_users_page(&owner_token, &[("is_active", "false")])
        .await
        .expect("list users failed");

    let inactive_users: Vec<serde_json::Value> =
        serde_json::from_value(users_after_toggle["data"]["items"].clone()).unwrap();
    assert!(inactive_users.iter().any(|u| u["id"] == visitor_id));

    // Reactivate user for continued testing
    app.toggle_user_active_via_api(&owner_token, visitor_id)
        .await
        .expect("toggle user back failed");

    // Permission modification testing
    let perms_payload = json!({
        "can_upload": true,
        "has_upload_limits": true,
        "upload_limit": 50000
    });

    let perms_resp = app
        .update_user_perms_via_api(&owner_token, visitor_id, &perms_payload)
        .await
        .expect("update perms failed");
    assert!(perms_resp.status().is_success());

    // Phase 5: File permission management
    let grant_resp = app
        .grant_or_update_permission_via_api(&visitor_token, file_id, limited_visitor_id, "viewer")
        .await
        .expect("grant permission failed");
    assert!(grant_resp.status().is_success());

    // List file permissions to verify grant
    let perms_list = app
        .list_permissions_via_api(&visitor_token, file_id)
        .await
        .expect("list permissions failed");
    assert!(!perms_list["data"].as_array().unwrap().is_empty());

    // Verify permission enforcement through file download
    let limited_access_bytes = app
        .download_file_bytes(&limited_visitor_token, file_id)
        .await
        .expect("limited visitor should be able to download");
    assert_eq!(limited_access_bytes, file_content);

    // Permission revocation testing
    let revoke_resp = app
        .revoke_permission_via_api(&visitor_token, file_id, limited_visitor_id)
        .await
        .expect("revoke permission failed");
    assert!(revoke_resp.status().is_success());

    // Confirm permission removal from system
    app.revoke_permission_and_assert_removed(&visitor_token, file_id, limited_visitor_id)
        .await
        .expect("permission should be removed");

    // Phase 6: Multipart file upload testing with large files
    let large_content: Vec<u8> = (0..5000).map(|i| (i % 256) as u8).collect();

    let chunk_responses = app
        .upload_chunks(
            &visitor_token,
            "large_file_test",
            "large_file.bin",
            &large_content,
            1024,
        )
        .await;

    // Validate all chunk uploads succeeded
    for (i, resp) in chunk_responses.iter().enumerate() {
        assert!(
            resp.status().is_success(),
            "Chunk {} upload failed with status: {}",
            i,
            resp.status()
        );
    }

    // Verify multipart upload integrity through download comparison
    let large_file_id = app
        .find_file_id_by_name(&visitor_token, "large_file.bin")
        .await
        .expect("find large file failed")
        .expect("large file should exist");

    let downloaded_large = app
        .download_file_bytes(&visitor_token, large_file_id)
        .await
        .expect("download large file failed");
    assert_eq!(downloaded_large, large_content);

    // Phase 7: Accessible files endpoint testing
    let accessible_files = app
        .list_accessible_files(&visitor_token, visitor_id)
        .await
        .expect("get accessible files failed");

    assert!(
        accessible_files.len() >= 2,
        "Should have access to uploaded files"
    );

    let filenames: Vec<String> = accessible_files.iter().map(|f| f.name.clone()).collect();
    assert!(filenames.contains(&"test_document.txt".to_string()));
    assert!(filenames.contains(&"large_file.bin".to_string()));

    // Phase 8: Audit log verification for security tracking
    let audit_resp = app
        .get_audit_logs_via_api(&owner_token, &[("limit", "20")])
        .await
        .expect("get audit logs failed");
    assert!(audit_resp.status().is_success());

    let audit_body: serde_json::Value = audit_resp.json().await.expect("invalid json");
    assert!(audit_body["success"].as_bool().unwrap());

    // Verify specific audit events were recorded
    app.assert_audit_contains_event(&owner_token, "FILE_UPLOAD", Some(file_id))
        .await
        .expect("FILE_UPLOAD event should be in audit logs");

    // Phase 9: File deletion testing and cleanup verification
    let delete_resp = app
        .delete_file_by_id(&visitor_token, file_id)
        .await
        .expect("delete file failed");
    assert!(delete_resp.status().is_success());

    // Confirm file removal from accessible files list
    let accessible_after_delete = app
        .list_accessible_files(&visitor_token, visitor_id)
        .await
        .expect("get accessible files after delete failed");

    let filenames_after: Vec<String> = accessible_after_delete
        .iter()
        .map(|f| f.name.clone())
        .collect();
    assert!(!filenames_after.contains(&"test_document.txt".to_string()));

    // Phase 10: User deletion testing with soft delete verification
    let delete_user_resp = app
        .delete_user_via_api(&owner_token, visitor_id)
        .await
        .expect("delete user failed");
    assert!(delete_user_resp.status().is_success());

    // Verify user soft deletion in system
    let users_after_delete = app
        .list_users_page(
            &owner_token,
            &[("is_active", "false"), ("include_deleted", "true")],
        )
        .await
        .expect("list users after delete failed");

    let inactive_after: Vec<serde_json::Value> =
        serde_json::from_value(users_after_delete["data"]["items"].clone()).unwrap();
    assert!(inactive_after.iter().any(|u| u["id"] == visitor_id));

    // Phase 11: Resource cleanup after test completion
    app.cleanup();
}

/// Tests error cases, security boundaries, and permission validation
#[tokio::test(flavor = "multi_thread")]
async fn test_error_cases_and_security() {
    // Windows-specific configuration delay
    if cfg!(windows) {
        tokio::time::sleep(Duration::from_secs(2)).await;
    }

    let app = TestApp::spawn().await;
    app.post_init_db().await;

    // Setup test users for security testing
    app.create_owner_direct("security_owner", "owner_pass")
        .await;
    let owner_token = app
        .login_and_get_token("security_owner", "owner_pass")
        .await;

    app.create_visitor_via_api_as_owner(
        &owner_token,
        "security_visitor",
        "visitor_pass",
        VisitorOptions {
            can_upload: true,
            can_delete_own_files: true,
            has_upload_limits: false,
            upload_limit: 0,
        },
    )
    .await;

    let visitor_token = app
        .login_and_get_token("security_visitor", "visitor_pass")
        .await;

    // Test 1: Unauthorized access attempts without valid token
    let unauthorized_resp = app
        .api
        .get("/api/user")
        .send()
        .await
        .expect("request failed");
    assert!(unauthorized_resp.status().is_client_error());

    // Test invalid token rejection
    let invalid_token_resp = app
        .api
        .get("/api/user")
        .with_token("invalid_token")
        .send()
        .await
        .expect("request failed");
    assert!(invalid_token_resp.status().is_client_error());

    // Test 2: Permission boundary testing for role-based access
    let forbidden_resp = app
        .get_users_via_api(&visitor_token, &[])
        .await
        .expect("request failed");
    assert!(forbidden_resp.status().is_client_error());

    // Test 3: Input validation testing with excessive limits
    let excess_limit_resp = app
        .get_files(&visitor_token, &[("limit", "1000")])
        .await
        .expect("request failed");
    assert!(excess_limit_resp.status().is_success());

    // Test 4: Insufficient permission testing for upload restrictions
    app.create_visitor_via_api_as_owner(
        &owner_token,
        "no_upload_user",
        "nopass",
        VisitorOptions {
            can_upload: false,
            can_delete_own_files: false,
            has_upload_limits: false,
            upload_limit: 0,
        },
    )
    .await;

    let no_upload_token = app.login_and_get_token("no_upload_user", "nopass").await;

    let no_upload_content = b"test no permission".to_vec();
    let no_upload_resp = app
        .upload_single_chunk_file(
            &no_upload_token,
            "no_perm_file",
            "no_perm.txt",
            no_upload_content,
        )
        .await;

    assert!(no_upload_resp.status().is_client_error());

    app.cleanup();
}

/// Tests pagination functionality, filtering, and result set management
#[tokio::test(flavor = "multi_thread")]
async fn test_pagination_and_filtering() {
    // Windows-specific configuration delay
    if cfg!(windows) {
        tokio::time::sleep(Duration::from_secs(2)).await;
    }

    let app = TestApp::spawn().await;
    app.post_init_db().await;

    app.create_owner_direct("pagination_owner", "owner_pass")
        .await;
    let owner_token = app
        .login_and_get_token("pagination_owner", "owner_pass")
        .await;

    // Create multiple test users for pagination testing
    for i in 0..20 {
        let username = format!("user_{:02}", i);
        let opts = VisitorOptions {
            can_upload: i % 2 == 0,
            can_delete_own_files: true,
            has_upload_limits: false,
            upload_limit: 0,
        };

        app.create_visitor_via_api_as_owner(&owner_token, &username, "password123", opts)
            .await;
    }

    // Test 1: Basic pagination functionality with limit and offset
    let page1 = app
        .list_users_page(&owner_token, &[("limit", "5"), ("offset", "0")])
        .await
        .expect("page1 failed");

    let items_page1: Vec<serde_json::Value> =
        serde_json::from_value(page1["data"]["items"].clone()).unwrap();

    assert_eq!(items_page1.len(), 5);
    assert_eq!(page1["data"]["limit"], 5);
    assert_eq!(page1["data"]["offset"], 0);

    // Test second page retrieval
    let page2 = app
        .list_users_page(&owner_token, &[("limit", "5"), ("offset", "5")])
        .await
        .expect("page2 failed");

    let items_page2: Vec<serde_json::Value> =
        serde_json::from_value(page2["data"]["items"].clone()).unwrap();
    assert_eq!(items_page2.len(), 5);

    // Verify page separation and no overlap between result sets
    let page1_ids: Vec<i64> = items_page1
        .iter()
        .map(|u| u["id"].as_i64().unwrap())
        .collect();

    let page2_ids: Vec<i64> = items_page2
        .iter()
        .map(|u| u["id"].as_i64().unwrap())
        .collect();

    for id in page1_ids {
        assert!(!page2_ids.contains(&id), "Pages should not overlap");
    }

    // Test 2: Permission-based filtering for user attributes
    let upload_users = app
        .list_users_page(&owner_token, &[("perm", "can_upload"), ("limit", "20")])
        .await
        .expect("filter by perm failed");

    let upload_items: Vec<serde_json::Value> =
        serde_json::from_value(upload_users["data"]["items"].clone()).unwrap();

    for user in &upload_items {
        assert_eq!(user["can_upload"], 1);
    }

    // Test 3: Combined filtering with multiple parameters
    let filtered = app
        .list_users_page(&owner_token, &[("name", "user_1"), ("limit", "15")])
        .await
        .expect("combined filter failed");

    let filtered_items: Vec<serde_json::Value> =
        serde_json::from_value(filtered["data"]["items"].clone()).unwrap();

    assert!(
        !filtered_items.is_empty(),
        "Should find at least some users"
    );
    assert!(
        filtered_items.len() >= 5,
        "Should find at least 5 users matching 'user_1'"
    );

    app.cleanup();
}
