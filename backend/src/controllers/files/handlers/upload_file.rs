//! Handles streaming file uploads with size limit enforcement and database registration.

use crate::{
    middleware::perms_middleware::UserPermissions,
    models::{responses::ApiResponse, types::UploadsPath},
    utils::{db::register_file, helpers::get_user_id},
};
use actix_multipart::Multipart;
use actix_web::{HttpMessage, HttpRequest, HttpResponse, web};
use futures_util::TryStreamExt;
use sanitize_filename::sanitize;
use sqlx::SqlitePool;
use tokio::io::AsyncWriteExt;

/// Accepts a file upload via multipart form, validates against user quotas, and stores it.
pub async fn upload_file(
    mut payload: Multipart,
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    upload_path: web::Data<UploadsPath>,
) -> HttpResponse {
    let base = upload_path.get_ref().get();
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };
    // SQLite does not support u64 parameters.
    let user_id_i64 = user_id as i64;

    // Ensure upload directory exists.
    if let Err(e) = tokio::fs::create_dir_all(&base).await {
        return ApiResponse::<()>::builder()
            .message(format!("Cannot create upload directory: {e}"))
            .internal();
    }

    let user_perms_db = match sqlx::query!(
        r#"
        SELECT 
            can_upload,
            has_upload_limits,
            upload_limit
        FROM Users 
        WHERE id = ? AND is_active = 1 AND is_deleted = 0
        "#,
        user_id_i64
    )
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(row) => row,
        Err(sqlx::Error::RowNotFound) => {
            return ApiResponse::<()>::builder()
                .message("User not found or inactive")
                .unauthorized();
        }
        Err(e) => {
            tracing::error!("DB error fetching user permissions: {:?}", e);
            return ApiResponse::<()>::builder()
                .message("Database error")
                .internal();
        }
    };

    if user_perms_db.can_upload == 0 {
        return ApiResponse::<()>::builder()
            .message("You do not have permission to upload files")
            .forbidden();
    }

    let _user_perms = req
        .extensions()
        .get::<UserPermissions>()
        .cloned()
        .unwrap_or_default();

    // Process the first file field.
    let mut file_name = None;
    let mut mime_type = None;
    let mut file_size = 0u64;
    let mut temp_file_path = None;

    while let Ok(Some(mut field)) = payload.try_next().await {
        if let Some(content_disposition) = field.content_disposition()
            && let Some(name) = content_disposition.get_filename()
        {
            // Sanitize filename.
            let safe_name = sanitize(name);
            if safe_name.is_empty() {
                return ApiResponse::<()>::builder()
                    .message("Invalid filename")
                    .bad_request();
            }

            // Determine MIME type.
            mime_type = field.content_type().map(|m| m.to_string()).or_else(|| {
                mime_guess::from_path(&safe_name)
                    .first_raw()
                    .map(String::from)
            });

            // Create a unique internal path: user_id/timestamp_random/filename
            let timestamp = chrono::Utc::now().timestamp_millis();
            let random_part: u32 = rand::random();
            let unique_dir = format!("{}_{:08x}", timestamp, random_part);
            let relative_dir = format!("{}/{}", user_id, unique_dir);
            let relative_path = format!("{}/{}", relative_dir, safe_name);
            let full_path = base.join(&relative_path);

            // Create parent directories.
            if let Some(parent) = full_path.parent()
                && let Err(e) = tokio::fs::create_dir_all(parent).await
            {
                return ApiResponse::<()>::builder()
                    .message(format!("Failed to create directory: {e}"))
                    .internal();
            }

            // Open file for writing.
            let mut file = match tokio::fs::File::create(&full_path).await {
                Ok(f) => f,
                Err(e) => {
                    return ApiResponse::<()>::builder()
                        .message(format!("Failed to create file: {e}"))
                        .internal();
                }
            };

            // Stream chunks to file, enforcing quota if needed.
            while let Ok(Some(chunk)) = field.try_next().await {
                file_size += chunk.len() as u64;
                if user_perms_db.has_upload_limits != 0 {
                    let used_bytes: i64 = sqlx::query_scalar!(
                        r#"
                        SELECT COALESCE(SUM(size_bytes), 0) AS "used!"
                        FROM Files
                        WHERE uploaded_by = ? AND is_deleted = 0
                        "#,
                        user_id_i64
                    )
                    .fetch_one(pool.get_ref())
                    .await
                    .unwrap_or(0);

                    let limit = user_perms_db.upload_limit.unwrap_or(0) as u64;
                    let used = used_bytes as u64;

                    if limit > 0 && (file_size > limit || used + file_size > limit) {
                        let _ = tokio::fs::remove_file(&full_path).await;
                        return ApiResponse::<()>::builder()
                            .message("Upload exceeds storage quota")
                            .bad_request();
                    }
                }

                if let Err(e) = file.write_all(&chunk).await {
                    let _ = tokio::fs::remove_file(&full_path).await;
                    return ApiResponse::<()>::builder()
                        .message(format!("Write error: {e}"))
                        .internal();
                }
            }

            file.flush().await.ok();
            file.sync_all().await.ok();
            drop(file);

            file_name = Some(safe_name);
            temp_file_path = Some((relative_path, full_path));
            break;
        }
    }

    let (relative_path, _full_path) = match temp_file_path {
        Some(p) => p,
        None => {
            return ApiResponse::<()>::builder()
                .message("No file provided in upload")
                .bad_request();
        }
    };

    let file_name = file_name.unwrap_or_else(|| "unnamed".to_string());
    let mime = mime_type.unwrap_or_else(|| "application/octet-stream".to_string());

    // Register file in database.
    let payload = crate::utils::db::RegisterFilePayload {
        name: file_name,
        internal_path: relative_path.clone(),
        size_bytes: file_size,
        mime_type: mime,
        uploaded_by: user_id,
    };

    let register_result = register_file(pool.get_ref(), payload).await;

    crate::watcher::mark_handled_internal_path(&relative_path);

    register_result
}
