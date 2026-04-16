// tests/common/test_app.rs
use super::api_client::ApiClient;
use super::test_db::{cleanup_db, create_test_db};
use super::test_fs::{cleanup_uploads_dir, create_test_uploads_dir};
use super::test_server::spawn_test_server;
use reqwest::{
    Response,
    multipart::{Form, Part},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::sleep;

// -----------------------------------------------------------------------------
// DATA STRUCTURES
// -----------------------------------------------------------------------------

#[derive(Debug, Deserialize, Clone, Serialize)]
pub struct AccessibleFile {
    pub id: i64,
    pub name: String,
    pub size_bytes: i64,
    pub mime_type: Option<String>,
    pub uploaded_by: i64,
    pub uploaded_at: String,
    pub access_type: String,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct PermissionRow {
    pub user_id: i64,
    pub username: Option<String>,
    pub access_level: String,
    pub granted_at: String,
    pub granted_by: Option<i64>,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct AuditLogRow {
    pub id: i64,
    pub timestamp: String,
    pub user_id: Option<i64>,
    pub username: Option<String>,
    pub event_type: String,
    pub description: Option<String>,
    pub ip_address: Option<String>,
    pub file_id: Option<i64>,
    pub file_name: Option<String>,
    pub success: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct VisitorOptions {
    pub can_upload: bool,
    pub can_delete_own_files: bool,
    pub has_upload_limits: bool,
    pub upload_limit: u64,
}

// -----------------------------------------------------------------------------
// MAIN TEST APPLICATION
// -----------------------------------------------------------------------------

pub struct TestApp {
    pub api: ApiClient,
    pub db_path: PathBuf,
    pub uploads_path: PathBuf,
    pub pool: SqlitePool,
    _server_handle: tokio::task::JoinHandle<()>, // keep server alive
}

impl TestApp {
    // -------------------------------------------------------------------------
    // INITIALIZATION & SETUP
    // -------------------------------------------------------------------------

    pub async fn spawn() -> Self {
        let _ = tracing_subscriber::fmt::try_init();

        // Create temporary resources
        let (pool, db_path) = create_test_db().await;
        let uploads_path = create_test_uploads_dir();

        // Start server
        let jwt_secret = "test_secret_for_tests".to_string();
        let (base_url, server_handle) =
            spawn_test_server(pool.clone(), uploads_path.clone(), jwt_secret).await;

        let api = ApiClient::new(base_url).with_timeout(Duration::from_secs(30));
        Self::wait_for_server_ready(&api).await;

        TestApp {
            api,
            db_path,
            uploads_path,
            pool,
            _server_handle: server_handle,
        }
    }

    async fn wait_for_server_ready(api: &ApiClient) {
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(30);

        loop {
            if start.elapsed() > timeout {
                panic!("server did not become ready in time");
            }

            // Use GET /api/db to check server responsiveness
            match api.get("/api/db").send().await {
                Ok(_) => break,
                Err(e) => {
                    eprintln!("Server not ready yet: {}", e);
                    sleep(Duration::from_millis(500)).await;
                }
            }
        }
    }

    /// Initialize database via API endpoint (mimics user action)
    pub async fn post_init_db(&self) {
        let resp = self
            .api
            .post("/api/db")
            .send()
            .await
            .expect("POST /api/db failed");

        assert!(
            resp.status().is_success(),
            "POST /api/db status: {}",
            resp.status()
        );
    }

    // -------------------------------------------------------------------------
    // AUTHENTICATION & USER MANAGEMENT
    // -------------------------------------------------------------------------

    pub async fn create_owner_direct(&self, username: &str, password: &str) {
        use backend::utils::db::{
            RegisterPayload, register_user, register_user::RegisterOwnerPayload,
        };

        let payload = RegisterPayload::Owner(RegisterOwnerPayload {
            username: username.to_string(),
            password: password.to_string(),
        });
        let resp = register_user(&self.pool, payload).await;
        assert_eq!(resp.status().as_u16(), 201);
    }

    pub async fn login_and_get_token(&self, username: &str, password: &str) -> String {
        let resp = self
            .send_request_with_retry(
                || {
                    self.api.post("/api/auth/login").with_json(
                        &serde_json::json!({ "username": username, "password": password }),
                    )
                },
                5,
            )
            .await
            .expect("login request failed after retries");

        assert!(
            resp.status().is_success(),
            "Login failed with status: {}",
            resp.status()
        );
        let body: Value = resp.json().await.expect("invalid json from login");
        body["token"].as_str().expect("token missing").to_owned()
    }

    pub async fn create_visitor_via_api_as_owner(
        &self,
        owner_token: &str,
        username: &str,
        password: &str,
        opts: VisitorOptions,
    ) {
        let payload = self.build_visitor_register_payload(username, password, &opts);

        let resp = self
            .send_request_with_retry(
                || {
                    self.api
                        .post("/api/auth/register")
                        .with_token(owner_token)
                        .with_json(&payload)
                },
                6,
            )
            .await
            .expect("owner create visitor failed after retries");

        assert_eq!(
            resp.status().as_u16(),
            201,
            "owner create visitor expected 201, got {}",
            resp.status()
        );
    }

    pub async fn change_owner_password(&self, new_password: &str) -> Result<Response, String> {
        let payload = serde_json::json!({ "password": new_password });
        self.api
            .post("api/auth/owner_reset_password")
            .with_json(&payload)
            .send()
            .await
            .map_err(|e| format!("owner password change failed: {e}"))
    }

    pub async fn change_visitor_password(
        &self,
        owner_token: &str,
        visitor_username: &str,
        new_password: &str,
    ) -> Result<Response, String> {
        let payload = serde_json::json!({
            "username": visitor_username,
            "password": new_password
        });
        self.api
            .post("api/auth/visitor_reset_password")
            .with_token(owner_token)
            .with_json(&payload)
            .send()
            .await
            .map_err(|e| format!("visitor password change failed: {e}"))
    }

    // -------------------------------------------------------------------------
    // FILE OPERATIONS
    // -------------------------------------------------------------------------

    /// Upload a complete file in a single multipart request.
    /// The new backend expects a field named "file" containing the file.
    pub async fn upload_single_chunk_file(
        &self,
        visitor_token: &str,
        _file_id: &str, // kept for backward compatibility, ignored
        filename: &str,
        file_bytes: Vec<u8>,
    ) -> Response {
        let part = Part::bytes(file_bytes)
            .file_name(filename.to_string())
            .mime_str("application/octet-stream")
            .unwrap();
        let form = Form::new().part("file", part);

        self.api
            .post("/api/files/upload")
            .with_token(visitor_token)
            .send_multipart(form)
            .await
            .expect("upload request failed")
    }

    pub async fn get_files(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Response, reqwest::Error> {
        let mut request = self.api.get("/api/files").with_token(token);
        for (key, value) in query_params {
            request = request.with_query_param(key, value);
        }
        request.send().await
    }

    pub async fn find_file_id_by_name(
        &self,
        token: &str,
        name: &str,
    ) -> Result<Option<i64>, String> {
        self.find_item_id_by_name(token, "/api/files", "name", "id", name)
            .await
    }

    pub async fn delete_file_by_id(&self, token: &str, file_id: i64) -> Result<Response, String> {
        self.api
            .delete(&format!("/api/files/{}", file_id))
            .with_token(token)
            .send()
            .await
            .map_err(|e| format!("delete request failed: {e}"))
    }

    pub async fn download_file_bytes(&self, token: &str, file_id: i64) -> Result<Vec<u8>, String> {
        let resp = self
            .download_file(token, file_id)
            .await
            .map_err(|e| format!("request error: {e}"))?;

        let status = resp.status();
        if !status.is_success() && status != reqwest::StatusCode::PARTIAL_CONTENT {
            let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
            return Err(format!("download failed: status={status} body={text}"));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("error reading body bytes: {e}"))?;
        Ok(bytes.to_vec())
    }

    // -------------------------------------------------------------------------
    // PERMISSION MANAGEMENT
    // -------------------------------------------------------------------------

    pub async fn grant_or_update_permission_via_api(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
        access_level: &str,
    ) -> Result<Response, String> {
        let payload = serde_json::json!({
            "user_id": target_user_id,
            "access_level": access_level
        });
        self.send_permission_request(
            "POST",
            token,
            &format!("/api/files/{}/perms", file_id),
            Some(&payload),
        )
        .await
    }

    pub async fn list_permissions_via_api(
        &self,
        token: &str,
        file_id: i64,
    ) -> Result<Value, String> {
        self.get_paginated_data(token, &format!("/api/files/{}/perms", file_id), &[])
            .await
    }

    pub async fn revoke_permission_via_api(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
    ) -> Result<Response, String> {
        self.send_permission_request(
            "DELETE",
            token,
            &format!("/api/files/{}/perms/{}", file_id, target_user_id),
            None,
        )
        .await
    }

    pub async fn revoke_permission_and_assert_removed(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
    ) -> Result<(), String> {
        let resp = self
            .revoke_permission_via_api(token, file_id, target_user_id)
            .await
            .map_err(|e| format!("request failed: {}", e))?;

        let status = resp.status().as_u16();
        if !((200..=299).contains(&status) || status == 404) {
            let body = resp
                .text()
                .await
                .unwrap_or_else(|_| "<body read error>".to_string());
            return Err(format!("revoke failed: status={} body={}", status, body));
        }

        match self
            .get_permission_row(token, file_id, target_user_id)
            .await
        {
            Ok(Some(_)) => Err(format!(
                "permission still present after revoke for user_id={} file_id={}",
                target_user_id, file_id
            )),
            Ok(None) => Ok(()),
            Err(e) => Err(format!("failed to verify permission removal: {}", e)),
        }
    }

    // -------------------------------------------------------------------------
    // USER MANAGEMENT
    // -------------------------------------------------------------------------

    pub async fn get_users_via_api(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Response, reqwest::Error> {
        let mut request = self.api.get("/api/user").with_token(token);
        for (key, value) in query_params {
            request = request.with_query_param(key, value);
        }
        request.send().await
    }

    pub async fn list_users_page(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Value, String> {
        self.get_paginated_data(token, "/api/user", query_params)
            .await
    }

    pub async fn find_user_id_by_username(
        &self,
        token: &str,
        username: &str,
    ) -> Result<Option<i64>, String> {
        self.find_item_id_by_name(token, "/api/user", "username", "id", username)
            .await
    }

    pub async fn delete_user_via_api(&self, token: &str, user_id: i64) -> Result<Response, String> {
        self.send_permission_request("DELETE", token, &format!("/api/user/{}", user_id), None)
            .await
    }

    pub async fn toggle_user_active_via_api(
        &self,
        token: &str,
        user_id: i64,
    ) -> Result<Response, String> {
        self.send_permission_request(
            "POST",
            token,
            &format!("/api/user/{}/toggle", user_id),
            None,
        )
        .await
    }

    pub async fn update_user_perms_via_api(
        &self,
        token: &str,
        user_id: i64,
        payload: &Value,
    ) -> Result<Response, String> {
        self.send_permission_request(
            "POST",
            token,
            &format!("/api/user/{}/perms", user_id),
            Some(payload),
        )
        .await
    }

    // -------------------------------------------------------------------------
    // ACCESSIBLE FILES & AUDIT LOGS
    // -------------------------------------------------------------------------

    pub async fn list_accessible_files(
        &self,
        token: &str,
        user_id: i64,
    ) -> Result<Vec<AccessibleFile>, String> {
        let body = self
            .get_paginated_data(token, &format!("/api/user/{}/accessible", user_id), &[])
            .await?;

        let items = Self::extract_items_array_from_body(&body)
            .ok_or_else(|| format!("unexpected response shape: {body}"))?;

        items
            .iter()
            .map(|item| {
                serde_json::from_value(item.clone())
                    .map_err(|e| format!("failed to deserialize AccessibleFile: {e}"))
            })
            .collect()
    }

    pub async fn get_audit_logs_via_api(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Response, reqwest::Error> {
        let mut request = self.api.get("/api/audit").with_token(token);
        for (key, value) in query_params {
            request = request.with_query_param(key, value);
        }
        request.send().await
    }

    pub async fn list_audit_logs_page(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Value, String> {
        self.get_paginated_data(token, "/api/audit", query_params)
            .await
    }

    pub async fn assert_audit_contains_event(
        &self,
        token: &str,
        event_type: &str,
        file_id: Option<i64>,
    ) -> Result<(), String> {
        if self
            .find_audit_row_by_event_and_file(token, event_type, file_id)
            .await?
            .is_some()
        {
            Ok(())
        } else {
            Err(format!(
                "audit event not found: event_type='{}' file_id={:?}",
                event_type, file_id
            ))
        }
    }

    // -------------------------------------------------------------------------
    // INTERNAL HELPER METHODS
    // -------------------------------------------------------------------------

    fn extract_items_array_from_body(body: &Value) -> Option<Vec<Value>> {
        if let Some(items) = body
            .get("data")
            .and_then(|d| d.get("items"))
            .and_then(|it| it.as_array())
        {
            return Some(items.clone());
        }
        if let Some(items) = body.get("data").and_then(|d| d.as_array()) {
            return Some(items.clone());
        }
        if let Some(items) = body.as_array() {
            return Some(items.clone());
        }
        None
    }

    async fn send_request_with_retry<F>(
        &self,
        request_builder: F,
        max_attempts: usize,
    ) -> Result<Response, reqwest::Error>
    where
        F: Fn() -> crate::common::api_client::RequestBuilder,
    {
        let mut attempts = 0;
        loop {
            attempts += 1;
            match request_builder().send().await {
                Ok(resp) => return Ok(resp),
                Err(e) => {
                    if attempts >= max_attempts {
                        return Err(e);
                    }
                    sleep(Duration::from_millis(500 * attempts as u64)).await;
                }
            }
        }
    }

    async fn find_item_id_by_name(
        &self,
        token: &str,
        endpoint: &str,
        name_field: &str,
        id_field: &str,
        name: &str,
    ) -> Result<Option<i64>, String> {
        let max_attempts = 5;
        for attempt in 1..=max_attempts {
            let resp = self
                .api
                .get(endpoint)
                .with_token(token)
                .with_query_param("name", name)
                .send()
                .await
                .map_err(|e| format!("request error: {e}"))?;

            let status = resp.status();
            if !status.is_success() {
                let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
                return Err(format!(
                    "GET {endpoint} failed: status={status} body={text}"
                ));
            }

            let body: Value = resp
                .json()
                .await
                .map_err(|e| format!("invalid json: {e}"))?;

            let items_opt = Self::extract_items_array_from_body(&body);
            if let Some(items) = items_opt {
                for item in items {
                    if let (Some(item_name), Some(id)) = (
                        item.get(name_field).and_then(|v| v.as_str()),
                        item.get(id_field).and_then(|v| v.as_i64()),
                    ) && item_name == name
                    {
                        return Ok(Some(id));
                    }
                }
            }

            if attempt < max_attempts {
                sleep(Duration::from_millis(500 * attempt)).await;
            }
        }
        Ok(None)
    }

    async fn get_paginated_data(
        &self,
        token: &str,
        endpoint: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Value, String> {
        let mut request = self.api.get(endpoint).with_token(token);
        for (key, value) in query_params {
            request = request.with_query_param(key, value);
        }
        let resp = request
            .send()
            .await
            .map_err(|e| format!("request error: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
            return Err(format!(
                "GET {endpoint} failed: status={status} body={text}"
            ));
        }
        resp.json().await.map_err(|e| format!("invalid json: {e}"))
    }

    fn build_visitor_register_payload(
        &self,
        username: &str,
        password: &str,
        opts: &VisitorOptions,
    ) -> serde_json::Value {
        serde_json::json!({
            "username": username,
            "password": password,
            "can_upload": opts.can_upload,
            "can_delete_own_files": opts.can_delete_own_files,
            "has_upload_limits": opts.has_upload_limits,
            "upload_limit": opts.upload_limit
        })
    }

    async fn download_file(&self, token: &str, file_id: i64) -> Result<Response, reqwest::Error> {
        self.api
            .get(&format!("/api/files/download/{}", file_id))
            .with_token(token)
            .send()
            .await
    }

    async fn send_permission_request(
        &self,
        method: &str,
        token: &str,
        endpoint: &str,
        payload: Option<&Value>,
    ) -> Result<Response, String> {
        let request_builder = match method {
            "GET" => self.api.get(endpoint),
            "POST" => self.api.post(endpoint),
            "DELETE" => self.api.delete(endpoint),
            _ => panic!("Unsupported HTTP method"),
        };
        let mut request = request_builder.with_token(token);
        if let Some(p) = payload {
            request = request.with_json(p);
        }
        request
            .send()
            .await
            .map_err(|e| format!("{method} request failed: {e}"))
    }

    async fn get_permission_row(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
    ) -> Result<Option<PermissionRow>, String> {
        let body = self.list_permissions_via_api(token, file_id).await?;
        let items = Self::extract_items_array_from_body(&body)
            .ok_or_else(|| format!("unexpected permissions response shape: {body}"))?;
        items
            .iter()
            .find(|it| it.get("user_id").and_then(|v| v.as_i64()) == Some(target_user_id))
            .map(|item| {
                serde_json::from_value(item.clone())
                    .map_err(|e| format!("failed to deserialize permission row: {e}"))
            })
            .transpose()
    }

    async fn fetch_audit_log_rows(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Vec<AuditLogRow>, String> {
        let body = self.list_audit_logs_page(token, query_params).await?;
        let arr_val = if let Some(items) = Self::extract_items_array_from_body(&body) {
            Value::Array(items)
        } else {
            return Err(format!("unexpected audit logs response shape: {body}"));
        };
        serde_json::from_value(arr_val)
            .map_err(|e| format!("failed to deserialize audit rows: {e}"))
    }

    async fn find_audit_row_by_event_and_file(
        &self,
        token: &str,
        event_type: &str,
        file_id: Option<i64>,
    ) -> Result<Option<AuditLogRow>, String> {
        for attempt in 1..=6 {
            let mut query_params = vec![("event_type", event_type), ("limit", "100")];
            let file_id_str;
            if let Some(fid) = file_id {
                file_id_str = fid.to_string();
                query_params.push(("file_id", &file_id_str));
            }
            let rows = self.fetch_audit_log_rows(token, &query_params).await?;
            if let Some(row) = rows.into_iter().find(|row| {
                row.event_type == event_type && file_id.is_none_or(|fid| row.file_id == Some(fid))
            }) {
                return Ok(Some(row));
            }
            if attempt < 6 {
                sleep(Duration::from_millis(500 * attempt)).await;
            }
        }
        Ok(None)
    }

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------

    pub fn cleanup(self) {
        cleanup_db(&self.db_path);
        cleanup_uploads_dir(&self.uploads_path);
        // Server handle will be dropped, stopping the server.
    }
}
