//! Handles owner password reset (local server only).

use crate::models::responses::ApiResponse;
use crate::utils::helpers::hash_password;
use actix_web::{HttpRequest, HttpResponse, web};
use serde::Deserialize;
use sqlx::SqlitePool;

/// Expected structure for owner password reset request.
#[derive(Deserialize)]
pub struct OwnerResetPayload {
    pub password: String,
}

/// Resets the password of the single owner account.
pub async fn owner_reset_password(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    payload: web::Json<OwnerResetPayload>,
) -> HttpResponse {
    let password = payload.password.trim();

    // Fetch owner account.
    let owner = match sqlx::query!(
        r#"
        SELECT id, username
        FROM Users
        WHERE role = 'owner' AND is_deleted = 0
        LIMIT 1
        "#
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => (row.id, row.username),
        Ok(None) => {
            return ApiResponse::<()>::builder()
                .message("Owner account not found")
                .internal();
        }
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    // Hash new password.
    let password_hash = match hash_password(password) {
        Ok(pass) => pass,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    // Update password in database.
    if let Err(e) = sqlx::query!(
        "UPDATE Users SET password_hash = ? WHERE id = ?",
        password_hash,
        owner.0
    )
    .execute(pool.get_ref())
    .await
    {
        return ApiResponse::<()>::builder()
            .message(e.to_string())
            .internal();
    }

    let ip_addr = req
        .connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string();

    // Build description string before passing to query macro.
    let description = format!(
        "Owner password reset via LocalOnly endpoint for user {}",
        owner.1
    );

    // Log the action.
    let _ = sqlx::query!(
        r#"
        INSERT INTO AuditLog(user_id, event_type, description, ip_address, success)
        VALUES (?, ?, ?, ?, 1)
        "#,
        owner.0,
        "OWNER_PASSWORD_RESET",
        description,
        ip_addr
    )
    .execute(pool.get_ref())
    .await;

    ApiResponse::<()>::builder()
        .message("Owner password updated successfully")
        .ok()
}
