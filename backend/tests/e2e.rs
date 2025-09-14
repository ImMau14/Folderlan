mod common;
use chrono::Utc;
use common::{TestApp, VisitorOptions};
use reqwest::Response;
use tracing::{error, info};

/// Expected result for an upload operation
#[derive(Clone, Copy, Debug)]
enum Expectation {
    Success,
    Failure,
}

/// Test scenario for a visitor
struct UploadScenario {
    name: &'static str,
    visitor_opts: VisitorOptions,
    expect_single: Expectation,
    expect_multi: Expectation,
    expect_lote: Expectation,
    expect_create_user: Expectation,
}

/// Upload helpers that return Response(s) for the assert to handle
async fn try_upload_single(
    app: &TestApp,
    token: &str,
    file_id: &str,
    filename: &str,
    data: Vec<u8>,
) -> Response {
    app.upload_single_chunk_file(token, file_id, filename, data)
        .await
}

async fn try_upload_multi(
    app: &TestApp,
    token: &str,
    file_id: &str,
    filename: &str,
    data: Vec<u8>,
    chunk_size: usize,
) -> Vec<Response> {
    app.upload_chunks(token, file_id, filename, &data, chunk_size)
        .await
}

async fn try_upload_lote(
    app: &TestApp,
    token: &str,
    files: Vec<(String, String, Vec<u8>)>,
    chunk_size: usize,
) -> Vec<Vec<Response>> {
    app.upload_lote(token, files, chunk_size).await
}

/// Invokes the TestApp helper that expects Option<&str> correctly
async fn try_create_user_as(
    app: &TestApp,
    token_opt: Option<&str>,
    username: &str,
    password: &str,
) -> Result<Response, reqwest::Error> {
    app.try_create_user_via_api(token_opt, username, password, None)
        .await
}

/// Centralized Asserts: Compare expectation with response (success/failure) and record details.
async fn assert_expected_single(resp: Response, expectation: Expectation, context: &str) {
    let status = resp.status();
    let is_success = status.is_success();

    match expectation {
        Expectation::Success => {
            if !is_success {
                let body = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
                error!(
                    "EXPECTED SUCCESS but failed for {}: status={} body={}",
                    context, status, body
                );
            }
            assert!(is_success, "{context}: expected success");
        }
        Expectation::Failure => {
            if is_success {
                let body = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
                error!(
                    "EXPECTED FAILURE but succeeded for {}: status=200+ body={}",
                    context, body
                );
            }
            assert!(!is_success, "{context}: expected failure");
        }
    }
}

async fn assert_expected_many(resps: Vec<Response>, expectation: Expectation, context: &str) {
    for (i, resp) in resps.into_iter().enumerate() {
        let s = format!("{context} (chunk {i})");
        assert_expected_single(resp, expectation, &s).await;
    }
}

async fn assert_expected_lote(resps: Vec<Vec<Response>>, expectation: Expectation, context: &str) {
    for (fi, file_resps) in resps.into_iter().enumerate() {
        for (ci, resp) in file_resps.into_iter().enumerate() {
            let s = format!("{context} (file {fi} chunk {ci})");
            assert_expected_single(resp, expectation, &s).await;
        }
    }
}

