//! Retrieves a paginated list of files accessible to the authenticated user.

use crate::{models::responses::ApiResponse, utils::helpers::get_user_id};
use actix_web::{HttpRequest, HttpResponse, web};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Deserialize)]
pub struct FileQuery {
    pub name: Option<String>,
    pub min_size: Option<i64>,
    pub max_size: Option<i64>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub visibility: Option<String>,
    pub uploaded_by: Option<i64>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(sqlx::FromRow, Serialize)]
struct FileRow {
    id: i64,
    name: String,
    size_bytes: i64,
    internal_path: String,
    mime_type: Option<String>,
    is_public: bool,
    uploaded_by: Option<String>,
    uploaded_at: Option<String>,
    total_count: i64,
}

#[derive(Serialize)]
struct FilesPage<T> {
    items: Vec<T>,
    total: i64,
    limit: u32,
    offset: u32,
}

/// Returns a paginated list of files with optional filtering.
pub async fn get_files(
    pool: web::Data<SqlitePool>,
    q: web::Query<FileQuery>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match get_user_id(req.clone()) {
        Ok(id) => id,
        Err(e) => return e,
    };
    // SQLite does not support u64 parameters.
    let user_id_i64 = user_id as i64;

    let limit = q.limit.unwrap_or(25).min(100) as i64;
    let offset = q.offset.unwrap_or(0) as i64;

    let name_pattern = q.name.as_ref().map(|s| format!("%{}%", s));

    let rows = match sqlx::query_as!(
        FileRow,
        r#"
        SELECT
            f.id as "id!",
            f.name as "name!",
            f.size_bytes as "size_bytes!",
            f.internal_path as "internal_path!",
            f.mime_type as "mime_type: _",
            f.is_public as "is_public!",
            u.username as "uploaded_by: _",
            f.uploaded_at as "uploaded_at: _", 
            COUNT(*) OVER () as "total_count!"
        FROM Files f
        JOIN Users ru ON ru.id = ? AND ru.is_deleted = 0 AND ru.is_active = 1
        LEFT JOIN Users u ON u.id = f.uploaded_by
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
        AND (? IS NULL OR (? = 'public' AND f.is_public = 1) OR (? = 'private' AND f.is_public = 0))
        AND (? IS NULL OR f.uploaded_by = ?)
        ORDER BY f.uploaded_at DESC
        LIMIT ? OFFSET ?
        "#,
        user_id_i64,
        name_pattern,
        name_pattern,
        q.min_size,
        q.min_size,
        q.max_size,
        q.max_size,
        q.start_date,
        q.start_date,
        q.end_date,
        q.end_date,
        q.visibility,
        q.visibility,
        q.visibility,
        q.uploaded_by,
        q.uploaded_by,
        limit,
        offset
    )
    .fetch_all(pool.get_ref())
    .await
    {
        Ok(r) => r,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Database error: {e}"))
                .internal();
        }
    };

    let total = rows.first().map(|r| r.total_count).unwrap_or(0);
    let page = FilesPage {
        items: rows,
        total,
        limit: limit as u32,
        offset: offset as u32,
    };

    ApiResponse::builder()
        .message("Files fetched")
        .data(page)
        .ok()
}
