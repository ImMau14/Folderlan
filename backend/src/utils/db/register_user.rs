// Handles user registration with different roles and permissions
use crate::{models::responses::ApiResponse, utils::helpers::hash_password};
use actix_web::HttpResponse;
use serde::Deserialize;
use sqlx::SqlitePool;

// Visitor registration payload with specific permissions
#[derive(Deserialize, Debug)]
pub struct RegisterVisitorPayload {
    pub username: String,
    pub password: String,
    pub can_upload: bool,
    pub can_delete_own_files: bool,
    pub has_upload_limits: bool,
    pub upload_limit: u64,
}

// Owner registration payload with basic credentials
#[derive(Deserialize, Debug)]
pub struct RegisterOwnerPayload {
    pub username: String,
    pub password: String,
}

// Unified payload type handling both visitor and owner registration
#[derive(Deserialize, Debug)]
#[serde(untagged)]
pub enum RegisterPayload {
    Visitor(RegisterVisitorPayload),
    Owner(RegisterOwnerPayload),
}

// Registers a new user in the database with role-specific permissions
pub async fn register_user(pool: &SqlitePool, user: RegisterPayload) -> HttpResponse {
    // Internal payload structure for database insertion
    struct Payload {
        username: String,
        password_hash: String,
        role: String,
        can_upload: bool,
        can_delete_own_files: bool,
        has_upload_limits: bool,
        upload_limit: u64,
    }

    // Process payload based on user type (owner/visitor)
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
            can_upload: true,           // Owners have full upload privileges
            can_delete_own_files: true, // Owners can delete their files
            has_upload_limits: false,   // Owners have no upload limits
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
            can_upload: item.can_upload, // Configurable upload permission
            can_delete_own_files: item.can_delete_own_files, // Configurable delete permission
            has_upload_limits: item.has_upload_limits, // Configurable limits flag
            upload_limit: item.upload_limit, // Custom upload limit
        },
    };

    let upload_limit_i64 = user.upload_limit as i64;

    // Execute database insertion with user data
    match sqlx::query!(
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
        user.username,
        user.password_hash,
        user.role,
        user.can_upload,
        user.can_delete_own_files,
        user.has_upload_limits,
        upload_limit_i64, // Convert u64 to i64 for SQLite compatibility
    )
    .execute(pool)
    .await
    {
        // Handle insertion results
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
