// Checks if the current user is owner or uploader of specified file
use sqlx::SqlitePool;

// Verifies user permissions for file access
pub async fn is_owner_or_uploader(
    pool: &SqlitePool,
    user_id: u64,
    file_id: u64,
) -> Result<bool, String> {
    // Defines structure to hold query results
    #[derive(sqlx::FromRow)]
    struct OwnerCheck {
        uploaded_by: i64,
        user_role: Option<String>,
    }

    // Executes SQL query to fetch file and user data
    let rec_opt = sqlx::query_as::<_, OwnerCheck>(
        r#"
        SELECT f.uploaded_by, u.role AS user_role
        FROM Files f
        LEFT JOIN Users u ON u.id = ?
        WHERE f.id = ? AND f.is_deleted = 0
        "#,
    )
    .bind(user_id as i64)
    .bind(file_id as i64)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("DB error: {e}"))?;

    // Processes query results
    match rec_opt {
        Some(rec) => {
            // Checks if user has owner role or is file uploader
            let is_owner = rec.user_role.as_deref() == Some("owner");
            Ok(is_owner || rec.uploaded_by as u64 == user_id)
        }
        None => Err("File not found or is deleted".into()),
    }
}
