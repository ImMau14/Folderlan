mod common;
use common::{TestApp, VisitorOptions};
use serde_json::json;

#[tokio::test]
async fn delete_owner_returns_bad_request_and_message() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    // Create owner and login
    app.create_owner_direct("owner_err", "pw").await;
    let token = app.login_and_get_token("owner_err", "pw").await;

    // Get owner id (will appear as role = "owner")
    // Create a visitor to have at least one other user in the db
    let opts = VisitorOptions::default();
    app.create_visitor_via_api_as_owner(&token, "tmp_v", "pw", opts)
        .await;

    // Find owner by name (owner_err)
    let maybe_owner_id = app
        .find_user_id_by_username(&token, "owner_err")
        .await
        .unwrap();
    assert!(maybe_owner_id.is_some(), "Owner id not found");
    let owner_id = maybe_owner_id.unwrap();

    // Attempt to delete owner -> 400 with message "Cannot delete owner user"
    let resp = app
        .delete_user_via_api(&token, owner_id)
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        400,
        "Expected 400 when deleting owner"
    );

    let body: serde_json::Value = resp.json().await.expect("Invalid json body");
    assert_eq!(
        body.get("message").and_then(|m| m.as_str()),
        Some("Cannot delete owner user")
    );

    app.cleanup();
}

#[tokio::test]
async fn operations_on_nonexistent_user_return_404() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    app.create_owner_direct("owner_404", "pw").await;
    let token = app.login_and_get_token("owner_404", "pw").await;

    // Use an unlikely id (not created)
    let missing_id: i64 = 9_999_999;

    // delete -> 404 + message "User not found"
    let resp_del = app
        .delete_user_via_api(&token, missing_id)
        .await
        .expect("Delete request failed");
    assert_eq!(resp_del.status().as_u16(), 404);
    let b_del: serde_json::Value = resp_del.json().await.expect("Invalid json");
    assert_eq!(
        b_del.get("message").and_then(|m| m.as_str()),
        Some("User not found")
    );

    // toggle -> 404 + message
    let resp_toggle = app
        .toggle_user_active_via_api(&token, missing_id)
        .await
        .expect("Toggle request failed");
    assert_eq!(resp_toggle.status().as_u16(), 404);
    let b_toggle: serde_json::Value = resp_toggle.json().await.expect("Invalid json");
    assert_eq!(
        b_toggle.get("message").and_then(|m| m.as_str()),
        Some("User not found")
    );

    // update perms -> 404 + message
    let payload = json!({ "can_upload": true });
    let resp_update = app
        .update_user_perms_via_api(&token, missing_id, &payload)
        .await
        .expect("Update perms request failed");
    assert_eq!(resp_update.status().as_u16(), 404);
    let b_up: serde_json::Value = resp_update.json().await.expect("Invalid json");
    assert_eq!(
        b_up.get("message").and_then(|m| m.as_str()),
        Some("User not found")
    );

    app.cleanup();
}

#[tokio::test]
async fn auth_and_role_enforcement_for_user_routes() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    // Create owner + visitor
    app.create_owner_direct("owner_auth", "pw").await;
    let owner_token = app.login_and_get_token("owner_auth", "pw").await;

    let opts = VisitorOptions::default();
    app.create_visitor_via_api_as_owner(&owner_token, "visitor_auth", "pw", opts)
        .await;

    let visitor_token = app.login_and_get_token("visitor_auth", "pw").await;

    // Get visitor id
    let visitor_id = app
        .find_user_id_by_username(&owner_token, "visitor_auth")
        .await
        .expect("Find request failed")
        .expect("Visitor not found");

    // --- No token: expect 401 for each protected route ---
    // Build direct client calls without Authorization header
    let base = app.base_url.clone();
    let client = app.client.clone();

    // GET /api/user (list)
    let resp = client
        .get(format!("{}/api/user", base))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        401,
        "Expected 401 without token for GET /api/user"
    );

    // DELETE /api/user/{id}
    let resp = client
        .delete(format!("{}/api/user/{}", base, visitor_id))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        401,
        "Expected 401 without token for DELETE"
    );

    // POST toggle
    let resp = client
        .post(format!("{}/api/user/{}/toggle", base, visitor_id))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        401,
        "Expected 401 without token for toggle"
    );

    // POST perms
    let resp = client
        .post(format!("{}/api/user/{}/perms", base, visitor_id))
        .json(&json!({}))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        401,
        "Expected 401 without token for update perms"
    );

    // --- Visitor token (authenticated but not owner): expect 403 (role middleware) ---
    // GET /api/user
    let resp = client
        .get(format!("{}/api/user", base))
        .header("Authorization", format!("Bearer {visitor_token}"))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        403,
        "Expected 403 for GET /api/user as visitor"
    );

    // DELETE /api/user/{id}
    let resp = client
        .delete(format!("{}/api/user/{}", base, visitor_id))
        .header("Authorization", format!("Bearer {visitor_token}"))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        403,
        "Expected 403 for DELETE as visitor"
    );

    // POST toggle
    let resp = client
        .post(format!("{}/api/user/{}/toggle", base, visitor_id))
        .header("Authorization", format!("Bearer {visitor_token}"))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        403,
        "Expected 403 for toggle as visitor"
    );

    // POST perms
    let resp = client
        .post(format!("{}/api/user/{}/perms", base, visitor_id))
        .header("Authorization", format!("Bearer {visitor_token}"))
        .json(&json!({"can_upload": true}))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        403,
        "Expected 403 for update perms as visitor"
    );

    app.cleanup();
}

#[tokio::test]
async fn invalid_payload_for_update_perms_returns_400() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    app.create_owner_direct("owner_invalid", "pw").await;
    let owner_token = app.login_and_get_token("owner_invalid", "pw").await;

    // Create visitor and get id
    let opts = VisitorOptions::default();
    app.create_visitor_via_api_as_owner(&owner_token, "visitor_invalid", "pw", opts)
        .await;
    let visitor_id = app
        .find_user_id_by_username(&owner_token, "visitor_invalid")
        .await
        .expect("Find request failed")
        .expect("Visitor not found");

    // Send invalid payload: wrong types (string in boolean field)
    let bad_payload = json!({
        "can_upload": "not_a_bool",
        "upload_limit": "not_a_number"
    });

    // Use helper that adds Authorization header
    let resp = app
        .update_user_perms_via_api(&owner_token, visitor_id, &bad_payload)
        .await
        .expect("Request failed");

    // Actix / serde should return 400 Bad Request for invalid deserialization
    assert_eq!(
        resp.status().as_u16(),
        400,
        "Expected 400 for invalid JSON payload"
    );

    // Try to parse message if in ApiResponse format
    if resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .contains("application/json")
        && let Ok(body) = resp.json::<serde_json::Value>().await
    {
        // Actix might return a different body; we check for any error indication
        let msg = body
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("<no message>");
        assert!(
            !msg.is_empty(),
            "Expected an error message in response JSON"
        );
    }

    app.cleanup();
}
