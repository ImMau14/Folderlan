// Updates user permissions.
use crate::models::responses::ApiResponse;
use actix_web::{Responder, web};
use serde::Deserialize;
use sqlx::SqlitePool;

/// User permission update payload.
#[derive(Deserialize)]
pub struct UpdateUserPerms {
    pub can_upload: Option<bool>,
    pub can_delete_own_files: Option<bool>,
    pub has_upload_limits: Option<bool>,
    pub upload_limit: Option<i64>,
}

/// Updates user permissions.
pub async fn update_user_perms(
    pool: web::Data<SqlitePool>,
    path: web::Path<u64>,
    payload: web::Json<UpdateUserPerms>,
) -> impl Responder {
    let id = path.into_inner();
    let payload = payload.into_inner();

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
        r#"
        UPDATE Users 
        SET 
            can_upload = COALESCE(?, can_upload),
            can_delete_own_files = COALESCE(?, can_delete_own_files),
            has_upload_limits = COALESCE(?, has_upload_limits),
            upload_limit = COALESCE(?, upload_limit)
        WHERE id = ?
    "#,
    )
    .bind(payload.can_upload.map(|b| if b { 1i64 } else { 0i64 }))
    .bind(
        payload
            .can_delete_own_files
            .map(|b| if b { 1i64 } else { 0i64 }),
    )
    .bind(
        payload
            .has_upload_limits
            .map(|b| if b { 1i64 } else { 0i64 }),
    )
    .bind(payload.upload_limit)
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
                    .message("User permissions updated successfully")
                    .ok()
            }
        }
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Internal server error: {e}"))
            .internal(),
    }
}
