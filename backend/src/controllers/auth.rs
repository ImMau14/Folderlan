use actix_web::{web, HttpResponse};
use actix_web_httpauth::middleware::HttpAuthentication;
use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{SqlitePool, Row};

use crate::middleware::jwt_middleware::{jwt_validator_adapter, Claims, JwtConfig};
use crate::middleware::role_middleware::RoleAuth;
use crate::middleware::server_ip_only::LocalOnly;

#[derive(Deserialize, Debug)]
pub(crate) struct AuthPayload {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
struct LoginResponse {
    success: bool,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    token: Option<String>,
}

pub async fn login(
    pool: web::Data<SqlitePool>,
    jwt_cfg: web::Data<JwtConfig>,
    credentials: web::Json<AuthPayload>
) -> HttpResponse {
    let query_result = sqlx::query(
        "SELECT id, username, password_hash, role FROM Users WHERE username = ?"
    )
    .bind(&credentials.username)
    .fetch_optional(pool.get_ref())
    .await;

    let user = match query_result {
        Ok(Some(row)) => row,
        Ok(None) => return HttpResponse::Unauthorized().json(json!({
            "success": false,
            "message": "Invalid credentials"
        })),
        Err(e) => return HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": e.to_string()
        }))
    };

    let id: i64 = user.get("id");
    let username: String = user.get("username");
    let password_hash: String = user.get("password_hash");
    let role: String = user.get("role");

    let parsed_hash = match PasswordHash::new(&password_hash) {
        Ok(parsed) => parsed,
        Err(e) => return HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": e.to_string()
        }))
    };

    let argon2 = Argon2::default();
    if argon2
        .verify_password(credentials.password.as_bytes(), &parsed_hash)
        .is_err()
    {
        return HttpResponse::Unauthorized().json(json!({
            "success": false,
            "message": "Invalid credentials"
        }))
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
        Err(e) => return HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": e.to_string()
        }))
    };

    HttpResponse::Ok().json(LoginResponse {
        success: true,
        message: "Login success".to_string(),
        token: Some(token)
    })
}

pub async fn register(
    pool: web::Data<SqlitePool>,
    item: web::Json<AuthPayload>
) -> HttpResponse {
    register_user(pool, item, "visitor").await
}

pub async fn owner_register(
    pool: web::Data<SqlitePool>,
    item: web::Json<AuthPayload>
) -> HttpResponse {
    register_user(pool, item, "owner").await
}

async fn register_user(
    pool: web::Data<SqlitePool>,
    item: web::Json<AuthPayload>,
    role: &str
) -> HttpResponse {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = match argon2.hash_password(item.password.as_bytes(), &salt) {
        Ok(hash) => hash.to_string(),
        Err(e) => return HttpResponse::InternalServerError().json(json!({
            "success": false,
            "message": &format!("Password hash error: {}", e)
        }))
    };

    match sqlx::query(
        "INSERT INTO Users (username, password_hash, role) VALUES (?, ?, ?)"
    )
        .bind(&item.username)
        .bind(&password_hash)
        .bind(role)
        .execute(pool.get_ref())
        .await {
            Ok(result) if result.rows_affected() == 1 => {
                HttpResponse::Created().json(json!({
                    "success": true,
                    "message": &format!("{} user created successfully", role)
                }))
            }
            Ok(_) => return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": "No record was inserted"
            })),
            Err(e) => return HttpResponse::InternalServerError().json(json!({
                "success": false,
                "message": &format!("Database error: {}", e)
            }))
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