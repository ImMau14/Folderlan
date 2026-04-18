use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex as StdMutex;

pub static METRICS: Lazy<StdMutex<HashMap<String, u64>>> =
    Lazy::new(|| StdMutex::new(HashMap::new()));

pub fn incr_metric(key: &str) {
    let mut m = METRICS.lock().unwrap();
    *m.entry(key.to_string()).or_insert(0) += 1;
}
