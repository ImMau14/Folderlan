//! Revokes a user's permission on a file.

use crate::{
    models::responses::ApiResponse,
    utils::{
        db::{MinLevel, check_file_permission},
        helpers::get_user_id,
    },
};
use actix_web::{HttpRequest, HttpResponse, web};
use sqlx::SqlitePool;

/// Removes a specific user's access to a file.
pub async fn revoke_permission(
    path: web::Path<(u64, i64)>, // (file_id, user_id)
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> HttpResponse {
    let (file_id_u64, target_user_id) = path.into_inner();
    let file_id = file_id_u64 as i64;
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    // Authorization: must have collaborator permission.
    let perm_check =
        check_file_permission(pool.get_ref(), user_id, file_id_u64, MinLevel::Collaborator).await;
    match perm_check {
        Ok(_) => {}
        Err(resp) => return resp,
    }

    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(_) => {
            return ApiResponse::<()>::builder()
                .message("Failed to start transaction")
                .internal();
        }
    };

    let result = sqlx::query!(
        "DELETE FROM FilePermissions WHERE file_id = ? AND user_id = ?",
        file_id,
        target_user_id
    )
    .execute(&mut *tx)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            if tx.commit().await.is_err() {
                return ApiResponse::<()>::builder()
                    .message("Transaction commit failed")
                    .internal();
            }
            ApiResponse::<()>::builder()
                .message("Permission revoked")
                .ok()
        }
        Ok(_) => {
            let _ = tx.rollback().await;
            ApiResponse::<()>::builder()
                .message("Permission entry not found")
                .not_found()
        }
        Err(e) => {
            let _ = tx.rollback().await;
            ApiResponse::<()>::builder()
                .message(format!("Database error: {e}"))
                .internal()
        }
    }
}
