// File system watcher module for monitoring uploads directory events
use mime_guess::from_path;
use notify::{
    Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Result as NotifyResult, Watcher,
};
use once_cell::sync::Lazy;
use sqlx::SqlitePool;
use std::{
    collections::HashMap,
    env,
    path::{Path, PathBuf},
    sync::{Arc, Mutex as StdMutex},
    time::{Duration, Instant},
};
use tokio::{sync::Mutex as TokioMutex, task::JoinHandle, time::sleep};
use tracing::{debug, error, info, warn};

use crate::utils::db::{RegisterFilePayload, register_file};

type FileLock = Arc<TokioMutex<()>>;
type FileLockEntry = (FileLock, Instant);
type FileLocksMap = HashMap<String, FileLockEntry>;

// Global registry for per-file async locks to prevent concurrent processing.
// Each entry stores the lock and the last time it was used.
static FILE_LOCKS: Lazy<StdMutex<FileLocksMap>> = Lazy::new(|| StdMutex::new(HashMap::new()));

// In-memory cache for tracking recently handled files to avoid duplicate processing
static HANDLED_REGISTRY: Lazy<StdMutex<HashMap<String, Instant>>> =
    Lazy::new(|| StdMutex::new(HashMap::new()));

// Simple metrics registry for basic counters
static METRICS: Lazy<StdMutex<HashMap<String, u64>>> = Lazy::new(|| StdMutex::new(HashMap::new()));

// Time-to-live for handled file entries in the registry (default)
const DEFAULT_IGNORE_TTL_SECS: u64 = 30;

// Delay between file stability checks during write operations (default ms)
const DEFAULT_STABILITY_CHECK_MS: u64 = 300;

// Number of consecutive stable size checks required to consider a file complete (default)
const DEFAULT_STABILITY_REQUIRED: usize = 3;

// Time-to-live for idle locks before pruning (default)
const DEFAULT_LOCK_TTL_SECS: u64 = 300;

// Default prune interval seconds
const DEFAULT_PRUNE_INTERVAL_SECS: u64 = 10;

// Default channel capacity for notify -> tokio channel
const DEFAULT_CHANNEL_CAPACITY: usize = 64;

