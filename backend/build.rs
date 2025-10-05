// Main entry point for setting Windows-specific metadata and resources in the compiled executable
#[cfg(windows)]
fn main() {
    use std::env;
    let mut res = winres::WindowsResource::new();

    // Set application icon
    res.set_icon("assets/icon.ico");

    // --- Metadata fields ---
    res.set(
        "FileDescription",
        "Share files using your local LAN network!",
    );
    res.set("ProductName", "Folderlan");
    res.set("OriginalFilename", "Folderlan.exe");
    res.set("LegalCopyright", "© 2025 ImMau14");

    // --- Numeric version values ---
    // Cargo provides environment variables such as CARGO_PKG_VERSION
    // and CARGO_PKG_VERSION_{MAJOR,MINOR,PATCH}
    // Parse CARGO_PKG_VERSION (e.g., "1.2.3" or "1.2.3-beta" -> extract numbers)
    let ver = env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "0.0.0".into());
    let mut parts = ver
        .split(['.', '-', '+'])
        .map(|s| s.parse::<u64>().unwrap_or(0));

    // Extract semantic version components
    let major = parts.next().unwrap_or(0);
    let minor = parts.next().unwrap_or(0);
    let patch = parts.next().unwrap_or(0);
    let build = 0u64;

    // Pack version components into a 64-bit value as required by Windows APIs
    fn pack_version(maj: u64, min: u64, pat: u64, b: u64) -> u64 {
        (maj << 48) | (min << 32) | (pat << 16) | b
    }

    // Apply version information
    res.set_version_info(
        winres::VersionInfo::FILEVERSION,
        pack_version(major, minor, patch, build),
    );
    res.set_version_info(
        winres::VersionInfo::PRODUCTVERSION,
        pack_version(major, minor, patch, build),
    );

    // Compile and embed the Windows resource file
    res.compile().expect("winres: compile failed");
}

// No-op main function for non-Windows platforms
#[cfg(not(windows))]
fn main() {}
