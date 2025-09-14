// tests/e2e_download.rs
mod common;

use chrono::Utc;
use common::{TestApp, VisitorOptions};
use reqwest::StatusCode;
use sqlx::Row;
use std::path::PathBuf;
use tokio::fs;
use tracing::info;

/// Inserta archivo físico + fila en Files. Devuelve file id (i64).
async fn insert_file_and_disk(
    app: &TestApp,
    name: &str,
    internal_path: &str,
    uploaded_by: i64,
    content: &[u8],
    mime: Option<&str>,
) -> i64 {
    // asegurar carpeta
    let full_path: PathBuf = app.uploads_path.join(internal_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .await
            .expect("create upload parents failed");
    }

    // escribir archivo
    fs::write(&full_path, content)
        .await
        .expect("write file failed");

    // insertar fila en DB
    let mime_val = mime.unwrap_or("application/octet-stream");
    sqlx::query(
        r#"
        INSERT INTO Files (name, size_bytes, internal_path, mime_type, uploaded_by, uploaded_at, is_deleted)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)
        "#,
    )
    .bind(name)
    .bind(content.len() as i64)
    .bind(internal_path)
    .bind(mime_val)
    .bind(uploaded_by)
    .execute(&app.pool)
    .await
    .expect("insert file row failed");

    let row = sqlx::query("SELECT id FROM Files WHERE internal_path = ? AND uploaded_by = ?")
        .bind(internal_path)
        .bind(uploaded_by)
        .fetch_one(&app.pool)
        .await
        .expect("fetch inserted file id failed");

    row.try_get::<i64, _>("id").expect("missing id")
}

/// Obtiene id de usuario por username
async fn user_id_by_username(app: &TestApp, username: &str) -> i64 {
    let row = sqlx::query("SELECT id FROM Users WHERE username = ?")
        .bind(username)
        .fetch_one(&app.pool)
        .await
        .expect("query user id failed");
    row.try_get::<i64, _>("id").expect("missing user id")
}

/// Asegura que el usuario tenga role = 'owner' (antes el test forzaba flags que ya no existen).
async fn ensure_user_is_owner(app: &TestApp, user_id: i64) {
    let row_opt = sqlx::query("SELECT role FROM Users WHERE id = ?")
        .bind(user_id)
        .fetch_optional(&app.pool)
        .await
        .expect("failed to query user row");

    if let Some(row) = row_opt {
        let role: Option<String> = row.try_get("role").ok();
        info!("User {} role before ensure: {:?}", user_id, role);

        if role.as_deref() != Some("owner") {
            sqlx::query(
                r#"
                UPDATE Users
                SET role = 'owner'
                WHERE id = ?
                "#,
            )
            .bind(user_id)
            .execute(&app.pool)
            .await
            .expect("failed to update user role to owner");
            info!("User {} role updated to owner", user_id);
        } else {
            info!("User {} already owner", user_id);
        }
    } else {
        panic!("user id {user_id} not found in DB");
    }
}

