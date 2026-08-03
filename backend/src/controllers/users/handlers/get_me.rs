use crate::{middleware::jwt_middleware::AuthUser, models::responses::ApiResponse};
use actix_web::{HttpMessage, HttpRequest, HttpResponse, web};
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Serialize, sqlx::FromRow)]
pub struct MeResponse {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub can_upload: bool,
    pub can_delete_own_files: bool,
    pub has_upload_limits: bool,
    pub upload_limit: i64,
}

pub async fn get_me(pool: web::Data<SqlitePool>, req: HttpRequest) -> HttpResponse {
    let auth = match req.extensions().get::<AuthUser>().cloned() {
        Some(a) => a,
        None => {
            return ApiResponse::<()>::builder()
                .message("Not authenticated")
                .unauthorized();
        }
    };

    match sqlx::query_as::<_, MeResponse>(
        r#"
        SELECT
            id,
            username,
            role,
            can_upload,
            can_delete_own_files,
            has_upload_limits,
            upload_limit
        FROM Users
        WHERE id = ? AND is_deleted = 0 AND is_active = 1
        "#,
    )
    .bind(auth.id)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => ApiResponse::builder()
            .message("User info retrieved")
            .data(row)
            .ok(),
        Ok(None) => ApiResponse::<()>::builder()
            .message("User not found or inactive")
            .unauthorized(),
        Err(e) => {
            tracing::error!("DB error fetching user info: {:?}", e);
            ApiResponse::<()>::builder()
                .message("Database error")
                .internal()
        }
    }
}
