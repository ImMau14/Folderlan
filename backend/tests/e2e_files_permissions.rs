mod common;
use common::{TestApp, VisitorOptions};
use sqlx::Row;

async fn user_id_by_username(app: &TestApp, username: &str) -> i64 {
    let row = sqlx::query("SELECT id FROM Users WHERE username = ?")
        .bind(username)
        .fetch_one(&app.pool)
        .await
        .expect("query user id failed");
    row.try_get::<i64, _>("id").expect("missing user id")
}

#[tokio::test]
async fn e2e_permissions_comprehensive_test() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    // Owner
    let owner_username = "owner@local.test";
    let owner_password = "OwnerPass123!";
    app.create_owner_direct(owner_username, owner_password)
        .await;
    let owner_token = app
        .login_and_get_token(owner_username, owner_password)
        .await;
    let _owner_id = user_id_by_username(&app, owner_username).await;

    // Visitor 1 (upload a file)
    let visitor1_opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: true,
        ..Default::default()
    };
    let visitor1_username = "visitor1@local.test";
    let visitor1_password = "VisitorPass123!";
    app.create_visitor_via_api_as_owner(
        &owner_token,
        visitor1_username,
        visitor1_password,
        visitor1_opts,
    )
    .await;
    let visitor1_token = app
        .login_and_get_token(visitor1_username, visitor1_password)
        .await;
    let _visitor1_id = user_id_by_username(&app, visitor1_username).await;

    // Visitor 2 (without permissions)
    let visitor2_opts = VisitorOptions {
        can_upload: false,
        can_delete_own_files: false,
        ..Default::default()
    };
    let visitor2_username = "visitor2@local.test";
    let visitor2_password = "VisitorPass123!";
    app.create_visitor_via_api_as_owner(
        &owner_token,
        visitor2_username,
        visitor2_password,
        visitor2_opts,
    )
    .await;
    let visitor2_token = app
        .login_and_get_token(visitor2_username, visitor2_password)
        .await;
    let visitor2_id = user_id_by_username(&app, visitor2_username).await;

    // Visitor 3 (with upload permissions)
    let visitor3_opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: true,
        ..Default::default()
    };
    let visitor3_username = "visitor3@local.test";
    let visitor3_password = "VisitorPass123!";
    app.create_visitor_via_api_as_owner(
        &owner_token,
        visitor3_username,
        visitor3_password,
        visitor3_opts,
    )
    .await;
    let visitor3_token = app
        .login_and_get_token(visitor3_username, visitor3_password)
        .await;
    let visitor3_id = user_id_by_username(&app, visitor3_username).await;

    // Visitor 1 uploads a file
    let file1_id_str = "file1";
    let file1_name = "doc1";
    let file1_content = b"Content 1";
    let resp = app
        .upload_single_chunk_file(
            &visitor1_token,
            file1_id_str,
            file1_name,
            file1_content.to_vec(),
        )
        .await;
    assert!(resp.status().is_success(), "visitor1 upload failed");

    // Visitor 3 uploads a file
    let file2_id_str = "file2";
    let file2_name = "doc2";
    let file2_content = b"Content 2";
    let resp = app
        .upload_single_chunk_file(
            &visitor3_token,
            file2_id_str,
            file2_name,
            file2_content.to_vec(),
        )
        .await;
    assert!(resp.status().is_success(), "visitor3 upload failed");

    // Get the real ID from the users
    let file1_id = app
        .find_file_id_by_name(&visitor1_token, file1_name)
        .await
        .expect("failed to find file1")
        .expect("file1 not found");

    let file2_id = app
        .find_file_id_by_name(&visitor3_token, file2_name)
        .await
        .expect("failed to find file2")
        .expect("file2 not found");

    // TEST 1: Only users can see their own files
    let resp = app.get_files(&visitor1_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(items.len(), 1, "visitor1 should see only their own file");
    assert_eq!(items[0]["name"].as_str().unwrap(), file1_name);

    let resp = app.get_files(&visitor2_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(
        items.len(),
        0,
        "visitor2 should see no files (no upload permission)"
    );

    let resp = app.get_files(&visitor3_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(items.len(), 1, "visitor3 should see only their own file");
    assert_eq!(items[0]["name"].as_str().unwrap(), file2_name);

    // TEST 2: Owner can see al files
    let resp = app.get_files(&owner_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(items.len(), 2, "owner should see all files");

    // TEST 3: Grant viewer permission to visitor2 on file1
    let resp = app
        .grant_or_update_permission_via_api(&visitor1_token, file1_id, visitor2_id, "viewer")
        .await
        .expect("grant permission request failed");
    assert!(resp.status().is_success(), "grant viewer permission failed");

    // Verify that visitor2 can now see file1
    let resp = app.get_files(&visitor2_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(
        items.len(),
        1,
        "visitor2 should see file1 after being granted viewer permission"
    );
    assert_eq!(items[0]["name"].as_str().unwrap(), file1_name);

    // TEST 4: Verify that viewer can download but not delete
    let resp = app.download_file(&visitor2_token, file1_id).await;
    assert!(resp.is_ok(), "viewer should be able to download");
    let bytes = app.download_file_bytes(&visitor2_token, file1_id).await;
    assert!(bytes.is_ok(), "viewer should be able to download bytes");
    assert_eq!(
        bytes.unwrap(),
        file1_content,
        "downloaded content should match"
    );

    let resp = app.delete_file_by_id(&visitor2_token, file1_id).await;
    assert!(resp.is_ok(), "viewer delete request should complete");
    let resp = resp.unwrap();
    assert_eq!(resp.status(), 403, "viewer should not be able to delete");

    // TEST 5: Grant collaborator permission to visitor3 on file1
    let resp = app
        .grant_or_update_permission_via_api(&visitor1_token, file1_id, visitor3_id, "collaborator")
        .await
        .expect("grant permission request failed");
    assert!(
        resp.status().is_success(),
        "grant collaborator permission failed"
    );

    // TEST 6: Verify that collaborator can download and delete
    let resp = app.download_file(&visitor3_token, file1_id).await;
    assert!(resp.is_ok(), "collaborator should be able to download");

    let resp = app.delete_file_by_id(&visitor3_token, file1_id).await;
    assert!(resp.is_ok(), "collaborator delete request should complete");
    let resp = resp.unwrap();
    assert!(
        resp.status().is_success(),
        "collaborator delete should succeed"
    );

    // TEST 7: Verify that the file was deleted
    let resp = app.get_files(&visitor1_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(items.len(), 0, "file1 should be deleted");

    // TEST 8: List file permissions
    let resp = app
        .list_permissions_via_api(&visitor3_token, file2_id)
        .await;
    assert!(resp.is_ok(), "should be able to list permissions");
    let permissions = resp.unwrap();
    assert!(
        permissions["data"].is_array(),
        "permissions should be an array"
    );

    // TEST 9: Revoke permissions
    // First grant visitor2 permission on file2
    let resp = app
        .grant_or_update_permission_via_api(&visitor3_token, file2_id, visitor2_id, "viewer")
        .await
        .expect("grant permission request failed");
    assert!(resp.status().is_success(), "grant viewer permission failed");

    // Verify that visitor2 can see file2
    let resp = app.get_files(&visitor2_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(
        items.len(),
        1,
        "visitor2 should see file2 after being granted permission"
    );

    // Revoke permission
    let resp = app
        .revoke_permission_via_api(&visitor3_token, file2_id, visitor2_id)
        .await;
    assert!(resp.is_ok(), "revoke permission should succeed");
    let resp = resp.unwrap();
    assert!(
        resp.status().is_success(),
        "revoke permission should return success status"
    );

    // Verify that visitor2 can no longer see file2
    let resp = app.get_files(&visitor2_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    let items = body["data"]["items"].as_array().unwrap();
    assert_eq!(
        items.len(),
        0,
        "visitor2 should not see file2 after permission revocation"
    );

    // TEST 10: Unauthorized Attempts
    // Visitor2 attempts to grant itself permission (should return 403)
    let resp = app
        .grant_or_update_permission_via_api(&visitor2_token, file2_id, visitor2_id, "viewer")
        .await
        .expect("request should complete");
    assert_eq!(
        resp.status(),
        403,
        "visitor2 should not be able to grant permissions"
    );

    // Visitor2 attempts to revoke a permission (should return 403)
    let resp = app
        .revoke_permission_via_api(&visitor2_token, file2_id, visitor3_id)
        .await
        .expect("request should complete");
    assert_eq!(
        resp.status(),
        403,
        "visitor2 should not be able to revoke permissions"
    );

    app.cleanup();
}

#[tokio::test]
async fn e2e_permissions_edge_cases() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    // Basic setup
    let owner_username = "owner@local.test";
    let owner_password = "OwnerPass123!";
    app.create_owner_direct(owner_username, owner_password)
        .await;
    let owner_token = app
        .login_and_get_token(owner_username, owner_password)
        .await;

    let visitor_opts = VisitorOptions {
        can_upload: true,
        ..Default::default()
    };
    let visitor_username = "visitor@local.test";
    let visitor_password = "VisitorPass123!";
    app.create_visitor_via_api_as_owner(
        &owner_token,
        visitor_username,
        visitor_password,
        visitor_opts,
    )
    .await;
    let visitor_token = app
        .login_and_get_token(visitor_username, visitor_password)
        .await;
    let visitor_id = user_id_by_username(&app, visitor_username).await;

    // Upload a file
    let file_id_str = "test_file";
    let file_name = "test";
    let file_content = b"Test content";
    let resp = app
        .upload_single_chunk_file(
            &visitor_token,
            file_id_str,
            file_name,
            file_content.to_vec(),
        )
        .await;
    assert!(resp.status().is_success(), "upload failed");

    let file_id = app
        .find_file_id_by_name(&visitor_token, file_name)
        .await
        .expect("failed to find file")
        .expect("file not found");

    // TEST 1: Grant permission to a non-existent user (should return 404)
    let resp = app
        .grant_or_update_permission_via_api(&visitor_token, file_id, 9999, "viewer")
        .await
        .expect("request should complete");
    assert_eq!(
        resp.status(),
        404,
        "grant to non-existent user should return 404"
    );

    // TEST 2: Grant permission with invalid access level (should return 400)
    let resp = app
        .grant_or_update_permission_via_api(&visitor_token, file_id, visitor_id, "invalid_level")
        .await
        .expect("request should complete");
    assert_eq!(
        resp.status(),
        400,
        "grant with invalid access level should return 400"
    );

    // TEST 3: Grant permission to a non-existent file (should return 404)
    let resp = app
        .grant_or_update_permission_via_api(&visitor_token, 9999, visitor_id, "viewer")
        .await
        .expect("request should complete");
    assert_eq!(
        resp.status(),
        404,
        "grant for non-existent file should return 404"
    );

    // TEST 4: Owner can manage permissions of any file
    let resp = app
        .grant_or_update_permission_via_api(&owner_token, file_id, visitor_id, "viewer")
        .await
        .expect("request should complete");
    assert!(
        resp.status().is_success(),
        "owner permission grant should succeed"
    );

    app.cleanup();
}
