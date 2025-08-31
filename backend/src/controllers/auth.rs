use actix_web::{web, HttpResponse};
use actix_web_httpauth::middleware::HttpAuthentication;
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Row, SqlitePool};
use argon2::{Argon2, PasswordHash, PasswordVerifier};

use crate::middleware::jwt_middleware::{jwt_validator_adapter, Claims, JwtConfig};
use crate::middleware::role_middleware::RoleAuth;
use crate::middleware::server_ip_only::LocalOnly;
use crate::utils::{register_user, RegisterPayload};

#[derive(Deserialize, Debug)]
pub struct LoginPayload {
    pub username: String,
    pub password: String
}

#[derive(Serialize)]
struct LoginResponse {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    token: Option<String>
}

pub async fn login(
    pool: web::Data<SqlitePool>,
    jwt_cfg: web::Data<JwtConfig>,
    credentials: web::Json<LoginPayload>,
) -> HttpResponse {
    let query_result = sqlx::query(
        "SELECT id, username, password_hash, role FROM Users WHERE username = ?"
    )
    .bind(&credentials.username)
    .fetch_optional(pool.get_ref())
    .await;

    let user = match query_result {
        Ok(Some(row)) => row,
        Ok(None) => {
            return HttpResponse::Unauthorized().json(json!({
                "success": false,
                "message": "Invalid credentials"
            }))
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": e.to_string()
            }))
        }
    };

    let id: i64 = user.get("id");
    let username: String = user.get("username");
    let password_hash: String = user.get("password_hash");
    let role: String = user.get("role");

    let parsed_hash = match PasswordHash::new(&password_hash) {
        Ok(parsed) => parsed,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": e.to_string()
            }))
        }
    };

    let argon2 = Argon2::default();
    if argon2
        .verify_password(credentials.password.as_bytes(), &parsed_hash)
        .is_err()
    {
        return HttpResponse::Unauthorized().json(json!({
            "success": false,
            "message": "Invalid credentials"
        }));
    }

    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(1))
        .expect("Invalid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: id.to_string(),
        username: username.clone(),
        role: role.clone(),
        exp: expiration
    };

    let token = match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_cfg.secret.as_bytes())
    ) {
        Ok(t) => t,
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": e.to_string()
            }))
        }
    };

    HttpResponse::Ok().json(LoginResponse {
        success: true,
        message: "Login success".to_string(),
        token: Some(token)
    })
}

pub async fn register(
    pool: web::Data<SqlitePool>,
    user: web::Json<RegisterPayload>,
) -> HttpResponse {
    let user_data = user.into_inner();

    match user_data {
        RegisterPayload::Owner(_) => {
            HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": "Cannot make owner user from this endpoint"
            }))
        }
        RegisterPayload::Visitor(visitor_data) => {
            register_user(pool.get_ref(), RegisterPayload::Visitor(visitor_data)).await
        }
    }
}

pub async fn owner_register(
    pool: web::Data<SqlitePool>,
    user: web::Json<RegisterPayload>,
) -> HttpResponse {
    let user_data = user.into_inner();

    match user_data {
        RegisterPayload::Visitor(_) => {
            HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": "Cannot make visitor user from this endpoint"
            }))
        }
        RegisterPayload::Owner(owner_data) => {
            register_user(pool.get_ref(), RegisterPayload::Owner(owner_data)).await
        }
    }
}

pub fn auth_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .service(web::resource("/login").route(web::post().to(login)))
            .service(
                web::resource("/register")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(register))
            )
            .service(
                web::resource("/owner_register")
                    .wrap(LocalOnly)
                    .route(web::post().to(owner_register))
            )
    );
}