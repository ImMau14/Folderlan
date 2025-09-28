// Manages user-related endpoints including listing, updating permissions, toggling status, and file access
use crate::{
    middleware::{jwt_middleware::jwt_validator_adapter, role_middleware::RoleAuth},
    models::responses::ApiResponse,
};
use actix_web::{HttpResponse, Responder, web};
use actix_web_httpauth::middleware::HttpAuthentication;
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

// Query parameters for user list filtering and pagination.
#[derive(Deserialize)]
pub struct UserQuery {
    pub name: Option<String>,
    // Permission filter: "can_upload" | "can_upload:false" | "can_upload,has_upload_limits"
    pub perm: Option<String>,
    pub is_active: Option<bool>,
    pub include_deleted: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

// User record with total count for pagination.
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

// Paginated user list response.
#[derive(Serialize)]
pub struct UsersPage {
    pub items: Vec<UserRowWithTotal>,
    pub total: i64,
    pub limit: u32,
    pub offset: u32,
}

// User permission update payload.
#[derive(Deserialize)]
pub struct UpdateUserPerms {
    pub can_upload: Option<bool>,
    pub can_delete_own_files: Option<bool>,
    pub has_upload_limits: Option<bool>,
    pub upload_limit: Option<i64>,
}

// File accessible by a user with access level.
#[derive(Serialize, sqlx::FromRow)]
pub struct AccessibleFile {
    pub id: i64,
    pub name: String,
    pub size_bytes: i64,
    pub mime_type: Option<String>,
    pub uploaded_by: i64,
    pub uploaded_at: String,
    pub access_type: String, // "owner", "viewer", "collaborator"
}

// Parses permission filter string into individual permission flags.
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

// Soft-deletes a user by setting is_deleted flag. Prevents owner deletion.
pub async fn delete_user(pool: web::Data<SqlitePool>, path: web::Path<u64>) -> HttpResponse {
    let id = path.into_inner();

    let row = match sqlx::query(
        "
        SELECT role 
        FROM Users 
        WHERE 
            id = ? 
            AND is_deleted = 0
    ",
    )
    .bind(id as i64)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return ApiResponse::<()>::builder()
                .message("User not found")
                .not_found();
        }
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Internal server error: {e}"))
                .internal();
        }
    };

    let role: String = match row.try_get("role") {
        Ok(role) => role,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Internal server error: {e}"))
                .internal();
        }
    };

    if role == "owner" {
        return ApiResponse::<()>::builder()
            .message("Cannot delete owner user")
            .bad_request();
    }

    match sqlx::query(
        "
        UPDATE Users 
        SET 
            is_deleted = 1,
            deleted_at = CURRENT_TIMESTAMP,
            is_active = 0
        WHERE id = ?
    ",
    )
    .bind(id as i64)
    .execute(pool.get_ref())
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                ApiResponse::<()>::builder()
                    .message("User not found")
                    .not_found()
            } else {
                ApiResponse::<()>::builder()
                    .message("User deleted successfully")
                    .ok()
            }
        }
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Internal server error: {e}"))
            .internal(),
    }
}

// Retrieves paginated and filtered user list.
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

// Toggles user active status.
pub async fn toggle_user_active(
    pool: web::Data<SqlitePool>,
    path: web::Path<u64>,
) -> impl Responder {
    let id = path.into_inner();

    let user_exists =
        match sqlx::query_scalar::<_, i64>("SELECT 1 FROM Users WHERE id = ? AND is_deleted = 0")
            .bind(id as i64)
            .fetch_optional(pool.get_ref())
            .await
        {
            Ok(Some(_)) => true,
            Ok(None) => false,
            Err(e) => {
                return ApiResponse::<()>::builder()
                    .message(format!("DB error: {e}"))
                    .internal();
            }
        };

    if !user_exists {
        return ApiResponse::<()>::builder()
            .message("User not found")
            .not_found();
    }

    match sqlx::query(
        "
        UPDATE Users 
        SET 
            is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
        WHERE id = ?
    ",
    )
    .bind(id as i64)
    .execute(pool.get_ref())
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                ApiResponse::<()>::builder()
                    .message("User not found")
                    .not_found()
            } else {
                ApiResponse::<()>::builder()
                    .message("User status toggled successfully")
                    .ok()
            }
        }
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Internal server error: {e}"))
            .internal(),
    }
}

