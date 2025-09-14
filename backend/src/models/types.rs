use serde::Deserialize;
use std::path::PathBuf;

/// For the upload file handler
#[derive(Deserialize, Clone, Debug)]
pub struct ChunkMeta {
    pub file_id: String,
    pub chunk_index: u64,
    pub total_chunks: u64,
    pub chunk_size: u64, // In bytes
    pub total_size: u64, // In bytes
    pub filename: String,
}

/// The upload folders path
pub struct UploadsPath {
    path: PathBuf,
}

impl UploadsPath {
    pub fn new(path: &str) -> Self {
        UploadsPath {
            path: PathBuf::from(path),
        }
    }

    // To get the PathBuf from the struct
    pub fn get(&self) -> PathBuf {
        self.path.clone()
    }
}
