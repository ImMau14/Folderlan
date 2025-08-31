use actix_service::Service;
use actix_web::{
    Error, HttpMessage,
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse, Transform},
};
use futures_util::future::{LocalBoxFuture, Ready, ready};
use std::{
    rc::Rc,
    task::{Context, Poll},
};

use crate::middleware::jwt_middleware::AuthUser;

use actix_web::HttpResponse;
use actix_web::error::InternalError;
use serde_json::json;

#[allow(dead_code)]
#[derive(Clone)]
pub struct RoleAuth {
    allowed_roles: Vec<String>,
}

impl RoleAuth {
    #[allow(dead_code)]
    pub fn new(roles: &[&str]) -> Self {
        Self {
            allowed_roles: roles.iter().map(|s| s.to_string()).collect(),
        }
    }
}

pub struct RoleAuthMiddleware<S> {
    service: Rc<S>,
    allowed_roles: Vec<String>,
}

impl<S, B> Transform<S, ServiceRequest> for RoleAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = RoleAuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RoleAuthMiddleware {
            service: Rc::new(service),
            allowed_roles: self.allowed_roles.clone(),
        }))
    }
}

impl<S, B> Service<ServiceRequest> for RoleAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();
        let allowed = self.allowed_roles.clone();

        Box::pin(async move {
            let maybe_auth = req.extensions().get::<AuthUser>().cloned();

            let auth = match maybe_auth {
                Some(a) => a,
                None => {
                    let body = json!({ "success": false, "message": "Not authenticated" });
                    let resp = HttpResponse::Unauthorized().json(body);
                    let err: Error = InternalError::from_response("Not authenticated", resp).into();
                    return Err(err);
                }
            };

            if !allowed.iter().any(|r| r == &auth.role) {
                let body = json!({ "success": false, "message": "Access denied" });
                let resp = HttpResponse::Forbidden().json(body);
                let err: Error = InternalError::from_response("Access denied", resp).into();
                return Err(err);
            }

            let res = svc.call(req).await?;
            Ok(res)
        })
    }
}
