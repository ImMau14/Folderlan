use crate::middleware::server_ip_only::LocalOnly;
use crate::utils::get_array_of_sentences;
use actix_web::{HttpResponse, Responder, http::StatusCode, web};
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Serialize)]
struct Response {
    success: bool,
    message: String,
}

#[derive(Serialize)]
struct ExistResponse {
    success: bool,
    exist: bool,
}

pub async fn init_db(pool: web::Data<SqlitePool>) -> impl Responder {
    let pool_ref: &SqlitePool = pool.get_ref();

    let stmts = match get_array_of_sentences("./db/schema.sql") {
        Ok(arr) => arr,
        Err(e) => {
            let body = format!("Could not read ./db/schema.sql: {e}");
            return HttpResponse::InternalServerError().json(Response {
                success: false,
                message: body,
            });
        }
    };

    for (idx, sql) in stmts.iter().enumerate() {
        if let Err(e) = sqlx::query(sql).execute(pool_ref).await {
            let body = format!("Error while executing #{idx}: {e}\nSQL: {sql}");
            return HttpResponse::InternalServerError().json(Response {
                success: false,
                message: body,
            });
        }
    }

    HttpResponse::build(StatusCode::CREATED)
        .content_type("application/json")
        .json(Response {
            success: true,
            message: "The database has been created".to_string(),
        })
}

pub async fn db_exists(pool: web::Data<SqlitePool>) -> impl Responder {
    let pool_ref: &SqlitePool = pool.get_ref();

    let sql = "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%')";

    match sqlx::query_scalar::<_, i64>(sql).fetch_one(pool_ref).await {
        Ok(val) => HttpResponse::Ok().json(ExistResponse {
            success: true,
            exist: val == 1,
        }),
        Err(e) => HttpResponse::InternalServerError().json(Response {
            success: false,
            message: e.to_string(),
        }),
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
