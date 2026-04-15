//! Grants or updates a user's permission on a file.

use crate::{
    models::responses::ApiResponse,
    utils::{
        db::{MinLevel, check_file_permission},
        helpers::get_user_id,
    },
};
use actix_web::{HttpRequest, HttpResponse, web};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Deserialize)]
pub struct PermPayload {
    user_id: i64,
    access_level: String,
}

#[derive(sqlx::FromRow, Serialize)]
pub struct FilePermRow {
    user_id: i64,
    username: Option<String>,
    access_level: String,
    granted_at: Option<String>,
    granted_by: Option<i64>,
}

/// Grants or updates file access for a target user.
pub async fn grant_permission(
    path: web::Path<u64>,
    payload: web::Json<PermPayload>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> HttpResponse {
    // SQLite expects i64.
    let file_id = *path as i64;
    let body = payload.into_inner();
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };
    // Convert to i64 for SQLite compatibility.
    let user_id_i64 = user_id as i64;

    // Validate access level.
    let access = body.access_level.as_str();
    if access != "viewer" && access != "collaborator" {
        return ApiResponse::<()>::builder()
            .message("Invalid access_level; must be 'viewer' or 'collaborator'")
            .bad_request();
    }

    // Check that current user is owner or uploader (has collaborator permission).
    let perm_check =
        check_file_permission(pool.get_ref(), user_id, *path, MinLevel::Collaborator).await;
    match perm_check {
        Ok(_) => {}
        Err(resp) => return resp,
    }

    // Ensure target user exists.
    let target_exists = sqlx::query_scalar!(
        "SELECT id FROM Users WHERE id = ? AND is_deleted = 0",
        body.user_id
    )
    .fetch_optional(pool.get_ref())
    .await
    .map(|opt| opt.is_some())
    .unwrap_or(false);

    if !target_exists {
        return ApiResponse::<()>::builder()
            .message("Target user not found")
            .not_found();
    }

    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(_) => {
            return ApiResponse::<()>::builder()
                .message("Failed to start transaction")
                .internal();
        }
    };

    if let Err(e) = sqlx::query!(
        r#"
        INSERT INTO FilePermissions (file_id, user_id, access_level, granted_by, granted_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(file_id, user_id) DO UPDATE SET
            access_level = excluded.access_level,
            granted_by = excluded.granted_by,
            granted_at = CURRENT_TIMESTAMP
        "#,
        file_id,
        body.user_id,
        access,
        user_id_i64
    )
    .execute(&mut *tx)
    .await
    {
        let _ = tx.rollback().await;
        return ApiResponse::<()>::builder()
            .message(format!("Database error: {e}"))
            .internal();
    }

    if tx.commit().await.is_err() {
        return ApiResponse::<()>::builder()
            .message("Transaction commit failed")
            .internal();
    }

    // Fetch the updated permission row.
    let row = match sqlx::query_as!(
        FilePermRow,
        r#"
        SELECT
            fp.user_id as "user_id!",
            u.username as "username: _",
            fp.access_level as "access_level!",
            fp.granted_at as "granted_at: _",
            fp.granted_by as "granted_by: _"
        FROM FilePermissions fp
        LEFT JOIN Users u ON u.id = fp.user_id
        WHERE fp.file_id = ? AND fp.user_id = ?
        "#,
        file_id,
        body.user_id
    )
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Failed to fetch permission: {e}"))
                .internal();
        }
    };

    ApiResponse::builder()
        .message("Permission granted/updated")
        .data(row)
        .ok()
}
