use serde::Deserialize;
use sqlx::SqlitePool;
use actix_web::HttpResponse;
use serde_json::json;

use crate::utils::hash_password;

#[derive(Deserialize, Debug)]
pub struct RegisterVisitorPayload {
    pub username: String,
    pub password: String,
    pub can_access_all_files: bool,
    pub can_download: bool,
    pub can_upload: bool,
    pub can_edit: bool,
    pub can_delete: bool,
    pub has_upload_limits: bool,
    pub upload_limit: u64
}

#[derive(Deserialize, Debug)]
pub struct RegisterOwnerPayload {
    pub username: String,
    pub password: String
}

#[derive(Deserialize, Debug)]
#[serde(untagged)]
pub enum RegisterPayload {
    Owner(RegisterOwnerPayload),
    Visitor(RegisterVisitorPayload)
}

pub async fn register_user(pool: &SqlitePool, user: RegisterPayload) -> HttpResponse {
    struct Payload {
        username: String,
        password_hash: String,
        role: String,
        can_access_all_files: bool,
        can_download: bool,
        can_upload: bool,
        can_edit: bool,
        can_delete: bool,
        has_upload_limits: bool,
        upload_limit: u64
    }

    let user: Payload = match user {
        RegisterPayload::Owner(item) => Payload {
            username: item.username,
            password_hash: match hash_password(&item.password) {
                Ok(hash) => hash,
                Err(e) => {
                    return HttpResponse::InternalServerError().json(json!({
                        "success": false,
                        "message": &format!("{e}")
                    }))
                }
            },
            role: "owner".to_string(),
            can_access_all_files: true,
            can_download: true,
            can_upload: true,
            can_edit: true,
            can_delete: true,
            has_upload_limits: false,
            upload_limit: 0,
        },
        RegisterPayload::Visitor(item) => Payload {
            username: item.username,
            password_hash: match hash_password(&item.password) {
                Ok(hash) => hash,
                Err(e) => {
                    return HttpResponse::InternalServerError().json(json!({
                        "success": false,
                        "message": &format!("{e}")
                    }))
                }
            },
            role: "visitor".to_string(),
            can_access_all_files: item.can_access_all_files,
            can_download: item.can_download,
            can_upload: item.can_upload,
            can_edit: item.can_edit,
            can_delete: item.can_delete,
            has_upload_limits: item.has_upload_limits,
            upload_limit: item.upload_limit
        }
    };

    match sqlx::query(
        "
        INSERT INTO Users (
            username, 
            password_hash, 
            role, 
            can_access_all_files, 
            can_download, 
            can_upload, 
            can_edit, 
            can_delete,
            has_upload_limits,
            upload_limit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "
    )
    .bind(&user.username)
    .bind(&user.password_hash)
    .bind(&user.role)
    .bind(&user.can_access_all_files)
    .bind(&user.can_download)
    .bind(&user.can_upload)
    .bind(&user.can_edit)
    .bind(&user.can_delete)
    .bind(&user.has_upload_limits)
    .bind(user.upload_limit as i64)
    .execute(pool)
    .await
    {
        Ok(result) if result.rows_affected() == 1 => HttpResponse::Created().json(json!({
            "success": true,
            "message": "User created successfully"
        })),
        Ok(_) => HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": "No record was inserted"
        })),
        Err(e) => HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": &format!("Database error: {}", e)
        }))
    }
}