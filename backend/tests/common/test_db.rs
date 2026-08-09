use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub async fn create_test_db() -> (SqlitePool, PathBuf) {
    let test_id = chrono::Utc::now().timestamp_nanos_opt().unwrap();
    let mut db_path = std::env::temp_dir();
    db_path.push(format!("test_db_{}.sqlite", test_id));

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("failed to create temp dir for db");
    }

    let opts = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(30));

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect_with(opts)
        .await
        .expect("cannot create sqlite pool");

    // Migrations will be triggered via the API endpoint POST /api/db
    (pool, db_path)
}

pub fn cleanup_db(db_path: &Path) {
    let _ = std::fs::remove_file(db_path);
}
