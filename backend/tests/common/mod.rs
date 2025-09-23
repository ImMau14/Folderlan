use actix_web::{App, HttpServer, middleware::Logger, web};
use reqwest::Client;
use reqwest::Response;
use reqwest::multipart::{Form, Part};
use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::{fs, net::TcpListener, path::PathBuf, time::Duration};
use tokio::time::sleep;

use backend::middleware::jwt_middleware::JwtConfig;
use backend::models::types::ChunkMeta as BackendChunkMeta;
use backend::models::types::UploadsPath;
use backend::utils::register_user::{RegisterOwnerPayload, RegisterPayload, register_user};
use backend::{build_cors, configure_services};

use serde::{Deserialize, Serialize};
use std::panic;

// Represents a file accessible to a user with metadata and permissions
#[derive(Debug, Deserialize, Clone, Serialize)]
pub struct AccessibleFile {
    pub id: i64,
    pub name: String,
    pub size_bytes: i64,
    pub mime_type: Option<String>,
    pub uploaded_by: i64,
    pub uploaded_at: String,
    pub access_type: String, // "owner", "viewer", or "collaborator"
}

// Metadata for file chunks during upload
#[derive(Deserialize, Clone, Debug, Serialize)]
pub struct ChunkMetaSerde {
    pub file_id: String,
    pub chunk_index: u64,
    pub total_chunks: u64,
    pub chunk_size: u64,
    pub total_size: u64,
    pub filename: String,
}

// Represents a user's permission on a file
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct PermissionRow {
    pub user_id: i64,
    pub username: Option<String>,
    pub access_level: String,
    pub granted_at: String,
    pub granted_by: Option<i64>,
}

// Represents an audit log row returned by the API
#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
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

impl From<ChunkMetaSerde> for BackendChunkMeta {
    fn from(s: ChunkMetaSerde) -> Self {
        BackendChunkMeta {
            file_id: s.file_id,
            chunk_index: s.chunk_index,
            total_chunks: s.total_chunks,
            chunk_size: s.chunk_size,
            total_size: s.total_size,
            filename: s.filename,
        }
    }
}

impl From<BackendChunkMeta> for ChunkMetaSerde {
    fn from(m: BackendChunkMeta) -> Self {
        ChunkMetaSerde {
            file_id: m.file_id,
            chunk_index: m.chunk_index,
            total_chunks: m.total_chunks,
            chunk_size: m.chunk_size,
            total_size: m.total_size,
            filename: m.filename,
        }
    }
}

// Configuration options for visitor accounts
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct VisitorOptions {
    pub can_upload: bool,
    pub can_delete_own_files: bool,
    pub has_upload_limits: bool,
    pub upload_limit: u64,
}

// Type of user registration (owner or visitor)
#[derive(Clone, Copy, Debug)]
pub enum RegisterKind {
    #[allow(dead_code)]
    Owner,
    Visitor,
}

// Test application context for integration testing
pub struct TestApp {
    pub base_url: String,
    pub db_path: PathBuf,
    pub uploads_path: PathBuf,
    pub client: Client,
    pub pool: SqlitePool,
}

