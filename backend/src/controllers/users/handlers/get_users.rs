// Manages listing users with filtering and pagination.

use crate::models::responses::ApiResponse;
use actix_web::{Responder, web};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

/// Query parameters for user list filtering and pagination.
#[derive(Deserialize)]
pub struct UserQuery {
    pub name: Option<String>,
    /// Permission filter: "can_upload" | "can_upload:false" | "can_upload,has_upload_limits"
    pub perm: Option<String>,
    pub is_active: Option<bool>,
    pub include_deleted: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// User record with total count for pagination.
#[derive(Serialize, sqlx::FromRow)]
pub struct UserRowWithTotal {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub is_active: i64,
    pub can_upload: i64,
    pub can_delete_own_files: i64,
    pub has_upload_limits: i64,
    pub upload_limit: i64,
    pub created_at: Option<String>,
    pub last_login_at: Option<String>,
    pub total_count: i64,
}

/// Paginated user list response.
#[derive(Serialize)]
pub struct UsersPage {
    pub items: Vec<UserRowWithTotal>,
    pub total: i64,
    pub limit: u32,
    pub offset: u32,
}

/// Parses permission filter string into individual permission flags.
fn parse_perm_flags(perm: &Option<String>) -> (Option<bool>, Option<bool>, Option<bool>) {
    if perm.is_none() {
        return (None, None, None);
    }
    let mut cu: Option<bool> = None;
    let mut cd: Option<bool> = None;
    let mut hl: Option<bool> = None;

    for token in perm.as_ref().unwrap().split(',') {
        let token = token.trim();
        if token.is_empty() {
            continue;
        }
        let (name, val_opt) = if let Some(idx) = token.find(':') {
            let (n, v) = token.split_at(idx);
            (n.trim(), Some(v[1..].trim()))
        } else {
            (token, None)
        };

        let value = match val_opt {
            Some("true") | Some("1") => Some(true),
            Some("false") | Some("0") => Some(false),
            None => Some(true),
            Some(_) => None,
        };

        match name {
            "can_upload" => cu = value,
            "can_delete_own_files" => cd = value,
            "has_upload_limits" => hl = value,
            _ => {}
        }
    }

    (cu, cd, hl)
}

/// Retrieves paginated and filtered user list.
pub async fn get_users(pool: web::Data<SqlitePool>, q: web::Query<UserQuery>) -> impl Responder {
    let limit_u32 = q.limit.unwrap_or(25).min(100);
    let offset_u32 = q.offset.unwrap_or(0);
    let name_pattern: Option<String> = q.name.as_ref().map(|s| format!("%{s}%"));

    let (can_upload_filter, can_delete_filter, has_limits_filter) = parse_perm_flags(&q.perm);
    let include_deleted_flag: i64 = if q.include_deleted.unwrap_or(false) {
        1
    } else {
        0
    };
    let is_active_bind: Option<i64> = q.is_active.map(|b| if b { 1i64 } else { 0i64 });

    let can_upload_bind = can_upload_filter.map(|b| if b { 1i64 } else { 0i64 });
    let can_delete_bind = can_delete_filter.map(|b| if b { 1i64 } else { 0i64 });
    let has_limits_bind = has_limits_filter.map(|b| if b { 1i64 } else { 0i64 });

    let rows_result = sqlx::query_as::<_, UserRowWithTotal>(
        r#"
        SELECT
            id,
            username,
            role,
            is_active,
            can_upload,
            can_delete_own_files,
            has_upload_limits,
            upload_limit,
            created_at,
            last_login_at,
            COUNT(1) OVER () AS total_count
        FROM Users
        WHERE
            (? = 1 OR is_deleted = 0)
            AND (? IS NULL OR username LIKE ?)
            AND (? IS NULL OR is_active = ?)
            AND (? IS NULL OR can_upload = ?)
            AND (? IS NULL OR can_delete_own_files = ?)
            AND (? IS NULL OR has_upload_limits = ?)
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    "#,
    )
    .bind(include_deleted_flag)
    .bind(name_pattern.as_deref())
    .bind(name_pattern.as_deref())
    .bind(is_active_bind)
    .bind(is_active_bind)
    .bind(can_upload_bind)
    .bind(can_upload_bind)
    .bind(can_delete_bind)
    .bind(can_delete_bind)
    .bind(has_limits_bind)
    .bind(has_limits_bind)
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
    let page = UsersPage {
        items: rows,
        total,
        limit: limit_u32,
        offset: offset_u32,
    };

    ApiResponse::builder()
        .message("Users fetched")
        .data(page)
        .ok()
}
