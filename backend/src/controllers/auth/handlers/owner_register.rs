//! Handles registration of new owner accounts (local server only).

use crate::models::responses::ApiResponse;
use crate::utils::db::{RegisterPayload, register_user};
use actix_web::{HttpResponse, web};
use sqlx::SqlitePool;

/// Registers a new owner account.
pub async fn owner_register(
    pool: web::Data<SqlitePool>,
    user: web::Json<RegisterPayload>,
) -> HttpResponse {
    let user_data = user.into_inner();

    match user_data {
        RegisterPayload::Visitor(_) => ApiResponse::<()>::builder()
            .message("Cannot make visitor user from this endpoint")
            .internal(),
        RegisterPayload::Owner(owner_data) => {
            register_user(pool.get_ref(), RegisterPayload::Owner(owner_data)).await
        }
    }
}
