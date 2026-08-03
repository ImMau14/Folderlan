pub mod handlers;

use actix_web::web;
use actix_web_httpauth::middleware::HttpAuthentication;

use crate::middleware::{jwt_middleware::jwt_validator_adapter, role_middleware::RoleAuth};
use handlers::{
    delete_user, get_accessible_files, get_me, get_users, toggle_user_active, update_user_perms,
};

/// Configures user management routes with JWT authentication and role-based authorization.
pub fn users_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/user")
            .service(
                web::resource("/me")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(get_me)),
            )
            .service(
                web::resource("")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(get_users)),
            )
            .service(
                web::resource("/{id}")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::delete().to(delete_user)),
            )
            .service(
                web::resource("/{id}/toggle")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(toggle_user_active)),
            )
            .service(
                web::resource("/{id}/perms")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(update_user_perms)),
            )
            .service(
                web::resource("/{id}/accessible")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(get_accessible_files)),
            ),
    );
}
