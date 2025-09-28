// Middleware for permission-based authorization.
use crate::{middleware::jwt_middleware::AuthUser, models::responses::ApiResponse};
use actix_service::Service;
use actix_web::{
    Error, HttpMessage,
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse, Transform},
    error::InternalError,
    web::Data,
};
use futures_util::future::{LocalBoxFuture, Ready, ready};
use sqlx::{Row, SqlitePool};
use std::{
    rc::Rc,
    task::{Context, Poll},
};

// User permissions structure
#[derive(Debug, Clone)]
pub struct UserPermissions {
    pub can_upload: bool,
    pub can_delete_own_files: bool,
    pub has_upload_limits: bool,
}

// Permission-based authentication middleware
#[derive(Clone)]
pub struct PermsAuth {
    required_perms: Vec<String>,
}

impl PermsAuth {
    // Creates new middleware with required permissions
    pub fn new(perms: &[&str]) -> Self {
        Self {
            required_perms: perms.iter().map(|s| s.to_string()).collect(),
        }
    }
}

// Actix-web transformer implementation
impl<S, B> Transform<S, ServiceRequest> for PermsAuth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = PermsAuthMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    // Creates new middleware instance
    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(PermsAuthMiddleware {
            service: Rc::new(service),
            required_perms: self.required_perms.clone(),
        }))
    }
}

// Permission authentication middleware service
pub struct PermsAuthMiddleware<S> {
    service: Rc<S>,
    required_perms: Vec<String>,
}

impl<S, B> Service<ServiceRequest> for PermsAuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: MessageBody + 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    // Delegates readiness polling to inner service
    fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    // Main request handling logic
    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone();
        let required_perms = self.required_perms.clone();

        Box::pin(async move {
            // Extract authentication data from request extensions
            let auth = match req.extensions().get::<AuthUser>().cloned() {
                Some(a) => a,
                None => {
                    let msg = "Not authenticated";
                    let resp = ApiResponse::<()>::builder().message(msg).unauthorized();
                    return Err(InternalError::from_response(msg.to_string(), resp).into());
                }
            };

            // Bypass permission checks for owner role
            if auth.role == "owner" {
                let user_perms = UserPermissions {
                    can_upload: true,
                    can_delete_own_files: true,
                    has_upload_limits: false, // Owner has no upload limits
                };
                req.extensions_mut().insert(user_perms);
                return svc.call(req).await;
            }

            // Retrieve database connection pool
            let pool = match req.app_data::<Data<SqlitePool>>() {
                Some(d) => d.get_ref().clone(),
                None => {
                    let msg = "Database pool not configured";
                    let resp = ApiResponse::<()>::builder().message(msg).internal();
                    return Err(InternalError::from_response(msg.to_string(), resp).into());
                }
            };

            // Build dynamic SQL query based on required permissions
            let base_columns = ["can_upload", "can_delete_own_files", "has_upload_limits"];
            let mut all_columns_to_fetch: Vec<String> = required_perms.clone();
            all_columns_to_fetch.extend(base_columns.iter().map(|s| s.to_string()));
            all_columns_to_fetch.sort();
            all_columns_to_fetch.dedup();

            let query_string = format!(
                "SELECT {} FROM Users WHERE id = ? AND is_active = 1 AND is_deleted = 0",
                all_columns_to_fetch.join(", ")
            );

            // Execute permission query
            let row = match sqlx::query(&query_string)
                .bind(auth.id)
                .fetch_one(&pool)
                .await
            {
                Ok(r) => r,
                Err(sqlx::Error::RowNotFound) => {
                    let msg = "User not found or inactive";
                    let resp = ApiResponse::<()>::builder().message(msg).unauthorized();
                    return Err(InternalError::from_response(msg.to_string(), resp).into());
                }
                Err(e) => {
                    tracing::error!("DB error fetching user permissions: {:?}", e);
                    let msg = "Database error";
                    let resp = ApiResponse::<()>::builder().message(msg).internal();
                    return Err(InternalError::from_response(msg.to_string(), resp).into());
                }
            };

            // Validate each required permission
            for perm_name in &required_perms {
                let has_perm: bool =
                    row.try_get::<i64, _>(perm_name.as_str()).unwrap_or(0_i64) != 0;
                if !has_perm {
                    let msg = "Access denied: insufficient permissions";
                    let resp = ApiResponse::<()>::builder().message(msg).forbidden();
                    return Err(InternalError::from_response(msg.to_string(), resp).into());
                }
            }

            // Store user permissions in request extensions
            let user_perms = UserPermissions {
                can_upload: row.try_get::<i64, _>("can_upload").unwrap_or(0_i64) != 0,
                can_delete_own_files: row
                    .try_get::<i64, _>("can_delete_own_files")
                    .unwrap_or(0_i64)
                    != 0,
                has_upload_limits: row.try_get::<i64, _>("has_upload_limits").unwrap_or(0_i64) != 0,
            };
            req.extensions_mut().insert(user_perms);

            // Proceed with request processing
            svc.call(req).await
        })
    }
}
