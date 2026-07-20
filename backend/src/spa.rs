// SPA handler for serving embedded static files in Actix-Web applications
use actix_web::{HttpRequest, HttpResponse, Result, web};
#[cfg(has_dist)]
use mime_guess::from_path;
#[cfg(has_dist)]
use percent_encoding::percent_decode_str;

#[cfg(not(has_dist))]
use crate::models::responses::ApiResponse;

#[cfg(has_dist)]
static ASSETS: include_dir::Dir<'_> = include_dir::include_dir!("$CARGO_MANIFEST_DIR/dist");

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
        let index = ASSETS
            .get_file("index.html")
            .expect("dist/index.html must exist");
        Ok(HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(index.contents()))
    }
}

#[cfg(not(has_dist))]
async fn spa_handler(_req: HttpRequest) -> Result<HttpResponse> {
    Ok(ApiResponse::<()>::builder()
        .message("SPA not available: the 'dist' directory was not embedded at compile time")
        .not_found())
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.default_service(web::route().to(spa_handler));
}
