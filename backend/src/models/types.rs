use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct Response {
    pub success: bool,
    pub message: String,
}

#[derive(Deserialize, Clone, Debug)]
pub struct ChunkMeta {
    pub file_id: String,
    pub chunk_index: u64,
    pub total_chunks: u64,
    pub chunk_size: u64,
    pub total_size: u64,
    pub filename: String,
}
