use actix_web::{Responder, web};
use sqlx::SqlitePool;

use crate::middleware::server_ip_only::LocalOnly;
use crate::models::responses::ApiResponse;
use crate::utils::get_array_of_sentences;

pub async fn init_db(pool: web::Data<SqlitePool>) -> impl Responder {
    let pool_ref: &SqlitePool = pool.get_ref();

    let stmts = match get_array_of_sentences(include_str!("../../db/schema.sql")) {
        Ok(arr) => arr,
        Err(e) => {
            return ApiResponse::<()>::builder()
                .message(format!("Could not read ./db/schema.sql: {e}"))
                .internal();
        }
    };

    for (idx, sql) in stmts.iter().enumerate() {
        if let Err(e) = sqlx::query(sql).execute(pool_ref).await {
            return ApiResponse::<()>::builder()
                .message(format!("Error while executing #{idx}: {e}\nSQL: {sql}"))
                .internal();
        }
    }

    ApiResponse::<()>::builder()
        .message("The database has been created")
        .ok()
}

pub async fn db_exists(pool: web::Data<SqlitePool>) -> impl Responder {
    let pool_ref: &SqlitePool = pool.get_ref();

    let sql = "
        SELECT EXISTS(
            SELECT 1 
            FROM sqlite_master 
            WHERE 
                type='table' 
                AND name NOT LIKE 'sqlite_%'
        )
    ";

    match sqlx::query_scalar::<_, i64>(sql).fetch_one(pool_ref).await {
        Ok(val) => ApiResponse::<()>::builder().exists(val == 1).ok(),
        Err(e) => ApiResponse::<()>::builder()
            .message(e.to_string())
            .internal(),
    }
}

pub fn db_config(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/db")
            .wrap(LocalOnly)
            .route("", web::get().to(db_exists))
            .route("", web::post().to(init_db)),
    );
}