#[allow(dead_code)]
impl TestApp {
    // Spawns a new test application instance
    pub async fn spawn() -> Self {
        let _ = tracing_subscriber::fmt::try_init();
        std::panic::set_hook(Box::new(|panic_info| {
            eprintln!("panic hook: {panic_info}");
        }));

        let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind random port");
        let port = listener.local_addr().unwrap().port();

        let mut db_path = std::env::temp_dir();
        let nanos = chrono::Utc::now().timestamp_nanos_opt().unwrap();
        db_path.push(format!("test_db_{nanos}.sqlite"));
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let sqlite_opts = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(sqlite_opts)
            .await
            .expect("cannot create sqlite pool");

        let jwt_cfg = JwtConfig {
            secret: "test_secret_for_tests".to_string(),
        };

        let uploads_path = "./tests_uploads";

        let srv_pool = pool.clone();
        let srv_cfg = jwt_cfg.clone();
        let server = HttpServer::new(move || {
            let cors = build_cors(true, "127.0.0.1", port);
            let uploads_path = UploadsPath::new(uploads_path);
            App::new()
                .wrap(Logger::default())
                .app_data(web::Data::new(uploads_path))
                .app_data(web::Data::new(srv_pool.clone()))
                .app_data(web::Data::new(srv_cfg.clone()))
                .wrap(cors)
                .configure(configure_services)
        })
        .listen(listener)
        .expect("failed to listen")
        .run();

        tokio::spawn(server);

        let base_url = format!("http://127.0.0.1:{port}");

        let client = Client::builder()
            .pool_max_idle_per_host(0)
            .build()
            .expect("failed to build reqwest client");

        let start = std::time::Instant::now();
        let timeout = Duration::from_secs(6);
        loop {
            if start.elapsed() > timeout {
                panic!("server did not become ready in time");
            }
            if let Ok(resp) = client.get(format!("{}/api/db", &base_url)).send().await
                && resp.status().is_success()
            {
                break;
            }
            sleep(Duration::from_millis(100)).await;
        }

        TestApp {
            base_url,
            db_path,
            uploads_path: PathBuf::from(uploads_path),
            client,
            pool,
        }
    }

    // Initializes the database schema
    pub async fn post_init_db(&self) {
        let resp = self
            .client
            .post(format!("{}/api/db", &self.base_url))
            .send()
            .await
            .expect("POST /api/db failed");
        assert!(
            resp.status().is_success(),
            "POST /api/db status: {}",
            resp.status()
        );
    }

    // Creates an owner user directly in the database
    pub async fn create_owner_direct(&self, username: &str, password: &str) {
        let payload = RegisterPayload::Owner(RegisterOwnerPayload {
            username: username.to_string(),
            password: password.to_string(),
        });
        let resp = register_user(&self.pool, payload).await;
        assert_eq!(resp.status().as_u16(), 201);
    }

    // Logs in and returns JWT token
    pub async fn login_and_get_token(&self, username: &str, password: &str) -> String {
        let resp = self
            .client
            .post(format!("{}/api/auth/login", &self.base_url))
            .json(&serde_json::json!({ "username": username, "password": password }))
            .send()
            .await
            .expect("login request failed");
        assert!(resp.status().is_success());
        let body: serde_json::Value = resp.json().await.expect("invalid json from login");
        body["token"].as_str().expect("token missing").to_owned()
    }

    // Builds registration payload JSON
    fn build_register_payload(
        &self,
        username: &str,
        password: &str,
        kind: RegisterKind,
        opts: Option<&VisitorOptions>,
    ) -> serde_json::Value {
        let mut base = serde_json::json!({
            "username": username,
            "password": password
        });

        if let RegisterKind::Visitor = kind {
            let o = opts.cloned().unwrap_or_default();
            let visitor_fields = serde_json::json!({
                "can_upload": o.can_upload,
                "can_delete_own_files": o.can_delete_own_files,
                "has_upload_limits": o.has_upload_limits,
                "upload_limit": o.upload_limit
            });

            if let serde_json::Value::Object(ref mut map) = base
                && let serde_json::Value::Object(vis_map) = visitor_fields
            {
                for (k, v) in vis_map {
                    map.insert(k, v);
                }
            }
        }

        base
    }

    // Sends registration request to API
    pub async fn send_register_request(
        &self,
        token: Option<&str>,
        payload: &serde_json::Value,
    ) -> Result<Response, reqwest::Error> {
        let mut builder = self
            .client
            .post(format!("{}/api/auth/register", &self.base_url))
            .json(payload);
        if let Some(t) = token {
            builder = builder.header("Authorization", format!("Bearer {t}"));
        }
        builder.send().await
    }

