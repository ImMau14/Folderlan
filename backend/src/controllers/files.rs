use actix_multipart::Multipart;
use actix_web::{HttpMessage, HttpRequest, HttpResponse, Responder, web};
use actix_web_httpauth::middleware::HttpAuthentication;
use futures_util::TryStreamExt as _;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;
use tokio::sync::Mutex as TokioMutex;

use crate::middleware::jwt_middleware::AuthUser;
use crate::middleware::jwt_middleware::jwt_validator_adapter;
use crate::middleware::perms_middleware::{PermsAuth, UserPermissions};
use crate::models::types::{ChunkMeta, Response};
use crate::utils::storage;
use crate::utils::{RegisterFilePayload, register_file};

// Query params (extractor)
#[derive(Deserialize)]
pub struct FileQuery {
    pub name: Option<String>,
    pub min_size: Option<i64>,
    pub max_size: Option<i64>,
    pub start_date: Option<String>, // 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'
    pub end_date: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct FileRowWithTotal {
    id: i64,
    name: String,
    size_bytes: i64,
    internal_path: String,
    mime_type: Option<String>,
    uploaded_by: Option<String>,
    uploaded_at: String,
    total_count: i64,
}

#[derive(serde::Serialize)]
struct FilesPage<T> {
    items: Vec<T>,
    total: i64,
    limit: u32,
    offset: u32,
}

#[derive(Serialize, FromRow)]
struct FileRow {
    id: i64,
    name: String,
    size_bytes: i64,
    internal_path: String,
    mime_type: Option<String>,
    uploaded_by: Option<String>,
    uploaded_at: String,
}

#[derive(Serialize)]
struct ApiResponse<T> {
    success: bool,
    message: String,
    data: Option<T>,
}

// Global map for per-file locks
static FILE_LOCKS: Lazy<Mutex<HashMap<String, Arc<TokioMutex<()>>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub async fn upload_file(
    mut payload: Multipart,
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
) -> impl Responder {
    let base = PathBuf::from("./uploads");

    let user_id: u64 = match req.extensions().get::<AuthUser>() {
        Some(auth_user) => auth_user.id.try_into().unwrap(),

        None => {
            return HttpResponse::InternalServerError().json(Response {
                success: false,
                message: "cannot upload without id (middleware failed)".into(),
            });
        }
    };

    if let Err(e) = storage::ensure_base(&base).await {
        return HttpResponse::InternalServerError().json(Response {
            success: false,
            message: format!("cannot create upload dir: {e}"),
        });
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
                    return HttpResponse::BadRequest().json(Response {
                        success: false,
                        message: "metadata already provided".into(),
                    });
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
                                    return HttpResponse::InternalServerError().json(Response {
                                        success: false,
                                        message: format!("DB error: {e}"),
                                    });
                                }
                            };

                            if meta.total_size > results.upload_limit as u64
                                || results.used_bytes >= results.upload_limit
                                || results.used_bytes + meta.total_size as i64
                                    > results.upload_limit
                            {
                                storage::cleanup_tmp_files(&base, &meta.file_id).await;
                                return HttpResponse::BadRequest().json(Response {
                                    success: false,
                                    message: format!(
                                        "file total size {} exceeds upload limit {}",
                                        meta.total_size, results.upload_limit
                                    ),
                                });
                            }
                        }

                        meta_opt = Some(meta);
                    }
                    Err(e) => {
                        return HttpResponse::BadRequest().json(Response {
                            success: false,
                            message: format!("invalid metadata JSON: {e}"),
                        });
                    }
                }
            }

            Some("chunk") => {
                let meta_ref: &ChunkMeta = match meta_opt.as_ref() {
                    Some(m) => m,
                    None => {
                        return HttpResponse::BadRequest().json(Response {
                            success: false,
                            message: "metadata must be sent before chunk".into(),
                        });
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
                                    return HttpResponse::InternalServerError().json(Response {
                                        success: false,
                                        message: e,
                                    });
                                }
                            }
                        } else {
                            // Not all parts yet: acknowledge this chunk saved
                            return HttpResponse::Ok().json(Response {
                                success: true,
                                message: format!(
                                    "chunk {} saved for file_id={}",
                                    meta_ref.chunk_index, meta_ref.file_id
                                ),
                            });
                        }
                    }
                    Err(e) => {
                        storage::cleanup_tmp_files(&base, &meta_ref.file_id).await;
                        return HttpResponse::InternalServerError().json(Response {
                            success: false,
                            message: e,
                        });
                    }
                }
            }

            _ => {
                // ignore unknown/other fields
                while let Ok(Some(_)) = field.try_next().await { /* consume */ }
            }
        }
    }

    // If metadata was received but no chunk in the same request
    if meta_opt.is_some() {
        HttpResponse::BadRequest().json(Response {
            success: false,
            message: "chunk not received".into(),
        })
    } else {
        HttpResponse::BadRequest().json(Response {
            success: false,
            message: "no valid fields found".into(),
        })
    }
}

