use std::path::Path;

fn main() {
    // This tells rustc that 'has_dist' is an expected custom configuration
    println!("cargo::rustc-check-cfg=cfg(has_dist)");

    // ---------- Dist directory detection (for SPA embedding) ----------
    let dist_dir = Path::new("dist");
    if dist_dir.exists() && dist_dir.is_dir() {
        println!("cargo:rustc-cfg=has_dist");
        println!("cargo:rerun-if-changed=dist");
    } else {
        println!("cargo:rerun-if-changed=build.rs");
    }

    // ---------- Windows resource embedding (unchanged) ----------
    #[cfg(windows)]
    {
        use std::env;
        let mut res = winres::WindowsResource::new();

        // Set application icon
        res.set_icon("assets/icon.ico");

        // Metadata fields
        res.set(
            "FileDescription",
            "Share files using your local LAN network!",
        );
        res.set("ProductName", "Folderlan");
        res.set("OriginalFilename", "Folderlan.exe");
        res.set("LegalCopyright", "© 2025-2026 ImMau14");

        // Numeric version values from Cargo.toml
        let ver = env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "0.0.0".into());
        let mut parts = ver
            .split(['.', '-', '+'])
            .map(|s| s.parse::<u64>().unwrap_or(0));

        let major = parts.next().unwrap_or(0);
        let minor = parts.next().unwrap_or(0);
        let patch = parts.next().unwrap_or(0);
        let build = 0u64;

        fn pack_version(maj: u64, min: u64, pat: u64, b: u64) -> u64 {
            (maj << 48) | (min << 32) | (pat << 16) | b
        }

        res.set_version_info(
            winres::VersionInfo::FILEVERSION,
            pack_version(major, minor, patch, build),
        );
        res.set_version_info(
            winres::VersionInfo::PRODUCTVERSION,
            pack_version(major, minor, patch, build),
        );

        res.compile().expect("winres: compile failed");
    }
}
