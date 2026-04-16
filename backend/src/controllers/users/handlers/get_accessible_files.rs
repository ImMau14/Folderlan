// Retrieves all files accessible by a user including ownership and permissions.
use crate::models::responses::ApiResponse;
use actix_web::{Responder, web};
use serde::Serialize;
use sqlx::SqlitePool;

/// File accessible by a user with access level.
#[derive(Serialize, sqlx::FromRow)]
pub struct AccessibleFile {
    pub id: i64,
    pub name: String,
    pub size_bytes: i64,
    pub mime_type: Option<String>,
    pub uploaded_by: i64,
    pub uploaded_at: String,
    pub access_type: String, // "owner", "viewer", "collaborator"
}

/// Retrieves all files accessible by a user including ownership and permissions.
pub async fn get_accessible_files(
    pool: web::Data<SqlitePool>,
    user_id: web::Path<u64>,
) -> impl Responder {
    let user_id = user_id.into_inner() as i64;

    let query = r#"
        SELECT 
            f.id, 
            f.name, 
            f.size_bytes, 
            f.mime_type, 
            f.uploaded_by, 
            f.uploaded_at,
            CASE
                WHEN f.uploaded_by = ? THEN 'owner'
                WHEN fp.access_level = 'collaborator' THEN 'collaborator'
                ELSE 'viewer'
            END as access_type
        FROM Files f
        LEFT JOIN FilePermissions fp ON 
            f.id = fp.file_id AND 
            fp.user_id = ?
        WHERE 
            f.is_deleted = 0 AND
            (f.is_public = 1 OR 
             f.uploaded_by = ? OR 
             fp.user_id IS NOT NULL)
    "#;

    match sqlx::query_as::<_, AccessibleFile>(query)
        .bind(user_id)
        .bind(user_id)
        .bind(user_id)
        .fetch_all(pool.get_ref())
        .await
    {
        Ok(files) => ApiResponse::builder()
            .message("Files fetched successfully")
            .data(files)
            .ok(),
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("DB error: {e}"))
            .internal(),
    }
}
