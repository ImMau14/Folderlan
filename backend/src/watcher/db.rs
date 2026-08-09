use mime_guess::from_path;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::path::Path;
use tokio::sync::mpsc::{self, error::TrySendError};
use tracing::{error, info, warn};

use super::metrics::incr_metric;

/// A queued database write emitted by the watcher.
///
/// Watcher tasks never touch the database directly: they enqueue a job and the
/// single writer task drains, deduplicates and commits them in batches. This
/// serializes SQLite writes (single writer) and collapses the repeated
/// Create/Modify events that notify fires for the same file.
#[derive(Debug)]
pub enum DbJob {
    Register {
        internal_path: String,
        size_bytes: u64,
        owner_user_id: i64,
    },
    MarkDeleted {
        internal_path: String,
    },
}

/// Handle to the single-writer database queue. Cheap to clone (sender only).
#[derive(Clone)]
pub struct DbQueue {
    tx: mpsc::Sender<DbJob>,
}

impl DbQueue {
    pub fn spawn(pool: SqlitePool) -> Self {
        let (tx, rx) = mpsc::channel(1024);
        let handle = tokio::spawn(db_worker(pool, rx));
        // Detach: dropping the JoinHandle does not stop the worker task.
        std::mem::forget(handle);
        DbQueue { tx }
    }

    /// Enqueue a job without blocking. If the queue is full the job is dropped
    /// (logged): files are re-detected by later notify events anyway.
    pub fn enqueue(&self, job: DbJob) {
        match self.tx.try_send(job) {
            Ok(()) => {}
            Err(TrySendError::Full(_)) => {
                warn!("Watcher DB queue full, dropping job");
            }
            Err(TrySendError::Closed(_)) => {
                warn!("Watcher DB queue closed, dropping job");
            }
        }
    }
}

/// Single writer: drains the queue in batches and deduplicates by internal
/// path (last event wins), so SQLite never sees concurrent writers and
/// repeated Create/Modify events collapse into a single upsert.
async fn db_worker(pool: SqlitePool, mut rx: mpsc::Receiver<DbJob>) {
    loop {
        let first = match rx.recv().await {
            Some(job) => job,
            None => {
                info!("Watcher DB queue closed, worker exiting.");
                break;
            }
        };

        let mut jobs = Vec::with_capacity(64);
        jobs.push(first);
        while let Ok(job) = rx.try_recv() {
            jobs.push(job);
        }

        let batch = dedup_jobs(jobs);
        if let Err(e) = process_batch(&pool, batch).await {
            error!("Watcher DB batch failed: {:?}", e);
        }
    }
}

/// Collapse jobs for the same file: the last enqueued job wins.
fn dedup_jobs(jobs: Vec<DbJob>) -> HashMap<String, DbJob> {
    let mut map = HashMap::with_capacity(jobs.len());
    for job in jobs {
        let key = match &job {
            DbJob::Register { internal_path, .. } => internal_path.clone(),
            DbJob::MarkDeleted { internal_path } => internal_path.clone(),
        };
        map.insert(key, job);
    }
    map
}

async fn process_batch(pool: &SqlitePool, jobs: HashMap<String, DbJob>) -> Result<(), sqlx::Error> {
    for (_key, job) in jobs {
        let job_desc = match &job {
            DbJob::Register { internal_path, .. } => internal_path.clone(),
            DbJob::MarkDeleted { internal_path } => internal_path.clone(),
        };

        let result = match job {
            DbJob::Register {
                internal_path,
                size_bytes,
                owner_user_id,
            } => {
                let file_name = Path::new(&internal_path)
                    .file_name()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_else(|| internal_path.clone());

                let mime_type = from_path(Path::new(&internal_path))
                    .first_or_octet_stream()
                    .essence_str()
                    .to_string();

                let size_bytes_i64 = size_bytes as i64;
                let uploaded_by_i64 = owner_user_id;

                sqlx::query!(
                    "INSERT INTO Files (
                            name,
                            internal_path,
                            size_bytes,
                            mime_type,
                            uploaded_by
                        ) VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(internal_path) DO UPDATE SET
                            name = excluded.name,
                            size_bytes = excluded.size_bytes,
                            mime_type = excluded.mime_type,
                            is_deleted = 0,
                            deleted_at = NULL,
                            uploaded_at = CASE
                                WHEN Files.is_deleted = 1 THEN CURRENT_TIMESTAMP
                                ELSE Files.uploaded_at
                            END
                    ",
                    file_name,
                    internal_path,
                    size_bytes_i64,
                    mime_type,
                    uploaded_by_i64,
                )
                .execute(pool)
                .await
                .map(|_| {
                    info!("Watcher registered file {} ok", job_desc);
                    incr_metric("files_registered");
                })
            }
            DbJob::MarkDeleted { internal_path } => sqlx::query!(
                "UPDATE Files SET is_deleted = 1 WHERE internal_path = ?",
                internal_path
            )
            .execute(pool)
            .await
            .map(|result| {
                if result.rows_affected() > 0 {
                    info!("Marked deleted in DB: {}", internal_path);
                } else {
                    warn!(
                        "Remove event: no DB record found to mark deleted for {}",
                        internal_path
                    );
                }
            }),
        };

        if let Err(e) = result {
            error!("Watcher DB statement failed for {}: {:?}", job_desc, e);
            return Err(e);
        }
    }

    Ok(())
}
