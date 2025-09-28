// Main entry point for the Actix-Web server with SQLite database integration
use actix_web::{App, HttpServer, web::Data};
use sqlx::{SqlitePool, sqlite::SqliteConnectOptions};
use std::path::{Path, PathBuf};
use tracing_actix_web::TracingLogger;
use tracing_subscriber::{EnvFilter, fmt, prelude::*};

use backend::{
    build_cors, configure_services,
    middleware::{jwt_middleware::JwtConfig, simple_access_logger::SimpleAccessLogger},
    models::types::UploadsPath,
};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing subsystem for structured logging
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,actix_server=warn,actix_web=info"));

    let fmt_layer =
        fmt::layer().event_format(fmt::format().compact().without_time().with_target(false));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .init();
    tracing::info!("Starting server");

    // Load CORS configuration from environment
    let off_cors: bool = std::env::var("OFF_CORS")
        .ok()
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(false);

    // Configure server network settings
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(8080);

    let address: String = std::env::var("ADDRESS").unwrap_or_else(|_| "0.0.0.0".to_string());

    tracing::info!(
        "OFF_CORS: {}  PORT: {}  ADDRESS: {}",
        off_cors,
        port,
        address
    );

    // Initialize SQLite database connection
    let db_file = std::env::var("SQLITE_FILE").unwrap_or_else(|_| "db/app.db".to_string());

    // Ensure database directory exists
    let db_path = Path::new(&db_file);
    if let Some(parent_dir) = db_path.parent() {
        std::fs::create_dir_all(parent_dir).expect("Failed to create database directory");
    }

    let connect_opts = SqliteConnectOptions::new()
        .filename(&db_file)
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(connect_opts)
        .await
        .expect("Could not connect to SQLite");

    // Apply database performance optimizations
    if let Err(e) = sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(&pool)
        .await
    {
        tracing::warn!("Could not set journal_mode=WAL: {}", e);
    }
    if let Err(e) = sqlx::query("PRAGMA busy_timeout = 5000;")
        .execute(&pool)
        .await
    {
        tracing::warn!("Could not set busy_timeout: {}", e);
    }

    // Configure JWT authentication
    let secret_jwt: String = std::env::var("SECRET_JWT").unwrap_or_else(|_| "12345".to_string());
    let jwt_cfg = JwtConfig { secret: secret_jwt };

    tracing::info!("Server will bind to http://{}:{}", address, port);

    // Choose uploads directory
    let uploads_dir = PathBuf::from("./uploads");

    // tmp subdir name (adjust if you use a different tmp folder inside uploads).
    let tmp_subdir = "tmp";

    // Owner user id when watcher registers files created by sharing.
    let owner_user_id: Option<i64> = Some(1);

    match backend::watcher::start_watcher(
        uploads_dir,
        tmp_subdir,
        Some(pool.clone()),
        owner_user_id,
    )
    .await
    {
        Ok(_handle) => {
            tracing::info!("Filesystem watcher started");
            // Optionally keep the handle somewhere if you want graceful shutdown logic.
        }
        Err(e) => {
            tracing::warn!("Failed to start filesystem watcher: {}", e);
        }
    }

    // Configure Actix-Web application factory
    let address_for_app = address.clone();
    let app_factory = move || {
        let cors = build_cors(off_cors, &address_for_app, port);
        let uploads_path = UploadsPath::new("./uploads");

        App::new()
            .app_data(Data::new(uploads_path))
            .app_data(Data::new(pool.clone()))
            .app_data(Data::new(jwt_cfg.clone()))
            .wrap(cors)
            .wrap(TracingLogger::default())
            .wrap(SimpleAccessLogger)
            .configure(configure_services)
    };

    // Start HTTP server
    HttpServer::new(app_factory)
        .bind((address.as_str(), port))?
        .run()
        .await
}
