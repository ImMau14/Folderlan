use std::{fs, net::TcpListener, path::PathBuf, time::Duration};
use actix_web::{web, App, HttpServer, middleware::Logger};
use reqwest::multipart::{Form, Part};
use reqwest::Client;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use tokio::time::sleep;

use backend::{configure_services, build_cors};
use backend::middleware::jwt_middleware::JwtConfig;
use backend::utils::register_user::{register_user, RegisterPayload, RegisterOwnerPayload};

use serde::Deserialize;

#[derive(Deserialize, Clone, Debug, serde::Serialize)]
pub struct ChunkMeta {
    pub file_id: String,
    pub chunk_index: u64,
    pub total_chunks: u64,
    pub chunk_size: u64,
    pub filename: String
}

pub struct TestApp {
    pub base_url: String,
    pub db_path: PathBuf,
    pub client: Client,
    pub pool: SqlitePool,
}

impl TestApp {
    pub async fn spawn() -> Self {
        let _ = tracing_subscriber::fmt::try_init();
        std::panic::set_hook(Box::new(|panic_info| {
            eprintln!("panic hook: {}", panic_info);
        }));

        let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind random port");
        let port = listener.local_addr().unwrap().port();

        let mut db_path = std::env::temp_dir();
        let nanos = chrono::Utc::now().timestamp_nanos_opt().unwrap();
        db_path.push(format!("test_db_{}.sqlite", nanos));
        if let Some(parent) = db_path.parent() { let _ = fs::create_dir_all(parent); }

        let sqlite_opts = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(sqlite_opts)
            .await
            .expect("cannot create sqlite pool");

        let jwt_cfg = JwtConfig { secret: "test_secret_for_tests".to_string() };

        let srv_pool = pool.clone();
        let srv_cfg = jwt_cfg.clone();
        let server = HttpServer::new(move || {
            let cors = build_cors(true, "127.0.0.1", port);
            App::new()
                .wrap(Logger::default())
                .app_data(web::Data::new(srv_pool.clone()))
                .app_data(web::Data::new(srv_cfg.clone()))
                .wrap(cors)
                .configure(configure_services)
        })
        .listen(listener)
        .expect("failed to listen")
        .run();

        tokio::spawn(server);

        let base_url = format!("http://127.0.0.1:{}", port);

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
            if let Ok(resp) = client.get(&format!("{}/api/db", &base_url)).send().await {
                if resp.status().is_success() {
                    break;
                }
            }
            sleep(Duration::from_millis(100)).await;
        }

