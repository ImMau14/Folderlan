use actix_web::HttpResponse;
use mime_guess::from_path;
use sqlx::SqlitePool;
use std::path::Path;
use tracing::{info, warn};

use super::metrics::incr_metric;
use crate::models::responses::ApiResponse;
use crate::utils::db::RegisterFilePayload;

/// Register a newly detected file in the database using compile-time checked queries.
///
/// The UPSERT keyed on `internal_path` makes this idempotent: re-detecting a
/// file that is already registered only refreshes its metadata, and a file
/// that was soft-deleted (and then re-appears on disk) is restored.
pub async fn register_file_in_db(
    pool: &SqlitePool,
    internal_path: &str,
    file_size: u64,
    owner_user_id: i64,
) -> Result<(), ()> {
    let file_name = Path::new(internal_path)
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| internal_path.to_string());

    let mime_type = from_path(Path::new(internal_path))
        .first_or_octet_stream()
        .essence_str()
        .to_string();

    let payload = RegisterFilePayload {
        name: file_name.clone(),
        internal_path: internal_path.to_string(),
        size_bytes: file_size,
        mime_type,
        uploaded_by: owner_user_id as u64,
    };

    let resp = register_file_in_db_now(pool, &payload).await;
    if resp.status().is_success() {
        info!("Watcher registered file {} ok", internal_path);
        incr_metric("files_registered");
        Ok(())
    } else {
        warn!("Watcher failed to register {}: {:?}", internal_path, resp);
        Err(())
    }
}

/// Upsert registration used by the watcher. Unlike the API registration,
/// `uploaded_by` of an existing row is preserved so that watcher events fired
/// after an upload (e.g. close/modify events) never clobber file attribution.
async fn register_file_in_db_now(pool: &SqlitePool, payload: &RegisterFilePayload) -> HttpResponse {
    let size_bytes_i64 = payload.size_bytes as i64;
    let uploaded_by_i64 = payload.uploaded_by as i64;
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
                is_deleted = 0,
                deleted_at = NULL,
                uploaded_at = CASE
                    WHEN Files.is_deleted = 1 THEN CURRENT_TIMESTAMP
                    ELSE Files.uploaded_at
                END
        ",
        payload.name,
        payload.internal_path,
        size_bytes_i64,
        payload.mime_type,
        uploaded_by_i64,
    )
    .execute(pool)
    .await
    {
        Ok(_) => ApiResponse::<()>::builder()
            .message("Saved file successfully")
            .created(),
        Err(e) => {
            warn!("Watcher DB upsert failed: {:?}", e);
            ApiResponse::<()>::builder()
                .message(format!("Database error: {e}"))
                .internal()
        }
    }
}

/// Mark a file as deleted in the database using compile-time checked query.
pub async fn mark_file_deleted(pool: &SqlitePool, internal_path: &str) -> Result<(), sqlx::Error> {
    let result = sqlx::query!(
        "UPDATE Files SET is_deleted = 1 WHERE internal_path = ?",
        internal_path
    )
    .execute(pool)
    .await?;

    if result.rows_affected() > 0 {
        info!("Marked deleted in DB: {}", internal_path);
    } else {
        warn!(
            "Remove event: no DB record found to mark deleted for {}",
            internal_path
        );
    }
    Ok(())
}