/// Centralized, data-driven testing
#[tokio::test]
async fn e2e_upload_permissions_and_limits_data_driven() {
    let app = TestApp::spawn().await;

    // owner credentials (const)
    let owner_username = "owner@local.test";
    let owner_password = "OwnerPass123!";

    // ---------- Single initialization: DB + owner ----------
    info!("Initializing DB once and creating owner...");
    app.post_init_db().await;

    // Create owner directly (common helper)
    app.create_owner_direct(owner_username, owner_password)
        .await;

    // Owner login to obtain reusable token in all scenarios
    let owner_token = app
        .login_and_get_token(owner_username, owner_password)
        .await;

    // ---------- Scenarios: add or modify here to extend tests ----------
    let scenarios = vec![
        UploadScenario {
            name: "visitor_no_upload_permission",
            visitor_opts: VisitorOptions {
                can_upload: false,
                can_delete_own_files: false,
                has_upload_limits: false,
                upload_limit: 0,
            },
            expect_single: Expectation::Failure,
            expect_multi: Expectation::Failure,
            expect_lote: Expectation::Failure,
            expect_create_user: Expectation::Failure,
        },
        UploadScenario {
            name: "visitor_unlimited_upload",
            visitor_opts: VisitorOptions {
                can_upload: true,
                can_delete_own_files: false,
                has_upload_limits: false,
                upload_limit: 0,
            },
            expect_single: Expectation::Success,
            expect_multi: Expectation::Success,
            expect_lote: Expectation::Success,
            expect_create_user: Expectation::Failure,
        },
        UploadScenario {
            name: "visitor_with_small_limit",
            visitor_opts: VisitorOptions {
                can_upload: true,
                can_delete_own_files: false,
                has_upload_limits: true,
                upload_limit: 5, // 5 bytes
            },
            expect_single: Expectation::Failure,
            expect_multi: Expectation::Failure,
            expect_lote: Expectation::Failure,
            expect_create_user: Expectation::Failure,
        },
        UploadScenario {
            name: "visitor_with_sufficient_limit",
            visitor_opts: VisitorOptions {
                can_upload: true,
                can_delete_own_files: false,
                has_upload_limits: true,
                upload_limit: 1024 * 10, // 10 KiB
            },
            expect_single: Expectation::Success,
            expect_multi: Expectation::Success,
            expect_lote: Expectation::Success,
            expect_create_user: Expectation::Failure,
        },
    ];

    // For each scenario: create visitor (via owner), execute actions and check expectations
    for scenario in scenarios.into_iter() {
        info!("--- Running scenario: {} ---", scenario.name);

        // Unique visitor per scenario to avoid collisions
        let ts = Utc::now().timestamp_nanos_opt().unwrap();
        let visitor_username = format!("{}-{}@local.test", scenario.name, ts);
        let visitor_password = "VisitorPass123!";

        // Create the visitor via API as owner using the token already obtained
        info!("Owner creating visitor '{}' via API...", visitor_username);
        app.create_visitor_via_api_as_owner(
            &owner_token,
            &visitor_username,
            visitor_password,
            scenario.visitor_opts,
        )
        .await;

        // Visitor login to get token — this will only work if the creation was successful.
        // If the login fails, login_and_get_token should propagate the error or return an empty token.
        let visitor_token = app
            .login_and_get_token(&visitor_username, visitor_password)
            .await;

        // Simple extra check: non-empty token
        assert!(
            !visitor_token.is_empty(),
            "visitor login returned empty token — visitor creation may have failed"
        );

        // Try to create user as visitor (permission)
        match try_create_user_as(&app, Some(visitor_token.as_str()), "malicious@local", "X").await {
            Ok(resp) => {
                assert_expected_single(resp, scenario.expect_create_user, "create_user_as_visitor")
                    .await;
            }
            Err(e) => {
                // If the call failed at the request level (timeout, conn), we allow the test to continue
                error!("try_create_user_as errored: {:?}", e);
                if let Expectation::Success = scenario.expect_create_user {
                    panic!(
                        "Expected create_user to succeed but request-level error occurred: {e:?}"
                    );
                }
            }
        }

        // Single-chunk upload
        let file_id_single = format!(
            "single-{}-{}",
            scenario.name,
            Utc::now().timestamp_nanos_opt().unwrap()
        );
        let data_single = b"This is single chunk test data".to_vec(); // ~30 bytes
        let resp_single = try_upload_single(
            &app,
            &visitor_token,
            &file_id_single,
            "one.txt",
            data_single.clone(),
        )
        .await;
        assert_expected_single(resp_single, scenario.expect_single, "upload_single").await;

        // Multi-chunk upload
        let file_id_multi = format!(
            "multi-{}-{}",
            scenario.name,
            Utc::now().timestamp_nanos_opt().unwrap()
        );
        let data_multi =
            b"The quick brown fox jumps over the lazy dog - multi-chunk test.".to_vec();
        let multi_resps = try_upload_multi(
            &app,
            &visitor_token,
            &file_id_multi,
            "two.txt",
            data_multi.clone(),
            10,
        )
        .await;
        assert_expected_many(multi_resps, scenario.expect_multi, "upload_multi").await;

        // Batch upload (2 files: one small and one medium)
        let lote = vec![
            (
                format!(
                    "lote-{}-1-{}",
                    scenario.name,
                    Utc::now().timestamp_nanos_opt().unwrap()
                ),
                "ls1.txt".to_string(),
                b"Lote small 1".to_vec(),
            ),
            (
                format!(
                    "lote-{}-2-{}",
                    scenario.name,
                    Utc::now().timestamp_nanos_opt().unwrap()
                ),
                "lm1.txt".to_string(),
                b"This is a bigger file for lote upload test".to_vec(),
            ),
        ];
        let lote_resps = try_upload_lote(&app, &visitor_token, lote, 10).await;
        assert_expected_lote(lote_resps, scenario.expect_lote, "upload_lote").await;

        info!("--- Scenario {} done ---", scenario.name);
    }

    // Finally: verify that /api/files/upload is protected without auth (global)
    verify_files_upload_protected(&app).await;

    app.cleanup();
}

async fn verify_files_upload_protected(app: &TestApp) {
    info!("Verifying /api/files/upload is protected (no-auth)...");
    let files_url = format!("{}/api/files/upload", &app.base_url);
    let resp_no_auth = app
        .client
        .post(&files_url)
        .send()
        .await
        .expect("files no-auth failed");

    let status = resp_no_auth.status().as_u16();

    if status == 200 {
        let body = resp_no_auth
            .text()
            .await
            .unwrap_or_else(|_| "<no-body>".into());
        error!("/api/files/upload returned 200 without auth. body={}", body);
    }
    assert_ne!(status, 200, "/api/files/upload must be protected");
}
