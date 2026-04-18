use actix_web::{App, web::Data};
use backend::{
    build_cors, configure_app,
    middleware::{jwt_middleware::JwtConfig, simple_access_logger::SimpleAccessLogger},
    models::types::UploadsPath,
    watcher::start_watcher,
};
use sqlx::SqlitePool;
use std::net::TcpListener;
use std::path::PathBuf;
use tracing_actix_web::TracingLogger;

pub async fn spawn_test_server(
    pool: SqlitePool,
    uploads_path: PathBuf,
    jwt_secret: String,
) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind random port");
    let port = listener.local_addr().unwrap().port();
    let base_url = format!("http://127.0.0.1:{}", port);

    let uploads_path_str = uploads_path.to_str().unwrap().to_string();
    let jwt_cfg = JwtConfig { secret: jwt_secret };

    // Start watcher (same as in main)
    let owner_user_id = Some(1);
    let _ = start_watcher(
        uploads_path.clone(),
        None,
        Some(pool.clone()),
        owner_user_id,
    )
    .await
    .map_err(|e| tracing::warn!("Failed to start watcher: {}", e));

    let server = actix_web::HttpServer::new(move || {
        let cors = build_cors(false, "127.0.0.1", port);
        let uploads_path_data = UploadsPath::new(&uploads_path_str);

        App::new()
            .app_data(Data::new(uploads_path_data))
            .app_data(Data::new(pool.clone()))
            .app_data(Data::new(jwt_cfg.clone()))
            .wrap(cors)
            .wrap(TracingLogger::default())
            .wrap(SimpleAccessLogger)
            .configure(configure_app)
    })
    .listen(listener)
    .expect("failed to listen")
    .run();

    // The server future returns Result<(), std::io::Error>.
    // We spawn it and map the result to () ignoring errors on drop.
    let handle = tokio::spawn(async {
        if let Err(e) = server.await {
            eprintln!("Test server error: {}", e);
        }
    });

    (base_url, handle)
}