    // Creates visitor via API as owner
    pub async fn create_visitor_via_api_as_owner(
        &self,
        owner_token: &str,
        username: &str,
        password: &str,
        opts: VisitorOptions,
    ) {
        let payload =
            self.build_register_payload(username, password, RegisterKind::Visitor, Some(&opts));
        let mut attempts = 0usize;
        let max = 6usize;
        loop {
            attempts += 1;
            match self
                .send_register_request(Some(owner_token), &payload)
                .await
            {
                Ok(resp) if resp.status().as_u16() == 201 => return,
                Ok(resp) => {
                    let status = resp.status();
                    let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
                    panic!("owner create visitor expected 201, got {status} body={text}");
                }
                Err(e) => {
                    if attempts >= max {
                        panic!("owner create visitor failed after retries: {e}",);
                    }
                    tokio::time::sleep(Duration::from_millis(200 * attempts as u64)).await;
                }
            }
        }
    }

    // Attempts to create user via API (returns Result instead of panicking)
    pub async fn try_create_user_via_api(
        &self,
        token: Option<&str>,
        username: &str,
        password: &str,
        opts: Option<VisitorOptions>,
    ) -> Result<reqwest::Response, reqwest::Error> {
        let payload =
            self.build_register_payload(username, password, RegisterKind::Visitor, opts.as_ref());
        self.send_register_request(token, &payload).await
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
        self.client
            .post(format!(
                "{}/{}",
                &self.base_url,
                endpoint.trim_start_matches('/')
            ))
            .header("Authorization", format!("Bearer {token}"))
            .multipart(form)
            .send()
            .await
    }

    // Uploads a single-chunk file
    pub async fn upload_single_chunk_file(
        &self,
        visitor_token: &str,
        file_id: &str,
        filename: &str,
        file_bytes: Vec<u8>,
    ) -> reqwest::Response {
        let meta = ChunkMetaSerde {
            file_id: file_id.to_string(),
            chunk_index: 0,
            total_chunks: 1,
            chunk_size: file_bytes.len() as u64,
            total_size: file_bytes.len() as u64,
            filename: filename.to_string(),
        };
        let form = Self::build_chunk_form_from_parts(&meta, &file_bytes);
        self.send_multipart_with_auth(visitor_token, "api/files/upload", form)
            .await
            .expect("upload request failed")
    }

    // Uploads a single chunk
    pub async fn upload_chunk(
        &self,
        visitor_token: &str,
        meta: ChunkMetaSerde,
        chunk_bytes: Vec<u8>,
    ) -> reqwest::Response {
        let form = Self::build_chunk_form_from_parts(&meta, &chunk_bytes);
        self.send_multipart_with_auth(visitor_token, "api/files/upload", form)
            .await
            .expect("chunk upload request failed")
    }

    // Uploads file in multiple chunks
    pub async fn upload_chunks(
        &self,
        visitor_token: &str,
        file_id: &str,
        filename: &str,
        data: &[u8],
        chunk_size: usize,
    ) -> Vec<reqwest::Response> {
        let chunks: Vec<&[u8]> = data.chunks(chunk_size).collect();
        let total = chunks.len() as u64;
        let mut responses = Vec::with_capacity(chunks.len());

        for (idx, chunk) in chunks.into_iter().enumerate() {
            let meta = ChunkMetaSerde {
                file_id: file_id.to_string(),
                chunk_index: idx as u64,
                total_chunks: total,
                chunk_size: chunk.len() as u64,
                total_size: data.len() as u64,
                filename: filename.to_string(),
            };
            let resp = self.upload_chunk(visitor_token, meta, chunk.to_vec()).await;
            responses.push(resp);
        }

        responses
    }

    // Uploads multiple files in batches
    pub async fn upload_lote(
        &self,
        visitor_token: &str,
        files: Vec<(String, String, Vec<u8>)>,
        chunk_size: usize,
    ) -> Vec<Vec<reqwest::Response>> {
        let mut all_responses = Vec::with_capacity(files.len());
        for (file_id, filename, data) in files {
            let responses = self
                .upload_chunks(visitor_token, &file_id, &filename, &data, chunk_size)
                .await;
            all_responses.push(responses);
        }
        all_responses
    }

