use crate::{
    models::responses::ApiResponse,
    utils::{
        db::{MinLevel, check_file_permission},
        helpers::get_user_id,
    },
};
use actix_web::{HttpRequest, HttpResponse, web};
use serde::Deserialize;
use sqlx::SqlitePool;

#[derive(Deserialize)]
pub struct TogglePublicPayload {
    pub is_public: bool,
}

pub async fn toggle_public(
    path: web::Path<u64>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    payload: web::Json<TogglePublicPayload>,
) -> HttpResponse {
    let file_id = *path as i64;
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    let _internal_path =
        match check_file_permission(pool.get_ref(), user_id, *path, MinLevel::Collaborator).await {
            Ok(p) => p.0,
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

    if let Err(e) = sqlx::query("UPDATE Files SET is_public = ? WHERE id = ?")
        .bind(payload.is_public)
        .bind(file_id)
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

    let visibility = if payload.is_public {
        "public"
    } else {
        "private"
    };
    ApiResponse::<()>::builder()
        .message(format!("File is now {}", visibility))
        .ok()
}
