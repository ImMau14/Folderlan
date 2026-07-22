//! Handles user login by verifying credentials and generating a JWT.

use crate::middleware::jwt_middleware::{Claims, JwtConfig};
use crate::models::responses::ApiResponse;
use actix_web::{HttpResponse, web};
use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordVerifier},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{EncodingKey, Header, encode};
use serde::Deserialize;
use sqlx::SqlitePool;

/// Expected structure for login requests.
#[derive(Deserialize, Debug)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

/// Verifies user credentials and returns a JWT token on success.
pub async fn login(
    pool: web::Data<SqlitePool>,
    jwt_cfg: web::Data<JwtConfig>,
    credentials: web::Json<LoginPayload>,
) -> HttpResponse {
    let credentials = credentials.into_inner();

    // Fetch user from database.
    let user = match sqlx::query!(
        r#"
        SELECT 
            id, username, password_hash, role, is_deleted, is_active 
        FROM Users 
        WHERE username = ?
        "#,
        credentials.username
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(row)) => row,
        Ok(None) => {
            return ApiResponse::<()>::builder()
                .message("Invalid credentials")
                .unauthorized();
        }
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    // Check account status.
    if user.is_deleted == 1 {
        return ApiResponse::<()>::builder()
            .message("Your account has been deleted")
            .unauthorized();
    }

    if user.is_active != 1 {
        return ApiResponse::<()>::builder()
            .message("Your account has been disabled")
            .unauthorized();
    }

    // Verify password.
    let parsed_hash = match PasswordHash::new(&user.password_hash) {
        Ok(parsed) => parsed,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    let argon2 = Argon2::default();
    if argon2
        .verify_password(credentials.password.as_bytes(), &parsed_hash)
        .is_err()
    {
        return ApiResponse::<()>::builder()
            .message("Invalid credentials")
            .unauthorized();
    }

    // Update last login timestamp.
    if let Err(e) = sqlx::query!(
        "UPDATE Users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
        user.id
    )
    .execute(pool.get_ref())
    .await
    {
        return ApiResponse::<()>::builder()
            .message(e.to_string())
            .internal();
    }

    // Build JWT claims with 1-hour expiration.
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(1))
        .expect("Invalid timestamp")
        .timestamp() as usize;

    let Some(user_id) = user.id else {
        return ApiResponse::<()>::builder()
            .message("Cannot get user id")
            .internal();
    };

    let claims = Claims {
        sub: user_id.to_string(),
        username: user.username.clone(),
        role: user.role.clone(),
        exp: expiration,
    };

    // Encode JWT.
    let token = match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_cfg.secret.as_bytes()),
    ) {
        Ok(t) => t,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    ApiResponse::<()>::builder()
        .message("Login success")
        .token(token)
        .ok()
}
