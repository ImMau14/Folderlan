// Handles file management operations including upload, download, deletion, and permission management.
use actix_files::NamedFile;
use actix_multipart::Multipart;
use actix_web::{HttpMessage, HttpRequest, Responder, http::header, web};
use actix_web_httpauth::middleware::HttpAuthentication;
use futures_util::TryStreamExt as _;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use std::{collections::HashMap, io, sync::Arc, sync::Mutex};
use tokio::sync::Mutex as TokioMutex;

use crate::middleware::{
    jwt_middleware::jwt_validator_adapter,
    perms_middleware::{PermsAuth, UserPermissions},
};
use crate::models::{
    responses::ApiResponse,
    types::{ChunkMeta, UploadsPath},
};
use crate::utils::{
    MinLevel, RegisterFilePayload, check_file_permission, get_user_id, is_owner_or_uploader,
    register_file, storage,
};

// Query parameters for file listing with filtering capabilities.
#[derive(Deserialize)]
pub struct FileQuery {
    name: Option<String>,
    min_size: Option<i64>,
    max_size: Option<i64>,
    start_date: Option<String>, // 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'
    end_date: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
}

// Paginated response structure for file listings.
#[derive(serde::Serialize)]
pub struct FilesPage<T> {
    items: Vec<T>,
    total: i64,
    limit: u32,
    offset: u32,
}

// Database row structure for files with additional metadata.
#[derive(sqlx::FromRow, serde::Serialize)]
pub struct FileRowWithTotal {
    id: i64,
    name: String,
    size_bytes: i64,
    internal_path: String,
    mime_type: Option<String>,
    uploaded_by: Option<String>,
    is_public: bool,
    uploaded_at: String,
    total_count: i64,
}

// Payload for granting or updating file permissions.
#[derive(Deserialize)]
pub struct PermPayload {
    user_id: i64,
    access_level: String,
}

// Database row structure for file permissions.
#[derive(sqlx::FromRow, Serialize)]
pub struct FilePermRow {
    user_id: i64,
    username: Option<String>,
    access_level: String,
    granted_at: String,
    granted_by: Option<i64>,
}

// Global synchronization mechanism for per-file upload operations.
static FILE_LOCKS: Lazy<Mutex<HashMap<String, Arc<TokioMutex<()>>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

