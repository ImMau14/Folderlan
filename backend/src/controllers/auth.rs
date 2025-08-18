use actix_web::{post, get, web, HttpResponse, Responder, http::StatusCode};
use crate::utils::get_array_of_sentences;
use sqlx::SqlitePool;
use serde::{Serialize, Deserialize};

#[derive(Serialize)]
struct Response {
    success: bool,
    message: String
}

#[derive(Deserialize)]
struct LoginPayload {
    user: String,
    password: String
}

#[post("/login")]
pub async fn login(pool: web::Data<SqlitePool>) -> impl Responder {
    let pool_ref: &SqlitePool = pool.get_ref();

    let stmts = match get_array_of_sentences("./db/schema.sql") {
        Ok(arr) => arr,
        Err(e) => {
            let body = format!("Could not read ./db/schema.sql: {}", e);
            return HttpResponse::InternalServerError().json(Response {
                success: false,
                message: body
            });
        }
    };

    for (idx, sql) in stmts.iter().enumerate() {
        if let Err(e) = sqlx::query(sql).execute(pool_ref).await {
            let body = format!("Error while executing #{}: {}\nSQL: {}", idx, e, sql);
            return HttpResponse::InternalServerError().json(Response {
                success: false,
                message: body
            });
        }
    }

    HttpResponse::build(StatusCode::CREATED)
        .content_type("application/json")
        .json(Response {
            success: true,
            message: "The database has been created".to_string()
        })
}

pub fn auth_config(cfg: &mut web::ServiceConfig) {
    cfg
        .service(login);
}