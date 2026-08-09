mod config;
mod db;
mod locks;
mod metrics;
mod processing;

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Result as NotifyResult, Watcher};
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::time::Duration;
use tokio::task::JoinHandle;
use tracing::{error, info, warn};

use config::{channel_capacity, prune_interval_secs};
use db::DbQueue;
use locks::{FILE_LOCKS, prune_file_locks_locked};
use metrics::METRICS;
use processing::handle_notify_event;

/// Initialize and start the filesystem watcher service.
pub async fn start_watcher(
    uploads_dir: PathBuf,
    tmp_subdir_name: Option<&str>,
    pool_opt: Option<SqlitePool>,
    owner_user_id_opt: Option<i64>,
) -> Result<JoinHandle<()>, Box<dyn std::error::Error + Send + Sync>> {
    if !uploads_dir.exists() {
        std::fs::create_dir_all(&uploads_dir)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
    }

    let uploads_root = std::fs::canonicalize(&uploads_dir)
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

    // Prepare temporary directory exclusion path if provided.
    let tmp_dir_canon = if let Some(sub) = tmp_subdir_name {
        if sub.is_empty() {
            None
        } else {
            let tmp_dir = uploads_root.join(sub);
            // Best-effort creation; ignore errors.
            let _ = std::fs::create_dir_all(&tmp_dir);
            Some(tmp_dir.canonicalize().unwrap_or(tmp_dir))
        }
    } else {
        None
    };

    info!("Filesystem watcher started for {}", uploads_root.display());

    let (tx, mut rx) = tokio::sync::mpsc::channel::<NotifyResult<Event>>(channel_capacity());

    let mut recommended_watcher: RecommendedWatcher = RecommendedWatcher::new(
        move |res: NotifyResult<Event>| {
            let _ = tx.blocking_send(res);
        },
        Config::default(),
    )?;

    recommended_watcher.watch(uploads_root.as_path(), RecursiveMode::Recursive)?;

    // Single-writer database queue: watcher tasks enqueue and the worker
    // serializes writes, so SQLite never sees concurrent writers.
    let db_queue = pool_opt.map(DbQueue::spawn);

    let handle = tokio::spawn(async move {
        let mut prune_interval = tokio::time::interval(Duration::from_secs(prune_interval_secs()));
        prune_interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            tokio::select! {
                _ = prune_interval.tick() => {
                    {
                        let mut locks = FILE_LOCKS.lock().unwrap();
                        prune_file_locks_locked(&mut locks);
                    }
                    {
                        let mut m = METRICS.lock().unwrap();
                        if !m.is_empty() {
                            info!("Watcher metrics snapshot: {:?}", *m);
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
                            let uploads_root = uploads_root.clone();
                            let tmp_dir = tmp_dir_canon.clone();
                            let queue = db_queue.clone();
                            let owner = owner_user_id_opt;
                            tokio::spawn(async move {
                                if let Err(e) =
                                    handle_notify_event(event, uploads_root, tmp_dir, queue, owner)
                                        .await
                                {
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

    std::mem::forget(recommended_watcher);
    Ok(handle)
}