// Handles chunked file upload with metadata validation and storage.
pub async fn upload_file(
    mut payload: Multipart,
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    path: web::Data<UploadsPath>,
) -> impl Responder {
    let base = path.get_ref().get();
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    if let Err(e) = storage::ensure_base(&base).await {
        return ApiResponse::<()>::builder()
            .message(format!("Cannot create upload dir: {e}"))
            .internal();
    }

    let mut meta_opt: Option<ChunkMeta> = None;

    while let Ok(Some(mut field)) = payload.try_next().await {
        let content_disposition = field.content_disposition();
        let field_name = content_disposition
            .and_then(|cd| cd.get_name())
            .map(|s| s.to_string());

        match field_name.as_deref() {
            Some("metadata") => {
                if meta_opt.is_some() {
                    return ApiResponse::<()>::builder()
                        .message("Metadata already provided")
                        .bad_request();
                }

                let mut buf = Vec::new();
                while let Ok(Some(chunk)) = field.try_next().await {
                    buf.extend_from_slice(&chunk);
                }

                match serde_json::from_slice::<ChunkMeta>(&buf) {
                    Ok(m) => {
                        let meta = m;

                        let has_upload_limits =
                            if let Some(user_perms) = req.extensions().get::<UserPermissions>() {
                                user_perms.has_upload_limits
                            } else {
                                false
                            };

                        if has_upload_limits {
                            #[derive(FromRow)]
                            struct LimitsResults {
                                upload_limit: i64,
                                used_bytes: i64,
                            }

                            let results: LimitsResults = match sqlx::query_as::<_, LimitsResults>(
                                r#"
                                    SELECT 
                                      u.upload_limit,
                                      COALESCE((
                                        SELECT SUM(f.size_bytes)
                                        FROM Files f
                                        WHERE f.uploaded_by = u.id AND f.is_deleted = 0
                                      ), 0) AS used_bytes
                                    FROM Users u
                                    WHERE u.id = ?
                                "#,
                            )
                            .bind(user_id as i64)
                            .fetch_one(pool.get_ref())
                            .await
                            {
                                Ok(t) => t,
                                Err(e) => {
                                    return ApiResponse::<()>::builder()
                                        .message(format!("DB error: {e}"))
                                        .internal();
                                }
                            };

                            if meta.total_size > results.upload_limit as u64
                                || results.used_bytes >= results.upload_limit
                                || results.used_bytes + meta.total_size as i64
                                    > results.upload_limit
                            {
                                storage::cleanup_tmp_files(&base, &meta.file_id).await;
                                return ApiResponse::<()>::builder()
                                    .message(format!(
                                        "File total size {} exceeds upload limit {}",
                                        meta.total_size, results.upload_limit
                                    ))
                                    .bad_request();
                            }
                        }

                        meta_opt = Some(meta);
                    }
                    Err(e) => {
                        return ApiResponse::<()>::builder()
                            .message(format!("Invalid metadata JSON: {e}"))
                            .bad_request();
                    }
                }
            }

            Some("chunk") => {
                let meta_ref: &ChunkMeta = match meta_opt.as_ref() {
                    Some(m) => m,
                    None => {
                        return ApiResponse::<()>::builder()
                            .message("Metadata must be sent before chunk")
                            .bad_request();
                    }
                };

                // Get the lock for this file_id
                let lock = {
                    let mut locks = FILE_LOCKS.lock().unwrap();
                    locks
                        .entry(meta_ref.file_id.clone())
                        .or_insert_with(|| Arc::new(TokioMutex::new(())))
                        .clone()
                };
                let _guard = lock.lock().await;

                match storage::save_chunk_to(&base, meta_ref, field).await {
                    Ok(_saved_path) => {
                        if storage::all_parts_present(&base, meta_ref).await {
                            match storage::assemble_file(&base, meta_ref).await {
                                Ok((final_path, file_name, file_size, mime_type)) => {
                                    storage::cleanup_tmp_files(&base, &meta_ref.file_id).await;
                                    return register_file(
                                        pool.get_ref(),
                                        RegisterFilePayload {
                                            name: file_name,
                                            internal_path: final_path
                                                .to_string_lossy()
                                                .into_owned(),
                                            size_bytes: file_size,
                                            mime_type,
                                            uploaded_by: user_id,
                                        },
                                    )
                                    .await;
                                }
                                Err(e) => {
                                    storage::cleanup_tmp_files(&base, &meta_ref.file_id).await;
                                    return ApiResponse::<()>::builder()
                                        .message(e.to_string())
                                        .internal();
                                }
                            }
                        } else {
                            // Not all parts yet: acknowledge this chunk saved
                            return ApiResponse::<()>::builder()
                                .message(format!(
                                    "chunk {} saved for file_id={}",
                                    meta_ref.chunk_index, meta_ref.file_id
                                ))
                                .ok();
                        }
                    }
                    Err(e) => {
                        storage::cleanup_tmp_files(&base, &meta_ref.file_id).await;
                        return ApiResponse::<()>::builder()
                            .message(e.to_string())
                            .internal();
                    }
                }
            }

            _ => {}
        }
    }

    // If metadata was received but no chunk in the same request
    if meta_opt.is_some() {
        ApiResponse::<()>::builder()
            .message("Chunk not received")
            .bad_request()
    } else {
        ApiResponse::<()>::builder()
            .message("No valid fields found")
            .bad_request()
    }
}

