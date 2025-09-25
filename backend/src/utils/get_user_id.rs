// Extracts the user ID from JWT middleware authentication data
use actix_web::{HttpMessage, HttpRequest, HttpResponse};
use std::convert::TryInto;

use crate::middleware::jwt_middleware::AuthUser;
use crate::models::responses::ApiResponse;

/// Extracts the user id from middleware
pub fn get_user_id(req: HttpRequest) -> Result<u64, HttpResponse> {
    // Get extensions from request to access middleware data
    let extensions = req.extensions();

    // Retrieve AuthUser data from middleware or return error if not found
    let auth_user = extensions.get::<AuthUser>().ok_or_else(|| {
        ApiResponse::<()>::builder()
            .message("Cannot upload without id (middleware failed)")
            .internal()
    })?;

    // Convert user ID to u64 or return error if conversion fails
    auth_user.id.try_into().map_err(|_| {
        ApiResponse::<()>::builder()
            .message("Invalid user id format")
            .internal()
    })
}