// Updates user permissions.
pub async fn update_user_perms(
    pool: web::Data<SqlitePool>,
    path: web::Path<u64>,
    payload: web::Json<UpdateUserPerms>,
) -> impl Responder {
    let id = path.into_inner();
    let payload = payload.into_inner();

    let user_exists =
        match sqlx::query_scalar::<_, i64>("SELECT 1 FROM Users WHERE id = ? AND is_deleted = 0")
            .bind(id as i64)
            .fetch_optional(pool.get_ref())
            .await
        {
            Ok(Some(_)) => true,
            Ok(None) => false,
            Err(e) => {
                return ApiResponse::<()>::builder()
                    .message(format!("DB error: {e}"))
                    .internal();
            }
        };

    if !user_exists {
        return ApiResponse::<()>::builder()
            .message("User not found")
            .not_found();
    }

    match sqlx::query(
        r#"
        UPDATE Users 
        SET 
            can_upload = COALESCE(?, can_upload),
            can_delete_own_files = COALESCE(?, can_delete_own_files),
            has_upload_limits = COALESCE(?, has_upload_limits),
            upload_limit = COALESCE(?, upload_limit)
        WHERE id = ?
    "#,
    )
    .bind(payload.can_upload.map(|b| if b { 1i64 } else { 0i64 }))
    .bind(
        payload
            .can_delete_own_files
            .map(|b| if b { 1i64 } else { 0i64 }),
    )
    .bind(
        payload
            .has_upload_limits
            .map(|b| if b { 1i64 } else { 0i64 }),
    )
    .bind(payload.upload_limit)
    .bind(id as i64)
    .execute(pool.get_ref())
    .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                ApiResponse::<()>::builder()
                    .message("User not found")
                    .not_found()
            } else {
                ApiResponse::<()>::builder()
                    .message("User permissions updated successfully")
                    .ok()
            }
        }
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Internal server error: {e}"))
            .internal(),
    }
}

// Retrieves all files accessible by a user including ownership and permissions.
pub async fn get_accessible_files(
    pool: web::Data<SqlitePool>,
    user_id: web::Path<u64>,
) -> impl Responder {
    let user_id = user_id.into_inner() as i64;

    let query = r#"
        SELECT 
            f.id, 
            f.name, 
            f.size_bytes, 
            f.mime_type, 
            f.uploaded_by, 
            f.uploaded_at,
            CASE
                WHEN f.uploaded_by = ? THEN 'owner'
                WHEN fp.access_level = 'collaborator' THEN 'collaborator'
                ELSE 'viewer'
            END as access_type
        FROM Files f
        LEFT JOIN FilePermissions fp ON 
            f.id = fp.file_id AND 
            fp.user_id = ?
        WHERE 
            f.is_deleted = 0 AND
            (f.is_public = 1 OR 
             f.uploaded_by = ? OR 
             fp.user_id IS NOT NULL)
    "#;

    match sqlx::query_as::<_, AccessibleFile>(query)
        .bind(user_id)
        .bind(user_id)
        .bind(user_id)
        .fetch_all(pool.get_ref())
        .await
    {
        Ok(files) => ApiResponse::builder()
            .message("Files fetched successfully")
            .data(files)
            .ok(),
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("DB error: {e}"))
            .internal(),
    }
}

// Configures user management routes with JWT authentication and role-based authorization.
pub fn users_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/user")
            .service(
                web::resource("")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(get_users)),
            )
            .service(
                web::resource("/{id}")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::delete().to(delete_user)),
            )
            .service(
                web::resource("/{id}/toggle")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(toggle_user_active)),
            )
            .service(
                web::resource("/{id}/perms")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(update_user_perms)),
            )
            .service(
                web::resource("{id}/accessible")
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::get().to(get_accessible_files)),
            ),
    );
}
