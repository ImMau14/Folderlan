// Shared test infrastructure used by every integration test binary.
// Helpers are intentionally shared; unused ones vary per binary.
#![allow(dead_code)]

mod api_client;
mod test_app;
mod test_db;
mod test_fs;
mod test_server;

pub use test_app::TestApp;
#[allow(unused_imports)]
pub use test_app::VisitorOptions;
