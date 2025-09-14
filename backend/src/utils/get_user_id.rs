use actix_web::{HttpMessage, HttpRequest, HttpResponse};
use std::convert::TryInto;

use crate::middleware::jwt_middleware::AuthUser;
use crate::models::responses::ApiResponse;

/// Extracts the user id from middleware
pub fn get_user_id(req: HttpRequest) -> Result<u64, HttpResponse> {
    let extensions = req.extensions();

    let auth_user = extensions.get::<AuthUser>().ok_or_else(|| {
        ApiResponse::<()>::builder()
            .message("Cannot upload without id (middleware failed)")
            .internal()
    })?;

    auth_user.id.try_into().map_err(|_| {
        ApiResponse::<()>::builder()
            .message("Invalid user id format")
            .internal()
    })
}