        TestApp { base_url, db_path, client, pool }
    }

    pub async fn post_init_db(&self) {
        let resp = self.client
            .post(&format!("{}/api/db", &self.base_url))
            .send()
            .await
            .expect("POST /api/db failed");
        assert!(resp.status().is_success(), "POST /api/db status: {}", resp.status());
    }

    pub async fn create_owner_direct(&self, username: &str, password: &str) {
        let payload = RegisterPayload::Owner(RegisterOwnerPayload {
            username: username.to_string(),
            password: password.to_string(),
        });
        let resp = register_user(&self.pool, payload).await;
        assert_eq!(resp.status().as_u16(), 201);
    }

    pub async fn login_and_get_token(&self, username: &str, password: &str) -> String {
        let resp = self.client.post(&format!("{}/api/auth/login", &self.base_url))
            .json(&serde_json::json!({ "username": username, "password": password }))
            .send()
            .await
            .expect("login request failed");
        assert!(resp.status().is_success());
        let body: serde_json::Value = resp.json().await.expect("invalid json from login");
        body["token"].as_str().expect("token missing").to_owned()
    }

    pub async fn create_visitor_via_api_as_owner(&self, owner_token: &str, username: &str, password: &str, can_upload: bool) {
        let payload = serde_json::json!({
            "username": username,
            "password": password,
            "can_access_all_files": false,
            "can_download": true,
            "can_upload": can_upload,
            "can_edit": false,
            "can_delete": false,
            "has_upload_limits": false,
            "upload_limit": 0
        });

        let mut attempts = 0usize;
        let max = 6usize;
        loop {
            attempts += 1;
            let builder = self.client.post(&format!("{}/api/auth/register", &self.base_url))
                .header("Authorization", format!("Bearer {}", owner_token))
                .json(&payload);
            match builder.send().await {
                Ok(resp) if resp.status().as_u16() == 201 => return,
                Ok(resp) => {
                    let status = resp.status();
                    let text = resp.text().await.unwrap_or_else(|_| "<no-body>".into());
                    panic!("owner create visitor expected 201, got {} body={}", status, text);
                }
                Err(e) => {
                    if attempts >= max { panic!("owner create visitor failed after retries: {}", e); }
                    tokio::time::sleep(Duration::from_millis(200 * attempts as u64)).await;
                }
            }
        }
    }

    pub async fn try_create_user_via_api(&self, token: &str, username: &str, password: &str) -> Result<reqwest::Response, reqwest::Error> {
        let payload = serde_json::json!({
            "username": username,
            "password": password,
            "can_access_all_files": false,
            "can_download": true,
            "can_upload": false,
            "can_edit": false,
            "can_delete": false,
            "has_upload_limits": false,
            "upload_limit": 0
        });

        self.client.post(&format!("{}/api/auth/register", &self.base_url))
            .header("Authorization", format!("Bearer {}", token))
            .json(&payload)
            .send()
            .await
    }

    pub async fn upload_single_chunk_file(&self, visitor_token: &str, file_id: &str, filename: &str, file_bytes: Vec<u8>) -> reqwest::Response {
        let meta = ChunkMeta {
            file_id: file_id.to_string(),
            chunk_index: 0,
            total_chunks: 1,
            chunk_size: file_bytes.len() as u64,
            filename: filename.to_string(),
        };
        let meta_json = serde_json::to_string(&meta).unwrap();
        let part_chunk = Part::bytes(file_bytes).file_name(filename.to_string()).mime_str("application/octet-stream").unwrap();
        let form = Form::new().text("metadata", meta_json).part("chunk", part_chunk);

        self.client.post(&format!("{}/api/files", &self.base_url))
            .header("Authorization", format!("Bearer {}", visitor_token))
            .multipart(form)
            .send()
            .await
            .expect("upload request failed")
    }

    pub async fn upload_chunk(&self, visitor_token: &str, meta: ChunkMeta, chunk_bytes: Vec<u8>) -> reqwest::Response {
        let meta_json = serde_json::to_string(&meta).unwrap();
        let part_chunk = Part::bytes(chunk_bytes).file_name(meta.filename.clone()).mime_str("application/octet-stream").unwrap();
        let form = Form::new().text("metadata", meta_json).part("chunk", part_chunk);

        self.client.post(&format!("{}/api/files", &self.base_url))
            .header("Authorization", format!("Bearer {}", visitor_token))
            .multipart(form)
            .send()
            .await
            .expect("chunk upload request failed")
    }

    pub async fn upload_chunks(&self, visitor_token: &str, file_id: &str, filename: &str, data: &[u8], chunk_size: usize) -> Vec<reqwest::Response> {
        let chunks: Vec<&[u8]> = data.chunks(chunk_size).collect();
        let total = chunks.len() as u64;
        let mut responses = Vec::with_capacity(chunks.len());

        for (idx, chunk) in chunks.into_iter().enumerate() {
            let meta = ChunkMeta {
                file_id: file_id.to_string(),
                chunk_index: idx as u64,
                total_chunks: total,
                chunk_size: chunk.len() as u64,
                filename: filename.to_string(),
            };
            let resp = self.upload_chunk(visitor_token, meta, chunk.to_vec()).await;
            responses.push(resp);
        }

        responses
    }

    pub async fn upload_lote(
        &self,
        visitor_token: &str,
        files: Vec<(String, String, Vec<u8>)>,
        chunk_size: usize
    ) -> Vec<Vec<reqwest::Response>> {
        let mut all_responses = Vec::with_capacity(files.len());
        for (file_id, filename, data) in files {
            let responses = self.upload_chunks(visitor_token, &file_id, &filename, &data, chunk_size).await;
            all_responses.push(responses);
        }
        all_responses
    }

    pub fn cleanup(self) {
        let _ = fs::remove_file(self.db_path);
        let _ = fs::remove_dir_all("./uploads");
    }
}