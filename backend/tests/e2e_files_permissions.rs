mod common;
use common::{TestApp, VisitorOptions};

#[tokio::test]
async fn e2e_get_files_permissions() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    // Creates owner
    let owner_username = "owner@local.test";
    let owner_password = "OwnerPass123!";
    app.create_owner_direct(owner_username, owner_password)
        .await;
    let owner_token = app
        .login_and_get_token(owner_username, owner_password)
        .await;

    // Creates two visitors with diferents permissions
    let visitor1_opts = VisitorOptions {
        can_access_all_files: false,
        can_download: true,
        can_upload: true,
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

    let visitor2_opts = VisitorOptions {
        can_access_all_files: true,
        can_download: true,
        can_upload: true,
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

    // Upload files with diferents users
    let visitor1_file = [("file1", "doc1.txt", b"Content 1".as_slice())];
    let visitor2_file = [("file2", "doc2.txt", b"Content 2".as_slice())];

    for (file_id, filename, data) in visitor1_file.iter() {
        app.upload_single_chunk_file(&visitor1_token, file_id, filename, data.to_vec())
            .await;
    }

    for (file_id, filename, data) in visitor2_file.iter() {
        app.upload_single_chunk_file(&visitor2_token, file_id, filename, data.to_vec())
            .await;
    }

    // Visitor1 should only see their own files
    let resp = app.get_files(&visitor1_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 1);

    // Visitor2 should see all files
    let resp = app.get_files(&visitor2_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 2);

    app.cleanup();
}
