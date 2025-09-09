use crate::models::types::ChunkMeta;
use actix_multipart::Field;
use futures_util::TryStreamExt as _;
use mime_guess::from_path;
use std::path::{Path, PathBuf};
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

use crate::utils::sanitize;

/// Ensure base dir and tmp exists creating it if not exists
pub async fn ensure_base(base: &PathBuf) -> Result<(), std::io::Error> {
    fs::create_dir_all(&base).await?;
    fs::create_dir_all(base.join("tmp")).await?;
    Ok(())
}

/// Path for the part (tmp). Now validates file_id.
/// Returns Err if file_id is invalid.
pub fn tmp_part_path(base: &Path, file_id: &str, index: u64) -> Result<PathBuf, String> {
    if !sanitize::validate_file_id(file_id) {
        return Err("invalid file_id".to_string());
    }
    Ok(base.join("tmp").join(format!("{file_id}.part.{index}")))
}

/// Save an incoming multipart `Field` (the chunk) to disk as a part file.
/// Also verifies chunk size.
pub async fn save_chunk_to(
    base: &Path,
    meta: &ChunkMeta,
    mut field: Field,
) -> Result<PathBuf, String> {
    // validate file_id
    if !sanitize::validate_file_id(&meta.file_id) {
        return Err("invalid file_id".into());
    }

    let part = tmp_part_path(base, &meta.file_id, meta.chunk_index)?;
    let mut f = File::create(&part)
        .await
        .map_err(|e| format!("cannot create chunk file: {e}"))?;

    // Use u64 for accumulation to match meta.* types and avoid usize issues on 32-bit targets
    let mut total_bytes: u64 = 0u64;

    // Read stream safely, performing best-effort cleanup in error branches
    loop {
        match field.try_next().await {
            Ok(Some(chunk)) => {
                let chunk_len = chunk.len() as u64;

                // protect against overflow when accumulating
                if chunk_len > u64::MAX - total_bytes {
                    let _ = fs::remove_file(&part).await;
                    return Err("overflow while accumulating chunk bytes".to_string());
                }
                total_bytes += chunk_len;

                if let Err(e) = f.write_all(&chunk).await {
                    let _ = fs::remove_file(&part).await;
                    return Err(format!("failed writing chunk to disk: {e}"));
                }
            }
            Ok(None) => break, // stream finished
            Err(e) => {
                let _ = fs::remove_file(&part).await;
                return Err(format!("stream error: {e}"));
            }
        }
    }

    if let Err(e) = f.sync_all().await {
        let _ = fs::remove_file(&part).await;
        return Err(format!("failed syncing chunk: {e}"));
    }

    // Compute expected chunk size safely:
    // start = chunk_index * chunk_size  (checked)
    let start = match meta.chunk_index.checked_mul(meta.chunk_size) {
        Some(s) => s,
        None => {
            let _ = fs::remove_file(&part).await;
            return Err(format!(
                "overflow computing start = chunk_index * chunk_size (index={}, size={})",
                meta.chunk_index, meta.chunk_size
            ));
        }
    };

    // If start is beyond total_size, the index is invalid
    if start >= meta.total_size {
        let _ = fs::remove_file(&part).await;
        return Err(format!(
            "chunk_index out of range: start {} >= total_size {}",
            start, meta.total_size
        ));
    }

    // expected chunk size is min(chunk_size, remaining_bytes)
    let remaining = meta.total_size - start;
    let chunk_size: u64 = std::cmp::min(remaining, meta.chunk_size);

    // Verify chunk size (compare u64 to u64)
    if total_bytes != chunk_size {
        // Clean up the chunk file if size doesn't match
        let _ = fs::remove_file(&part).await;
        return Err(format!(
            "chunk size mismatch: expected {chunk_size}, got {total_bytes}"
        ));
    }

    Ok(part)
}

/// Check async whether all parts exist (0 .. total_chunks-1)
pub async fn all_parts_present(base: &Path, meta: &ChunkMeta) -> bool {
    // quick validate
    if !sanitize::validate_file_id(&meta.file_id) {
        return false;
    }

    for i in 0..meta.total_chunks {
        match tmp_part_path(base, &meta.file_id, i) {
            Ok(p) => {
                if tokio::fs::metadata(&p).await.is_err() {
                    return false;
                }
            }
            Err(_) => return false,
        }
    }
    true
}

/// Assemble all parts in order into the final file,
/// returning (path_relative_to_base, sanitized_name, size_in_bytes, mime_type).
pub async fn assemble_file(
    base: &Path,
    meta: &ChunkMeta,
) -> Result<(PathBuf, String, u64, String), String> {
    // validate file_id
    if !sanitize::validate_file_id(&meta.file_id) {
        return Err("invalid file_id".into());
    }

    // Generate a unique sanitized filename and the relative path that will be used on disk
    let (sanitized_name, rel_path) =
        sanitize::generate_unique_sanitized_filename(base, &meta.filename)
            .await
            .map_err(|e| format!("cannot generate filename: {e}"))?;

    let final_path = base.join(&rel_path);

    // Optional double-check that final_path remains within base (requires parents exist)
    if let Err(e) = sanitize::ensure_path_within_base(base, final_path.as_path()).await {
        return Err(format!("security check failed: {e}"));
    }

    // create destination file (will create/overwrite only this unique name)
    let mut dst = File::create(&final_path)
        .await
        .map_err(|e| format!("cannot create final file: {e}"))?;

    // copy each part into dst
    for i in 0..meta.total_chunks {
        let part = tmp_part_path(base, &meta.file_id, i)
            .map_err(|e| format!("invalid file_id when reading part {i}: {e}"))?;
        let mut src = File::open(&part)
            .await
            .map_err(|e| format!("failed opening part {i}: {e}"))?;
        tokio::io::copy(&mut src, &mut dst)
            .await
            .map_err(|e| format!("failed copying part {i}: {e}"))?;

        // remove the part after copy (best-effort)
        let _ = fs::remove_file(&part).await;
    }

    dst.sync_all()
        .await
        .map_err(|e| format!("failed syncing final file: {e}"))?;

    let metadata = tokio::fs::metadata(&final_path)
        .await
        .map_err(|e| format!("failed reading metadata of final file: {e}"))?;
    let size: u64 = metadata.len();

    let mime = from_path(&final_path)
        .first_or_octet_stream()
        .essence_str()
        .to_string();

    // rel_path already is relative to base (generated by generate_unique_sanitized_filename)
    Ok((rel_path, sanitized_name, size, mime))
}

/// Clean up temporary files for a given file_id
pub async fn cleanup_tmp_files(base: &Path, file_id: &str) {
    // validate file_id
    if !sanitize::validate_file_id(file_id) {
        return;
    }

    let tmp_dir = base.join("tmp");
    let mut entries = match fs::read_dir(&tmp_dir).await {
        Ok(entries) => entries,
        Err(_) => return,
    };

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if let Some(name) = path.file_name().and_then(|n| n.to_str())
            && name.starts_with(&format!("{file_id}.part."))
        {
            let _ = fs::remove_file(&path).await;
        }
    }
}