    // Gets files with optional query parameters
    pub async fn get_files(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<reqwest::Response, reqwest::Error> {
        let mut url = format!("{}/api/files", self.base_url);

        if !query_params.is_empty() {
            url.push('?');
            for (i, (key, value)) in query_params.iter().enumerate() {
                if i > 0 {
                    url.push('&');
                }
                url.push_str(&format!("{key}={value}"));
            }
        }

        self.client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
    }

    // Finds file ID by name with retries
    pub async fn find_file_id_by_name(
        &self,
        token: &str,
        name: &str,
    ) -> Result<Option<i64>, String> {
        let max_attempts = 5;
        let mut attempts = 0;

        loop {
            attempts += 1;
            let resp = self
                .get_files(token, &[("name", name)])
                .await
                .map_err(|e| format!("request error: {e}"))?;

            let status = resp.status();
            if !status.is_success() {
                let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
                return Err(format!(
                    "GET /api/files failed: status={status} body={text}"
                ));
            }

            let body: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("invalid json from get_files: {e}"))?;

            let items = body
                .get("data")
                .and_then(|d| d.get("items"))
                .and_then(|it| it.as_array())
                .ok_or_else(|| "unexpected get_files response structure".to_string())?;

            for item in items {
                if let (Some(n), Some(id)) = (
                    item.get("name").and_then(|v| v.as_str()),
                    item.get("id").and_then(|v| v.as_i64()),
                ) && n == name
                {
                    return Ok(Some(id));
                }
            }

            if attempts >= max_attempts {
                return Ok(None);
            }

            tokio::time::sleep(Duration::from_millis(200 * attempts)).await;
        }
    }

    // Deletes file by ID
    pub async fn delete_file_by_id(
        &self,
        token: &str,
        file_id: i64,
    ) -> Result<reqwest::Response, String> {
        let url = format!("{}/api/files/{}", self.base_url, file_id);
        self.client
            .delete(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .map_err(|e| format!("delete request failed: {e}"))
    }

    // Downloads entire file
    pub async fn download_file(
        &self,
        token: &str,
        file_id: i64,
    ) -> Result<reqwest::Response, reqwest::Error> {
        let url = format!("{}/api/files/download/{}", self.base_url, file_id);
        self.client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
    }

    // Downloads file range (partial content)
    pub async fn download_file_range(
        &self,
        token: &str,
        file_id: i64,
        range: &str,
    ) -> Result<reqwest::Response, reqwest::Error> {
        let url = format!("{}/api/files/download/{}", self.base_url, file_id);
        self.client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Range", range)
            .send()
            .await
    }

    // Downloads file and returns bytes
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

    // Grants or updates file permission for user
    pub async fn grant_or_update_permission_via_api(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
        access_level: &str, // "viewer" or "collaborator"
    ) -> Result<reqwest::Response, String> {
        let payload = serde_json::json!({
            "user_id": target_user_id,
            "access_level": access_level
        });
        let url = format!("{}/api/files/{}/permissions", &self.base_url, file_id);
        self.client
            .post(&url)
            .header("Authorization", format!("Bearer {token}"))
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("grant permission request failed: {e}"))
    }

    // Lists permissions for a file
    pub async fn list_permissions_via_api(
        &self,
        token: &str,
        file_id: i64,
    ) -> Result<serde_json::Value, String> {
        let url = format!("{}/api/files/{}/permissions", &self.base_url, file_id);
        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .map_err(|e| format!("list permissions request failed: {e}"))?;

        let status = resp.status();

        if !status.is_success() {
            let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
            return Err(format!(
                "list permissions failed: status={status} body={text}"
            ));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("invalid json from list_permissions: {e}"))?;
        Ok(body)
    }

