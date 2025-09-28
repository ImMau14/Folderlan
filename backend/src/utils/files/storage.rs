// Manages file chunk operations including storage, validation, and assembly for uploads.
use crate::{models::types::ChunkMeta, utils::files::sanitize};
use actix_multipart::Field;
use futures_util::TryStreamExt as _;
use mime_guess::from_path;
use std::path::{Path, PathBuf};
use tokio::{
    fs::{self, File},
    io::AsyncWriteExt,
};

/// Creates base directory and tmp subdirectory if they don't exist
pub async fn ensure_base(base: &PathBuf) -> Result<(), std::io::Error> {
    fs::create_dir_all(&base).await?;
    fs::create_dir_all(base.join("tmp")).await?;
    Ok(())
}

/// Generates temporary path for chunk part with file_id validation
pub fn tmp_part_path(base: &Path, file_id: &str, index: u64) -> Result<PathBuf, String> {
    if !sanitize::validate_file_id(file_id) {
        return Err("invalid file_id".to_string());
    }
    Ok(base.join("tmp").join(format!("{file_id}.part.{index}")))
}

/// Saves multipart field chunk to temporary part file with size validation
pub async fn save_chunk_to(
    base: &Path,
    meta: &ChunkMeta,
    mut field: Field,
) -> Result<PathBuf, String> {
    // Validate file_id before processing
    if !sanitize::validate_file_id(&meta.file_id) {
        return Err("invalid file_id".into());
    }

    let part = tmp_part_path(base, &meta.file_id, meta.chunk_index)?;
    let mut f = File::create(&part)
        .await
        .map_err(|e| format!("cannot create chunk file: {e}"))?;

    let mut total_bytes: u64 = 0u64;

    // Stream chunks to disk with overflow protection
    loop {
        match field.try_next().await {
            Ok(Some(chunk)) => {
                let chunk_len = chunk.len() as u64;

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
            Ok(None) => break,
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

    // Calculate expected chunk size with overflow checks
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

    if start >= meta.total_size {
        let _ = fs::remove_file(&part).await;
        return Err(format!(
            "chunk_index out of range: start {} >= total_size {}",
            start, meta.total_size
        ));
    }

    let remaining = meta.total_size - start;
    let chunk_size: u64 = std::cmp::min(remaining, meta.chunk_size);

    // Verify received chunk size matches expected
    if total_bytes != chunk_size {
        let _ = fs::remove_file(&part).await;
        return Err(format!(
            "chunk size mismatch: expected {chunk_size}, got {total_bytes}"
        ));
    }

    Ok(part)
}

/// Verifies all chunks for a file are present in temporary storage
pub async fn all_parts_present(base: &Path, meta: &ChunkMeta) -> bool {
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

/// Combines all chunks into final file and returns file metadata
pub async fn assemble_file(
    base: &Path,
    meta: &ChunkMeta,
) -> Result<(PathBuf, String, u64, String), String> {
    if !sanitize::validate_file_id(&meta.file_id) {
        return Err("invalid file_id".into());
    }

    // Generate unique sanitized filename
    let (sanitized_name, rel_path) =
        sanitize::generate_unique_sanitized_filename(base, &meta.filename)
            .await
            .map_err(|e| format!("cannot generate filename: {e}"))?;

    let final_path = base.join(&rel_path);

    // Security check to prevent path traversal
    if let Err(e) = sanitize::ensure_path_within_base(base, final_path.as_path()).await {
        return Err(format!("security check failed: {e}"));
    }

    let mut dst = File::create(&final_path)
        .await
        .map_err(|e| format!("cannot create final file: {e}"))?;

    // Concatenate all chunks into final file
    for i in 0..meta.total_chunks {
        let part = tmp_part_path(base, &meta.file_id, i)
            .map_err(|e| format!("invalid file_id when reading part {i}: {e}"))?;
        let mut src = File::open(&part)
            .await
            .map_err(|e| format!("failed opening part {i}: {e}"))?;
        tokio::io::copy(&mut src, &mut dst)
            .await
            .map_err(|e| format!("failed copying part {i}: {e}"))?;

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

    Ok((rel_path, sanitized_name, size, mime))
}

/// Removes temporary chunk files for a specific file_id
pub async fn cleanup_tmp_files(base: &Path, file_id: &str) {
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
