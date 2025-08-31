pub mod controllers;
pub mod middleware;
pub mod models;
pub mod utils;

use actix_cors::Cors;
use actix_web::web;

/// Register routes and sub-scopes for the API.
pub fn configure_services(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .configure(controllers::auth::auth_config)
            .configure(controllers::db::db_config)
            .configure(controllers::files::files_config),
    );
}

/// Builds CORS policy
pub fn build_cors(off_cors: bool, address: &str, port: u16) -> Cors {
    if off_cors {
        Cors::permissive()
    } else {
        let origin = format!("http://{address}:{port}");
        Cors::default()
            .allowed_origin(origin.as_str())
            .allowed_methods(vec!["GET", "POST"])
            .allowed_header(actix_web::http::header::CONTENT_TYPE)
            .max_age(3600)
    }
}