    // Revokes permission for user on file
    pub async fn revoke_permission_via_api(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
    ) -> Result<reqwest::Response, String> {
        let url = format!(
            "{}/api/files/{}/permissions/{}",
            &self.base_url, file_id, target_user_id
        );
        self.client
            .delete(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .map_err(|e| format!("revoke permission request failed: {e}"))
    }

    // Gets permission row for specific user on file
    pub async fn get_permission_row(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
    ) -> Result<Option<PermissionRow>, String> {
        let body = self.list_permissions_via_api(token, file_id).await?;
        let items = body
            .get("data")
            .and_then(|d| d.as_array())
            .ok_or_else(|| format!("unexpected permissions response shape: {body}"))?;

        for it in items {
            if let Some(uid) = it.get("user_id").and_then(|v| v.as_i64())
                && uid == target_user_id
            {
                let perm: PermissionRow = serde_json::from_value(it.clone())
                    .map_err(|e| format!("failed to deserialize permission row: {e}"))?;
                return Ok(Some(perm));
            }
        }
        Ok(None)
    }

    // Grants permission and returns the permission row
    pub async fn grant_permission_and_get_row(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
        access_level: &str, // "viewer"|"collaborator"
    ) -> Result<PermissionRow, String> {
        let resp = self
            .grant_or_update_permission_via_api(token, file_id, target_user_id, access_level)
            .await?;
        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
            return Err(format!(
                "grant permission failed: status={status} body={text}"
            ));
        }
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("invalid json from grant permission: {e}"))?;

