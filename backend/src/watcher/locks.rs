use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Instant;
use tokio::sync::Mutex as TokioMutex;
use tracing::debug;

use super::config::lock_ttl;

type FileLock = Arc<TokioMutex<()>>;
type FileLockEntry = (FileLock, Instant);
type FileLocksMap = HashMap<String, FileLockEntry>;

pub static FILE_LOCKS: Lazy<StdMutex<FileLocksMap>> = Lazy::new(|| StdMutex::new(HashMap::new()));

/// Retrieve or create a per-file async mutex.
pub fn get_file_lock_for(key: &str) -> Arc<TokioMutex<()>> {
    let mut locks = FILE_LOCKS.lock().unwrap();
    let now = Instant::now();
    let entry = locks
        .entry(key.to_string())
        .or_insert_with(|| (Arc::new(TokioMutex::new(())), now));
    entry.1 = now;
    entry.0.clone()
}

/// Remove idle locks from FILE_LOCKS.
pub fn prune_file_locks_locked(locks: &mut HashMap<String, (Arc<TokioMutex<()>>, Instant)>) {
    let now = Instant::now();
    let ttl = lock_ttl();
    let mut to_remove = Vec::new();
    for (k, (arc_lock, last_used)) in locks.iter() {
        if Arc::strong_count(arc_lock) == 1 && now.duration_since(*last_used) > ttl {
            to_remove.push(k.clone());
        }
    }
    for k in to_remove {
        debug!("Pruning idle file lock: {}", k);
        locks.remove(&k);
    }
}
