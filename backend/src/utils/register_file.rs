// Handles file registration in the database by inserting file metadata.
use actix_web::HttpResponse;
use sqlx::SqlitePool;

use crate::models::responses::ApiResponse;

// Represents the file metadata required for database registration
pub struct RegisterFilePayload {
    pub name: String,
    pub internal_path: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub uploaded_by: u64,
}

// Inserts file metadata into the database and returns appropriate HTTP responses
pub async fn register_file(pool: &SqlitePool, file: RegisterFilePayload) -> HttpResponse {
    // Execute SQL insert query with file parameters
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
    .bind(file.size_bytes as i64) // Convert u64 to i64 for SQLite compatibility
    .bind(&file.mime_type)
    .bind(file.uploaded_by as i64) // Convert u64 to i64 for SQLite compatibility
    .execute(pool)
    .await
    {
        // Success case: exactly one row affected
        Ok(result) if result.rows_affected() == 1 => ApiResponse::<()>::builder()
            .message("Saved file successfully")
            .created(),

        // Success case: no rows affected (unexpected but handled)
        Ok(_) => ApiResponse::<()>::builder()
            .message("No record was inserted")
            .internal(),

        // Error case: database operation failed
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Database error: {e}"))
            .internal(),
    }
}
