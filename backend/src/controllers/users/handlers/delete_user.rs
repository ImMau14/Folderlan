// Soft-deletes a user by setting is_deleted flag.
use crate::models::responses::ApiResponse;
use actix_web::{HttpResponse, web};
use sqlx::{Row, SqlitePool};

/// Soft-deletes a user by setting is_deleted flag. Prevents owner deletion.
pub async fn delete_user(pool: web::Data<SqlitePool>, path: web::Path<u64>) -> HttpResponse {
    let id = path.into_inner();

    let row = match sqlx::query(
        "
        SELECT role 
        FROM Users 
        WHERE 
            id = ? 
            AND is_deleted = 0
    ",
    )
    .bind(id as i64)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return ApiResponse::<()>::builder()
                .message("User not found")
                .not_found();
        }
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Internal server error: {e}"))
                .internal();
        }
    };

    let role: String = match row.try_get("role") {
        Ok(role) => role,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Internal server error: {e}"))
                .internal();
        }
    };

    if role == "owner" {
        return ApiResponse::<()>::builder()
            .message("Cannot delete owner user")
            .bad_request();
    }

    match sqlx::query(
        "
        UPDATE Users 
        SET 
            is_deleted = 1,
            deleted_at = CURRENT_TIMESTAMP,
            is_active = 0
        WHERE id = ?
    ",
    )
    .bind(id as i64)
    .execute(pool.get_ref())
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                ApiResponse::<()>::builder()
                    .message("User not found")
                    .not_found()
            } else {
                ApiResponse::<()>::builder()
                    .message("User deleted successfully")
                    .ok()
            }
        }
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Internal server error: {e}"))
            .internal(),
    }
}
