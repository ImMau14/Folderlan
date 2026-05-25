// Handles file registration in the database by inserting file metadata.
use crate::models::responses::ApiResponse;
use actix_web::HttpResponse;
use sqlx::SqlitePool;

// Represents the file metadata required for database registration
#[derive(Debug, Clone)]
pub struct RegisterFilePayload {
    pub name: String,
    pub internal_path: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub uploaded_by: u64,
}

// Inserts file metadata into the database and returns appropriate HTTP responses.
// Uses INSERT OR IGNORE to safely handle concurrent registrations (e.g. from the file watcher).
pub async fn register_file(pool: &SqlitePool, file: RegisterFilePayload) -> HttpResponse {
    let size_bytes_i64 = file.size_bytes as i64;
    let uploaded_by_i64 = file.uploaded_by as i64;

    // Execute SQL insert query with file parameters
    match sqlx::query!(
        "INSERT OR IGNORE INTO Files (
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
        // Success case: exactly one row affected (new file)
        Ok(result) if result.rows_affected() == 1 => ApiResponse::<()>::builder()
            .message("Saved file successfully")
            .created(),

        // File already existed (INSERT OR IGNORE skipped the insertion) – not an error
        Ok(_) => ApiResponse::<()>::builder()
            .message("File already registered")
            .ok(),

        // Error case: database operation failed
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Database error: {e}"))
            .internal(),
    }
}