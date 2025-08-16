use actix_web::{
    dev::ServiceRequest,
    Error,
    web::Data,
    HttpMessage,
    HttpResponse
};
use actix_web::error::InternalError;
use actix_web_httpauth::extractors::bearer::BearerAuth;
use jsonwebtoken::{
    decode,
    DecodingKey,
    Validation,
    Algorithm
};
use serde::{
    Deserialize,
    Serialize
};
use serde_json::json;

#[derive(Clone, Debug)]
pub struct JwtConfig {
    pub secret: String
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub role: String,
    pub exp: usize
}

#[allow(dead_code)]
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub jwt_claims: Claims
}

pub async fn jwt_validator_adapter(
    req: ServiceRequest,
    credentials: BearerAuth
) -> Result<ServiceRequest, (Error, ServiceRequest)> {
    let cfg = match req.app_data::<Data<JwtConfig>>() {
        Some(d) => d.get_ref().clone(),
        None => {
            let body = json!({ "success": false, "message": "JwtConfig not registered in app_data" });
            let resp = HttpResponse::InternalServerError().json(body);
            let err: Error = InternalError::from_response("JwtConfig not registered in app_data", resp).into();
            return Err((err, req));
        }
    };

    let token = credentials.token();
    let decoding_key = DecodingKey::from_secret(cfg.secret.as_bytes());
    let validation = Validation::new(Algorithm::HS256);

    let token_data = match decode::<Claims>(token, &decoding_key, &validation) {
        Ok(td) => td,
        Err(_) => {
            let body = json!({ "success": false, "message": "Invalid token or expired" });
            let resp = HttpResponse::Unauthorized().json(body);
            let err: Error = InternalError::from_response("Invalid token or expired", resp).into();
            return Err((err, req));
        }
    };

    let claims = token_data.claims;
    let id = claims.sub.parse::<i64>().unwrap_or(0);

    let auth_user = AuthUser {
        id,
        username: claims.username.clone(),
        role: claims.role.clone(),
        jwt_claims: claims.clone()
    };

    req.extensions_mut().insert(auth_user);

    Ok(req)
}
