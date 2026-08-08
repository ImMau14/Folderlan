use std::env;
use std::time::Duration;

// Delay between file stability checks during write operations (default ms)
pub const DEFAULT_STABILITY_CHECK_MS: u64 = 300;

// Number of consecutive stable size checks required to consider a file complete (default)
pub const DEFAULT_STABILITY_REQUIRED: usize = 3;

// Time-to-live for idle locks before pruning (default)
pub const DEFAULT_LOCK_TTL_SECS: u64 = 300;

// Default prune interval seconds
pub const DEFAULT_PRUNE_INTERVAL_SECS: u64 = 10;

// Default channel capacity for notify -> tokio channel
pub const DEFAULT_CHANNEL_CAPACITY: usize = 64;

pub fn stability_check_delay() -> Duration {
    env::var("WATCHER_STABILITY_CHECK_MS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map(Duration::from_millis)
        .unwrap_or_else(|| Duration::from_millis(DEFAULT_STABILITY_CHECK_MS))
}

pub fn stability_required() -> usize {
    env::var("WATCHER_STABILITY_REQUIRED")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(DEFAULT_STABILITY_REQUIRED)
}

pub fn lock_ttl() -> Duration {
    env::var("WATCHER_LOCK_TTL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or_else(|| Duration::from_secs(DEFAULT_LOCK_TTL_SECS))
}

pub fn prune_interval_secs() -> u64 {
    env::var("WATCHER_PRUNE_INTERVAL_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(DEFAULT_PRUNE_INTERVAL_SECS)
}

pub fn channel_capacity() -> usize {
    env::var("WATCHER_CHANNEL_CAPACITY")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(DEFAULT_CHANNEL_CAPACITY)
}
