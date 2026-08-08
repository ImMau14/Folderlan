use notify::{Event, EventKind};
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

use super::config::{stability_check_delay, stability_required};
use super::db_ops::{mark_file_deleted, register_file_in_db};
use super::locks::get_file_lock_for;
use super::metrics::incr_metric;

/// Process a single filesystem event.
pub async fn handle_notify_event(
    event: Event,
    uploads_root: PathBuf,
    tmp_dir: Option<PathBuf>,
    pool_opt: Option<SqlitePool>,
    owner_user_id_opt: Option<i64>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if event.paths.is_empty() {
        debug!("Notify event without paths: {:?}", event);
        return Ok(());
    }

    // Skip events occurring within temporary directory (if configured)
    if let Some(tmp) = &tmp_dir {
        for p in &event.paths {
            if path_is_within(p, tmp) {
                debug!("Ignoring tmp path: {}", p.display());
                return Ok(());
            }
        }
    }

    match event.kind {
        EventKind::Create(_) | EventKind::Modify(_) => {
            for p in event.paths {
                if p.is_dir() {
                    continue;
                }

                let canon = match p.canonicalize() {
                    Ok(c) => c,
                    Err(_) => {
                        // The path no longer exists. This is what notify reports
                        // when a file is moved out of the watched tree (e.g.
                        // dragged to the trash or renamed to another folder).
                        // Treat it as a removal.
                        debug!(
                            "Path gone on {:?} event, treating as removal: {}",
                            event.kind,
                            p.display()
                        );
                        if let Some(pool) = &pool_opt
                            && let Some(internal) = compute_internal_for_remove(&p, &uploads_root)
                        {
                            let key = internal.clone();
                            let lock = get_file_lock_for(&key);
                            let _guard = lock.lock().await;
                            // The file may have been re-created while the event
                            // was in flight; in that case it is not a removal.
                            if tokio::fs::metadata(&p).await.is_ok() {
                                continue;
                            }
                            if let Err(e) = mark_file_deleted(pool, &internal).await {
                                error!(
                                    "DB error while marking is_deleted for {}: {:?}",
                                    internal, e
                                );
                            }
                            incr_metric("remove_events");
                            incr_metric("events_processed");
                        }
                        continue;
                    }
                };

                if !path_is_within(&canon, &uploads_root) {
                    debug!("Path not under uploads_root: {}", canon.display());
                    continue;
                }

                let internal_path = match canon.strip_prefix(&uploads_root) {
                    Ok(rel) => rel.to_string_lossy().into_owned(),
                    Err(_) => {
                        debug!("Could not compute internal path for {}", canon.display());
                        continue;
                    }
                };

                if !wait_for_stable_file(&canon).await {
                    warn!("File not stable: {}", canon.display());
                    continue;
                }

                let key = internal_path.clone();
                let lock = get_file_lock_for(&key);
                let _guard = lock.lock().await;

                // Re-check existence after acquiring the lock: the file may have
                // been removed while this event was waiting (e.g. an API delete
                // that removed the physical file right after our stability
                // check). Registering it again would resurrect a deleted row.
                if tokio::fs::metadata(&canon).await.is_err() {
                    if let Some(pool) = &pool_opt {
                        if let Err(e) = mark_file_deleted(pool, &internal_path).await {
                            error!(
                                "DB error while marking is_deleted for {}: {:?}",
                                internal_path, e
                            );
                        }
                        incr_metric("remove_events");
                    }
                    incr_metric("events_processed");
                    continue;
                }

                if let Some(pool) = &pool_opt {
                    let file_size = match tokio::fs::metadata(&canon).await {
                        Ok(md) => md.len(),
                        Err(e) => {
                            warn!("Failed stat {}: {}", canon.display(), e);
                            continue;
                        }
                    };
                    let owner_id = owner_user_id_opt.unwrap_or(1);
                    let _ = register_file_in_db(pool, &internal_path, file_size, owner_id).await;
                } else {
                    info!("New file detected (no DB): {}", internal_path);
                    incr_metric("files_detected_no_db");
                }
                incr_metric("events_processed");
            }
        }

        EventKind::Remove(_) => {
            for p in event.paths {
                if let Some(internal) = compute_internal_for_remove(&p, &uploads_root) {
                    let key = internal.clone();
                    let lock = get_file_lock_for(&key);
                    let _guard = lock.lock().await;

                    // If the file already exists again (re-created before the
                    // removal event was processed), keep it registered.
                    if tokio::fs::metadata(&p).await.is_ok() {
                        debug!("Removed path exists again, skipping: {}", p.display());
                        continue;
                    }

                    if let Some(pool) = &pool_opt {
                        if let Err(e) = mark_file_deleted(pool, &internal).await {
                            error!(
                                "DB error while marking is_deleted for {}: {:?}",
                                internal, e
                            );
                        }
                    } else {
                        info!("File removed (no DB): {}", internal);
                    }
                    incr_metric("remove_events");
                    incr_metric("events_processed");
                } else {
                    debug!(
                        "Removed path not under uploads_root (couldn't compute internal): {}",
                        p.display()
                    );
                }
            }
        }
        _ => {
            debug!("Ignored event kind: {:?}", event.kind);
        }
    }

    Ok(())
}

/// Check if a file path resides within the specified directory.
pub fn path_is_within(candidate: &Path, dir: &Path) -> bool {
    if let Ok(cand) = candidate.canonicalize() {
        return cand.starts_with(dir);
    }
    candidate.starts_with(dir)
}

/// Monitor file size stability to detect when write operations complete.
pub async fn wait_for_stable_file(path: &Path) -> bool {
    let mut stable_count = 0usize;
    let mut last_size: Option<u64> = None;
    let max_attempts = stability_required() * 10;
    let mut attempts = 0;

    while attempts < max_attempts {
        attempts += 1;
        match tokio::fs::metadata(path).await {
            Ok(md) => {
                let size = md.len();
                if Some(size) == last_size {
                    stable_count += 1;
                } else {
                    stable_count = 1;
                    last_size = Some(size);
                }
                if stable_count >= stability_required() {
                    return true;
                }
            }
            Err(e) => {
                warn!(
                    "Stat error while waiting stability for {}: {}",
                    path.display(),
                    e
                );
                return false;
            }
        }
        sleep(stability_check_delay()).await;
    }
    false
}

/// Compute an internal path string for removed files.
pub fn compute_internal_for_remove(p: &Path, uploads_root: &Path) -> Option<String> {
    if let Ok(rel) = p.strip_prefix(uploads_root) {
        return Some(rel.to_string_lossy().into_owned());
    }

    let uploads_root_s = uploads_root.to_string_lossy();
    let p_s = p.to_string_lossy();
    if p_s.starts_with(&*uploads_root_s) {
        let mut rel = p_s[uploads_root_s.len()..].to_string();
        if rel.starts_with(std::path::MAIN_SEPARATOR) {
            rel = rel
                .trim_start_matches(std::path::MAIN_SEPARATOR)
                .to_string();
        }
        return Some(rel);
    }

    p.file_name().map(|f| f.to_string_lossy().into_owned())
}