// Retrieves paginated file list with optional filtering based on user permissions.
pub async fn get_files(
    pool: web::Data<SqlitePool>,
    q: web::Query<FileQuery>,
    req: HttpRequest,
) -> impl Responder {
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    let limit_u32 = q.limit.unwrap_or(25).min(100);
    let offset_u32 = q.offset.unwrap_or(0);

    let name_pattern: Option<String> = q.name.as_ref().map(|s| format!("%{s}%"));

    let sql = r#"
        SELECT
            f.id,
            f.name,
            f.size_bytes,
            f.internal_path,
            f.mime_type,
            f.is_public,
            uploader.username AS uploaded_by,
            f.uploaded_at,
            COUNT(1) OVER () AS total_count
        FROM Files f
        JOIN Users ru ON ru.id = ? AND ru.is_deleted = 0 AND ru.is_active = 1
        LEFT JOIN Users uploader ON uploader.id = f.uploaded_by
        WHERE f.is_deleted = 0
        AND (
            ru.role = 'owner'
            OR f.uploaded_by = ru.id
            OR EXISTS (
                SELECT 1 FROM FilePermissions fp
                WHERE fp.file_id = f.id AND fp.user_id = ru.id
            )
            OR f.is_public = 1
        )
        AND (? IS NULL OR f.name LIKE ?)
        AND (? IS NULL OR f.size_bytes >= ?)
        AND (? IS NULL OR f.size_bytes <= ?)
        AND (? IS NULL OR date(f.uploaded_at) >= date(?))
        AND (? IS NULL OR date(f.uploaded_at) <= date(?))
        ORDER BY f.uploaded_at DESC
        LIMIT ? OFFSET ?
    "#;

    let rows_result = sqlx::query_as::<_, FileRowWithTotal>(sql)
        .bind(user_id as i64)
        .bind(name_pattern.as_deref())
        .bind(name_pattern.as_deref())
        .bind(q.min_size)
        .bind(q.min_size)
        .bind(q.max_size)
        .bind(q.max_size)
        .bind(q.start_date.as_deref())
        .bind(q.start_date.as_deref())
        .bind(q.end_date.as_deref())
        .bind(q.end_date.as_deref())
        .bind(limit_u32 as i64)
        .bind(offset_u32 as i64)
        .fetch_all(pool.get_ref())
        .await;

    let rows = match rows_result {
        Ok(r) => r,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("DB error: {e}"))
                .internal();
        }
    };

    let total = rows.first().map(|r| r.total_count).unwrap_or(0);
    let page = FilesPage {
        items: rows,
        total,
        limit: limit_u32,
        offset: offset_u32,
    };

    ApiResponse::builder()
        .message("Files fetched")
        .data(page)
        .ok()
}

// Marks file as deleted in database and removes physical file from storage.
pub async fn delete_file(
    path: web::Path<u64>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    upload_path: web::Data<UploadsPath>,
) -> impl Responder {
    let file_id = path.into_inner();
    let base_path = upload_path.get_ref().get().to_path_buf();
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    // Verify minimal collaborator perm
    let (internal_path, _name_opt) =
        match check_file_permission(pool.get_ref(), user_id, file_id, MinLevel::Collaborator).await
        {
            Ok(pair) => pair,
            Err(resp) => return resp,
        };

    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(_) => {
            return ApiResponse::<()>::builder()
                .message("Failed to start transaction")
                .internal();
        }
    };

    if let Err(e) =
        sqlx::query("UPDATE Files SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(file_id as i64)
            .execute(&mut *tx)
            .await
    {
        let _ = tx.rollback().await;
        return ApiResponse::<()>::builder()
            .message(format!("DB update error: {e}"))
            .internal();
    }

    if tx.commit().await.is_err() {
        return ApiResponse::<()>::builder()
            .message("Transaction failed")
            .internal();
    }

    let full_path = base_path.join(&internal_path);
    if (tokio::fs::remove_file(&full_path).await).is_err() {
        return ApiResponse::<()>::builder()
            .message("File marked as deleted but physical deletion failed")
            .ok();
    }

    ApiResponse::<()>::builder()
        .message("File deleted successfully")
        .ok()
}

