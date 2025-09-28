// Middleware for role-based authorization. Checks if the authenticated user has required permissions.
use crate::{middleware::jwt_middleware::AuthUser, models::responses::ApiResponse};
use actix_service::Service;
use actix_web::{
    Error, HttpMessage,
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse, Transform},
    error::InternalError,
};
use futures_util::future::{LocalBoxFuture, Ready, ready};
use std::{
    rc::Rc,
    task::{Context, Poll},
};

// Configuration for allowed roles
#[derive(Clone)]
pub struct RoleAuth {
    allowed_roles: Vec<String>,
}

impl RoleAuth {
    // Creates new RoleAuth with specified roles
    #[allow(dead_code)]
    pub fn new(roles: &[&str]) -> Self {
        Self {
            allowed_roles: roles.iter().map(|s| s.to_string()).collect(),
        }
    }
}

// Middleware service implementation
pub struct RoleAuthMiddleware<S> {
    service: Rc<S>,
    allowed_roles: Vec<String>,
}

// Transforms service by adding role-based authorization
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

    // Creates new middleware instance
    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(RoleAuthMiddleware {
            service: Rc::new(service),
            allowed_roles: self.allowed_roles.clone(),
        }))
    }
}

// Service implementation for role authorization
impl<S, B> Service<ServiceRequest> for RoleAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    // Proxies readiness poll to inner service
    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    // Checks user authentication and authorization before proceeding
    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();
        let allowed = self.allowed_roles.clone();

        Box::pin(async move {
            // Extracts authentication data from request extensions
            let maybe_auth = req.extensions().get::<AuthUser>().cloned();

            let auth = match maybe_auth {
                Some(a) => a,
                None => {
                    let msg = "Not authenticated";
                    let resp = ApiResponse::<()>::builder().message(msg).unauthorized();
                    let err: Error = InternalError::from_response(msg, resp).into();
                    return Err(err);
                }
            };

            // Verifies user has required role
            if !allowed.iter().any(|r| r == &auth.role) {
                let msg = "Access denied";
                let resp = ApiResponse::<()>::builder().message(msg).forbidden();
                let err: Error = InternalError::from_response(msg, resp).into();
                return Err(err);
            }

            // Proceeds with request processing if authorized
            let res = svc.call(req).await?;
            Ok(res)
        })
    }
}
