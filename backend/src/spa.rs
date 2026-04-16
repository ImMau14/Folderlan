// SPA handler for serving embedded static files in Actix-Web applications

use actix_web::{HttpRequest, HttpResponse, Result, web};
use mime_guess::from_path;
use percent_encoding::percent_decode_str;

// Import ApiResponse only when the SPA is NOT embedded
#[cfg(not(has_dist))]
use crate::models::responses::ApiResponse;

// Embeds entire `dist/` directory into binary at compile time
#[cfg(has_dist)]
static ASSETS: include_dir::Dir<'_> = include_dir::include_dir!("$CARGO_MANIFEST_DIR/dist");

// Normal SPA handler when dist is embedded
#[cfg(has_dist)]
async fn spa_handler(req: HttpRequest) -> Result<HttpResponse> {
    let raw = req.path().trim_start_matches('/');
    let path = percent_decode_str(raw).decode_utf8_lossy();
    let try_path = if path.is_empty() {
        "index.html".into()
    } else {
        path.into_owned()
    };

    if let Some(file) = ASSETS.get_file(&try_path) {
        let mime = from_path(&try_path).first_or_octet_stream();
        Ok(HttpResponse::Ok()
            .content_type(mime.essence_str())
            .body(file.contents()))
    } else {
        // SPA fallback – serve index.html for client-side routing
        let index = ASSETS
            .get_file("index.html")
            .expect("dist/index.html must exist when has_dist is defined");
        Ok(HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(index.contents()))
    }
}

// Fallback handler when dist is missing – return JSON error using ApiResponse
#[cfg(not(has_dist))]
async fn spa_handler(_req: HttpRequest) -> Result<HttpResponse> {
    let response = ApiResponse::<()>::builder()
        .message("SPA not available: the 'dist' directory was not embedded at compile time")
        .not_found(); // or .bad_request() / .internal()

    Ok(response)
}

// Configures Actix-Web application to use SPA handler as default service
pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.default_service(web::route().to(spa_handler));
}