        body.get("data")
            .cloned()
            .ok_or_else(|| format!("grant returned no data: {body}"))
            .and_then(|d| {
                serde_json::from_value::<PermissionRow>(d)
                    .map_err(|e| format!("failed to deserialize grant response: {e}"))
            })
    }

    // Checks if file has permission for user
    pub async fn file_has_permission(
        &self,
        token: &str,
        file_id: i64,
        user_id: i64,
    ) -> Result<bool, String> {
        Ok(self
            .get_permission_row(token, file_id, user_id)
            .await?
            .is_some())
    }

    // Asserts permission level matches expected value
    pub async fn assert_permission_level(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
        expected_level: &str,
    ) -> Result<(), String> {
        match self
            .get_permission_row(token, file_id, target_user_id)
            .await?
        {
            Some(row) => {
                if row.access_level == expected_level {
                    Ok(())
                } else {
                    Err(format!(
                        "permission access_level mismatch: expected='{}' got='{}'",
                        expected_level, row.access_level
                    ))
                }
            }
            None => Err(format!(
                "permission not found for user_id={target_user_id} on file_id={file_id}"
            )),
        }
    }

    // Revokes permission and expects success
    pub async fn revoke_permission_and_expect_ok(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
    ) -> Result<(), String> {
        let resp = self
            .revoke_permission_via_api(token, file_id, target_user_id)
            .await?;
        let status = resp.status();
        if status.is_success() {
            Ok(())
        } else {
            let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
            Err(format!("revoke failed: status={status} body={text}"))
        }
    }

    // Revokes permission and verifies it was removed
    pub async fn revoke_permission_and_assert_removed(
        &self,
        token: &str,
        file_id: i64,
        target_user_id: i64,
    ) -> Result<(), String> {
        self.revoke_permission_and_expect_ok(token, file_id, target_user_id)
            .await?;

        match self
            .get_permission_row(token, file_id, target_user_id)
            .await?
        {
            None => Ok(()),
            Some(_) => Err(format!(
                "permission still present after revoke for user_id={target_user_id} file_id={file_id}"
            )),
        }
    }

    // Gets users with optional query parameters
    pub async fn get_users_via_api(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<reqwest::Response, reqwest::Error> {
        let mut url = format!("{}/api/user", self.base_url);

        if !query_params.is_empty() {
            url.push('?');
            for (i, (key, value)) in query_params.iter().enumerate() {
                if i > 0 {
                    url.push('&');
                }
                url.push_str(&format!("{key}={value}"));
            }
        }

        self.client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
    }

    // Lists users with pagination and returns parsed JSON
    pub async fn list_users_page(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<serde_json::Value, String> {
        let resp = self
            .get_users_via_api(token, query_params)
            .await
            .map_err(|e| format!("request error: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
            return Err(format!("GET /api/user failed: status={status} body={text}"));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("invalid json from get_users: {e}"))?;
        Ok(body)
    }

    // Finds user ID by username with retries
    pub async fn find_user_id_by_username(
        &self,
        token: &str,
        username: &str,
    ) -> Result<Option<i64>, String> {
        let max_attempts = 5usize;
        let mut attempts = 0usize;

        loop {
            attempts += 1;
            let resp = self
                .get_users_via_api(token, &[("name", username)])
                .await
                .map_err(|e| format!("request error: {e}"))?;

            let status = resp.status();
            if !status.is_success() {
                let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
                return Err(format!("GET /api/user failed: status={status} body={text}"));
            }

            let body: serde_json::Value = resp
                .json()
                .await
                .map_err(|e| format!("invalid json from get_users: {e}"))?;

            let items = body
                .get("data")
                .and_then(|d| d.get("items"))
                .and_then(|it| it.as_array())
                .ok_or_else(|| "unexpected get_users response structure".to_string())?;

            for item in items {
                if let (Some(n), Some(id)) = (
                    item.get("username").and_then(|v| v.as_str()),
                    item.get("id").and_then(|v| v.as_i64()),
                ) && n == username
                {
                    return Ok(Some(id));
                }
            }

            if attempts >= max_attempts {
                return Ok(None);
            }

            tokio::time::sleep(Duration::from_millis(200 * attempts as u64)).await;
        }
    }

    // Deletes user via API
    pub async fn delete_user_via_api(
        &self,
        token: &str,
        user_id: i64,
    ) -> Result<reqwest::Response, String> {
        let url = format!("{}/api/user/{}", self.base_url, user_id);
        self.client
            .delete(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .map_err(|e| format!("delete user request failed: {e}"))
    }

    // Toggles user active status
    pub async fn toggle_user_active_via_api(
        &self,
        token: &str,
        user_id: i64,
    ) -> Result<reqwest::Response, String> {
        let url = format!("{}/api/user/{}/toggle", self.base_url, user_id);
        self.client
            .post(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
            .map_err(|e| format!("toggle user request failed: {e}"))
    }

    // Updates user permissions
    pub async fn update_user_perms_via_api(
        &self,
        token: &str,
        user_id: i64,
        payload: &serde_json::Value,
    ) -> Result<reqwest::Response, String> {
        let url = format!("{}/api/user/{}/perms", self.base_url, user_id);
        self.client
            .post(&url)
            .header("Authorization", format!("Bearer {token}"))
            .json(payload)
            .send()
            .await
            .map_err(|e| format!("update user perms request failed: {e}"))
    }

    // Gets accessible files for user
    pub async fn get_user_accessible_via_api(
        &self,
        token: &str,
        user_id: i64,
    ) -> Result<reqwest::Response, reqwest::Error> {
        let url = format!("{}/api/user/{}/accessible", &self.base_url, user_id);
        self.client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
    }

    // Lists accessible files for user
    pub async fn list_accessible_files(
        &self,
        token: &str,
        user_id: i64,
    ) -> Result<Vec<AccessibleFile>, String> {
        let resp = self
            .get_user_accessible_via_api(token, user_id)
            .await
            .map_err(|e| format!("request error: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
            return Err(format!(
                "GET /api/user/{user_id}/accessible failed: status={status} body={text}"
            ));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("invalid json from list_accessible_files: {e}"))?;

        let items = body
            .get("data")
            .and_then(|d| d.as_array())
            .ok_or_else(|| format!("unexpected list_accessible_files response shape: {body}"))?;

        let mut files = Vec::with_capacity(items.len());
        for item in items {
            let file: AccessibleFile = serde_json::from_value(item.clone())
                .map_err(|e| format!("failed to deserialize AccessibleFile: {e}"))?;
            files.push(file);
        }

        Ok(files)
    }

    // Gets audit logs with optional query parameters
    pub async fn get_audit_logs_via_api(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<reqwest::Response, reqwest::Error> {
        let mut url = format!("{}/api/audit", self.base_url);

        if !query_params.is_empty() {
            url.push('?');
            for (i, (key, value)) in query_params.iter().enumerate() {
                if i > 0 {
                    url.push('&');
                }
                url.push_str(&format!("{key}={value}"));
            }
        }

        self.client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .send()
            .await
    }

    // Lists audit logs and returns parsed JSON
    pub async fn list_audit_logs_page(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<serde_json::Value, String> {
        let resp = self
            .get_audit_logs_via_api(token, query_params)
            .await
            .map_err(|e| format!("request error: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
            return Err(format!(
                "GET /api/audit failed: status={status} body={text}"
            ));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| format!("invalid json from get_audit_logs: {e}"))?;
        Ok(body)
    }

    // Fetches audit log rows as Vec<AuditLogRow>
    // Accepts either `data` being an array or `data.items` shape to be tolerant with response shapes.
    pub async fn fetch_audit_log_rows(
        &self,
        token: &str,
        query_params: &[(&str, &str)],
    ) -> Result<Vec<AuditLogRow>, String> {
        let body = self.list_audit_logs_page(token, query_params).await?;

        // Normalize: body -> data value (could be array or object with items)
        let data_val = if let Some(d) = body.get("data") {
            d.clone()
        } else {
            body.clone()
        };

        let arr_val = if data_val.is_array() {
            data_val
        } else if let Some(items) = data_val.get("items") {
            items.clone()
        } else {
            return Err(format!("unexpected audit logs response shape: {body}"));
        };

        let rows: Vec<AuditLogRow> = serde_json::from_value(arr_val)
            .map_err(|e| format!("failed to deserialize audit rows: {e}"))?;
        Ok(rows)
    }

    // Finds an audit row by event_type and optional file_id with retries/backoff.
    // Returns Ok(Some(row)) if found, Ok(None) if not found after retries, Err on fatal errors.
    pub async fn find_audit_row_by_event_and_file(
        &self,
        token: &str,
        event_type: &str,
        file_id: Option<i64>,
    ) -> Result<Option<AuditLogRow>, String> {
        let max_attempts = 6usize;
        let mut attempts = 0usize;

        loop {
            attempts += 1;

            let mut q_owned: Vec<(String, String)> = Vec::with_capacity(3);
            q_owned.push(("event_type".to_string(), event_type.to_string()));
            q_owned.push(("limit".to_string(), "100".to_string()));
            if let Some(fid) = file_id {
                q_owned.push(("file_id".to_string(), fid.to_string()));
            }

            // Convert to Vec<(&str, &str)> right before the call.
            let q_refs: Vec<(&str, &str)> = q_owned
                .iter()
                .map(|(k, v)| (k.as_str(), v.as_str()))
                .collect();

            let rows = self.fetch_audit_log_rows(token, &q_refs).await?;

            for row in rows {
                if row.event_type == event_type {
                    if let Some(fid) = file_id {
                        if row.file_id == Some(fid) {
                            return Ok(Some(row));
                        }
                    } else {
                        return Ok(Some(row));
                    }
                }
            }

            if attempts >= max_attempts {
                return Ok(None);
            }

            tokio::time::sleep(Duration::from_millis(200 * attempts as u64)).await;
        }
    }

    // Asserts that an audit event exists (returns Ok(()) on success, Err(String) on failure)
    pub async fn assert_audit_contains_event(
        &self,
        token: &str,
        event_type: &str,
        file_id: Option<i64>,
    ) -> Result<(), String> {
        match self
            .find_audit_row_by_event_and_file(token, event_type, file_id)
            .await?
        {
            Some(_) => Ok(()),
            None => Err(format!(
                "audit event not found: event_type='{}' file_id={:?}",
                event_type, file_id
            )),
        }
    }

    // Cleans up test resources (database and uploads)
    pub fn cleanup(self) {
        let _ = fs::remove_file(self.db_path);
        let _ = fs::remove_dir_all(self.uploads_path);
    }
}
