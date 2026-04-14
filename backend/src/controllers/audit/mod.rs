// Configures the audit log API endpoints.

pub mod handlers;

use crate::{
    middleware::{jwt_middleware::jwt_validator_adapter, role_middleware::RoleAuth},
};
use actix_web::web;
use actix_web_httpauth::middleware::HttpAuthentication;
use handlers::list_audit_logs;

pub fn audit_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/audit")
            .wrap(RoleAuth::new(&["owner"]))
            .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
            .route("", web::get().to(list_audit_logs)),
    );
}
