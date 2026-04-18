use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Instant;
use tokio::sync::Mutex as TokioMutex;
use tracing::debug;

use super::config::{ignore_ttl, lock_ttl};

type FileLock = Arc<TokioMutex<()>>;
type FileLockEntry = (FileLock, Instant);
type FileLocksMap = HashMap<String, FileLockEntry>;

pub static FILE_LOCKS: Lazy<StdMutex<FileLocksMap>> = Lazy::new(|| StdMutex::new(HashMap::new()));
pub static HANDLED_REGISTRY: Lazy<StdMutex<HashMap<String, Instant>>> =
    Lazy::new(|| StdMutex::new(HashMap::new()));

/// Mark a file as processed to prevent duplicate handling.
pub fn mark_handled_internal_path(internal_path: &str) {
    let mut reg = HANDLED_REGISTRY.lock().unwrap();
    reg.insert(internal_path.to_string(), Instant::now());
    prune_handled_registry_locked(&mut reg);
}

/// Clean expired entries from the handled files registry.
pub fn prune_handled_registry_locked(reg: &mut HashMap<String, Instant>) {
    let now = Instant::now();
    let ttl = ignore_ttl();
    reg.retain(|_, &mut t| now.duration_since(t) <= ttl);
}

/// Check if a file has been recently processed.
pub fn is_recently_handled(internal_path: &str) -> bool {
    let mut reg = HANDLED_REGISTRY.lock().unwrap();
    prune_handled_registry_locked(&mut reg);
    reg.contains_key(internal_path)
}

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
