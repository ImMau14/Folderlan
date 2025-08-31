use sanitize_filename::sanitize;
use std::path::{Path, PathBuf};
use tokio::fs;
use std::io::ErrorKind;

pub fn sanitize_filename_input(name: &str) -> String {
    const MAX_LEN: usize = 255;

    let file_name = Path::new(name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("file");

    let mut s = sanitize(file_name);

    if s.len() > MAX_LEN {
        s.truncate(MAX_LEN);
    }

    if s.is_empty() {
        "file".to_string()
    } else {
        s
    }
}

pub fn validate_file_id(file_id: &str) -> bool {
    if file_id.is_empty() || file_id.len() > 128 { return false; }
    file_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub async fn generate_unique_sanitized_filename(
    base: &Path,
    raw_name: &str
) -> Result<(String, PathBuf), String> {
    let sanitized = sanitize_filename_input(raw_name);

    let stem = Path::new(&sanitized)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file")
        .to_string();

    let ext_opt = Path::new(&sanitized)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let mut s = e.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>();
            if s.len() > 16 { s.truncate(16); }
            s
        });

    const MAX_TRIES: u32 = 10000;

    for i in 0..=MAX_TRIES {
        let candidate_name = if i == 0 {
            if let Some(ref ext) = ext_opt { format!("{stem}.{ext}") } else { stem.clone() }
        } else if let Some(ref ext) = ext_opt {
            format!("{stem} ({i}).{ext}")
        } else { 
            format!("{stem} ({i})") 
        };

        let candidate_path = base.join(&candidate_name);

        match fs::metadata(&candidate_path).await {
            Ok(_) => {
                continue;
            }
            Err(e) => {
                if e.kind() == ErrorKind::NotFound {
                    let rel = PathBuf::from(&candidate_name);
                    return Ok((candidate_name, rel));
                } else {
                    // error IO inesperado
                    return Err(format!("failed checking existence of {}: {}", candidate_path.display(), e));
                }
            }
        }
    }

    Err("unable to find unique filename after many attempts".to_string())
}

pub async fn ensure_path_within_base(base: &Path, candidate: &Path) -> Result<(), String> {
    let base_can = fs::canonicalize(base).await
        .map_err(|e| format!("cannot canonicalize base {}: {}", base.display(), e))?;
    let parent = candidate.parent().ok_or("candidate has no parent")?;
    let parent_can = fs::canonicalize(parent).await
        .map_err(|e| format!("cannot canonicalize candidate parent {}: {}", parent.display(), e))?;
    if parent_can.starts_with(&base_can) {
        Ok(())
    } else {
        Err("candidate escapes base directory".to_string())
    }
}