pub async fn get_files(
    pool: web::Data<SqlitePool>,
    q: web::Query<FileQuery>,
    req: HttpRequest,
) -> impl Responder {
    // 1) obtener user id desde middleware
    let user_id_i64: i64 = match req.extensions().get::<AuthUser>() {
        Some(auth_user) => auth_user.id,
        None => {
            return HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                message: "cannot get user id (middleware failed)".into(),
                data: None,
            });
        }
    };

    // 2) normalizar params
    let limit_u32 = q.limit.unwrap_or(25).min(100);
    let offset_u32 = q.offset.unwrap_or(0);
    let limit_i64 = limit_u32 as i64;
    let offset_i64 = offset_u32 as i64;

    let name_pattern: Option<String> = q.name.as_ref().map(|s| format!("%{s}%"));
    let start_date = q.start_date.clone();
    let end_date = q.end_date.clone();

    let sql = r#"
        SELECT
          f.id,
          f.name,
          f.size_bytes,
          f.internal_path,
          f.mime_type,
          uploader.username AS uploaded_by,
          f.uploaded_at,
          COUNT(1) OVER () AS total_count
        FROM Files f
        JOIN Users ru
          ON ru.id = ?           -- 1: requesting user id
          AND ru.is_deleted = 0
          AND ru.is_active = 1
        LEFT JOIN Users uploader
          ON uploader.id = f.uploaded_by
        WHERE f.is_deleted = 0
        AND (
          (
            (ru.role = 'owner' OR ru.can_access_all_files = 1)
            AND NOT EXISTS (
              SELECT 1 FROM FilePermissions fp
              WHERE fp.file_id = f.id
                AND fp.user_id = ru.id
                AND fp.can_view = 0
            )
          )
          OR EXISTS (
            SELECT 1 FROM FilePermissions fp2
            WHERE fp2.file_id = f.id
              AND fp2.user_id = ru.id
              AND fp2.can_view = 1
          )
          OR f.uploaded_by = ru.id
        )
        AND (? IS NULL OR f.name LIKE ?)                   -- 2,3
        AND (? IS NULL OR f.size_bytes >= ?)               -- 4,5
        AND (? IS NULL OR f.size_bytes <= ?)               -- 6,7
        AND (
            (? IS NULL AND ? IS NULL)                      -- 8,9   (start_date, end_date)
          OR (? IS NOT NULL AND ? IS NULL AND date(f.uploaded_at) = date(?))  -- 10,11,12
          OR (? IS NOT NULL AND ? IS NOT NULL AND f.uploaded_at BETWEEN ? AND ?) --13,14,15,16
        )
        ORDER BY f.uploaded_at DESC
        LIMIT ? OFFSET ?                                   -- 17,18
    "#;

    let rows_result = sqlx::query_as::<_, FileRowWithTotal>(sql)
        .bind(user_id_i64) // 1
        .bind(name_pattern.as_deref()) // 2
        .bind(name_pattern.as_deref()) // 3
        .bind(q.min_size) // 4
        .bind(q.min_size) // 5
        .bind(q.max_size) // 6
        .bind(q.max_size) // 7
        .bind(start_date.as_deref()) // 8
        .bind(end_date.as_deref()) // 9
        .bind(start_date.as_deref()) // 10
        .bind(end_date.as_deref()) // 11
        .bind(start_date.as_deref()) // 12
        .bind(start_date.as_deref()) // 13
        .bind(end_date.as_deref()) // 14
        .bind(start_date.as_deref()) // 15
        .bind(end_date.as_deref()) // 16
        .bind(limit_i64) // 17
        .bind(offset_i64) // 18
        .fetch_all(pool.get_ref())
        .await;

    let rows = match rows_result {
        Ok(r) => r,
        Err(e) => {
            return HttpResponse::InternalServerError().json(ApiResponse::<()> {
                success: false,
                message: format!("DB error: {e}"),
                data: None,
            });
        }
    };

    let total = rows.first().map(|r| r.total_count).unwrap_or(0);

    let page = FilesPage {
        items: rows,
        total,
        limit: limit_u32,
        offset: offset_u32,
    };

    HttpResponse::Ok().json(ApiResponse {
        success: true,
        message: "Files fetched".into(),
        data: Some(page),
    })
}

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
                    .wrap(PermsAuth::new(&["can_download"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(get_files)),
            ),
    );
}
