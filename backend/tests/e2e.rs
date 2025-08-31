mod common;
use common::TestApp;

#[tokio::test]
async fn e2e_all_upload_combinations() {
    let app = TestApp::spawn().await;

    // Init DB
    app.post_init_db().await;

    // Create owner and visitor
    let owner_username = "owner@local.test";
    let owner_password = "OwnerPass123!";
    app.create_owner_direct(owner_username, owner_password)
        .await;
    let owner_token = app
        .login_and_get_token(owner_username, owner_password)
        .await;

    let visitor_username = "visitor@local.test";
    let visitor_password = "VisitorPass123!";
    app.create_visitor_via_api_as_owner(&owner_token, visitor_username, visitor_password, true)
        .await;
    let visitor_token = app
        .login_and_get_token(visitor_username, visitor_password)
        .await;

    // Ensure visitor cannot create users
    match app
        .try_create_user_via_api(&visitor_token, "attacker@local", "X")
        .await
    {
        Ok(resp) => assert_ne!(resp.status().as_u16(), 201),
        Err(_e) => {}
    }

    // Verify DB reachable
    let resp = app
        .client
        .get(format!("{}/api/db", &app.base_url))
        .send()
        .await
        .expect("GET /api/db failed");
    assert_eq!(resp.status().as_u16(), 200);

    // Single-chunk upload
    let file_id_single = format!(
        "single-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    );
    let resp_single = app
        .upload_single_chunk_file(
            &visitor_token,
            &file_id_single,
            "one.txt",
            b"single chunk data".to_vec(),
        )
        .await;
    assert!(resp_single.status().is_success());

    // Multi-chunk upload
    let file_id_multi = format!(
        "multi-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    );
    let data_multi = b"The quick brown fox jumps over the lazy dog - multi-chunk test.".to_vec();
    let multi_resps = app
        .upload_chunks(&visitor_token, &file_id_multi, "two.txt", &data_multi, 10)
        .await;
    for (i, resp) in multi_resps.into_iter().enumerate() {
        assert!(resp.status().is_success(), "multi chunk {i} failed");
    }

    // Lote upload (single-chunk files)
    let lote_single_files = vec![
        (
            format!(
                "lote-single-1-{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap()
            ),
            "ls1.txt".to_string(),
            b"Lote single file 1".to_vec(),
        ),
        (
            format!(
                "lote-single-2-{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap()
            ),
            "ls2.txt".to_string(),
            b"Lote single file 2".to_vec(),
        ),
    ];
    let lote_single_resps = app
        .upload_lote(&visitor_token, lote_single_files, 1024)
        .await;
    for (fi, file_resps) in lote_single_resps.into_iter().enumerate() {
        for (ci, resp) in file_resps.into_iter().enumerate() {
            assert!(
                resp.status().is_success(),
                "lote single file {fi} chunk {ci} failed"
            );
        }
    }

    // Lote upload (multi-chunk files)
    let lote_multi_files = vec![
        (
            format!(
                "lote-multi-1-{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap()
            ),
            "lm1.txt".to_string(),
            b"This is a bigger file to ensure chunked upload 1.".to_vec(),
        ),
        (
            format!(
                "lote-multi-2-{}",
                chrono::Utc::now().timestamp_nanos_opt().unwrap()
            ),
            "lm2.txt".to_string(),
            b"This is another bigger file to ensure chunked upload 2.".to_vec(),
        ),
    ];
    let lote_multi_resps = app.upload_lote(&visitor_token, lote_multi_files, 10).await;
    for (fi, file_resps) in lote_multi_resps.into_iter().enumerate() {
        for (ci, resp) in file_resps.into_iter().enumerate() {
            assert!(
                resp.status().is_success(),
                "lote multi file {fi} chunk {ci} failed"
            );
        }
    }

    // Verify /api/files is protected
    let files_url = format!("{}/api/files", &app.base_url);
    let resp_no_auth = app
        .client
        .post(&files_url)
        .send()
        .await
        .expect("files no-auth failed");
    assert_ne!(resp_no_auth.status().as_u16(), 200);

    app.cleanup();
}
