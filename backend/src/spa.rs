// SPA handler for serving embedded static files in Actix-Web applications
use actix_web::{HttpRequest, HttpResponse, Result, web};
use include_dir::{Dir, include_dir};
use mime_guess::from_path;
use percent_encoding::percent_decode_str;

// Embeds entire `dist/` directory into binary at compile time
static ASSETS: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/dist");

// Handles SPA routing by serving embedded files or falling back to index.html
async fn spa_handler(req: HttpRequest) -> Result<HttpResponse> {
    // Normalize and decode requested path
    let raw = req.path().trim_start_matches('/');
    let path = percent_decode_str(raw).decode_utf8_lossy();
    let try_path = if path.is_empty() {
        "index.html".into()
    } else {
        path.into_owned()
    };

    // Serve requested file if exists in embedded assets
    if let Some(file) = ASSETS.get_file(&try_path) {
        let mime = from_path(&try_path).first_or_octet_stream();
        Ok(HttpResponse::Ok()
            .content_type(mime.essence_str())
            .body(file.contents()))
    } else {
        // Fallback to index.html for SPA routing
        let index = ASSETS
            .get_file("index.html")
            .expect("dist/index.html must exist");
        Ok(HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(index.contents()))
    }
}

// Configures Actix-Web application to use SPA handler as default service
pub fn config(cfg: &mut web::ServiceConfig) {
    // Any request not captured by previous routes will be handled by `spa_handler`
    cfg.default_service(web::route().to(spa_handler));
}
