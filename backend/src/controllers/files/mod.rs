pub mod handlers;

use actix_web::web;
use actix_web_httpauth::middleware::HttpAuthentication;

use crate::middleware::{jwt_middleware::jwt_validator_adapter, perms_middleware::PermsAuth};
use handlers::{
    delete_file, download_file, get_files, grant_permission, list_permissions, revoke_permission,
    toggle_public, upload_file,
};

/// Configures file management routes under the `/files` scope.
pub fn files_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/files")
            .service(
                web::resource("/upload")
                    .wrap(PermsAuth::new(&["can_upload"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(upload_file)),
            )
            .service(
                web::resource("")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(get_files)),
            )
            .service(
                web::resource("/{id}")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::delete().to(delete_file)),
            )
            .service(
                web::resource("/download/{id}")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(download_file)),
            )
            .service(
                web::resource("/{id}/perms")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(grant_permission))
                    .route(web::get().to(list_permissions)),
            )
            .service(
                web::resource("/{id}/perms/{user_id}")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::delete().to(revoke_permission)),
            )
            .service(
                web::resource("/{id}/public")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::patch().to(toggle_public)),
            ),
    );
}
