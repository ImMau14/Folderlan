pub mod common;
use common::{AuditLogRow, TestApp, VisitorOptions};
use std::time::Duration;

/// Integration test for the audit logs controller.
///
/// Flow:
/// 1. Spawn the test app.
/// 2. Initialize the DB.
/// 3. Create an owner directly and obtain a token.
/// 4. Create a visitor via API as the owner and obtain the visitor token.
/// 5. Upload a single-chunk file with the visitor.
/// 6. Find the file_id by name.
/// 7. As owner query /api/audit filtering by file_id until finding an entry
///    related to the upload.
/// 8. Clean up resources.
#[tokio::test]
async fn test_audit_logs_contains_file_upload_entry() {
    // Spawn the test application
    let app = TestApp::spawn().await;

    // Ensure the schema/DB is initialized
    app.post_init_db().await;

    // Create owner directly in DB and login to get a token
    let owner_username = "owner_audit";
    let owner_password = "ownerpass";
    app.create_owner_direct(owner_username, owner_password)
        .await;
    let owner_token = app
        .login_and_get_token(owner_username, owner_password)
        .await;

    // Create a visitor via API (owner creates visitor)
    let visitor_username = "visitor_audit";
    let visitor_password = "visitorpass";
    let visitor_opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: true,
        has_upload_limits: false,
        upload_limit: 0,
    };
    app.create_visitor_via_api_as_owner(
        &owner_token,
        visitor_username,
        visitor_password,
        visitor_opts,
    )
    .await;

    // Visitor login
    let visitor_token = app
        .login_and_get_token(visitor_username, visitor_password)
        .await;

    // Upload a single-chunk file with the visitor
    let file_id_str = format!(
        "audit_test_file_{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    );
    let filename = "audit_test.txt";
    let file_bytes = b"hello audit log".to_vec();

    let upload_resp = app
        .upload_single_chunk_file(&visitor_token, &file_id_str, filename, file_bytes)
        .await;

    if !upload_resp.status().is_success() {
        let status = upload_resp.status();
        let body = upload_resp
            .text()
            .await
            .unwrap_or_else(|_| "<no-body>".into());
        panic!("upload failed status={} body={}", status, body);
    }

    assert!(
        upload_resp.status().is_success(),
        "upload failed status={}",
        upload_resp.status()
    );

    // Find the real file_id from GET /api/files (the app assigns a numeric id)
    let found_file_id = app
        .find_file_id_by_name(&visitor_token, filename)
        .await
        .expect("find_file_id_by_name failed")
        .expect("file not found after upload");

    // Polling: since the audit log might take a bit, we retry repeatedly.
    let mut attempts = 0usize;
    let max_attempts = 10usize;
    let mut found = None::<AuditLogRow>;

    while attempts < max_attempts {
        attempts += 1;

        // Request audit logs as owner (route protected for owner)
        let rows = app
            .fetch_audit_log_rows(
                &owner_token,
                &[("file_id", &found_file_id.to_string()), ("limit", "100")],
            )
            .await
            .expect("fetch_audit_log_rows failed");

        // Search for an entry that references the filename or the file_id
        for r in rows.into_iter() {
            // Tolerant conditions: exact filename, or file_id match, or description contains filename
            let matches_file_name = r.file_name.as_deref() == Some(filename);
            let matches_file_id = r.file_id == Some(found_file_id);
            let desc_contains = r
                .description
                .as_deref()
                .map(|d| d.contains(filename))
                .unwrap_or(false);

            if matches_file_name || matches_file_id || desc_contains {
                found = Some(r);
                break;
            }
        }

        if found.is_some() {
            break;
        }

        // Exponential-ish backoff wait (same strategy as in TestApp)
        tokio::time::sleep(Duration::from_millis(200 * attempts as u64)).await;
    }

    // Final assertion: an audit entry related to the upload must have been found
    match found {
        Some(row) => {
            // Basic checks on the row
            assert_eq!(
                row.file_id,
                Some(found_file_id),
                "audit row file_id mismatch (expected Some({}))",
                found_file_id
            );
            // Event type may vary by implementation; check it's not empty.
            assert!(
                !row.event_type.is_empty(),
                "audit row event_type empty for row id={}",
                row.id
            );
        }
        None => panic!(
            "no audit log found for uploaded file id={} after {} attempts",
            found_file_id, max_attempts
        ),
    }

    // Cleanup resources (DB and temporary uploads)
    app.cleanup();
}
