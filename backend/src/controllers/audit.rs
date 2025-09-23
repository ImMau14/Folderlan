use actix_web::{Responder, web};
use actix_web_httpauth::middleware::HttpAuthentication;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, SqlitePool};

use crate::middleware::{jwt_middleware::jwt_validator_adapter, role_middleware::RoleAuth};
use crate::models::responses::ApiResponse;

// Query params accepted: start, end, user_id, file_id, event_type, success, limit, offset
#[derive(Deserialize)]
pub struct AuditLogQuery {
    // "2025-09-01 00:00:00" or "2025-09-01T00:00:00"
    pub start: Option<String>,
    pub end: Option<String>,

    pub user_id: Option<i64>,
    pub file_id: Option<i64>,
    pub event_type: Option<String>,
    pub success: Option<bool>,

    // Oagination
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Serialize, FromRow)]
pub struct AuditLogRow {
    pub id: i64,
    pub timestamp: String,
    pub user_id: Option<i64>,
    pub username: Option<String>,
    pub event_type: String,
    pub description: Option<String>,
    pub ip_address: Option<String>,
    pub file_id: Option<i64>,
    pub file_name: Option<String>,
    pub success: bool,
}

pub async fn list_audit_logs(
    pool: web::Data<SqlitePool>,
    query: web::Query<AuditLogQuery>,
) -> impl Responder {
    let pool_ref: &SqlitePool = pool.get_ref();

    let mut qb = QueryBuilder::new(
        "
        SELECT
            a.id,
            a.timestamp,
            a.user_id,
            u.username as username,
            a.event_type,
            a.description,
            a.ip_address,
            a.file_id,
            f.name as file_name,
            a.success
        FROM AuditLog a
        LEFT JOIN Users u ON a.user_id = u.id
        LEFT JOIN Files f ON a.file_id = f.id
        WHERE 1 = 1
    ",
    );

    // Filters
    if let Some(ref start) = query.start {
        qb.push(" AND a.timestamp >= ").push_bind(start);
    }
    if let Some(ref end) = query.end {
        qb.push(" AND a.timestamp <= ").push_bind(end);
    }
    if let Some(uid) = query.user_id {
        qb.push(" AND a.user_id = ").push_bind(uid);
    }
    if let Some(fid) = query.file_id {
        qb.push(" AND a.file_id = ").push_bind(fid);
    }
    if let Some(ref ev) = query.event_type {
        qb.push(" AND a.event_type = ").push_bind(ev);
    }
    if let Some(s) = query.success {
        qb.push(" AND a.success = ").push_bind(s);
    }

    // Order and pagination
    qb.push(" ORDER BY a.timestamp DESC");

    let limit = query.limit.unwrap_or(100u32).min(1000);
    qb.push(" LIMIT ").push_bind(limit as i64);

    let offset = query.offset.unwrap_or(0u32);
    qb.push(" OFFSET ").push_bind(offset as i64);

    let query_built = qb.build_query_as::<AuditLogRow>();

    match query_built.fetch_all(pool_ref).await {
        Ok(rows) => ApiResponse::<Vec<AuditLogRow>>::builder().data(rows).ok(),
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Database error: {}", e))
            .internal(),
    }
}

pub fn audit_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/audit")
            .wrap(RoleAuth::new(&["owner"]))
            .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
            .route("", web::get().to(list_audit_logs)),
    );
}
