// Handles JWT authentication middleware and token validation.
use actix_web::error::InternalError;
use actix_web::{Error, HttpMessage, dev::ServiceRequest, web::Data};
use actix_web_httpauth::extractors::bearer::BearerAuth;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};

use crate::models::responses::ApiResponse;

// Configuration for JWT token validation.
#[derive(Clone, Debug)]
pub struct JwtConfig {
    pub secret: String,
}

// Claims extracted from JWT tokens.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub role: String,
    pub exp: usize,
}

// Authenticated user information extracted from JWT.
#[allow(dead_code)]
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub jwt_claims: Claims,
}

// Validates JWT tokens from Bearer authentication headers.
pub async fn jwt_validator_adapter(
    req: ServiceRequest,
    credentials: BearerAuth,
) -> Result<ServiceRequest, (Error, ServiceRequest)> {
    let cfg = match req.app_data::<Data<JwtConfig>>() {
        Some(d) => d.get_ref().clone(),
        None => {
            let msg = "JwtConfig not registered in app_data";
            let resp = ApiResponse::<()>::builder().message(msg).internal();

            let err: Error = InternalError::from_response(msg, resp).into();

            return Err((err, req));
        }
    };

    let token = credentials.token();
    let decoding_key = DecodingKey::from_secret(cfg.secret.as_bytes());
    let validation = Validation::new(Algorithm::HS256);

    let token_data = match decode::<Claims>(token, &decoding_key, &validation) {
        Ok(td) => td,
        Err(_) => {
            let msg = "Invalid token or expired";
            let resp = ApiResponse::<()>::builder().message(msg).unauthorized();

            let err: Error = InternalError::from_response(msg, resp).into();
            return Err((err, req));
        }
    };

    let claims = token_data.claims;
    let id = claims.sub.parse::<i64>().unwrap_or(0);

    let auth_user = AuthUser {
        id,
        username: claims.username.clone(),
        role: claims.role.clone(),
        jwt_claims: claims.clone(),
    };

    req.extensions_mut().insert(auth_user);

    Ok(req)
}
