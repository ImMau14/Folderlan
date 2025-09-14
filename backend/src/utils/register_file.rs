use actix_web::HttpResponse;
use sqlx::SqlitePool;

use crate::models::responses::ApiResponse;

pub struct RegisterFilePayload {
    pub name: String,
    pub internal_path: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub uploaded_by: u64,
}

pub async fn register_file(pool: &SqlitePool, file: RegisterFilePayload) -> HttpResponse {
    match sqlx::query(
        "
            INSERT INTO Files (
                name,
                internal_path,
                size_bytes,
                mime_type,
                uploaded_by
            ) VALUES (?, ?, ?, ?, ?)
        ",
    )
    .bind(&file.name)
    .bind(&file.internal_path)
    .bind(file.size_bytes as i64)
    .bind(&file.mime_type)
    .bind(file.uploaded_by as i64)
    .execute(pool)
    .await
    {
        Ok(result) if result.rows_affected() == 1 => ApiResponse::<()>::builder()
            .message("Saved file successfully")
            .created(),

        Ok(_) => ApiResponse::<()>::builder()
            .message("No record was inserted")
            .internal(),

        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Database error: {e}"))
            .internal(),
    }
}
