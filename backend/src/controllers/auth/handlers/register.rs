// Handles registration of new visitor accounts.

use crate::models::responses::ApiResponse;
use crate::utils::db::{RegisterPayload, register_user};
use actix_web::{HttpResponse, web};
use sqlx::SqlitePool;

/// Registers a new visitor account.
pub async fn register(
    pool: web::Data<SqlitePool>,
    user: web::Json<RegisterPayload>,
) -> HttpResponse {
    let user_data = user.into_inner();

    match user_data {
        RegisterPayload::Visitor(visitor_data) => {
            register_user(pool.get_ref(), RegisterPayload::Visitor(visitor_data)).await
        }
        RegisterPayload::Owner(_) => ApiResponse::<()>::builder()
            .message("Cannot make owner user from this endpoint")
            .internal(),
    }
}
