// Test application for backend API integration tests. Manages server lifecycle, database, file storage, and API client.
use reqwest::{
    Response,
    multipart::{Form, Part},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use std::{fs, net::TcpListener, path::PathBuf, time::Duration};
use tokio::time::sleep;

use super::api_client::ApiClient;

// =============================================================================
// DATA STRUCTURES
// =============================================================================

// Represents a file accessible to users with metadata
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

// Metadata for file chunk during upload process
#[derive(Deserialize, Clone, Debug, Serialize)]
pub struct ChunkMetaSerde {
    pub file_id: String,
    pub chunk_index: u64,
    pub total_chunks: u64,
    pub chunk_size: u64,
    pub total_size: u64,
    pub filename: String,
}

// Database row representing file permissions
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct PermissionRow {
    pub user_id: i64,
    pub username: Option<String>,
    pub access_level: String,
    pub granted_at: String,
    pub granted_by: Option<i64>,
}

// Database row representing audit log entries
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

// Configuration options for visitor user accounts
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct VisitorOptions {
    pub can_upload: bool,
    pub can_delete_own_files: bool,
    pub has_upload_limits: bool,
    pub upload_limit: u64,
}

// =============================================================================
// MAIN TEST APPLICATION
// =============================================================================

// Main test application managing server, database, and API interactions
pub struct TestApp {
    pub api: ApiClient,
    pub db_path: PathBuf,
    pub uploads_path: PathBuf,
    pub pool: SqlitePool,
}

impl TestApp {
    // =========================================================================
    // INITIALIZATION & SETUP
    // =========================================================================

    // Creates and starts test server with unique temporary resources
    pub async fn spawn() -> Self {
        let _ = tracing_subscriber::fmt::try_init();
        std::panic::set_hook(Box::new(|panic_info| {
            eprintln!("panic hook: {panic_info}");
        }));

        // Bind to random available port
        let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind random port");
        let port = listener.local_addr().unwrap().port();

        // Create unique identifiers for test isolation
        let test_id = chrono::Utc::now().timestamp_nanos_opt().unwrap();

        // Create unique database path
        let mut db_path = std::env::temp_dir();
        db_path.push(format!("test_db_{}.sqlite", test_id));
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        // Create unique uploads directory
        let mut uploads_path = std::env::temp_dir();
        uploads_path.push(format!("test_uploads_{}", test_id));
        fs::create_dir_all(&uploads_path).expect("failed to create unique uploads directory");

        // Initialize SQLite database connection
        let sqlite_opts = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect_with(sqlite_opts)
            .await
            .expect("cannot create sqlite pool");

        // Configure and start Actix web server
        use backend::middleware::jwt_middleware::JwtConfig;
        use backend::models::types::UploadsPath;
        use backend::{build_cors, configure_services};

        let jwt_cfg = JwtConfig {
            secret: "test_secret_for_tests".to_string(),
        };

        let srv_pool = pool.clone();
        let srv_cfg = jwt_cfg.clone();
        let uploads_path_str = uploads_path.to_str().unwrap().to_string();

        let server = actix_web::HttpServer::new(move || {
            let cors = build_cors(true, "127.0.0.1", port);
            let uploads_path = UploadsPath::new(&uploads_path_str);
            actix_web::App::new()
                .wrap(actix_web::middleware::Logger::default())
                .app_data(actix_web::web::Data::new(uploads_path))
                .app_data(actix_web::web::Data::new(srv_pool.clone()))
                .app_data(actix_web::web::Data::new(srv_cfg.clone()))
                .wrap(cors)
                .configure(configure_services)
        })
        .listen(listener)
        .expect("failed to listen")
        .run();

        // Start server in background task
        tokio::spawn(server);

        // Initialize API client with timeout
        let base_url = format!("http://127.0.0.1:{}", port);
        let api = ApiClient::new(base_url).with_timeout(Duration::from_secs(30));

        Self::wait_for_server_ready(&api).await;

        TestApp {
            api,
            db_path,
            uploads_path,
            pool,
        }
    }

    // Waits for server to become responsive before proceeding
    async fn wait_for_server_ready(api: &ApiClient) {
        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(30);

        loop {
            if start.elapsed() > timeout {
                panic!("server did not become ready in time");
            }

            match api.get("/api/db").send().await {
                Ok(resp) if resp.status().is_success() => break,
                Ok(resp) => {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_default();
                    eprintln!("Server responded with status {}: {}", status, body);
                    sleep(Duration::from_millis(500)).await;
                }
                Err(e) => {
                    eprintln!("Server not ready yet: {}", e);
                    sleep(Duration::from_millis(500)).await;
                }
            }
        }
    }

    // Initializes database schema via API call
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

    // =========================================================================
    // AUTHENTICATION & USER MANAGEMENT
    // =========================================================================

    // Creates owner user directly in database
    pub async fn create_owner_direct(&self, username: &str, password: &str) {
        use backend::utils::register_user::{RegisterOwnerPayload, RegisterPayload, register_user};

        let payload = RegisterPayload::Owner(RegisterOwnerPayload {
            username: username.to_string(),
            password: password.to_string(),
        });
        let resp = register_user(&self.pool, payload).await;
        assert_eq!(resp.status().as_u16(), 201);
    }

    // Authenticates user and returns JWT token
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

    // Creates visitor user via API using owner credentials
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

    // =========================================================================
    // FILE OPERATIONS
    // =========================================================================

    // Uploads complete file in single chunk
    pub async fn upload_single_chunk_file(
        &self,
        visitor_token: &str,
        file_id: &str,
        filename: &str,
        file_bytes: Vec<u8>,
    ) -> Response {
        let meta = ChunkMetaSerde {
            file_id: file_id.to_string(),
            chunk_index: 0,
            total_chunks: 1,
            chunk_size: file_bytes.len() as u64,
            total_size: file_bytes.len() as u64,
            filename: filename.to_string(),
        };

        let form = Self::build_chunk_form_from_parts(&meta, &file_bytes);
        self.send_multipart_with_auth(visitor_token, "/api/files/upload", form)
            .await
            .expect("upload request failed")
    }

    // Uploads file split into multiple chunks
    pub async fn upload_chunks(
        &self,
        visitor_token: &str,
        file_id: &str,
        filename: &str,
        data: &[u8],
        chunk_size: usize,
    ) -> Vec<Response> {
        let chunks: Vec<&[u8]> = data.chunks(chunk_size).collect();
        let total = chunks.len() as u64;

        chunks
            .into_iter()
            .enumerate()
            .map(|(idx, chunk)| {
                let meta = ChunkMetaSerde {
                    file_id: file_id.to_string(),
                    chunk_index: idx as u64,
                    total_chunks: total,
                    chunk_size: chunk.len() as u64,
                    total_size: data.len() as u64,
                    filename: filename.to_string(),
                };
                tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(self.upload_chunk(
                        visitor_token,
                        meta,
                        chunk.to_vec(),
                    ))
                })
            })
            .collect()
    }

    // Retrieves files list with optional query parameters
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

    // Finds file ID by filename in files list
    pub async fn find_file_id_by_name(
        &self,
        token: &str,
        name: &str,
    ) -> Result<Option<i64>, String> {
        self.find_item_id_by_name(token, "/api/files", "name", "id", name)
            .await
    }

    // Deletes file by ID via API
    pub async fn delete_file_by_id(&self, token: &str, file_id: i64) -> Result<Response, String> {
        self.api
            .delete(&format!("/api/files/{}", file_id))
            .with_token(token)
            .send()
            .await
            .map_err(|e| format!("delete request failed: {e}"))
    }

    // Downloads file and returns raw bytes
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

    // =========================================================================
    // PERMISSION MANAGEMENT
    // =========================================================================

    // Grants or updates file permissions for user
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
            &format!("/api/files/{}/permissions", file_id),
            Some(&payload),
        )
        .await
    }

    // Lists permissions for specific file
    pub async fn list_permissions_via_api(
        &self,
        token: &str,
        file_id: i64,
    ) -> Result<Value, String> {
        self.get_paginated_data(token, &format!("/api/files/{}/permissions", file_id), &[])
            .await
    }

    // Revokes permission from user for file
    pub async fn revoke_permission_via_api(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
    ) -> Result<Response, String> {
        self.send_permission_request(
            "DELETE",
            token,
            &format!("/api/files/{}/permissions/{}", file_id, target_user_id),
            None,
        )
        .await
    }

    // Revokes permission and verifies removal
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

    // =========================================================================
    // USER MANAGEMENT
    // =========================================================================

    // Retrieves users list with query parameters
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

    // Retrieves paginated users list
    pub async fn list_users_page(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Value, String> {
        self.get_paginated_data(token, "/api/user", query_params)
            .await
    }

    // Finds user ID by username
    pub async fn find_user_id_by_username(
        &self,
        token: &str,
        username: &str,
    ) -> Result<Option<i64>, String> {
        self.find_item_id_by_name(token, "/api/user", "username", "id", username)
            .await
    }

    // Deletes user via API
    pub async fn delete_user_via_api(&self, token: &str, user_id: i64) -> Result<Response, String> {
        self.send_permission_request("DELETE", token, &format!("/api/user/{}", user_id), None)
            .await
    }

    // Toggles user active status
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

    // Updates user permissions
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

    // =========================================================================
    // ACCESSIBLE FILES & AUDIT LOGS
    // =========================================================================

    // Lists files accessible to specific user
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

    // Retrieves audit logs with query parameters
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

    // Retrieves paginated audit logs
    pub async fn list_audit_logs_page(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Value, String> {
        self.get_paginated_data(token, "/api/audit", query_params)
            .await
    }

    // Verifies audit log contains specific event
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

    // =========================================================================
    // HELPER METHODS (Internal)
    // =========================================================================

    // Extracts items array from API response body
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

    // Sends request with retry logic for transient failures
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

    // Finds item ID by name field in paginated API responses
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

    // Retrieves paginated data from API endpoint
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

    // Builds visitor registration payload from options
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

    // Builds multipart form for chunk upload
    fn build_chunk_form_from_parts(meta: &ChunkMetaSerde, chunk_bytes: &[u8]) -> Form {
        let meta_json = serde_json::to_string(meta).expect("serialize metadata");
        let part_chunk = Part::bytes(chunk_bytes.to_vec())
            .file_name(meta.filename.clone())
            .mime_str("application/octet-stream")
            .unwrap();

        Form::new()
            .text("metadata", meta_json)
            .part("chunk", part_chunk)
    }

    // Sends multipart request with authentication
    async fn send_multipart_with_auth(
        &self,
        token: &str,
        endpoint: &str,
        form: Form,
    ) -> Result<Response, reqwest::Error> {
        self.api
            .post(endpoint)
            .with_token(token)
            .send_multipart(form)
            .await
    }

    // Uploads single file chunk
    async fn upload_chunk(
        &self,
        visitor_token: &str,
        meta: ChunkMetaSerde,
        chunk_bytes: Vec<u8>,
    ) -> Response {
        let form = Self::build_chunk_form_from_parts(&meta, &chunk_bytes);
        self.send_multipart_with_auth(visitor_token, "/api/files/upload", form)
            .await
            .expect("chunk upload request failed")
    }

    // Downloads file from server
    async fn download_file(&self, token: &str, file_id: i64) -> Result<Response, reqwest::Error> {
        self.api
            .get(&format!("/api/files/download/{}", file_id))
            .with_token(token)
            .send()
            .await
    }

    // Sends permission-related API request
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

    // Retrieves specific permission row from database
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

    // Fetches audit log rows from API
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

    // Finds specific audit log entry by event and file
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

    // =========================================================================
    // CLEANUP
    // =========================================================================

    // Cleans up temporary test resources
    pub fn cleanup(self) {
        let _ = fs::remove_file(self.db_path);
        let _ = fs::remove_dir_all(&self.uploads_path);
    }
}
