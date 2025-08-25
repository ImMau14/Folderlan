use crate::models::types::ChunkMeta;
use tokio::fs::{self, File};
use tokio::io::{AsyncWriteExt, copy};
use actix_multipart::Field;
use futures_util::TryStreamExt as _;
use std::path::PathBuf;

/// Ensure base dir and tmp exists creating it if not exists
pub async fn ensure_base(base: &PathBuf) -> Result<(), std::io::Error> {
    fs::create_dir_all(&base).await?;
    fs::create_dir_all(base.join("tmp")).await?;
    Ok(())
}

/// Path for the part
pub fn part_path(base: &PathBuf, file_id: &str, index: u64) -> PathBuf {
    base.join("tmp").join(format!("{}.part.{}", file_id, index))
}

/// Save an incoming multipart `Field` (the chunk) to disk as a part file.
/// Also verifies chunk size.
pub async fn save_chunk_to(base: &PathBuf, meta: &ChunkMeta, mut field: Field) -> Result<PathBuf, String> {
    let part = part_path(base, &meta.file_id, meta.chunk_index);
    let mut f = File::create(&part).await.map_err(|e| format!("cannot create chunk file: {}", e))?;

    let mut total_bytes = 0usize;

    while let Some(chunk) = field.try_next().await.map_err(|e| format!("stream error: {}", e))? {
        total_bytes += chunk.len();
        f.write_all(&chunk).await.map_err(|e| format!("failed writing chunk to disk: {}", e))?;
    }

    f.sync_all().await.map_err(|e| format!("failed syncing chunk: {}", e))?;

    // Verify chunk size
    if total_bytes as u64 != meta.chunk_size {
        // Clean up the chunk file if size doesn't match
        let _ = fs::remove_file(&part).await;
        return Err(format!("chunk size mismatch: expected {}, got {}", meta.chunk_size, total_bytes));
    }

    Ok(part)
}

/// Check async whether all parts exist (0 .. total_chunks-1)
pub async fn all_parts_present(base: &PathBuf, meta: &ChunkMeta) -> bool {
    for i in 0..meta.total_chunks {
        let p = part_path(base, &meta.file_id, i);
        if tokio::fs::metadata(&p).await.is_err() {
            return false;
        }
    }
    true
}

/// Assemble all parts in order into the final file.
pub async fn assemble_file(base: &PathBuf, meta: &ChunkMeta) -> Result<PathBuf, String> {
    let final_path = base.join(&meta.filename);
    let mut dst = File::create(&final_path).await.map_err(|e| format!("cannot create final file: {}", e))?;

    for i in 0..meta.total_chunks {
        let part = part_path(base, &meta.file_id, i);
        let mut src = File::open(&part).await.map_err(|e| format!("failed opening part {}: {}", i, e))?;
        copy(&mut src, &mut dst).await.map_err(|e| format!("failed copying part {}: {}", i, e))?;

        let _ = fs::remove_file(&part).await;
    }

    dst.sync_all().await.map_err(|e| format!("failed syncing final file: {}", e))?;
    Ok(final_path)
}

/// Clean up temporary files for a given file_id
pub async fn cleanup_tmp_files(base: &PathBuf, file_id: &str) {
    let tmp_dir = base.join("tmp");
    let mut entries = match fs::read_dir(&tmp_dir).await {
        Ok(entries) => entries,
        Err(_) => return,
    };

    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with(&format!("{}.part.", file_id)) {
                let _ = fs::remove_file(&path).await;
            }
        }
    }
}
