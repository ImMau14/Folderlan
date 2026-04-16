use crate::models::responses::ApiResponse;
use actix_web::{Responder, web};
use sqlx::SqlitePool;

pub async fn db_exists(pool: web::Data<SqlitePool>) -> impl Responder {
    let pool_ref: &SqlitePool = pool.get_ref();

    let result = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM Users
            WHERE role = 'owner' AND is_deleted = 0
        ) as "exists!: i64"
        "#
    )
    .fetch_one(pool_ref)
    .await;

    match result {
        Ok(val) => ApiResponse::<()>::builder().exists(val == 1).ok(),
        Err(e) => {
            if e.to_string().contains("no such table: Users") {
                ApiResponse::<()>::builder().exists(false).ok()
            } else {
                ApiResponse::<()>::builder()
                    .message(e.to_string())
                    .internal()
            }
        }
    }
}
