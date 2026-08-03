// Main application module and CORS configuration for the Actix Web server.
pub mod controllers;
pub mod middleware;
pub mod models;
pub mod spa;
pub mod utils;
pub mod watcher;

use actix_cors::Cors;
use actix_web::web;

/// Configures API routes and sub-scopes
pub fn configure_services(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .configure(controllers::auth::auth_config)
            .configure(controllers::db::db_config)
            .configure(controllers::users::users_config)
            .configure(controllers::audit::audit_config)
            .configure(controllers::files::files_config),
    );
}

/// Configures the APP routes
pub fn configure_app(cfg: &mut web::ServiceConfig) {
    configure_services(cfg);
    cfg.configure(spa::config);
}

/// Builds CORS policy with configurable restrictions
pub fn build_cors(off_cors: bool, address: &str, port: u16) -> Cors {
    if off_cors {
        Cors::permissive()
    } else {
        let origin = format!("http://{address}:{port}");
        Cors::default()
            .allowed_origin(origin.as_str())
            .allowed_methods(vec!["GET", "POST", "DELETE", "PATCH", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::AUTHORIZATION,
            ])
            .max_age(3600)
    }
}
