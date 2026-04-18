// Checks user permissions for file access based on ownership, public status, and explicit permissions.
use crate::models::responses::ApiResponse;
use actix_web::HttpResponse;
use sqlx::SqlitePool;

// Defines minimum access level required for operation
pub enum MinLevel {
    Viewer,
    Collaborator,
}

// Converts access level string to numeric value for comparison
fn level_value(level: &str) -> i32 {
    match level {
        "collaborator" => 2,
        "viewer" => 1,
        _ => 0,
    }
}

// Verifies file permissions and returns file path/name if authorized
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
        is_public: bool,
        requester_role: Option<String>,
        requester_can_delete_own_files: Option<bool>,
        access_level: Option<String>, // From FilePermissions
    }

    let current_user_id_i64 = current_user_id as i64;
    let file_id_i64 = file_id as i64;

    // Query file and user permission data
    let rec_opt = sqlx::query_as!(
        PermCheckRow,
        r#"
        SELECT
          f.internal_path,
          f.name,
          f.uploaded_by,
          f.is_public as "is_public!: bool",
          u.role AS requester_role,
          u.can_delete_own_files as "requester_can_delete_own_files: bool",
          (SELECT fp.access_level FROM FilePermissions fp WHERE fp.file_id = f.id AND fp.user_id = ?) AS access_level
        FROM Files f
        LEFT JOIN Users u ON u.id = ?
        WHERE f.id = ? AND f.is_deleted = 0
        "#,
        current_user_id_i64,
        current_user_id_i64,
        file_id_i64
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        ApiResponse::<()>::builder()
            .message(format!("DB error: {e}"))
            .internal()
    })?;

    // Verify file exists
    let row = match rec_opt {
        Some(r) => r,
        None => {
            return Err(ApiResponse::<()>::builder()
                .message("File not found or is deleted")
                .not_found());
        }
    };

    // Owner has full access
    if row.requester_role.as_deref() == Some("owner") {
        return Ok((row.internal_path, row.name));
    }

    // Public files are accessible to viewers
    if matches!(min_level, MinLevel::Viewer) && row.is_public {
        return Ok((row.internal_path, row.name));
    }

    // Handle uploader permissions
    if let Some(uploaded_by) = row.uploaded_by
        && uploaded_by as u64 == current_user_id
    {
        // Uploaders need special permission for delete operations
        if matches!(min_level, MinLevel::Collaborator) {
            if row.requester_can_delete_own_files == Some(true) {
                return Ok((row.internal_path, row.name));
            } else {
                return Err(ApiResponse::<()>::builder()
                    .message("Uploader lacks permission to perform this action")
                    .forbidden());
            }
        } else {
            // Uploaders can always view their own files
            return Ok((row.internal_path, row.name));
        }
    }

    // Check explicit permissions from FilePermissions table
    let required_value = match min_level {
        MinLevel::Viewer => 1,
        MinLevel::Collaborator => 2,
    };

    let user_level_value = row.access_level.as_deref().map(level_value).unwrap_or(0);

    if user_level_value >= required_value {
        return Ok((row.internal_path, row.name));
    }

    // Default deny
    Err(ApiResponse::<()>::builder()
        .message("File not found or insufficient permissions")
        .forbidden())
}