/// Test principal: verifica descargas y permisos.
#[tokio::test]
async fn e2e_downloads_basic_behaviour() {
    // arrancar app
    let app = TestApp::spawn().await;

    // inicializar DB
    app.post_init_db().await;

    // crear owner directamente
    let owner_username = "owner@download.test";
    let owner_password = "OwnerPass123!";
    app.create_owner_direct(owner_username, owner_password)
        .await;

    // login owner
    let owner_token = app
        .login_and_get_token(owner_username, owner_password)
        .await;
    assert!(!owner_token.is_empty(), "owner token empty");

    // obtener owner id desde DB
    let owner_id = user_id_by_username(&app, owner_username).await;

    // Asegurar role owner en DB (por si register_user no lo puso)
    ensure_user_is_owner(&app, owner_id).await;

    // preparar archivo subido por owner
    let ts = Utc::now().timestamp_nanos_opt().unwrap();
    let owner_file_internal = format!("owner_files/owner_file_{ts}.txt");
    let owner_file_bytes = b"Hello from owner file for download tests".to_vec();
    let owner_file_name = "owner_file.txt";

    let owner_file_id = insert_file_and_disk(
        &app,
        owner_file_name,
        &owner_file_internal,
        owner_id,
        &owner_file_bytes,
        Some("text/plain"),
    )
    .await;

    info!("Inserted test file id={}", owner_file_id);

    // Comprobar que archivo físico existe (debug)
    let full_path = app.uploads_path.join(&owner_file_internal);
    assert!(
        full_path.exists(),
        "expected physical file to exist at {full_path:?}"
    );

    // ---------- Owner: descarga completa ----------
    let resp = app
        .download_file(&owner_token, owner_file_id)
        .await
        .expect("owner download request failed");
    assert!(
        resp.status().is_success(),
        "expected successful download, got {}",
        resp.status()
    );

    // comprobar Content-Disposition
    let cd = resp
        .headers()
        .get(reqwest::header::CONTENT_DISPOSITION)
        .expect("missing content-disposition for owner");
    let cd_s = cd.to_str().expect("invalid cd header");
    assert!(
        cd_s.contains("attachment") && cd_s.contains("filename"),
        "unexpected content-disposition: {cd_s}"
    );

    // comprobar bytes
    let body_bytes = resp.bytes().await.expect("read owner body");
    assert_eq!(body_bytes.as_ref(), owner_file_bytes.as_slice());

    // ---------- Owner: Range parcial ----------
    let resp_range = app
        .download_file_range(&owner_token, owner_file_id, "bytes=0-4")
        .await
        .expect("owner range request failed");
    assert_eq!(
        resp_range.status(),
        StatusCode::PARTIAL_CONTENT,
        "expected 206 Partial Content"
    );
    let part = resp_range.bytes().await.expect("read partial bytes");
    assert_eq!(&part[..], &owner_file_bytes[..5]);

    // ---------- Visitor sin permisos no puede descargar ----------
    let ts2 = Utc::now().timestamp_nanos_opt().unwrap();
    let visitor1_name = format!("visitor_noperm_{ts2}@test");
    let visitor1_password = "VisitorPass1!";
    let visitor1_opts = VisitorOptions {
        can_upload: false,
        can_delete_own_files: false,
        has_upload_limits: false,
        upload_limit: 0,
    };
    app.create_visitor_via_api_as_owner(
        &owner_token,
        &visitor1_name,
        visitor1_password,
        visitor1_opts,
    )
    .await;
    let visitor1_token = app
        .login_and_get_token(&visitor1_name, visitor1_password)
        .await;

    let resp_v1 = app
        .download_file(&visitor1_token, owner_file_id)
        .await
        .expect("visitor1 download request failed");
    assert!(
        !resp_v1.status().is_success(),
        "visitor without permissions must not download owner's file"
    );

    // ---------- Visitor con permiso granular puede descargar ----------
    let ts3 = Utc::now().timestamp_nanos_opt().unwrap();
    let visitor2_name = format!("visitor_perm_{ts3}@test");
    let visitor2_password = "VisitorPass2!";
    let visitor2_opts = VisitorOptions {
        can_upload: false,
        can_delete_own_files: false,
        has_upload_limits: false,
        upload_limit: 0,
    };
    app.create_visitor_via_api_as_owner(
        &owner_token,
        &visitor2_name,
        visitor2_password,
        visitor2_opts,
    )
    .await;
    let visitor2_token = app
        .login_and_get_token(&visitor2_name, visitor2_password)
        .await;
    let visitor2_id = user_id_by_username(&app, &visitor2_name).await;

    // insertar permiso granular usando access_level (tu esquema)
    // usamos 'viewer' para indicar permiso de ver/descargar
    sqlx::query(
        r#"
        INSERT INTO FilePermissions (file_id, user_id, access_level, granted_by)
        VALUES (?, ?, 'viewer', ?)
        "#,
    )
    .bind(owner_file_id)
    .bind(visitor2_id)
    .bind(owner_id) // granted_by
    .execute(&app.pool)
    .await
    .expect("insert file permission failed");

    // ahora debe descargar bien
    let got = app
        .download_file_bytes(&visitor2_token, owner_file_id)
        .await
        .expect("visitor2 download after granting permission should succeed");
    assert_eq!(got, owner_file_bytes);

    // cleanup
    app.cleanup();
}
