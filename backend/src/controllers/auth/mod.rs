pub mod handlers;

use actix_web::web;
use actix_web_httpauth::middleware::HttpAuthentication;

use crate::middleware::{
    jwt_middleware::jwt_validator_adapter, role_middleware::RoleAuth, server_ip_only::LocalOnly,
};
use handlers::{
    login, owner_change_visitor_password, owner_register, owner_reset_password, register,
};

/// Configures authentication routes under the `/auth` scope.
pub fn auth_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .service(web::resource("/login").route(web::post().to(login)))
            .service(
                web::resource("/register")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(register)),
            )
            .service(
                web::resource("/owner_register")
                    .wrap(LocalOnly)
                    .route(web::post().to(owner_register)),
            )
            .service(
                web::resource("/owner_reset_password")
                    .wrap(LocalOnly)
                    .route(web::post().to(owner_reset_password)),
            )
            .service(
                web::resource("/visitor_reset_password")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(owner_change_visitor_password)),
            ),
    );
}