// Streams file download with proper Content-Disposition headers.
pub async fn download_file_named(
    path: web::Path<u64>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    upload_path: web::Data<UploadsPath>,
) -> impl Responder {
    let file_id = path.into_inner();
    let base_path = upload_path.get_ref().get().to_path_buf();
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    let (internal_path, name_opt) =
        match check_file_permission(pool.get_ref(), user_id, file_id, MinLevel::Viewer).await {
            Ok(pair) => pair,
            Err(resp) => return resp,
        };

    let file_name = name_opt.unwrap_or_else(|| "file".into());
    let full_path = base_path.join(&internal_path);

    let open_result = web::block(move || NamedFile::open(&full_path)).await;

    match open_result {
        Ok(Ok(named_file)) => {
            let mut resp = named_file.into_response(&req);
            let cd_val = format!("attachment; filename=\"{}\"", file_name.replace('"', ""));
            if let Ok(hv) = header::HeaderValue::from_str(&cd_val) {
                resp.headers_mut().insert(header::CONTENT_DISPOSITION, hv);
            }
            resp
        }
        Ok(Err(e)) => {
            if e.kind() == io::ErrorKind::NotFound {
                ApiResponse::<()>::builder()
                    .message("Physical file not found")
                    .not_found()
            } else {
                ApiResponse::<()>::builder()
                    .message(format!("Failed to open file: {e}"))
                    .internal()
            }
        }
        Err(block_err) => ApiResponse::<()>::builder()
            .message(format!("Blocking open error: {block_err}"))
            .internal(),
    }
}

// Grants or updates user permissions for specific file access.
pub async fn grant_or_update_permission(
    path: web::Path<u64>,
    payload: web::Json<PermPayload>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> impl Responder {
    let file_id = path.into_inner();
    let body = payload.into_inner();
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    // Validate access_level
    let access = body.access_level.as_str();
    if access != "viewer" && access != "collaborator" {
        return ApiResponse::<()>::builder()
            .message("invalid access_level, must be 'viewer' or 'collaborator'")
            .bad_request();
    }

    // Check file exists and that current user is owner or uploader
    match is_owner_or_uploader(pool.get_ref(), user_id, file_id).await {
        Ok(true) => {}
        Ok(false) => {
            return ApiResponse::<()>::builder()
                .message("Insufficient permissions to modify file permissions")
                .forbidden();
        }
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .not_found();
        }
    }

    // Ensure target user exists and not deleted
    let target_exists =
        match sqlx::query_scalar::<_, i64>("SELECT id FROM Users WHERE id = ? AND is_deleted = 0")
            .bind(body.user_id)
            .fetch_optional(pool.get_ref())
            .await
        {
            Ok(opt) => opt.is_some(),
            Err(e) => {
                return ApiResponse::<()>::builder()
                    .message(format!("DB error: {e}"))
                    .internal();
            }
        };

    if !target_exists {
        return ApiResponse::<()>::builder()
            .message("Target user not found")
            .not_found();
    }

    // Begin transaction
    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(_) => {
            return ApiResponse::<()>::builder()
                .message("Failed to start transaction")
                .internal();
        }
    };

    // UPSERT (SQLite): insert or update granted_by/access_level/granted_at atomically
    let upsert_sql = r#"
        INSERT INTO FilePermissions (file_id, user_id, access_level, granted_by, granted_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(file_id, user_id) DO UPDATE SET
            access_level = excluded.access_level,
            granted_by = excluded.granted_by,
            granted_at = CURRENT_TIMESTAMP
    "#;

    if let Err(e) = sqlx::query(upsert_sql)
        .bind(file_id as i64)
        .bind(body.user_id)
        .bind(access)
        .bind(user_id as i64)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        return ApiResponse::<()>::builder()
            .message(format!("DB error upserting permission: {e}"))
            .internal();
    }

    if tx.commit().await.is_err() {
        return ApiResponse::<()>::builder()
            .message("Transaction commit failed")
            .internal();
    }

    // Fetch resulting row to return
    let row = match sqlx::query_as::<_, FilePermRow>(
        r#"
            SELECT fp.user_id, u.username, fp.access_level, fp.granted_at, fp.granted_by
            FROM FilePermissions fp
            LEFT JOIN Users u ON u.id = fp.user_id
            WHERE fp.file_id = ? AND fp.user_id = ?
        "#,
    )
    .bind(file_id as i64)
    .bind(body.user_id)
    .fetch_one(pool.get_ref())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("DB error fetching permission: {e}"))
                .internal();
        }
    };

    ApiResponse::<FilePermRow>::builder()
        .message("Permission granted/updated")
        .data(row)
        .ok()
}

