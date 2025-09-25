// Provides utilities for sanitizing filenames, validating file IDs, generating unique filenames, and ensuring path security.
use sanitize_filename::sanitize;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tokio::fs;

// Sanitizes a filename by removing dangerous characters and truncating to maximum length
pub fn sanitize_filename_input(name: &str) -> String {
    const MAX_LEN: usize = 255;

    // Extract filename from path if present
    let file_name = Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file");

    let mut s = sanitize(file_name);

    // Enforce maximum length
    if s.len() > MAX_LEN {
        s.truncate(MAX_LEN);
    }

    // Ensure non-empty result
    if s.is_empty() { "file".to_string() } else { s }
}

// Validates file ID contains only safe characters and meets length requirements
pub fn validate_file_id(file_id: &str) -> bool {
    if file_id.is_empty() || file_id.len() > 128 {
        return false;
    }
    // Allow only alphanumeric, underscore and dash characters
    file_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

// Generates a unique filename within specified directory using sanitization and collision detection
pub async fn generate_unique_sanitized_filename(
    base: &Path,
    raw_name: &str,
) -> Result<(String, PathBuf), String> {
    let sanitized = sanitize_filename_input(raw_name);

    // Extract stem from filename
    let stem = Path::new(&sanitized)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();

    // Process and sanitize file extension
    let ext_opt = Path::new(&sanitized)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let mut s = e
                .chars()
                .filter(|c| c.is_ascii_alphanumeric())
                .collect::<String>();
            if s.len() > 16 {
                s.truncate(16);
            }
            s
        });

    const MAX_TRIES: u32 = 10000;

    // Attempt to find unique filename with counter suffix if needed
    for i in 0..=MAX_TRIES {
        let candidate_name = if i == 0 {
            if let Some(ref ext) = ext_opt {
                format!("{stem}.{ext}")
            } else {
                stem.clone()
            }
        } else if let Some(ref ext) = ext_opt {
            format!("{stem} ({i}).{ext}")
        } else {
            format!("{stem} ({i})")
        };

        let candidate_path = base.join(&candidate_name);

        match fs::metadata(&candidate_path).await {
            Ok(_) => continue, // Collision detected, try next number
            Err(e) => {
                if e.kind() == ErrorKind::NotFound {
                    let rel = PathBuf::from(&candidate_name);
                    return Ok((candidate_name, rel));
                } else {
                    // Unexpected IO error
                    return Err(format!(
                        "failed checking existence of {}: {}",
                        candidate_path.display(),
                        e
                    ));
                }
            }
        }
    }

    Err("unable to find unique filename after many attempts".to_string())
}

// Validates that a candidate path remains within the designated base directory
pub async fn ensure_path_within_base(base: &Path, candidate: &Path) -> Result<(), String> {
    let base_can = fs::canonicalize(base)
        .await
        .map_err(|e| format!("cannot canonicalize base {}: {}", base.display(), e))?;
    let parent = candidate.parent().ok_or("candidate has no parent")?;
    let parent_can = fs::canonicalize(parent).await.map_err(|e| {
        format!(
            "cannot canonicalize candidate parent {}: {}",
            parent.display(),
            e
        )
    })?;
    // Check if candidate remains within base directory boundaries
    if parent_can.starts_with(&base_can) {
        Ok(())
    } else {
        Err("candidate escapes base directory".to_string())
    }
}
