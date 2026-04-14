pub mod handlers;

use actix_web::web;

use crate::middleware::server_ip_only::LocalOnly;
use handlers::{db_exists, init_db};

pub fn db_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/db")
            .route("", web::get().to(db_exists))
            .service(
                web::resource("")
                    .wrap(LocalOnly)
                    .route(web::post().to(init_db)),
            ),
    );
}
