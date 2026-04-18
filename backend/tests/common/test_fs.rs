use std::path::PathBuf;

pub fn create_test_uploads_dir() -> PathBuf {
    let test_id = chrono::Utc::now().timestamp_nanos_opt().unwrap();
    let mut path = std::env::temp_dir();
    path.push(format!("test_uploads_{}", test_id));
    std::fs::create_dir_all(&path).expect("failed to create uploads dir");
    path
}

pub fn cleanup_uploads_dir(path: &PathBuf) {
    let _ = std::fs::remove_dir_all(path);
}
