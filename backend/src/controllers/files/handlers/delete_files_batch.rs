//! Batch soft-deletes multiple files in one transaction and removes their physical storage.

use crate::{
    models::{responses::ApiResponse, types::UploadsPath},
    utils::{
        db::{MinLevel, check_file_permission},
        helpers::get_user_id,
    },
};
use actix_web::{HttpRequest, HttpResponse, web};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

const MAX_BATCH: usize = 500;

#[derive(Deserialize)]
pub struct BatchDeleteRequest {
    pub ids: Vec<i64>,
}

#[derive(Serialize)]
pub struct BatchDeleteItem {
    pub id: i64,
    pub status: &'static str,
}

#[derive(Serialize)]
pub struct BatchDeleteSummary {
    pub deleted: usize,
    pub skipped: usize,
    pub items: Vec<BatchDeleteItem>,
}

/// Soft-deletes many files in a single transaction.
/// Responds with a per-id status: "deleted", "not_found" or "forbidden".
pub async fn delete_files_batch(
    pool: web::Data<SqlitePool>,
    req: HttpRequest,
    upload_path: web::Data<UploadsPath>,
    payload: web::Json<BatchDeleteRequest>,
) -> HttpResponse {
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };

    if payload.ids.is_empty() {
        return ApiResponse::<()>::builder()
            .message("No file ids provided")
            .bad_request();
    }

    if payload.ids.len() > MAX_BATCH {
        return ApiResponse::<()>::builder()
            .message(format!("Too many ids (max {MAX_BATCH} per request)"))
            .bad_request();
    }

    let mut seen = std::collections::HashSet::new();
    let ids: Vec<i64> = payload
        .ids
        .iter()
        .copied()
        .filter(|id| seen.insert(*id))
        .collect();

    let mut deleted_paths: Vec<(String, String)> = Vec::new();
    let mut items: Vec<BatchDeleteItem> = Vec::new();

    // Verify permission per id. First failure inside this loop is a server error.
    for &id in &ids {
        let id_u64 = match u64::try_from(id) {
            Ok(v) => v,
            Err(_) => {
                items.push(BatchDeleteItem {
                    id,
                    status: "not_found",
                });
                continue;
            }
        };

        match check_file_permission(pool.get_ref(), user_id, id_u64, MinLevel::Collaborator).await {
            Ok((internal_path, _)) => deleted_paths.push((format!("{id}"), internal_path)),
            Err(resp) => match resp.status().as_u16() {
                404 => items.push(BatchDeleteItem {
                    id,
                    status: "not_found",
                }),
                403 => items.push(BatchDeleteItem {
                    id,
                    status: "forbidden",
                }),
                _ => return resp,
            },
        }
    }

    if deleted_paths.is_empty() {
        return ApiResponse::builder()
            .message("No files were deleted")
            .data(BatchDeleteSummary {
                deleted: 0,
                skipped: items.len(),
                items,
            })
            .ok();
    }

    // Single transaction: soft-delete every visible id at once.
    let placeholders = vec!["?"; deleted_paths.len()].join(",");
    let sql = format!(
        "UPDATE Files SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP \
         WHERE id IN ({placeholders}) AND is_deleted = 0"
    );

    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(_) => {
            return ApiResponse::<()>::builder()
                .message("Failed to start transaction")
                .internal();
        }
    };

    let mut query = sqlx::query(&sql);
    for (id, _) in &deleted_paths {
        query = query.bind(id.parse::<i64>().unwrap());
    }

    if let Err(e) = query.execute(&mut *tx).await {
        let _ = tx.rollback().await;
        return ApiResponse::<()>::builder()
            .message(format!("Database error: {e}"))
            .internal();
    }

    if tx.commit().await.is_err() {
        return ApiResponse::<()>::builder()
            .message("Transaction failed")
            .internal();
    }

    // Remove physical files afterwards; a failed removal is not fatal (same as single delete).
    for (id, internal_path) in &deleted_paths {
        let full_path = upload_path.get_ref().get().join(internal_path);
        if let Err(e) = tokio::fs::remove_file(&full_path).await {
            eprintln!(
                "Batch delete: physical removal failed for {}: {e}",
                internal_path
            );
        }
        items.push(BatchDeleteItem {
            id: id.parse().unwrap(),
            status: "deleted",
        });
    }

    let deleted = items.iter().filter(|i| i.status == "deleted").count();
    let skipped = items.len() - deleted;

    ApiResponse::builder()
        .message(format!("Files deleted: {deleted}"))
        .data(BatchDeleteSummary {
            deleted,
            skipped,
            items,
        })
        .ok()
}
