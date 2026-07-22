# Folderlan · [![NodeJS CI](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/node-ci.yaml) [![Rust CI](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml)

Forget about limitations. Share files instantly, directly between devices.

Folderlan is the perfect solution for transferring documents, photos, videos, and more, without the need for the internet, Bluetooth, or cables. Simply connect your devices to the same Wi-Fi network and start sharing with an interface so intuitive that anyone can use it.

---

<img width="1024" height="600" alt="image" src="https://pbdecn9fvkmyynkh.public.blob.vercel-storage.com/285shots_so.webp" />

---

## Table of Contents

- [Key Features](#key-features)
  - [Intelligent File Management](#intelligent-file-management)
  - [User and Role Management](#user-and-role-management)
  - [Automated Monitoring](#automated-monitoring)
  - [Audit and Traceability](#audit-and-traceability)
  - [Security and Authentication](#security-and-authentication)
  - [Database and Configuration](#database-and-configuration)
  - [Granular Access Control](#granular-access-control)
- [Download](#download)
- [Quick Start](#quick-start)
- [Build](#build)
  - [Requirements (Recommended)](#requirements-recommended)
  - [Compilation Steps](#compilation-steps)
- [License](#license)

---

## Key Features

> Folderlan is currently in an alpha development phase. This means the core technology is operational, but we are in the process of implementing and refining the full set of features required for a complete user experience.

### Intelligent File Management

- **Advanced Upload**: Support for large files through chunked upload
- **Search and Filters**: Quickly find files by name, size, modification date
- **Access Control**: Secure downloads with real-time permission verification
- **Secure Deletion**: Permission-based system for controlled file management

### User and Role Management

**Two user types:**
- **Owner**: Full administrator access
- **Visitors**: Users with configurable permissions

**Granular permissions:**
- `can_upload`: Enable/disable file upload
- `can_delete_own_files`: Permission to delete own files
- `has_upload_limits`: Customizable storage limits
- `upload_limit`: Specific byte limit per user

### Automated Monitoring

- **Instant Detection**: File System Watcher automatically detects new files
- **Secure Processing**: Stability verification to avoid processing in-use files
- **Fault Tolerant**: Log-only mode when database is unavailable
- **Conflict-Free**: Locking system to prevent race conditions

### Audit and Traceability

- **Complete Logging**: All actions logged with timestamp
- **Advanced Filters**: Search by user, file, event type, or date range
- **Detailed Context**: IP information, result (success/failure), and descriptions
- **Total Transparency**: Know who, when, and what was done at all times

### Security and Authentication

- **JWT Tokens**: Secure authentication with expiration (1 hour)
- **Secure Configuration**: Local endpoints for initial setup
- **Configurable CORS**: Access policies adaptable to your environment
- **Access Recovery**: Password reset system for all users

### Database and Configuration

- **Integrated SQLite**: Lightweight, self-contained database
- **Automatic Initialization**: Self-configuring on first use
- **Health Monitoring**: Continuous database status verification
- **Flexible Configuration**: Environment variables to customize every aspect

### Granular Access Control

- **Per-File Permissions**: Individual control for each file
- **Smart Inheritance**: Permissions that inherit from owner
- **Selective Visibility**: Public or private files as needed
- **Collaborators**: Share specific files with selected users

---

## Download

You can get the latest release from this repository's [releases page](https://github.com/ImMau14/Folderlan/releases). The binaries are automatically compiled through GitHub Actions and are available for the following platforms: Windows (32-bit and 64-bit) and Linux (64-bit only).

---

## Quick Start

Getting started with Folderlan is straightforward. Follow these simple steps to begin sharing files:

1. **Download the program** from the [releases page](https://github.com/ImMau14/Folderlan/releases) for your operating system.
2. **Execute the binary** to start the Folderlan server on your device.
3. **Open your web browser** and navigate to `http://localhost:8080` (8080 is the default port).
4. **Follow the intuitive steps** in the web interface to configure your sharing preferences and set up your file sharing environment.
5. **Begin sharing files** by uploading them through the web interface.

> **Important Note for Cross-Device Sharing**: When sharing files with another device on the same network, ensure that both devices are connected to the same Wi-Fi or local network. To access Folderlan from another device, use the host machine's IP address instead of `localhost`. For example: `http://192.168.1.101:8080` (replace with your actual host IP address).

---

## Build

### Requirements (Recommended)

The following tools are required for the build scripts to work properly. The versions shown are the ones I recommend and use for development, but you can use similar versions if needed.

- **Rust 1.90.0** or higher
- **NodeJS 22.17.1** or higher
- **PNPM 10.19.0** or higher

### Compilation Steps

1. **Clone the repository:**
   ```bash
   git clone --depth 1 https://github.com/ImMau14/Folderlan.git
   ```

2. **Build the project:**
   
   You can use the `--release` flag to compile an optimized Rust binary.

   ```bash
   # On Linux or Git-Bash
   bash scripts/build.sh

   # On Windows (Command Prompt)
   scripts/build.cmd

   # On Windows (PowerShell)
   ./scripts/build.ps1
   ```

3. **Run the application:**
   ```bash
   # Navigate to the backend directory
   cd backend

   # Run with cargo (use `cargo run --release` if you built with release flag)
   cargo run
   ```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
