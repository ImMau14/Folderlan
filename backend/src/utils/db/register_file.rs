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
// Uses an UPSERT keyed on `internal_path`: if a soft-deleted row already exists
// for the same path (e.g. the file was deleted and then uploaded again with the
// same name), the row is restored and refreshed instead of being ignored.
pub async fn register_file(pool: &SqlitePool, file: RegisterFilePayload) -> HttpResponse {
    let size_bytes_i64 = file.size_bytes as i64;
    let uploaded_by_i64 = file.uploaded_by as i64;

    // Execute SQL insert query with file parameters
    match sqlx::query!(
        "INSERT INTO Files (
                name,
                internal_path,
                size_bytes,
                mime_type,
                uploaded_by
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(internal_path) DO UPDATE SET
                name = excluded.name,
                size_bytes = excluded.size_bytes,
                mime_type = excluded.mime_type,
                uploaded_by = excluded.uploaded_by,
                is_deleted = 0,
                deleted_at = NULL,
                uploaded_at = CASE
                    WHEN Files.is_deleted = 1 THEN CURRENT_TIMESTAMP
                    ELSE Files.uploaded_at
                END
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
        // Success case: exactly one row inserted or refreshed
        Ok(result) if result.rows_affected() == 1 => ApiResponse::<()>::builder()
            .message("Saved file successfully")
            .created(),

        // No row changed (content identical to what is stored) – not an error
        Ok(_) => ApiResponse::<()>::builder()
            .message("File already registered")
            .ok(),

        // Error case: database operation failed
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Database error: {e}"))
            .internal(),
    }
}
