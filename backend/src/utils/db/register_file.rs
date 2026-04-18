// Handles file registration in the database by inserting file metadata.
use crate::models::responses::ApiResponse;
use actix_web::HttpResponse;
use sqlx::SqlitePool;

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
    let size_bytes_i64 = file.size_bytes as i64;
    let uploaded_by_i64 = file.uploaded_by as i64;

    // Execute SQL insert query with file parameters
    match sqlx::query!(
        "
            INSERT INTO Files (
                name,
                internal_path,
                size_bytes,
                mime_type,
                uploaded_by
            ) VALUES (?, ?, ?, ?, ?)
        ",
        file.name,
        file.internal_path,
        size_bytes_i64, // Convert u64 to i64 for SQLite compatibility
        file.mime_type,
        uploaded_by_i64, // Convert u64 to i64 for SQLite compatibility
    )
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