// Helper: Read ignore TTL from env or fallback to default
fn ignore_ttl() -> Duration {
    env::var("WATCHER_IGNORE_TTL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or_else(|| Duration::from_secs(DEFAULT_IGNORE_TTL_SECS))
}

// Helper: Read stability check delay from env or default
fn stability_check_delay() -> Duration {
    env::var("WATCHER_STABILITY_CHECK_MS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map(Duration::from_millis)
        .unwrap_or_else(|| Duration::from_millis(DEFAULT_STABILITY_CHECK_MS))
}

// Helper: Read stability required count from env or default
fn stability_required() -> usize {
    env::var("WATCHER_STABILITY_REQUIRED")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(DEFAULT_STABILITY_REQUIRED)
}

// Helper: Read lock TTL from env or default
fn lock_ttl() -> Duration {
    env::var("WATCHER_LOCK_TTL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or_else(|| Duration::from_secs(DEFAULT_LOCK_TTL_SECS))
}

// Helper: Read prune interval seconds
fn prune_interval_secs() -> u64 {
    env::var("WATCHER_PRUNE_INTERVAL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(DEFAULT_PRUNE_INTERVAL_SECS)
}

// Helper: Read channel capacity
fn channel_capacity() -> usize {
    env::var("WATCHER_CHANNEL_CAPACITY")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(DEFAULT_CHANNEL_CAPACITY)
}

// Mark a file as processed by the upload handler to prevent watcher duplicate processing
// Called automatically after successful file registration in upload handlers
pub fn mark_handled_internal_path(internal_path: &str) {
    let mut reg = HANDLED_REGISTRY.lock().unwrap();
    reg.insert(internal_path.to_string(), Instant::now());
    prune_handled_registry_locked(&mut reg);
}

// Clean expired entries from the handled files registry
fn prune_handled_registry_locked(reg: &mut HashMap<String, Instant>) {
    let now = Instant::now();
    let ttl = ignore_ttl();
    reg.retain(|_, &mut t| now.duration_since(t) <= ttl);
}

// Check if a file has been recently processed to avoid duplicate handling
fn is_recently_handled(internal_path: &str) -> bool {
    let mut reg = HANDLED_REGISTRY.lock().unwrap();
    prune_handled_registry_locked(&mut reg);
    reg.contains_key(internal_path)
}

// Retrieve or create a per-file async mutex for synchronization
// Also updates the last-used timestamp to avoid premature pruning.
fn get_file_lock_for(key: &str) -> Arc<TokioMutex<()>> {
    let mut locks = FILE_LOCKS.lock().unwrap();
    let now = Instant::now();
    let entry = locks
        .entry(key.to_string())
        .or_insert_with(|| (Arc::new(TokioMutex::new(())), now));
    // Update last used timestamp
    entry.1 = now;
    entry.0.clone()
}

// Prune idle locks from FILE_LOCKS.
// Removes entries where the Arc strong_count == 1 (only stored in map) and last_used older than lock_ttl.
fn prune_file_locks_locked(locks: &mut HashMap<String, (Arc<TokioMutex<()>>, Instant)>) {
    let now = Instant::now();
    let ttl = lock_ttl();
    let mut to_remove = Vec::new();
    for (k, (arc_lock, last_used)) in locks.iter() {
        if std::sync::Arc::strong_count(arc_lock) == 1 && now.duration_since(*last_used) > ttl {
            to_remove.push(k.clone());
        }
    }
    for k in to_remove {
        debug!("Pruning idle file lock: {}", k);
        locks.remove(&k);
    }
}

// Helper to increment metric counters
fn incr_metric(key: &str) {
    let mut m = METRICS.lock().unwrap();
    *m.entry(key.to_string()).or_insert(0) += 1;
}

// Initialize and start the filesystem watcher service
//
// - `uploads_dir`: Base directory to monitor for file changes
// - `tmp_subdir_name`: Temporary subdirectory name to exclude from monitoring
// - `pool_opt`: Database connection pool for file registration (None for logging only)
// - `owner_user_id_opt`: User ID to assign ownership for files created via sharing
pub async fn start_watcher(
    uploads_dir: PathBuf,
    tmp_subdir_name: &str,
    pool_opt: Option<SqlitePool>,
    owner_user_id_opt: Option<i64>,
) -> Result<JoinHandle<()>, Box<dyn std::error::Error + Send + Sync>> {
    // Ensure uploads directory exists before starting watcher
    if !uploads_dir.exists() {
        std::fs::create_dir_all(&uploads_dir)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
    }

    // Resolve absolute path for consistent path comparisons
    let uploads_root = std::fs::canonicalize(&uploads_dir)
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

    // Configure temporary directory exclusion path
    let tmp_dir = uploads_root.join(tmp_subdir_name);
    let tmp_dir_canon = tmp_dir.canonicalize().unwrap_or_else(|_| tmp_dir.clone());

    info!(
        "Starting watcher. uploads_root={} tmp_dir={}",
        uploads_root.display(),
        tmp_dir_canon.display()
    );

    // Create channel for forwarding filesystem events to async runtime
    let (tx, mut rx) = tokio::sync::mpsc::channel::<NotifyResult<Event>>(channel_capacity());

    // Initialize notify watcher with event forwarding to tokio channel
    let mut recommended_watcher: RecommendedWatcher = RecommendedWatcher::new(
        move |res: NotifyResult<Event>| {
            let _ = tx.blocking_send(res);
        },
        Config::default(),
    )?;

    // Begin recursive monitoring of uploads directory
    recommended_watcher.watch(uploads_root.as_path(), RecursiveMode::Recursive)?;

    // Spawn main watcher event processing loop
    let handle = tokio::spawn(async move {
        let mut prune_interval = tokio::time::interval(Duration::from_secs(prune_interval_secs()));
        prune_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            tokio::select! {
                _ = prune_interval.tick() => {
                    // Periodic cleanup of expired handled file entries and idle locks
                    {
                        let mut reg = HANDLED_REGISTRY.lock().unwrap();
                        prune_handled_registry_locked(&mut reg);
                    }
                    {
                        let mut locks = FILE_LOCKS.lock().unwrap();
                        prune_file_locks_locked(&mut locks);
                    }
                    // Log and optionally reset metrics periodically
                    {
                        let mut m = METRICS.lock().unwrap();
                        if !m.is_empty() {
                            info!("Watcher metrics snapshot: {:?}", *m);
                            // Reset metrics to avoid unbounded growth (simple approach)
                            m.clear();
                        }
                    }
                }

                maybe_event = rx.recv() => {
                    match maybe_event {
                        None => {
                            info!("Watcher channel closed, exiting watcher task.");
                            break;
                        }
                        Some(Ok(event)) => {
                            // Process filesystem event in dedicated task
                            let uploads_root = uploads_root.clone();
                            let tmp_dir = tmp_dir_canon.clone();
                            let pool_clone = pool_opt.clone();
                            let owner = owner_user_id_opt;
                            tokio::spawn(async move {
                                if let Err(e) = handle_notify_event(event, uploads_root, tmp_dir, pool_clone, owner).await {
                                    error!("Watcher processing error: {:?}", e);
                                }
                            });
                        }
                        Some(Err(err)) => {
                            warn!("Notify error: {:?}", err);
                        }
                    }
                }
            }
        }
    });

    // Prevent watcher drop to maintain filesystem monitoring
    std::mem::forget(recommended_watcher);

    Ok(handle)
}

// Process individual filesystem event from notify watcher
// Handles create/modify/remove events with duplicate prevention and file locking
async fn handle_notify_event(
    event: Event,
    uploads_root: PathBuf,
    tmp_dir: PathBuf,
    pool_opt: Option<SqlitePool>,
    owner_user_id_opt: Option<i64>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if event.paths.is_empty() {
        debug!("Notify event without paths: {:?}", event);
        return Ok(());
    }

    // Skip events occurring within temporary directory
    for p in &event.paths {
        if path_is_within(p, &tmp_dir) {
            debug!("Ignoring tmp path: {}", p.display());
            return Ok(());
        }
    }

    match event.kind {
        EventKind::Create(_) | EventKind::Modify(_) => {
            for p in event.paths {
                if p.is_dir() {
                    continue;
                }

                // Resolve absolute file path
                let canon = match p.canonicalize() {
                    Ok(c) => c,
                    Err(e) => {
                        warn!("Failed to canonicalize {}: {}", p.display(), e);
                        continue;
                    }
                };

                // Verify file is within monitored uploads directory
                if !path_is_within(&canon, &uploads_root) {
                    debug!("Path not under uploads_root: {}", canon.display());
                    continue;
                }

                // Calculate internal path relative to uploads root
                let internal_path = match canon.strip_prefix(&uploads_root) {
                    Ok(rel) => rel.to_string_lossy().into_owned(),
                    Err(_) => {
                        debug!("Could not compute internal path for {}", canon.display());
                        continue;
                    }
                };

                // Skip recently processed files to avoid duplicates
                if is_recently_handled(&internal_path) {
                    debug!("Skipping recently handled: {}", internal_path);
                    continue;
                }

                // Wait for file write operations to complete
                if !wait_for_stable_file(&canon).await {
                    warn!("File not stable: {}", canon.display());
                    continue;
                }

                // Acquire file-specific lock for concurrent access control
                let key = internal_path.clone();
                let lock = get_file_lock_for(&key);
                let _guard = lock.lock().await;

                // Re-check handling status after lock acquisition
                if is_recently_handled(&internal_path) {
                    debug!(
                        "After lock, internal path already marked: {}",
                        internal_path
                    );
                    continue;
                }

                // Register file in database if connection available
                if let Some(pool) = &pool_opt {
                    let file_name = std::path::Path::new(&internal_path)
                        .file_name()
                        .map(|s| s.to_string_lossy().into_owned())
                        .unwrap_or_else(|| internal_path.clone());

                    let file_size_i64: u64 = match tokio::fs::metadata(&canon).await {
                        Ok(md) => md.len(),
                        Err(e) => {
                            warn!("Failed stat {}: {}", canon.display(), e);
                            continue;
                        }
                    };

                    let mime_type = from_path(std::path::Path::new(&internal_path))
                        .first_or_octet_stream()
                        .essence_str()
                        .to_string();

                    let uploaded_by_i64: u64 = owner_user_id_opt.unwrap_or(1).try_into().unwrap();

                    let payload = RegisterFilePayload {
                        name: file_name.clone(),
                        internal_path: internal_path.clone(),
                        size_bytes: file_size_i64,
                        mime_type,
                        uploaded_by: uploaded_by_i64,
                    };

                    let resp = register_file(pool, payload).await;
                    if resp.status().is_success() {
                        info!("Watcher registered file {} ok: {:?}", internal_path, resp);
                        mark_handled_internal_path(&internal_path);
                        incr_metric("files_registered");
                    } else {
                        warn!("Watcher failed to register {}: {:?}", internal_path, resp);
                    }
                } else {
                    // Log-only mode when database not available
                    info!("New file detected (no DB): {}", internal_path);
                    mark_handled_internal_path(&internal_path);
                    incr_metric("files_detected_no_db");
                }
                incr_metric("events_processed");
            }
        }

        EventKind::Remove(_) => {
            for p in event.paths {
                // Robustly compute internal path for remove events where the file may no longer exist.
                if let Some(internal) = compute_internal_for_remove(&p, &uploads_root) {
                    let key = internal.clone();
                    let lock = get_file_lock_for(&key);
                    let _guard = lock.lock().await;

                    if is_recently_handled(&internal) {
                        debug!("Skipping recently handled remove: {}", internal);
                        continue;
                    }

                    if let Some(pool) = &pool_opt {
                        // Mark file as deleted in database
                        match sqlx::query("UPDATE files SET is_deleted = 1 WHERE internal_path = ?")
                            .bind(&internal)
                            .execute(pool)
                            .await
                        {
                            Ok(result) => {
                                if result.rows_affected() > 0 {
                                    info!("Marked deleted in DB: {}", internal);
                                    mark_handled_internal_path(&internal);
                                } else {
                                    warn!(
                                        "Remove event: no DB record found to mark deleted for {}",
                                        internal
                                    );
                                    mark_handled_internal_path(&internal);
                                }
                            }
                            Err(e) => {
                                error!(
                                    "DB error while marking is_deleted for {}: {:?}",
                                    internal, e
                                );
                            }
                        }
                    } else {
                        info!("File removed (no DB): {}", internal);
                        mark_handled_internal_path(&internal);
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

// Compute an internal path string for removed files.
// Tries multiple strategies because removed files cannot be canonicalized.
fn compute_internal_for_remove(p: &Path, uploads_root: &Path) -> Option<String> {
    // Try direct strip_prefix first
    if let Ok(rel) = p.strip_prefix(uploads_root) {
        return Some(rel.to_string_lossy().into_owned());
    }

    // Fallback: compare strings (works when p is absolute and starts with uploads_root text)
    let uploads_root_s = uploads_root.to_string_lossy();
    let p_s = p.to_string_lossy();
    if p_s.starts_with(&*uploads_root_s) {
        let mut rel = p_s[uploads_root_s.len()..].to_string();
        // Trim leading path separator if present
        if rel.starts_with(std::path::MAIN_SEPARATOR) {
            rel = rel
                .trim_start_matches(std::path::MAIN_SEPARATOR)
                .to_string();
        }
        return Some(rel);
    }

    // Final fallback: use file name only (best-effort)
    if let Some(fname) = p.file_name() {
        return Some(fname.to_string_lossy().into_owned());
    }

    None
}

// Check if a file path resides within the specified directory
fn path_is_within(candidate: &Path, dir: &Path) -> bool {
    if let Ok(cand) = candidate.canonicalize() {
        return cand.starts_with(dir);
    }
    candidate.starts_with(dir)
}

// Monitor file size stability to detect when write operations complete
async fn wait_for_stable_file(path: &Path) -> bool {
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
