mod common;
use common::{TestApp, VisitorOptions};

#[tokio::test]
async fn e2e_get_files_filtering_and_pagination() {
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

    // Creates visitor with permissions
    let visitor_opts = VisitorOptions {
        can_access_all_files: true,
        can_download: true,
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

    let test_files = [
        ("file1", "document.txt", b"C1".as_slice()), // 2 bytes
        ("file2", "image.jpg", b"Content 22".as_slice()), // 10 bytes
        ("file3", "data.pdf", b"Content 333".as_slice()), // 11 bytes
    ];

    // Upload test files
    for (file_id, filename, data) in test_files.iter() {
        app.upload_single_chunk_file(&visitor_token, file_id, filename, data.to_vec())
            .await;
    }

    // Get all files
    let resp = app.get_files(&visitor_token, &[]).await.unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 3);

    // Get and filter files with name
    let resp = app
        .get_files(&visitor_token, &[("name", "document")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 1);

    // Get and filter files with a min-size (10 bytes or more)
    let resp = app
        .get_files(&visitor_token, &[("min_size", "10")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 2); // 10 and 11 bytes

    // Get and filter files with a max-size (10 bytes or less)
    let resp = app
        .get_files(&visitor_token, &[("max_size", "9")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 1); // 2 bytes

    // Pagination - Limits
    let resp = app
        .get_files(&visitor_token, &[("limit", "2")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 2);

    // Pagination - Offset
    let resp = app
        .get_files(&visitor_token, &[("limit", "2"), ("offset", "1")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 2);

    app.cleanup();
}
