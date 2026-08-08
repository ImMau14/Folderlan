// Main application module and CORS configuration for the Actix Web server.
pub mod controllers;
pub mod middleware;
pub mod models;
pub mod spa;
pub mod utils;
pub mod watcher;

use actix_cors::Cors;
use actix_web::web;
use std::net::{IpAddr, UdpSocket};

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

/// Best-effort detection of the machine's LAN IP using the UDP connect trick
/// (selects the default route without actually sending any packet).
fn detect_lan_ip() -> Option<IpAddr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip())
}

/// Builds CORS policy with configurable restrictions.
///
/// When CORS is not disabled, the following origins are allowed:
/// - `http://{ADDRESS}:{PORT}` (the bind address)
/// - `http://localhost:{PORT}` and `http://127.0.0.1:{PORT}`
/// - the detected LAN IP (`http://{lan_ip}:{PORT}`) when bound to all interfaces,
///   so pages opened from another device can call the API without CORS failures
/// - any origin listed in `CORS_ALLOWED_ORIGINS` (comma-separated)
pub fn build_cors(off_cors: bool, address: &str, port: u16) -> Cors {
    if off_cors {
        return Cors::permissive();
    }

    let mut origins: Vec<String> = vec![format!("http://{address}:{port}")];
    origins.push(format!("http://localhost:{port}"));
    origins.push(format!("http://127.0.0.1:{port}"));
    if (address == "0.0.0.0" || address == "::")
        && let Some(ip) = detect_lan_ip()
    {
        origins.push(format!("http://{ip}:{port}"));
    }

    if let Ok(list) = std::env::var("CORS_ALLOWED_ORIGINS") {
        for origin in list.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            origins.push(origin.to_string());
        }
    }

    origins.into_iter().fold(
        Cors::default()
            .allowed_methods(vec!["GET", "POST", "DELETE", "PATCH", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::AUTHORIZATION,
            ])
            .max_age(3600),
        |cors, origin| cors.allowed_origin(origin.as_str()),
    )
}
