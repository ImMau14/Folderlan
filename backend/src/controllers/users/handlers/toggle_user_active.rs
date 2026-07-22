// Toggles user active status.
use crate::models::responses::ApiResponse;
use actix_web::{Responder, web};
use sqlx::SqlitePool;

/// Toggles user active status.
pub async fn toggle_user_active(
    pool: web::Data<SqlitePool>,
    path: web::Path<u64>,
) -> impl Responder {
    let id = path.into_inner();

    let user_exists =
        match sqlx::query_scalar::<_, i64>("SELECT 1 FROM Users WHERE id = ? AND is_deleted = 0")
            .bind(id as i64)
            .fetch_optional(pool.get_ref())
            .await
        {
            Ok(Some(_)) => true,
            Ok(None) => false,
            Err(e) => {
                return ApiResponse::<()>::builder()
                    .message(format!("DB error: {e}"))
                    .internal();
            }
        };

    if !user_exists {
        return ApiResponse::<()>::builder()
            .message("User not found")
            .not_found();
    }

    match sqlx::query(
        "
        UPDATE Users 
        SET 
            is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
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
                    .message("User status toggled successfully")
                    .ok()
            }
        }
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Internal server error: {e}"))
            .internal(),
    }
}
