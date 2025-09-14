mod common;
use common::{TestApp, VisitorOptions};

#[tokio::test]
async fn e2e_get_files_filtering_and_pagination() {
    let app = TestApp::spawn().await;
    app.post_init_db().await;

    // Crea owner directamente en la DB
    let owner_username = "owner@local.test";
    let owner_password = "OwnerPass123!";
    app.create_owner_direct(owner_username, owner_password)
        .await;
    let owner_token = app
        .login_and_get_token(owner_username, owner_password)
        .await;

    // Crea visitor con permisos
    let visitor_opts = VisitorOptions {
        can_upload: true,
        can_delete_own_files: false,
        has_upload_limits: false,
        upload_limit: 0,
    };

    let visitor_username = "visitor@local.test";
    let visitor_password = "VisitorPass123!";
    app.create_visitor_via_api_as_owner(
        &owner_token,
        visitor_username,
        visitor_password,
        visitor_opts,
    )
    .await;
    let visitor_token = app
        .login_and_get_token(visitor_username, visitor_password)
        .await;

    // Archivos de prueba: (file_id, filename, bytes)
    let test_files = [
        ("file1", "document.txt", b"C1".as_slice()), // 2 bytes
        ("file2", "image.jpg", b"Content 22".as_slice()), // 10 bytes
        ("file3", "data.pdf", b"Content 333".as_slice()), // 11 bytes
    ];

    // Subir archivos (single-chunk) y comprobar status
    for (file_id, filename, data) in test_files.iter() {
        let resp = app
            .upload_single_chunk_file(&visitor_token, file_id, filename, data.to_vec())
            .await;
        assert!(
            resp.status().is_success(),
            "upload failed for {} (status {})",
            filename,
            resp.status()
        );
    }

    // Obtener todos los archivos (sin filtros)
    let resp = app
        .get_files(&visitor_token, &[] as &[(&str, &str)])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 3);

    // Filtrar por nombre (contiene "document")
    let resp = app
        .get_files(&visitor_token, &[("name", "document")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 1);

    // Filtrar por min_size >= 10 (debe devolver 10 y 11 bytes)
    let resp = app
        .get_files(&visitor_token, &[("min_size", "10")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 2);

    // Filtrar por max_size <= 9 (debe devolver solo 2 bytes)
    let resp = app
        .get_files(&visitor_token, &[("max_size", "9")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 1);

    // Paginación - limit
    let resp = app
        .get_files(&visitor_token, &[("limit", "2")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 2);

    // Paginación - limit + offset (limit=2, offset=1 => items 2 y 3)
    let resp = app
        .get_files(&visitor_token, &[("limit", "2"), ("offset", "1")])
        .await
        .unwrap();
    assert_eq!(resp.status(), 200);
    let body: serde_json::Value = resp.json().await.unwrap();
    assert_eq!(body["data"]["items"].as_array().unwrap().len(), 2);

    // Cleanup de archivos y DB temporales
    app.cleanup();
}