// Revokes user permissions for specific file access.
pub async fn revoke_permission(
    path: web::Path<(u64, i64)>, // (file_id, user_id)
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> impl Responder {
    let (file_id_u64, target_user_id) = path.into_inner();
    let file_id = file_id_u64;
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    // Authorization: only owner or uploader can revoke
    match is_owner_or_uploader(pool.get_ref(), user_id, file_id).await {
        Ok(true) => {}
        Ok(false) => {
            return ApiResponse::<()>::builder()
                .message("Insufficient permissions to revoke file permissions")
                .forbidden();
        }
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .not_found();
        }
    }

    // Begin transaction for consistent state and potential audit hooks
    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(_) => {
            return ApiResponse::<()>::builder()
                .message("Failed to start transaction")
                .internal();
        }
    };

    let res = sqlx::query(
        r#"
            DELETE FROM FilePermissions
            WHERE file_id = ? AND user_id = ?
        "#,
    )
    .bind(file_id as i64)
    .bind(target_user_id)
    .execute(&mut *tx)
    .await;

    match res {
        Ok(r) if r.rows_affected() > 0 => {
            if tx.commit().await.is_err() {
                return ApiResponse::<()>::builder()
                    .message("Transaction commit failed")
                    .internal();
            }
            ApiResponse::<()>::builder()
                .message("Permission revoked")
                .ok()
        }
        Ok(_) => {
            let _ = tx.rollback().await;
            ApiResponse::<()>::builder()
                .message("Permission entry not found")
                .not_found()
        }
        Err(e) => {
            let _ = tx.rollback().await;
            ApiResponse::<()>::builder()
                .message(format!("DB error: {e}"))
                .internal()
        }
    }
}

// Lists all permissions granted for a specific file.
pub async fn list_permissions(
    path: web::Path<u64>,
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
) -> impl Responder {
    let file_id = path.into_inner();
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    // Authorization: only owner or uploader can list permissions
    match is_owner_or_uploader(pool.get_ref(), user_id, file_id).await {
        Ok(true) => {}
        Ok(false) => {
            return ApiResponse::<()>::builder()
                .message("Insufficient permissions to list file permissions")
                .forbidden();
        }
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .not_found();
        }
    }

    let rows = match sqlx::query_as::<_, FilePermRow>(
        r#"
            SELECT fp.user_id, u.username, fp.access_level, fp.granted_at, fp.granted_by
            FROM FilePermissions fp
            LEFT JOIN Users u ON u.id = fp.user_id
            WHERE fp.file_id = ?
            ORDER BY fp.granted_at DESC
        "#,
    )
    .bind(file_id as i64)
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("DB error: {e}"))
                .internal();
        }
    };

    let items: Vec<FilePermRow> = rows;

    ApiResponse::builder()
        .message("Permissions listed")
        .data(items)
        .ok()
}

// Configures file management routes with authentication and permission middleware.
pub fn files_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/files")
            .service(
                web::resource("/upload")
                    .wrap(PermsAuth::new(&["can_upload"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(upload_file)),
            )
            .service(
                web::resource("")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(get_files)),
            )
            .service(
                web::resource("/{id}")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::delete().to(delete_file)),
            )
            .service(
                web::resource("/download/{id}")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(download_file_named)),
            )
            .service(
                web::resource("/{id}/permissions")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(grant_or_update_permission))
                    .route(web::get().to(list_permissions)),
            )
            .service(
                web::resource("/{id}/permissions/{user_id}")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::delete().to(revoke_permission)),
            ),
    );
}
