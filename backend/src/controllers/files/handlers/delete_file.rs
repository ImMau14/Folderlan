//! Soft‑deletes a file and removes its physical storage.

use crate::{
    models::{responses::ApiResponse, types::UploadsPath},
    utils::{
        db::{MinLevel, check_file_permission},
        helpers::get_user_id,
    },
};
use actix_web::{HttpRequest, HttpResponse, web};
use sqlx::SqlitePool;

/// Marks a file as deleted and removes it from disk.
pub async fn delete_file(
    path: web::Path<u64>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    upload_path: web::Data<UploadsPath>,
) -> HttpResponse {
    let file_id = *path as i64;
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    // Verify user has collaborator permission.
    let (internal_path, _) =
        match check_file_permission(pool.get_ref(), user_id, *path, MinLevel::Collaborator).await {
            Ok(p) => p,
            Err(resp) => return resp,
        };

    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(_) => {
            return ApiResponse::<()>::builder()
                .message("Failed to start transaction")
                .internal();
        }
    };

    if let Err(e) = sqlx::query!(
        "UPDATE Files SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
        file_id
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
            .message("Transaction failed")
            .internal();
    }

    let full_path = upload_path.get_ref().get().join(&internal_path);
    if let Err(e) = tokio::fs::remove_file(&full_path).await {
        return ApiResponse::<()>::builder()
            .message(format!(
                "File deleted from database but physical removal failed: {e}"
            ))
            .ok();
    }

    ApiResponse::<()>::builder()
        .message("File deleted successfully")
        .ok()
}
