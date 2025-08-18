mod controllers;
mod middleware;
mod utils;

use actix_web::{
    web::Data, 
    App, 
    web, 
    HttpServer
};
use actix_cors::Cors;
use tracing_subscriber::{
    prelude::*,
    fmt,
    EnvFilter
};
use tracing_actix_web::TracingLogger;

use middleware::simple_access_logger::SimpleAccessLogger;
use middleware::jwt_middleware;

use sqlx::SqlitePool;
use sqlx::sqlite::SqliteConnectOptions;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,actix_server=warn,actix_web=info"));

    let fmt_layer = fmt::layer().event_format(
        fmt::format()
            .compact()
            .without_time()
            .with_target(false)
    );

    tracing_subscriber::registry().with(env_filter).with(fmt_layer).init();
    tracing::info!("Starting Actix-web server");

    // OFF_CORS env var
    let off_cors: bool = match std::env::var("OFF_CORS") {
        Ok(val) => val.trim().parse().unwrap_or(false),
        Err(_) => false
    };
    tracing::info!("OFF_CORS: {}", off_cors);

    // PORT env var
    let port: u16 = match std::env::var("PORT") {
        Ok(val) => val.trim().parse().unwrap_or(8080),
        Err(_) => 8080
    };
    // ADDRESS env var
    let address: String = match std::env::var("ADDRESS") {
        Ok(val) => val.trim().parse().unwrap_or("0.0.0.0".to_string()),
        Err(_) => "0.0.0.0".to_string()
    };
    tracing::info!("Server will bind to http://{}:{}", address, port);

    // DB connect
    let db_file = std::env::var("SQLITE_FILE").unwrap_or_else(|_| "db/app.db".to_string());
    let connect_opts = SqliteConnectOptions::new()
        .filename(&db_file)
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(connect_opts)
        .await
        .expect("Could not connect to SQLite (SqlitePool::connect_with)");

    if let Err(e) = sqlx::query("PRAGMA journal_mode = WAL;").execute(&pool).await {
        tracing::warn!("Could not set journal_mode=WAL: {}", e);
    }
    if let Err(e) = sqlx::query("PRAGMA busy_timeout = 5000;").execute(&pool).await {
        tracing::warn!("Could not set busy_timeout: {}", e);
    }

    // SECRET_JWT env var
    let secret_jwt: String = match std::env::var("SECRET_JWT") {
        Ok(val) => val.trim().parse().unwrap_or("12345".to_string()),
        Err(_) => "12345".to_string()
    };

    let jwt_cfg = Data::new(jwt_middleware::JwtConfig { secret: secret_jwt });

    HttpServer::new(move || {
        let cors = if off_cors {
            Cors::permissive()
        } else {
            Cors::default()
                .allowed_origin(&format!("http://localhost:{}", port))
                .allowed_methods(vec!["GET"])
                .allowed_header(actix_web::http::header::CONTENT_TYPE)
                .max_age(3600)
        };

        App::new()
            .app_data(Data::new(pool.clone()))
            .app_data(jwt_cfg.clone())
            .wrap(cors)
            .wrap(TracingLogger::default())
            .wrap(SimpleAccessLogger)
            .service(
                web::scope("/api")
                    .wrap(middleware::server_ip_only::LocalOnly)
                    // .wrap(actix_web_httpauth::middleware::HttpAuthentication::bearer(
                        // middleware::jwt_middleware::jwt_validator_adapter
                    // ))
                    .configure(controllers::db::db_config)
            )
    })
    .bind((address, port))?
    .run()
    .await
}
