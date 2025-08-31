use actix_service::Service;
use actix_web::{
    Error, HttpMessage, HttpResponse,
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse, Transform},
    error::InternalError,
    web::Data,
};
use futures_util::future::{LocalBoxFuture, Ready, ready};
use serde_json::json;
use sqlx::{Row, SqlitePool, sqlite::SqliteRow};
use std::{
    rc::Rc,
    task::{Context, Poll},
};

use crate::middleware::jwt_middleware::AuthUser;

/// Middleware that checks user permission flags stored in the database.
/// - `required_perms` are column names from the Users table.
/// - If user role == "owner", request is allowed (bypass).
/// - All listed permissions must be true (AND).
#[derive(Clone)]
pub struct PermsAuth {
    required_perms: Vec<String>,
}

impl PermsAuth {
    /// Create a new middleware instance with a slice of permission names.
    /// Example: `PermsAuth::new(&["can_upload", "can_delete"])`
    pub fn new(perms: &[&str]) -> Self {
        Self {
            required_perms: perms.iter().map(|s| s.to_string()).collect(),
        }
    }
}

pub struct PermsAuthMiddleware<S> {
    service: Rc<S>,
    required_perms: Vec<String>,
}

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

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(PermsAuthMiddleware {
            service: Rc::new(service),
            required_perms: self.required_perms.clone(),
        }))
    }
}

impl<S, B> Service<ServiceRequest> for PermsAuthMiddleware<S>
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
        let required = self.required_perms.clone();

        Box::pin(async move {
            // Get AuthUser inserted by JWT middleware
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

            // Bypass for owner role
            if auth.role == "owner" {
                let res = svc.call(req).await?;
                return Ok(res);
            }

            // Get DB pool from app_data
            let pool = match req.app_data::<Data<SqlitePool>>() {
                Some(d) => d.get_ref().clone(),
                None => {
                    let body =
                        json!({ "success": false, "message": "Database pool not configured" });
                    let resp = HttpResponse::InternalServerError().json(body);
                    let err: Error =
                        InternalError::from_response("Database pool not configured", resp).into();
                    return Err(err);
                }
            };

            // Fetch the relevant permission columns for this user.
            let row: SqliteRow = match sqlx::query(
                r#"
                SELECT
                    can_access_all_files,
                    can_download,
                    can_upload,
                    can_edit,
                    can_delete,
                    has_upload_limits
                FROM Users
                WHERE id = ? AND is_active = 1 AND is_deleted = 0
                "#,
            )
            .bind(auth.id)
            .fetch_one(&pool)
            .await
            {
                Ok(r) => r,
                Err(sqlx::Error::RowNotFound) => {
                    let body = json!({ "success": false, "message": "User not found or inactive" });
                    let resp = HttpResponse::Unauthorized().json(body);
                    let err: Error =
                        InternalError::from_response("User not found or inactive", resp).into();
                    return Err(err);
                }
                Err(e) => {
                    tracing::error!("DB error fetching user permissions: {:?}", e);
                    let body = json!({ "success": false, "message": "Database error" });
                    let resp = HttpResponse::InternalServerError().json(body);
                    let err: Error = InternalError::from_response("Database error", resp).into();
                    return Err(err);
                }
            };

            // Helper: read a boolean-like column (stored as INTEGER 0/1) from the row.
            // Returns actix_web::Error on failure with proper logging.
            let read_bool_col = |r: &SqliteRow, col: &str| -> Result<bool, Error> {
                let v: i64 = match r.try_get(col) {
                    Ok(val) => val,
                    Err(e) => {
                        tracing::error!("Error reading column `{}`: {:?}", col, e);
                        let body = json!({ "success": false, "message": "Database error" });
                        let resp = HttpResponse::InternalServerError().json(body);
                        let err: Error =
                            InternalError::from_response("Database error", resp).into();
                        return Err(err);
                    }
                };
                Ok(v != 0)
            };

            // Validate required permissions (AND logic).
            for perm in required.iter() {
                // Known permissions mapping: if you add DB permission columns, include here.
                let has_perm = match perm.as_str() {
                    "can_access_all_files"
                    | "can_download"
                    | "can_upload"
                    | "can_edit"
                    | "can_delete"
                    | "has_upload_limits" => {
                        // check column value
                        read_bool_col(&row, perm.as_str())?
                    }
                    unknown => {
                        tracing::warn!("Unknown permission requested in middleware: {}", unknown);
                        let body = json!({ "success": false, "message": format!("Unknown permission: {}", unknown) });
                        let resp = HttpResponse::InternalServerError().json(body);
                        let err: Error =
                            InternalError::from_response("Unknown permission requested", resp)
                                .into();
                        return Err(err);
                    }
                };

                if !has_perm {
                    let body = json!({ "success": false, "message": "Access denied: insufficient permissions" });
                    let resp = HttpResponse::Forbidden().json(body);
                    let err: Error = InternalError::from_response(
                        "Access denied: insufficient permissions",
                        resp,
                    )
                    .into();
                    return Err(err);
                }
            }

            // All checks passed: call next service
            let res = svc.call(req).await?;
            Ok(res)
        })
    }
}
