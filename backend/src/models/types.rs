// Common types: Manages file chunk metadata and upload directory paths for file uploads.
use serde::Deserialize;
use std::path::PathBuf;

/// Metadata for individual file chunks during upload process
#[derive(Deserialize, Clone, Debug)]
pub struct ChunkMeta {
    pub file_id: String,   // Unique identifier for the file
    pub chunk_index: u64,  // Current chunk sequence number
    pub total_chunks: u64, // Total number of chunks in file
    pub chunk_size: u64,   // Size of current chunk in bytes
    pub total_size: u64,   // Complete file size in bytes
    pub filename: String,  // Original filename
}

/// Manages upload directory path operations
pub struct UploadsPath {
    path: PathBuf, // Stores the upload directory path
}

impl UploadsPath {
    // Creates new UploadsPath instance from string path
    pub fn new(path: &str) -> Self {
        UploadsPath {
            path: PathBuf::from(path),
        }
    }

    // Returns cloned PathBuf of upload directory
    pub fn get(&self) -> PathBuf {
        self.path.clone()
    }
}
