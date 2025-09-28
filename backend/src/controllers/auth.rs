// Manages authentication-related endpoints, including login, registration, and password resets.
use crate::{
    middleware::{
        jwt_middleware::{Claims, JwtConfig, jwt_validator_adapter},
        role_middleware::RoleAuth,
        server_ip_only::LocalOnly,
    },
    models::responses::ApiResponse,
    utils::{
        db::{RegisterPayload, register_user},
        helpers::hash_password,
    },
};
use actix_web::{HttpMessage, HttpRequest, HttpResponse, web};
use actix_web_httpauth::middleware::HttpAuthentication;
use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordVerifier},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{EncodingKey, Header, encode};
use serde::Deserialize;
use sqlx::{Row, SqlitePool};

// Defines the expected structure for login requests.
#[derive(Deserialize, Debug)]
pub struct LoginPayload {
    pub username: String,
    pub password: String,
}

// Defines the expected structure for an owner's password reset request.
#[derive(Deserialize)]
pub struct OwnerResetPayload {
    pub password: String,
}

// Defines the expected structure for a visitor's password reset request.
#[derive(Deserialize)]
pub struct VisitorResetPayload {
    pub username: String,
    pub password: String,
}

// Handles user login by verifying credentials and generating a JWT.
pub async fn login(
    pool: web::Data<SqlitePool>,
    jwt_cfg: web::Data<JwtConfig>,
    credentials: web::Json<LoginPayload>,
) -> HttpResponse {
    let credentials = credentials.into_inner();

    // Fetches the user from the database.
    let query_result = sqlx::query(
        "
        SELECT 
            id, username, password_hash, role, is_deleted, is_active 
        FROM Users 
        WHERE username = ?
    ",
    )
    .bind(&credentials.username)
    .fetch_optional(pool.get_ref())
    .await;

    let user = match query_result {
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

    let id: i64 = user.get("id");
    let username: String = user.get("username");
    let password_hash: String = user.get("password_hash");
    let role: String = user.get("role");
    let is_deleted: bool = user.get("is_deleted");
    let is_active: bool = user.get("is_active");

    // Returns an error if the account is deleted or disabled.
    if is_deleted {
        return ApiResponse::<()>::builder()
            .message("Your account has been deleted")
            .unauthorized();
    }

    if !is_active {
        return ApiResponse::<()>::builder()
            .message("Your account has been disabled")
            .unauthorized();
    }

    // Verifies the provided password against the stored hash.
    let parsed_hash = match PasswordHash::new(&password_hash) {
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

    // Updates the user's last login timestamp.
    if let Err(e) = sqlx::query(
        "
        UPDATE Users 
        SET last_login_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    ",
    )
    .bind(id)
    .execute(pool.get_ref())
    .await
    {
        return ApiResponse::<()>::builder()
            .message(e.to_string())
            .internal();
    }

    // Creates the JWT claims with a 1-hour expiration.
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(1))
        .expect("Invalid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: id.to_string(),
        username: username.clone(),
        role: role.clone(),
        exp: expiration,
    };

    // Generates the JWT token.
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

    // Returns a success response with the JWT.
    ApiResponse::<()>::builder()
        .message("Login success")
        .token(token)
        .ok()
}

// Handles the registration of a new visitor.
pub async fn register(
    pool: web::Data<SqlitePool>,
    user: web::Json<RegisterPayload>,
) -> HttpResponse {
    let user_data = user.into_inner();

    // Delegates to the user registration utility, ensuring only visitors can register here.
    match user_data {
        RegisterPayload::Visitor(visitor_data) => {
            register_user(pool.get_ref(), RegisterPayload::Visitor(visitor_data)).await
        }
        RegisterPayload::Owner(_) => ApiResponse::<()>::builder()
            .message("Cannot make owner user from this endpoint")
            .internal(),
    }
}

// Handles the registration of a new owner. Restricted to the local server.
pub async fn owner_register(
    pool: web::Data<SqlitePool>,
    user: web::Json<RegisterPayload>,
) -> HttpResponse {
    let user_data = user.into_inner();

    // Delegates to the user registration utility, ensuring only owners can register here.
    match user_data {
        RegisterPayload::Visitor(_) => ApiResponse::<()>::builder()
            .message("Cannot make visitor user from this endpoint")
            .internal(),
        RegisterPayload::Owner(owner_data) => {
            register_user(pool.get_ref(), RegisterPayload::Owner(owner_data)).await
        }
    }
}

// Handles an owner resetting their own password. Restricted to the local server.
pub async fn owner_reset_password(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    payload: web::Json<OwnerResetPayload>,
) -> HttpResponse {
    let password = payload.password.trim();

    // Fetches the owner account from the database.
    let owner_row = match sqlx::query(
        "SELECT 
            id, 
            username
        FROM Users 
        WHERE 
            role = 'owner' 
            AND is_deleted = 0 LIMIT 1",
    )
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(opt) => opt,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    let owner = match owner_row {
        Some(row) => {
            let id: i64 = row.get("id");
            let username: String = row.get("username");
            (id, username)
        }
        None => {
            return ApiResponse::<()>::builder()
                .message("Owner account not found")
                .internal();
        }
    };

    // Hashes the new password.
    let password_hash = match hash_password(password) {
        Ok(pass) => pass,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    // Updates the owner's password in the database.
    if let Err(e) = sqlx::query(
        "
        UPDATE Users 
        SET password_hash = ? 
        WHERE id = ?
    ",
    )
    .bind(&password_hash)
    .bind(owner.0)
    .execute(pool.get_ref())
    .await
    {
        return ApiResponse::<()>::builder()
            .message(e.to_string())
            .internal();
    }

    let ip_addr = req
        .connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string();

    // Logs the password reset action in the audit log.
    let _ = sqlx::query(
        "
        INSERT INTO AuditLog(
            user_id, 
            event_type, 
            description, 
            ip_address, 
            success
        ) VALUES (
            ?, 
            ?, 
            ?, 
            ?, 
            1
        )",
    )
    .bind(owner.0)
    .bind("OWNER_PASSWORD_RESET")
    .bind(format!(
        "Owner password reset via LocalOnly endpoint for user {}",
        owner.1
    ))
    .bind(ip_addr)
    .execute(pool.get_ref())
    .await;

    // Returns a success response.
    ApiResponse::<()>::builder()
        .message("Owner password updated successfully")
        .ok()
}

// Handles an owner resetting a visitor's password.
pub async fn owner_change_visitor_password(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    payload: web::Json<VisitorResetPayload>,
) -> HttpResponse {
    let payload = payload.into_inner();
    let username = payload.username.trim();
    let password = payload.password.trim();

    // Returns an error if the username is empty.
    if username.is_empty() {
        return ApiResponse::<()>::builder()
            .message("username is required")
            .bad_request();
    }

    // Fetches the visitor account from the database.
    let user_row = match sqlx::query(
        "SELECT id, role, is_deleted, username FROM Users WHERE username = ? LIMIT 1",
    )
    .bind(username)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(opt) => opt,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(e.to_string())
                .internal();
        }
    };

    let user = match user_row {
        Some(row) => {
            let id: i64 = row.get("id");
            let role: String = row.get("role");
            let is_deleted: bool = row.get("is_deleted");
            let username: String = row.get("username");
            (id, role, is_deleted, username)
        }
        None => {
            return ApiResponse::<()>::builder()
                .message("Visitor not found")
                .not_found();
        }
    };

    // Returns an error if the user is deleted or not a visitor.
    if user.2 {
        return ApiResponse::<()>::builder()
            .message("User has been deleted")
            .bad_request();
    }

    if user.1 != "visitor" {
        return ApiResponse::<()>::builder()
            .message("Target user is not a visitor")
            .bad_request();
    }

    // Hashes the new password.
    let password_hash = match hash_password(password) {
        Ok(pass) => pass,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Password hash error: {}", e))
                .internal();
        }
    };

    // Updates the visitor's password in the database.
    if let Err(e) = sqlx::query(
        "
        UPDATE Users 
        SET 
            password_hash = ? 
        WHERE id = ?
    ",
    )
    .bind(&password_hash)
    .bind(user.0)
    .execute(pool.get_ref())
    .await
    {
        return ApiResponse::<()>::builder()
            .message(e.to_string())
            .internal();
    }

    // Retrieves the user ID of the authenticated owner from JWT claims for auditing.
    let mut actor_user_id: Option<i64> = None;
    if let Some(claims) = req.extensions().get::<Claims>()
        && let Ok(parsed) = claims.sub.parse::<i64>()
    {
        actor_user_id = Some(parsed);
    }

    let ip_addr = req
        .connection_info()
        .realip_remote_addr()
        .unwrap_or("unknown")
        .to_string();

    // Logs the password reset action in the audit log.
    let _ = if let Some(actor_id) = actor_user_id {
        sqlx::query(
            "
            INSERT INTO AuditLog(
                user_id,
                event_type,
                description, 
                ip_address, 
                success
            ) VALUES (
                ?, 
                ?, 
                ?, 
                ?, 
                1
            )",
        )
        .bind(actor_id)
        .bind("OWNER_RESET_VISITOR_PASSWORD")
        .bind(format!(
            "Owner (id={}) reset password for visitor {}",
            actor_id, user.3
        ))
        .bind(ip_addr)
        .execute(pool.get_ref())
        .await
    } else {
        sqlx::query(
            "
            INSERT INTO AuditLog(
                event_type, 
                description, 
                ip_address, 
                success
            ) VALUES (
                ?, 
                ?, 
                ?, 
                1
            )",
        )
        .bind("OWNER_RESET_VISITOR_PASSWORD")
        .bind(format!(
            "Owner (unknown) reset password for visitor {}",
            user.3
        ))
        .bind(ip_addr)
        .execute(pool.get_ref())
        .await
    };

    // Returns a success response.
    ApiResponse::<()>::builder()
        .message("Visitor password updated successfully")
        .ok()
}

// Configures the Actix Web service for authentication routes.
pub fn auth_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .service(web::resource("/login").route(web::post().to(login)))
            .service(
                web::resource("/register")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(register)),
            )
            .service(
                web::resource("/owner_register")
                    .wrap(LocalOnly)
                    .route(web::post().to(owner_register)),
            )
            .service(
                web::resource("/owner_reset_password")
                    .wrap(LocalOnly)
                    .route(web::post().to(owner_reset_password)),
            )
            .service(
                web::resource("/visitor_reset_password")
                    .wrap(RoleAuth::new(&["owner"]))
                    .wrap(HttpAuthentication::bearer(jwt_validator_adapter))
                    .route(web::post().to(owner_change_visitor_password)),
            ),
    );
}
