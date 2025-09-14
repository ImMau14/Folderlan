use crate::models::responses::ApiResponse;
use actix_web::HttpResponse;
use sqlx::SqlitePool;

pub enum MinLevel {
    Viewer,
    Collaborator,
}

fn level_value(level: &str) -> i32 {
    match level {
        "collaborator" => 2,
        "viewer" => 1,
        _ => 0,
    }
}

pub async fn check_file_permission(
    pool: &SqlitePool,
    current_user_id: u64,
    file_id: u64,
    min_level: MinLevel,
) -> Result<(String, Option<String>), HttpResponse> {
    #[derive(sqlx::FromRow)]
    struct PermCheckRow {
        internal_path: String,
        name: Option<String>,
        uploaded_by: Option<i64>,
        is_public: i64, // 0/1
        requester_role: Option<String>,
        requester_can_delete_own_files: Option<i64>, // 0/1
        access_level: Option<String>,                // From FilePermissions
    }

    let rec_opt = sqlx::query_as::<_, PermCheckRow>(
        r#"
        SELECT
          f.internal_path,
          f.name,
          f.uploaded_by,
          f.is_public,
          u.role AS requester_role,
          u.can_delete_own_files AS requester_can_delete_own_files,
          (SELECT fp.access_level FROM FilePermissions fp WHERE fp.file_id = f.id AND fp.user_id = ?) AS access_level
        FROM Files f
        LEFT JOIN Users u ON u.id = ?
        WHERE f.id = ? AND f.is_deleted = 0
        "#,
    )
    .bind(current_user_id as i64) // For subquery select
    .bind(current_user_id as i64) // To get requester's role/can_delete flag
    .bind(file_id as i64)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        ApiResponse::<()>::builder()
            .message(format!("DB error: {e}"))
            .internal()
    })?;

    let row = match rec_opt {
        Some(r) => r,
        None => {
            return Err(ApiResponse::<()>::builder()
                .message("File not found or is deleted")
                .not_found());
        }
    };

    // Owner shortcut
    if row.requester_role.as_deref() == Some("owner") {
        return Ok((row.internal_path, row.name));
    }

    // If min_level == Viewer, allow if file is public
    if matches!(min_level, MinLevel::Viewer) && row.is_public == 1 {
        return Ok((row.internal_path, row.name));
    }

    // If uploader and special rule for delete: the original delete endpoint allowed
    // the uploader to delete their own files only if u.can_delete_own_files = 1.
    // Check that here only when min_level == Collaborator and current user is uploader.
    if let Some(uploaded_by) = row.uploaded_by
        && uploaded_by as u64 == current_user_id
    {
        // If the required operation is delete (Collaborator) we must ensure the user can delete own files.
        if matches!(min_level, MinLevel::Collaborator) {
            if row.requester_can_delete_own_files == Some(1) {
                return Ok((row.internal_path, row.name));
            } else {
                return Err(ApiResponse::<()>::builder()
                    .message("Uploader lacks permission to perform this action")
                    .forbidden());
            }
        } else {
            // For viewer-level operations, uploader can view their own files
            return Ok((row.internal_path, row.name));
        }
    }

    // Check FilePermissions access_level
    let required_value = match min_level {
        MinLevel::Viewer => 1,
        MinLevel::Collaborator => 2,
    };

    let user_level_value = row.access_level.as_deref().map(level_value).unwrap_or(0);

    if user_level_value >= required_value {
        return Ok((row.internal_path, row.name));
    }

    // Otherwise insufficient
    Err(ApiResponse::<()>::builder()
        .message("File not found or insufficient permissions")
        .forbidden())
}
