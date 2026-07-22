use mime_guess::from_path;
use sqlx::SqlitePool;
use std::path::Path;
use tracing::{info, warn};

use super::locks::mark_handled_internal_path;
use super::metrics::incr_metric;
use crate::utils::db::{RegisterFilePayload, register_file};

/// Register a newly detected file in the database using compile-time checked queries.
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

    let resp = register_file(pool, payload).await;
    if resp.status().is_success() {
        info!("Watcher registered file {} ok", internal_path);
        mark_handled_internal_path(internal_path);
        incr_metric("files_registered");
        Ok(())
    } else {
        warn!("Watcher failed to register {}: {:?}", internal_path, resp);
        Err(())
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
        mark_handled_internal_path(internal_path);
    } else {
        warn!(
            "Remove event: no DB record found to mark deleted for {}",
            internal_path
        );
        // Still mark as handled to avoid repeated attempts
        mark_handled_internal_path(internal_path);
    }
    Ok(())
}
