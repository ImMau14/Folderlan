# 📁 Folderlan Backend · [![Rust CI](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml/badge.svg)](https://github.com/ImMau14/Folderlan/actions/workflows/rust-ci.yaml)

REST API for the Folderlan file‑sharing platform — handles authentication, user management, file operations, permissions, and real‑time filesystem monitoring.

---

## Index

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration – Environment Variables](#configuration--environment-variables)
- [Architecture & Core Concepts](#architecture--core-concepts)
  - [User Roles](#user-roles)
  - [File Permissions](#file-permissions)
  - [How Roles & Permissions Combine](#how-roles--permissions-combine)
  - [Authentication & Authorization Flow](#authentication--authorization-flow)
  - [Database Schema](#database-schema)
  - [File Watcher](#file-watcher)
- [API Reference](#api-reference)
  - [Database Management](#database-management)
  - [Authentication](#authentication)
  - [File Management](#file-management)
  - [File Permissions](#file-permissions-1)
  - [User Management](#user-management)
  - [Audit Logs](#audit-logs)
- [Common Rules: Pagination, Filters & Errors](#common-rules)
- [Appendix: Canonical Response Schema](#appendix-canonical-response-schema)

---

## Overview

Folderlan Backend is the server‑side component of the Folderlan file‑sharing application. It exposes a RESTful API built with **Actix‑web** and **SQLite**.  
Its responsibilities include:

- Managing exactly one **owner** account and multiple **visitor** accounts.
- Handling file uploads, downloads, listing, and deletion with granular permissions.
- Enforcing storage quotas per user.
- Granting and revoking per‑file access rights (`viewer` / `collaborator`).
- Toggling file visibility (public/private).
- Watching the `uploads/` directory in real time and automatically registering new or deleted files.
- Providing an auditable trail of all security‑relevant events.
- Exposing the authenticated user's profile via `/api/user/me`.

The backend does **not** include a graphical interface. It is designed to be consumed by the [Folderlan frontend](https://github.com/ImMau14/Folderlan) or any HTTP client.

<details>
<summary><strong>Project structure</strong></summary>

```
backend/
├── migrations/             # SQL migration scripts (applied on first POST /api/db)
├── src/
│   ├── controllers/        # Route handlers grouped by domain (auth, files, users, audit, db)
│   ├── middleware/          # JWT validation, role checks, permission checks, local‑only guard
│   ├── models/             # Shared types and response builders
│   ├── utils/              # Database helpers (register user, register file, check permissions), password hashing
│   ├── watcher/            # Filesystem monitor logic (config, locks, metrics, processing)
│   ├── lib.rs              # App configuration, CORS setup, route mounting
│   └── main.rs             # Entry point, DB initialisation, server startup
├── Cargo.toml
└── README.md
```

</details>

---

## Quick Start

### First run – step by step

1. **Clone the repository and enter the backend directory**  
   ```bash
   git clone https://github.com/ImMau14/Folderlan.git
   cd Folderlan/backend
   ```

2. **Build and run the server**  
   ```bash
   cargo run --release
   ```
   The server starts on `http://0.0.0.0:8080` by default.

3. **Initial setup (all requests must come from the same machine)**  
   The database is empty at this point. Use the following endpoints **in order**:

   ```bash
   # a) Run migrations (create tables)
   curl -X POST http://127.0.0.1:8080/api/db

   # b) Register the owner account
   curl -X POST http://127.0.0.1:8080/api/auth/owner_register \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"supersecret"}'

   # c) Log in and obtain a JWT token
   curl -X POST http://127.0.0.1:8080/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"supersecret"}'
   ```
   The returned `token` field must be included in all subsequent authenticated requests as `Authorization: Bearer <token>`.

4. **Create your first visitor** (example)  
   ```bash
   curl -X POST http://127.0.0.1:8080/api/auth/register \
     -H "Authorization: Bearer <owner_token>" \
     -H "Content-Type: application/json" \
     -d '{"username":"alice","password":"alice123","can_upload":true,"can_delete_own_files":true,"has_upload_limits":false,"upload_limit":0}'
   ```

---

## Configuration – Environment Variables

<details>
<summary><strong>Main server variables</strong></summary>

| Variable      | Type   | Default     | Description |
|---------------|--------|-------------|-------------|
| `PORT`        | u16    | `8080`      | TCP port to bind. |
| `ADDRESS`     | string | `0.0.0.0`   | Bind address. Use `127.0.0.1` for local‑only exposure. |
| `SQLITE_FILE` | string | `db/app.db` | Path to the SQLite database file. Parent directories are created automatically. |
| `SECRET_JWT`  | string | *random hex* | Secret key for signing JWTs (HS256). If not set, a new random key is generated **on every start**, invalidating previous tokens. Set it explicitly for persistence. |
| `OFF_CORS`            | bool   | `false`     | If `true`, allows all origins (`Cors::permissive()`). If `false`, allows `http://{ADDRESS}:{PORT}`, `http://localhost:{PORT}`, `http://127.0.0.1:{PORT}`, and the detected LAN IP when bound to all interfaces, with methods `GET, POST, DELETE, PATCH, OPTIONS` and headers `Content-Type, Authorization`. |
| `CORS_ALLOWED_ORIGINS` | string | *(empty)*   | Comma‑separated list of extra origins to allow (e.g. `http://192.168.1.50:5173`). Ignored when `OFF_CORS=true`. |
| `LOCAL_ONLY`  | bool   | `true`      | If `true`, endpoints guarded by `LocalOnly` middleware only accept requests from `127.0.0.1` or `::1`. Set to `false` to disable this protection (e.g., when behind a reverse proxy). |

</details>

<details>
<summary><strong>File Watcher variables</strong></summary>

These control the real‑time monitor that watches the `uploads/` directory.

| Variable                      | Type  | Default | Description |
|-------------------------------|-------|---------|-------------|
| `WATCHER_STABILITY_CHECK_MS`  | u64   | `300`   | Milliseconds between consecutive size checks while waiting for a file to stop growing. |
| `WATCHER_STABILITY_REQUIRED`  | usize | `3`     | Number of consecutive stable‑size checks required before a file is considered completely written. |
| `WATCHER_LOCK_TTL_SECS`       | u64   | `300`   | Seconds an idle per‑file lock stays alive before being pruned from memory. |
| `WATCHER_PRUNE_INTERVAL_SECS` | u64   | `10`    | How often the watcher cleans up expired internal structures. |
| `WATCHER_CHANNEL_CAPACITY`    | usize | `64`    | Size of the internal event channel buffer. |

For remote or slow filesystems (NFS, SMB), consider increasing stability values to avoid processing incomplete files.

</details>

---

## Architecture & Core Concepts

### User Roles

There are exactly two system‑level roles stored in the `Users` table (column `role`):

| Role      | Count | Created by                                | Capabilities |
|-----------|-------|-------------------------------------------|--------------|
| `owner`   | 1     | `POST /api/auth/owner_register` (local)   | Full access to **everything**. Ignores all file‑level permission checks. Can manage users, view audit logs, upload/delete any file. |
| `visitor` | 0…N   | `POST /api/auth/register` (by owner)      | Limited by account flags (`can_upload`, `can_delete_own_files`, quotas) and explicit file permissions. |

No additional roles (admin, auditor) exist.

### File Permissions

Independently of the user’s role, **each file** can have explicit permissions stored in the `FilePermissions` table. The supported access levels are:

| Level         | Meaning |
|---------------|---------|
| `viewer`      | Can list and download the file. |
| `collaborator`| All `viewer` rights **plus** can delete the file, grant/revoke permissions on it, list its permissions, and toggle its public flag. |

The original uploader (`uploaded_by`) is implicitly granted certain rights based on their own flags (see next section).

### How Roles & Permissions Combine

When a user tries to access a file (list, download, delete, change permissions, toggle public), the server evaluates the following rules **in order**:

1. **Owner** → always granted full access (no further checks).
2. **File is public** (`is_public = 1`) and the operation only requires `viewer` level (e.g., download, listing) → allowed.
3. **User is the uploader** (`uploaded_by` matches the current user):
   - For `viewer`‑only operations → **always allowed** (the uploader can always see and download their own files).
   - For `collaborator`‑level operations (delete, manage permissions, toggle public) → allowed **only if** the user’s `can_delete_own_files` flag is `true`.
4. **Explicit permission** in `FilePermissions` with a level equal or higher than required:
   - `viewer` satisfies `MinLevel::Viewer`
   - `collaborator` satisfies `MinLevel::Collaborator`
5. **None of the above** → `403 Forbidden`.

> [!WARNING]
> An uploader without `can_delete_own_files = true` **cannot delete their own files**, share them, or change their public status, because those actions require `collaborator` rights. The uploader is effectively limited to viewing and downloading.

> [!NOTE]
> `can_delete_own_files` only affects **files uploaded by the visitor themselves**. It grants no rights over files uploaded by others (or by the file watcher, which assigns ownership to the owner): for those, the visitor needs an explicit `collaborator` permission in `FilePermissions` — the flag alone will still return `403`.

### Authentication & Authorization Flow

<details>
<summary><strong>Step‑by‑step details</strong></summary>

- **JWT Tokens:** generated at login (`POST /api/auth/login`). Payload contains:
  ```json
  {
    "sub": "user_id (as string)",
    "username": "...",
    "role": "owner|visitor",
    "exp": <unix timestamp one hour later>
  }
  ```
  Algorithm: HS256. Key comes from the `SECRET_JWT` env variable.

- **Middleware stack** (applied in order when defined on a route):
  1. `HttpAuthentication::bearer(jwt_validator_adapter)` – validates the token, extracts `AuthUser` and injects it into request extensions.
  2. `RoleAuth(["owner"])` – checks that the JWT’s `role` matches one of the allowed roles.
  3. `PermsAuth(["can_upload"])` – queries the database for the user’s boolean flags and denies if the required flag is `false`. **Owners bypass** this check (they are granted all flags as `true`).
  4. `LocalOnly` – if enabled (`LOCAL_ONLY=true`), rejects requests not coming from `127.0.0.1` or `::1`.

- **Password hashing:** Argon2 with random salt (via `argon2` crate).

- **Account status:** a user must be `is_active = 1` and `is_deleted = 0` to log in. Soft‑deleted users are effectively disabled.

</details>

### Database Schema

<details>
<summary><strong>Key tables and fields</strong></summary>

- **`Users`**  
  `id`, `username`, `password_hash`, `role`, `can_upload`, `can_delete_own_files`, `has_upload_limits`, `upload_limit` (bytes, if limits enabled), `is_active`, `is_deleted`, `created_at`, `last_login_at`, `deleted_at`.

- **`Files`**  
  `id`, `name` (sanitised original name), `internal_path` (relative to `uploads/`), `size_bytes`, `mime_type`, `uploaded_by` → `Users.id`, `is_public`, `is_deleted`, `uploaded_at`, `deleted_at`.  
  Soft‑delete: `is_deleted = 1` keeps the record; the physical file is removed.

- **`FilePermissions`**  
  `file_id`, `user_id`, `access_level` (`'viewer'` or `'collaborator'`), `granted_by`, `granted_at`.  
  Composite unique key `(file_id, user_id)` with `ON CONFLICT ... DO UPDATE` to allow overwriting the level.

- **`AuditLog`**  
  `id`, `timestamp`, `user_id` (nullable), `event_type`, `description`, `ip_address`, `file_id` (nullable), `success`.  
  Populated by explicit insertions in handlers and by database triggers (e.g., on `is_active` toggle).

SQLite optimisations `WAL` journal mode and `busy_timeout = 30000` are applied automatically at startup.

</details>

### File Watcher

<details>
<summary><strong>Real‑time filesystem monitor – full behaviour</strong></summary>

A background task powered by the `notify` crate watches the `uploads/` directory recursively.

- **Events processed:** `Create`, `Modify`, `Remove`.
- **Ignored:** directories, and any path inside a temporary subdirectory (configured via `tmp_subdir_name`; currently unused but ready).
- **Stability check:** before registering a newly created or modified file, the watcher repeatedly checks its size every `WATCHER_STABILITY_CHECK_MS` ms. It requires `WATCHER_STABILITY_REQUIRED` consecutive checks with the same size to confirm the file is fully written.
- **Removal detection:** plain deletions arrive as `Remove` events; a file that is moved or renamed out of the watched tree is detected when its path can no longer be resolved and is treated as removed as well.
- **Per‑file locking:** each file being handled acquires an asynchronous mutex (`FILE_LOCKS` map) to prevent race conditions between overlapping events. The file's presence on disk is re-verified while holding the lock before the database is updated, so an API delete racing with a queued watcher event cannot resurrect a deleted row.
- **Database actions (if DB pool is provided):** the watcher merges the on-disk state with the database using an upsert keyed on `internal_path`:
  - File present on disk → insert the row, or restore/re‑refresh it if a soft‑deleted row already exists (`is_deleted = 0`, old `uploaded_by` is preserved so watcher events never clobber the uploader attribution).
  - File absent → `UPDATE Files SET is_deleted = 1 WHERE internal_path = ?`. Manually copied files appear as owned by the system owner (`owner_user_id`, default `1`).
- **Without database:** events are simply logged with `info!()`, and a metric `files_detected_no_db` is incremented.
- **Metrics:** internal counters (files registered, events processed, remove events, etc.) are periodically logged every prune interval.

</details>

---

## API Reference

### Database Management

<details>
<summary><code>GET /api/db</code> – Check database status</summary>

**Access:** public

**Response 200:**
```json
{
  "success": true,
  "exists": true
}
```
`exists` is `true` if at least one non‑deleted owner account exists (i.e., the database has been initialised and the owner registered). If the `Users` table does not exist yet, the endpoint still returns `200` with `"exists": false` (no error).

</details>

<details>
<summary><code>POST /api/db</code> – Initialise database (run migrations)</summary>

**Access:** local‑only (`LocalOnly` middleware)

**Response 200:**
```json
{
  "success": true,
  "message": "Migrations executed successfully"
}
```

**Errors:** `500` if migration scripts fail.

</details>

### Authentication

<details>
<summary><code>POST /api/auth/login</code></summary>

**Access:** public

**Body:**
```json
{
  "username": "alice",
  "password": "secret"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Login success",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```
The token expires after **1 hour**.

**Errors:** `401` (invalid credentials, account deleted or disabled), `500`.

</details>

<details>
<summary><code>POST /api/auth/register</code> – Register a visitor (owner only)</summary>

**Access:** owner authenticated (JWT + `RoleAuth(["owner"])`)

**Body:**
```json
{
  "username": "bob",
  "password": "p@ssw0rd",
  "can_upload": true,
  "can_delete_own_files": true,
  "has_upload_limits": false,
  "upload_limit": 0
}
```
`upload_limit` is only enforced if `has_upload_limits` is `true`. The owner cannot create another owner via this endpoint (returns an internal error).

**Response 201:**
```json
{
  "success": true,
  "message": "User created successfully"
}
```

**Errors:** `400` (invalid data), `403` (not owner), `500`.

</details>

<details>
<summary><code>POST /api/auth/owner_register</code> – Register the owner (local only)</summary>

**Access:** local‑only

**Body:**
```json
{
  "username": "admin",
  "password": "adminpass"
}
```

**Response 201** (same as visitor registration).

**Errors:** `500` if the payload contains a visitor variant or DB error occurs.

</details>

<details>
<summary><code>POST /api/auth/owner_reset_password</code> – Reset owner password (local only)</summary>

**Access:** local‑only

**Body:**
```json
{
  "password": "newpassword"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Owner password updated successfully"
}
```

**Errors:** `500` if no owner exists.

</details>

<details>
<summary><code>POST /api/auth/visitor_reset_password</code> – Reset a visitor’s password (owner only)</summary>

**Access:** owner authenticated

**Body:**
```json
{
  "username": "bob",
  "password": "newpassword"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Visitor password updated successfully"
}
```

**Errors:** `400` (empty username, target is not a visitor, user deleted), `404` (not found), `500`.

</details>

### File Management

All file endpoints require a valid JWT (except where noted) and respect the permission model described above.

<details>
<summary><code>POST /api/files/upload</code> – Upload a file</summary>

**Access:** authenticated + `can_upload` permission (verified by `PermsAuth`). Owner always allowed.

**Headers:** `Authorization`, `Content-Type: multipart/form-data`

**Request body:** single file field (field name arbitrary). The first file field encountered is processed; any additional fields are ignored.

**Behaviour:**
- Sanitises the original filename (`sanitize_filename` crate).
- If a file with the same name already exists in the uploads root, a counter is appended (e.g., `report (1).pdf`).
- **Quota enforcement:** if the user has `has_upload_limits = 1`, the server calculates used space as `SUM(size_bytes) FROM Files WHERE uploaded_by = <user> AND is_deleted = 0`. If `used + new_file_size > upload_limit`, the request is rejected with `400` and any partially written file is removed.
- After successful write, the file is registered in the database using an upsert keyed on `internal_path`. If a soft‑deleted row already exists for the same path (e.g. the file was deleted earlier and is being re‑uploaded with the same name), the row is restored and refreshed instead of being ignored.
- On transient DB errors (5xx) the registration is retried up to 3 times. If all fail, the uploaded file is deleted.

**Response 201** (from `register_file`):
```json
{
  "success": true,
  "message": "Saved file successfully"
}
```
or `200` with `"File already registered"` if the stored row did not change (the upsert matched identical metadata).

**Errors:** `401` (no token), `403` (missing `can_upload`), `400` (invalid filename, quota exceeded, no file provided), `500`.

</details>

<details>
<summary><code>GET /api/files</code> – List accessible files</summary>

**Access:** authenticated

**Query parameters (all optional):**
- `name` – substring match (SQL `LIKE %...%`)
- `min_size`, `max_size` – bytes
- `start_date`, `end_date` – date part only (ISO‑8601, e.g., `2025-01-01`)
- `visibility` – filter by public/private status: `"public"` (only `is_public = 1`) or `"private"` (only `is_public = 0`)
- `uploaded_by` – user ID of the original uploader
- `limit` (default 25, max 100)
- `offset` (default 0)

**Visibility rules:** returns files where the authenticated user:
- is the owner, **or**
- is the uploader, **or**
- has an explicit `FilePermissions` entry, **or**
- the file is marked `is_public = 1`.

Additionally, the user’s own account must be active and not deleted (a self‑join ensures this).

Every row also includes `my_access`, the caller’s effective access level on that file: `"owner"`, `"collaborator"` or `"viewer"`. The frontend uses it to show/hide management actions (delete, share, toggle public) without having to guess. An uploader without `can_delete_own_files` gets `"viewer"` on their own files, matching the permission rules above.

**Response 200:**
```json
{
  "success": true,
  "message": "Files fetched",
  "data": {
    "items": [
      {
        "id": 77,
        "name": "report.pdf",
        "size_bytes": 123456,
        "internal_path": "2025/09/report.pdf",
        "mime_type": "application/pdf",
        "is_public": false,
        "uploaded_by": "alice",
        "uploaded_at": "2025-09-28T12:00:00Z",
        "my_access": "collaborator",
        "total_count": 42
      }
    ],
    "total": 42,
    "limit": 25,
    "offset": 0
  }
}
```

**Errors:** `401`, `500`.

</details>

<details>
<summary><code>DELETE /api/files/{id}</code> – Delete a file</summary>

**Access:** authenticated, requires `collaborator` level on the target file (see permission rules).

**Behaviour:**
- Soft‑delete: `UPDATE Files SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP`.
- The physical file on disk is removed.
- If the file record was already deleted, a `404` is returned.

**Response 200:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

**Errors:** `403` (insufficient permissions), `404`, `500`.

</details>

<details>
<summary><code>DELETE /api/files</code> – Batch delete files</summary>

**Access:** authenticated, requires `collaborator` level on each target file (see permission rules).

**Body:**
```json
{
  "ids": [77, 78, 79]
}
```
- Up to **500 ids** per request; duplicate ids are silently collapsed.
- Empty payload (`[]`) returns `400`.
- Each id is permission‑checked individually; the soft‑delete runs as a **single `UPDATE ... IN (...)` within one transaction**, then each physical file is removed (a failed physical removal is reported but is not fatal, matching the single‑delete semantics).
- If the file is already soft‑deleted (or does not exist), its status is `not_found` instead of failing the whole request.

**Response 200:**
```json
{
  "success": true,
  "message": "Files deleted: 2",
  "data": {
    "deleted": 2,
    "skipped": 2,
    "items": [
      { "id": 77, "status": "deleted" },
      { "id": 78, "status": "deleted" },
      { "id": 999, "status": "not_found" },
      { "id": 50, "status": "forbidden" }
    ]
  }
}
```
`status` is one of `deleted`, `not_found`, or `forbidden`. `skipped` counts ids that were neither found nor permitted.

**Errors:** `400` (empty or too many ids), `403` (may be reported per‑id via `forbidden`), `500`.

> [!TIP]
> Re‑deleting an already soft‑deleted file returns `not_found` per id — the frontend treats `not_found`/`forbidden` as skipped and never re‑sends the request, avoiding the repeated `404`s that happen when deleting one by one.

</details>

<details>
<summary><code>GET /api/files/download/{id}</code> – Download a file</summary>

**Access:** authenticated, requires at least `viewer` level.

**Response:** the file is streamed with `Content-Disposition: attachment; filename="..."`. The MIME type is determined from the file extension.

**Errors:** `403` (permission denied), `404` (file not found or deleted, or physical file missing), `500`.

</details>

<details>
<summary><code>PATCH /api/files/{id}/public</code> – Toggle public visibility</summary>

**Access:** authenticated, requires `collaborator` level on the file.

**Body:**
```json
{
  "is_public": true
}
```

**Behaviour:**
- Sets the `is_public` flag of the file to the given boolean value.
- Operates within a transaction to ensure consistency.

**Response 200:**
```json
{
  "success": true,
  "message": "File is now public"
}
```
or `"File is now private"` accordingly.

**Errors:** `403` (insufficient permissions), `404` (file not found), `500`.

</details>

### File Permissions

These endpoints manage the `FilePermissions` table. They all require authentication and that the requesting user has `collaborator` level on the target file.

<details>
<summary><code>POST /api/files/{id}/perms</code> – Grant/update permission</summary>

**Body:**
```json
{
  "user_id": 42,
  "access_level": "viewer"
}
```
`access_level` must be `"viewer"` or `"collaborator"`.

**Response 200:**
```json
{
  "success": true,
  "message": "Permission granted/updated",
  "data": {
    "user_id": 42,
    "username": "bob",
    "access_level": "viewer",
    "granted_at": "2025-09-28T12:35:00Z",
    "granted_by": 1
  }
}
```
If the `(file, user)` pair already exists, the level and `granted_by` are updated.

**Errors:** `400` (invalid level), `404` (target user not found), `403` (caller lacks collaborator rights), `500`.

</details>

<details>
<summary><code>GET /api/files/{id}/perms</code> – List all permissions on a file</summary>

**Response 200:**
```json
{
  "success": true,
  "message": "Permissions listed",
  "data": [
    {
      "user_id": 42,
      "username": "bob",
      "access_level": "collaborator",
      "granted_at": "2025-09-28T12:35:00Z",
      "granted_by": 1
    }
  ]
}
```

**Errors:** `403`, `500`.

</details>

<details>
<summary><code>DELETE /api/files/{id}/perms/{user_id}</code> – Revoke a permission</summary>

**Access:** caller must have `collaborator` level on file `{id}`.

**Response 200:**
```json
{
  "success": true,
  "message": "Permission revoked"
}
```

**Errors:** `403`, `404` (permission entry not found), `500`.

</details>

### User Management

All endpoints under `/api/user` require authentication. Some are restricted to the **owner** role (see individual descriptions), while others are accessible to any authenticated user.

<details>
<summary><code>GET /api/user/me</code> – Get current user profile</summary>

**Access:** authenticated (any role)

**Response 200:**
```json
{
  "success": true,
  "message": "User info retrieved",
  "data": {
    "id": 42,
    "username": "bob",
    "role": "visitor",
    "can_upload": true,
    "can_delete_own_files": false,
    "has_upload_limits": false,
    "upload_limit": 0
  }
}
```

**Errors:** `401` (not authenticated or user not found/inactive), `500`.

</details>

<details>
<summary><code>GET /api/user</code> – List users</summary>

**Access:** authenticated (any role; previously restricted to owner, now open to all authenticated users)

**Query parameters:**
- `name` – substring match
- `perm` – permission filter, e.g., `"can_upload:true"` or `"can_upload:true,can_delete_own_files:false"`
- `is_active` – boolean filter
- `include_deleted` – include soft‑deleted users (default `false`)
- `limit` (default 25, max 100)
- `offset` (default 0)

**Response 200:**
```json
{
  "success": true,
  "message": "Users fetched",
  "data": {
    "items": [
      {
        "id": 42,
        "username": "bob",
        "role": "visitor",
        "is_active": 1,
        "can_upload": 1,
        "can_delete_own_files": 0,
        "has_upload_limits": 0,
        "upload_limit": 0,
        "created_at": "2025-01-01T09:00:00Z",
        "last_login_at": "2025-09-27T18:00:00Z",
        "total_count": 5
      }
    ],
    "total": 5,
    "limit": 25,
    "offset": 0
  }
}
```

</details>

<details>
<summary><code>DELETE /api/user/{id}</code> – Soft‑delete a user (owner only)</summary>

- Cannot delete the owner (returns `400`).
- Sets `is_deleted = 1`, `deleted_at = now`, and `is_active = 0`.

**Response 200:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

</details>

<details>
<summary><code>POST /api/user/{id}/toggle</code> – Toggle active status (owner only)</summary>

Flips `is_active` from 1 to 0 or vice‑versa. The change is automatically logged in the audit trail via a database trigger.

**Response 200:**
```json
{
  "success": true,
  "message": "User status toggled successfully"
}
```

</details>

<details>
<summary><code>POST /api/user/{id}/perms</code> – Update user permissions (owner only)</summary>

**Body** (all fields optional, only provided fields are updated):
```json
{
  "can_upload": true,
  "can_delete_own_files": false,
  "has_upload_limits": false,
  "upload_limit": 0
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "User permissions updated successfully"
}
```

</details>

<details>
<summary><code>GET /api/user/{id}/accessible</code> – Files accessible by a user</summary>

**Access:** authenticated (any role). Useful for checking which files a particular user can see.

**Response 200:**
```json
{
  "success": true,
  "message": "Files fetched successfully",
  "data": [
    {
      "id": 77,
      "name": "report.pdf",
      "size_bytes": 123456,
      "mime_type": "application/pdf",
      "uploaded_by": 42,
      "uploaded_at": "2025-09-28T12:00:00Z",
      "access_type": "owner"
    }
  ]
}
```
`access_type` can be `"owner"`, `"viewer"`, or `"collaborator"`.

</details>

### Audit Logs

<details>
<summary><code>GET /api/audit</code> – Retrieve audit entries (owner only)</summary>

**Access:** owner only (`RoleAuth(["owner"])` + JWT)

**Query parameters (all optional):**
- `start`, `end` – ISO‑8601 timestamps (used as `>= start` and `<= end`)
- `user_id`, `file_id`
- `event_type` – exact match
- `success` – boolean
- `limit` (default 100, max 1000)
- `offset` (default 0)

**Response 200:**
```json
{
  "success": true,
  "message": "Audit entries retrieved",
  "data": [
    {
      "id": 123,
      "timestamp": "2025-09-28T12:34:56Z",
      "user_id": 42,
      "username": "alice",
      "event_type": "file_upload",
      "description": "Uploaded file report.pdf",
      "ip_address": "192.168.1.10",
      "file_id": 77,
      "file_name": "report.pdf",
      "success": true,
      "total_count": 15
    }
  ]
}
```

</details>

---

## Common Rules

- **Authentication:** unless marked as public, all endpoints require `Authorization: Bearer <token>`.
- **Pagination:** `limit` (max varies by resource) and `offset`. The response includes a `total` count or per‑row `total_count` for windowed pagination.
- **Error format:** every error response follows the canonical schema with `"success": false` and an appropriate HTTP status (`400`, `401`, `403`, `404`, `500`).
- **Soft‑deletes:** users and files are marked as deleted (`is_deleted = 1`) but remain in the database. File permissions are physically removed when revoked.

---

## Appendix: Canonical Response Schema

All responses (success or error) adhere to this JSON structure:

```json
{
  "success": true | false,
  "message": "optional human‑readable string",
  "data": { ... },
  "token": "present only on login",
  "exists": true/false  // used only by the DB status endpoint
}
```

Fields that are not relevant are omitted from the serialised output.
