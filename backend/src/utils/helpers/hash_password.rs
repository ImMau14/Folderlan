// Provides password hashing functionality using the Argon2 algorithm.
use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString},
};
use rand::rngs::OsRng;

// Hashes a plaintext password using Argon2 with a randomly generated salt.
pub fn hash_password(password: &str) -> Result<String, String> {
    // Generate cryptographically secure random salt
    let salt = SaltString::generate(&mut OsRng);

    // Initialize Argon2 hasher with default parameters
    let argon2 = Argon2::default();

    // Hash password combined with salt
    match argon2.hash_password(password.as_bytes(), &salt) {
        Ok(hash) => Ok(hash.to_string()),
        Err(e) => Err(format!("Password hash error: {e}")),
    }
}
