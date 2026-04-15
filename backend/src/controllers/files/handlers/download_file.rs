//! Streams a file for download with proper headers.

use crate::{
    models::{responses::ApiResponse, types::UploadsPath},
    utils::{
        db::{MinLevel, check_file_permission},
        helpers::get_user_id,
    },
};
use actix_files::NamedFile;
use actix_web::{HttpRequest, HttpResponse, http::header, web};
use sqlx::SqlitePool;
use std::io;

/// Serves the requested file as an attachment.
pub async fn download_file(
    path: web::Path<u64>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    upload_path: web::Data<UploadsPath>,
) -> HttpResponse {
    let file_id = *path as i64;
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    // Check file exists and not deleted.
    let exists = sqlx::query_scalar!(
        "SELECT id FROM Files WHERE id = ? AND is_deleted = 0",
        file_id
    )
    .fetch_optional(pool.get_ref())
    .await
    .map(|opt| opt.is_some())
    .unwrap_or(false);

    if !exists {
        return ApiResponse::<()>::builder()
            .message("File not found")
            .not_found();
    }

    // Verify viewer permission.
    let (internal_path, filename) =
        match check_file_permission(pool.get_ref(), user_id, *path, MinLevel::Viewer).await {
            Ok(p) => p,
            Err(resp) => return resp,
        };

    let base = upload_path.get_ref().get();
    let full_path = base.join(&internal_path);

    match NamedFile::open(&full_path) {
        Ok(file) => {
            let cd_value = format!(
                "attachment; filename=\"{}\"",
                filename
                    .unwrap_or_else(|| "file".to_string())
                    .replace('"', "")
            );
            let mut resp = file.into_response(&req);
            if let Ok(hv) = header::HeaderValue::from_str(&cd_value) {
                resp.headers_mut().insert(header::CONTENT_DISPOSITION, hv);
            }
            resp
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => ApiResponse::<()>::builder()
            .message("Physical file missing")
            .not_found(),
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Failed to open file: {e}"))
            .internal(),
    }
}
