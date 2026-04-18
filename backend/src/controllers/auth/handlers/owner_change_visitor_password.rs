//! Handles owner resetting a visitor's password.

use crate::middleware::jwt_middleware::Claims;
use crate::models::responses::ApiResponse;
use crate::utils::helpers::hash_password;
use actix_web::{HttpMessage, HttpRequest, HttpResponse, web};
use serde::Deserialize;
use sqlx::SqlitePool;

/// Expected structure for visitor password reset request.
#[derive(Deserialize)]
pub struct VisitorResetPayload {
    pub username: String,
    pub password: String,
}

/// Allows an authenticated owner to change a visitor's password.
pub async fn owner_change_visitor_password(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    payload: web::Json<VisitorResetPayload>,
) -> HttpResponse {
    let payload = payload.into_inner();
    let username = payload.username.trim();
    let password = payload.password.trim();

    if username.is_empty() {
        return ApiResponse::<()>::builder()
            .message("username is required")
            .bad_request();
    }

    // Fetch target user.
    let user = match sqlx::query!(
        r#"
        SELECT id, role, is_deleted, username
        FROM Users
        WHERE username = ?
        LIMIT 1
        "#,
        username
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => (row.id, row.role, row.is_deleted, row.username),
        Ok(None) => {
            return ApiResponse::<()>::builder()
                .message("Visitor not found")
                .not_found();
        }
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    // Validate target user.
    if user.2 == 1 {
        return ApiResponse::<()>::builder()
            .message("User has been deleted")
            .bad_request();
    }
    if user.1 != "visitor" {
        return ApiResponse::<()>::builder()
            .message("Target user is not a visitor")
            .bad_request();
    }

    // Hash new password.
    let password_hash = match hash_password(password) {
        Ok(pass) => pass,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Password hash error: {}", e))
                .internal();
        }
    };

    // Update password.
    if let Err(e) = sqlx::query!(
        "UPDATE Users SET password_hash = ? WHERE id = ?",
        password_hash,
        user.0
    )
    .execute(pool.get_ref())
    .await
    {
        return ApiResponse::<()>::builder()
            .message(e.to_string())
            .internal();
    }

    // Extract actor user ID from JWT claims for audit log.
    let mut actor_user_id: Option<i64> = None;
    if let Some(claims) = req.extensions().get::<Claims>()
        && let Ok(parsed) = claims.sub.parse::<i64>()
    {
        actor_user_id = Some(parsed);
    }

    let ip_addr = req
        .connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string();

    // Log the action.
    if let Some(actor_id) = actor_user_id {
        let description = format!(
            "Owner (id={}) reset password for visitor {}",
            actor_id, user.3
        );
        let _ = sqlx::query!(
            r#"
            INSERT INTO AuditLog(user_id, event_type, description, ip_address, success)
            VALUES (?, ?, ?, ?, 1)
            "#,
            actor_id,
            "OWNER_RESET_VISITOR_PASSWORD",
            description,
            ip_addr
        )
        .execute(pool.get_ref())
        .await;
    } else {
        let description = format!("Owner (unknown) reset password for visitor {}", user.3);
        let _ = sqlx::query!(
            r#"
            INSERT INTO AuditLog(event_type, description, ip_address, success)
            VALUES (?, ?, ?, 1)
            "#,
            "OWNER_RESET_VISITOR_PASSWORD",
            description,
            ip_addr
        )
        .execute(pool.get_ref())
        .await;
    }

    ApiResponse::<()>::builder()
        .message("Visitor password updated successfully")
        .ok()
}
