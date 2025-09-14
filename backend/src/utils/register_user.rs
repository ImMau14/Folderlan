use actix_web::HttpResponse;
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::models::responses::ApiResponse;
use crate::utils::hash_password;

#[derive(Deserialize, Debug)]
pub struct RegisterVisitorPayload {
    pub username: String,
    pub password: String,
    pub can_upload: bool,
    pub can_delete_own_files: bool,
    pub has_upload_limits: bool,
    pub upload_limit: u64,
}

#[derive(Deserialize, Debug)]
pub struct RegisterOwnerPayload {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize, Debug)]
#[serde(untagged)]
pub enum RegisterPayload {
    Visitor(RegisterVisitorPayload),
    Owner(RegisterOwnerPayload),
}

pub async fn register_user(pool: &SqlitePool, user: RegisterPayload) -> HttpResponse {
    struct Payload {
        username: String,
        password_hash: String,
        role: String,
        can_upload: bool,
        can_delete_own_files: bool,
        has_upload_limits: bool,
        upload_limit: u64,
    }

    let user: Payload = match user {
        RegisterPayload::Owner(item) => Payload {
            username: item.username,
            password_hash: match hash_password(&item.password) {
                Ok(hash) => hash,
                Err(e) => {
                    return ApiResponse::<()>::builder()
                        .message(e.to_string())
                        .internal();
                }
            },
            role: "owner".to_string(),
            can_upload: true,
            can_delete_own_files: true,
            has_upload_limits: false,
            upload_limit: 0,
        },
        RegisterPayload::Visitor(item) => Payload {
            username: item.username,
            password_hash: match hash_password(&item.password) {
                Ok(hash) => hash,
                Err(e) => {
                    return ApiResponse::<()>::builder()
                        .message(e.to_string())
                        .internal();
                }
            },
            role: "visitor".to_string(),
            can_upload: item.can_upload,
            can_delete_own_files: item.can_delete_own_files,
            has_upload_limits: item.has_upload_limits,
            upload_limit: item.upload_limit,
        },
    };

    match sqlx::query(
        "
        INSERT INTO Users (
            username, 
            password_hash, 
            role, 
            can_upload, 
            can_delete_own_files,
            has_upload_limits,
            upload_limit
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ",
    )
    .bind(&user.username)
    .bind(&user.password_hash)
    .bind(&user.role)
    .bind(user.can_upload)
    .bind(user.can_delete_own_files)
    .bind(user.has_upload_limits)
    .bind(user.upload_limit as i64)
    .execute(pool)
    .await
    {
        Ok(result) if result.rows_affected() == 1 => ApiResponse::<()>::builder()
            .message("User created successfully")
            .created(),
        Ok(_) => ApiResponse::<()>::builder()
            .message("No record was inserted")
            .internal(),
        Err(e) => ApiResponse::<()>::builder()
            .message(format!("Database error: {e}"))
            .internal(),
    }
}
