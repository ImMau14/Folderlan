//! Lists all permissions granted on a file.

use crate::{
    models::responses::ApiResponse,
    utils::{
        db::{MinLevel, check_file_permission},
        helpers::get_user_id,
    },
};
use actix_web::{HttpRequest, HttpResponse, web};
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(sqlx::FromRow, Serialize)]
pub struct FilePermRow {
    user_id: i64,
    username: Option<String>,
    access_level: String,
    granted_at: Option<String>,
    granted_by: Option<i64>,
}

/// Returns a list of all permissions for a given file.
pub async fn list_permissions(
    path: web::Path<u64>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> HttpResponse {
    // SQLite expects i64.
    let file_id = *path as i64;
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };
    // Convert to i64 for SQLite compatibility.
    let _user_id_i64 = user_id as i64;

    // Authorization: must have collaborator permission.
    let perm_check =
        check_file_permission(pool.get_ref(), user_id, *path, MinLevel::Collaborator).await;
    match perm_check {
        Ok(_) => {}
        Err(resp) => return resp,
    }

    let rows = match sqlx::query_as!(
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
        WHERE fp.file_id = ?
        ORDER BY fp.granted_at DESC
        "#,
        file_id
    )
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Database error: {e}"))
                .internal();
        }
    };

    ApiResponse::builder()
        .message("Permissions listed")
        .data(rows)
        .ok()
}
