use crate::models::responses::ApiResponse;
use actix_web::{Responder, web};
use sqlx::SqlitePool;

pub async fn init_db(pool: web::Data<SqlitePool>) -> impl Responder {
    let pool_ref: &SqlitePool = pool.get_ref();

    if let Err(e) = sqlx::migrate!("./migrations").run(pool_ref).await {
        return ApiResponse::<()>::builder()
            .message(format!("Migration error: {e}"))
            .internal();
    }

    ApiResponse::<()>::builder()
        .message("Migrations executed successfully")
        .ok()
}
