use actix_multipart::Multipart;
use actix_web::{HttpMessage, HttpRequest, HttpResponse, Responder, web};
use actix_web_httpauth::middleware::HttpAuthentication;
use futures_util::TryStreamExt as _;
use once_cell::sync::Lazy;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;
use tokio::sync::Mutex as TokioMutex;

use crate::middleware::jwt_middleware::AuthUser;
use crate::middleware::jwt_middleware::jwt_validator_adapter;
use crate::middleware::perms_middleware::PermsAuth;
use crate::models::types::{ChunkMeta, Response};
use crate::utils::storage;
use crate::utils::{RegisterFilePayload, register_file};

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
                    Ok(m) => meta_opt = Some(m),
                    Err(e) => {
                        return HttpResponse::BadRequest().json(Response {
                            success: false,
                            message: format!("invalid metadata JSON: {e}"),
                        });
                    }
                }
            }

            Some("chunk") => {
                let meta = match meta_opt.take() {
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
                        .entry(meta.file_id.clone())
                        .or_insert_with(|| Arc::new(TokioMutex::new(())))
                        .clone()
                };
                let _guard = lock.lock().await;

                match storage::save_chunk_to(&base, &meta, field).await {
                    Ok(_saved_path) => {
                        if storage::all_parts_present(&base, &meta).await {
                            match storage::assemble_file(&base, &meta).await {
                                Ok((final_path, file_name, file_size, mime_type)) => {
                                    storage::cleanup_tmp_files(&base, &meta.file_id).await;
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
                                    storage::cleanup_tmp_files(&base, &meta.file_id).await;
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
                                    meta.chunk_index, meta.file_id
                                ),
                            });
                        }
                    }
                    Err(e) => {
                        storage::cleanup_tmp_files(&base, &meta.file_id).await;
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

pub fn files_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/files")
            .wrap(PermsAuth::new(&["can_upload"]))
            .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
            .route("", web::post().to(upload_file)),
    );
}
