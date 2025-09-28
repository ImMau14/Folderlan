# Folderlan 1.0.0 — Backend Documentation

![Rust](https://img.shields.io/badge/Rust-393127?style=for-the-badge&logo=rust)
![Actix-web](https://img.shields.io/badge/Actix--Web-2d2d2d?style=for-the-badge&logo=actix)
![SQLite](https://img.shields.io/badge/SQLite-272939?style=for-the-badge&logo=sqlite)

---

## Table of contents

1. [Quick start](#quick-start)  
2. [Build & run (developer steps)](#build--run-developer-steps)  
3. [Configuration — Environment variables](#configuration--environment-variables-explanation-only)  
   - [Main server variables](#main-server-variables)  
   - [Watcher variables](#watcher-variables)  
4. [File system watcher](#file-system-watcher-concise)  
   - [Pipeline](#pipeline)  
   - [Guarantees & features](#guarantees--features)  
5. [API reference](#api-reference-precise--unambiguous)  
   - [Database management](#database-management)  
   - [Authentication](#authentication)  
   - [Audit logs](#audit-logs)  
   - [File management](#file-management)  
   - [User management](#user-management)  
6. [Common rules: auth / pagination / errors](#common-rules-auth--pagination--errors)  
7. [Appendix: canonical response schemas](#appendix-canonical-response-schemas)  

---

# Quick start
1. Clone repo and go to backend:

  ```bash
  cd backend
  ```

2. Build or run:

  ```bash
  cargo build            # or cargo run
  cargo build --release  # for optimized binary
  ```

3. First run will:

  * Create the SQLite file (default `db/app.db`);
  * Create `uploads` directory;
  * Require creating a single **owner** account (use local-only owner registration endpoint).

4. Configure runtime via environment variables (see [Configuration](#configuration--environment-variables-explanation-only)).

---

# Build & run (developer steps)

1. Change dir:

  ```bash
  cd backend
  ```

2. Debug build & run:

  ```bash
  cargo run
  ```

3. Release build:

  ```bash
  cargo build --release
  ./target/release/backend # Or backend.exe on Windows
  ```

---

# Configuration — Environment variables

## Main server variables

| Name          |          Type |                 Default | Purpose / Notes                                                                       |
| :-----------: | :-----------: | :---------------------: | ------------------------------------------------------------------------------------- |
| `OFF_CORS`    |       boolean |                 `false` | If `true`, modifies CORS builder behavior. Set to `true` for restricted environments. |
| `PORT`        |       integer |                  `8080` | TCP port to bind server.                                                              |
| `ADDRESS`     |        string |               `0.0.0.0` | Bind address. Use `127.0.0.1` for local-only.                                         |
| `SQLITE_FILE` | string (path) |             `db/app.db` | SQLite DB file path. Parent dirs are created automatically.                           |
| `SECRET_JWT`  |        string | `"12345"` (dev default) | JWT signing secret. **Change in production.**                                         |

**Usage:** set env vars in shell, systemd, or container env. Example:

```bash
export PORT=8080
export SECRET_JWT="change-me"
```

## Watcher variables

| Name                          |    Type | Typical value | Purpose                                             |
| :---------------------------: | :-----: | :-----------: | --------------------------------------------------- |
| `WATCHER_IGNORE_TTL_SECS`     | integer |          `30` | Avoid reprocessing same file for this many seconds. |
| `WATCHER_STABILITY_CHECK_MS`  | integer |         `300` | Milliseconds between file size checks.              |
| `WATCHER_STABILITY_REQUIRED`  | integer |           `3` | Required number of stable checks before processing. |
| `WATCHER_LOCK_TTL_SECS`       | integer |         `300` | TTL for cleaning idle per-file locks.               |
| `WATCHER_PRUNE_INTERVAL_SECS` | integer |          `10` | Cleanup frequency for internal structures.          |
| `WATCHER_CHANNEL_CAPACITY`    | integer |          `64` | Internal event channel capacity.                    |

**Note:** increase stability values for remote filesystems (NFS/SMB).

---

# File system watcher

## Purpose

Monitors `uploads` folder, detects finished file writes, and registers changes in the DB (or logs them if DB unavailable).

## Pipeline

1. **Event received** (create/modify/remove).
2. **Filter**: ignore directories and configured tmp-subdir.
3. **Stability checks**: poll size until it stops growing (configurable).
4. **Acquire per-file lock** (async mutex).
5. **Register**: insert/update/delete DB record with metadata (size, mime, owner).
6. **Mark processed** (in-memory TTL) to avoid immediate reprocessing.

## Guarantees & features

* Duplicate events are suppressed via short TTL.
* Temporary subdirectory (e.g., `tmp`) is ignored to avoid partial uploads.
* Per-file locks avoid race conditions for concurrent events.
* When DB is unavailable, watcher falls back to log-only mode (does not crash server).
* Metrics: internal counters and periodic logs for observability.

---

# API reference

## Database management

### GET `/api/db` — Check database existence

* **Access**: Local-only (request must originate from server host / `127.0.0.1` or equivalent LocalOnly middleware).
* **Method**: `GET`
* **Headers**: none
* **Query**: none
* **Body**: none
* **Response (200)**:

  ```json
  { 
    "success": bool,
    "message": string,
    "exists": bool
  }
  ```
* **Errors**: `500` when db aren't initialized.

### POST `/api/db` — Initialize database

* **Access**: Local-only
* **Method**: `POST`
* **Body**: none
* **Response (200)**:

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```
* **Errors**: `500` on schema execution or file read error.

---

## Authentication

### POST `/api/auth/login`

* **Access**: public
* **Method**: `POST`
* **Headers**: `Content-Type: application/json`
* **Body (required)**:

  ```json
  {
    "username": string, 
    "password": string
  }
  ```

* **Response (200)**:

  ```json
  { 
    "success": bool,
    "message": string,
    "token": string
  }
  ```
  
* **Notes**: token expires in 1 hour.
* **Errors**: `401` invalid credentials, `500` server error.

### POST `/api/auth/register` — Register visitor

* **Access**: Owner (must include `Authorization: Bearer <token>`)
* **Method**: `POST`
* **Headers**: `Authorization`, `Content-Type: application/json`
* **Body (required)**:

  ```json
  { 
    "username": string,
    "password": string,
    "can_upload": bool,
    "can_delete_own_files": bool,
    "has_upload_limits": bool,
    "upload_limit": int
  }
  ```
* **Response (200)**:

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```

* **Errors**: `400` invalid input, `403` insufficient perms, `500` DB error.

### POST `/api/auth/owner_register` — Register owner (local-only)

* **Access**: Local-only
* **Method**: `POST`
* **Body**:

  ```json
  { 
    "username":"string, 
    "password": string
  }
  ```

* **Response**: same as visitor register.

### POST `/api/auth/owner_reset_password` — Reset owner password (local-only)

* **Access**: Local-only
* **Method**: `POST`
* **Body**:

  ```json
  { 
    "password": string
  }
  ```
* **Response**: 

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```

* **Errors**: `500` if owner not found.

### POST `/api/auth/visitor_reset_password` — Reset visitor password (owner only)

* **Access**: Owner
* **Method**: `POST`
* **Headers**: `Authorization`, `Content-Type: application/json`
* **Body**:

  ```json
  { 
    "username": string, 
    "password": string
  }
  ```
  
* **Response**: 

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```

* **Errors**: `404` visitor not found, `400` invalid.

---

## Audit logs

### GET `/api/audit`

* **Access**: Owner only
* **Method**: `GET`
* **Headers**: `Authorization: Bearer <token>`
* **Query params**:

  * `start` (ISO-8601 string, optional)
  * `end` (ISO-8601 string, optional)
  * `user_id` (integer, optional)
  * `file_id` (integer, optional)
  * `event_type` (string, optional)
  * `success` (boolean, optional)
  * `limit` (integer, optional, default 100, max 1000)
  * `offset` (integer, optional, default 0)
* **Response (200)**:

  ```json
  {
    "message": string,
    "data": [
      {
        "id": int,
        "timestamp": string,
        "user_id": int,
        "username": string,
        "event_type": string,
        "description": string,
        "ip_address": string,
        "file_id": int,
        "file_name": string,
        "success": bool
      }
    ]
  }
  ```

---

## File management

All file endpoints require `Authorization: Bearer <token>` and appropriate permissions.

### POST `/api/files/upload` — Chunked file upload

* **Permission required**: `can_upload`
* **Method**: `POST`
* **Headers**: `Authorization`, `Content-Type: multipart/form-data`
* **Multipart fields**:

  * `metadata` (JSON string) — **required**

    ```json
    {
      "file_id": string,       // unique client-side id for this file
      "chunk_index": int,      // zero-based integer
      "total_chunks: int,      // integer > 0
      "chunk_size": int,       // integer: bytes
      "total_size": int,       // integer: bytes total
      "filename": string       // string
    }
    ```

  * `chunk` — binary chunk (required)

* **Behavior**:

  * Server validates metadata and assembles chunks when all are received.
  * On finalization, file is stored under `uploads` and DB row created/updated.

* **Response (200)**:

  ```json
  { 
    "success": bool,
    "message": string
  }
  ```

* **Errors**: `400` invalid metadata, `403` permission denied, `500` storage/db error.

### GET `/api/files` — List files

* **Method**: `GET`
* **Query params**:

  * `name` (string, optional) — substring match
  * `min_size` (integer, optional, bytes)
  * `max_size` (integer, optional, bytes)
  * `start_date` / `end_date` (ISO-8601, optional)
  * `limit` (integer, default 25, max 100)
  * `offset` (integer, default 0)

* **Response (200)**:

  ```json
  { 
    "message": "Files retrieved", 
    "data": { 
      "items": [ 
        {
          "id": int,
          "name": string,
          "size_bytes": int,
          "internal_path:" string,
          "mime_type": string,
          "uploaded_by": string,
          "is_public": bool,
          "uploaded_at": string,
          "total_count": int,
        }
      ], 
      "total": int,
      "limit": int, 
      "offset": int 
    } 
  }
  ```

### DELETE `/api/files/{id}` — Delete file

* **Method**: `DELETE`
* **URL param**: `id` (integer)
* **Response**: 

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```

* **Errors**: `403` no permission, `404` not found, `500` server error.

### GET `/api/files/download/{id}` — Download file

* **Method**: `GET`
* **URL param**: `id` (integer)
* **Response**: raw file stream with `Content-Disposition: attachment; filename="..."`.
* **Errors**: `403` permission, `404` not found.

### POST `/api/files/{id}/perms` — Grant/update permission

* **Method**: `POST`
* **URL param**: `id` (integer)
* **Body**:

  ```json
  { 
    "user_id": int, 
    "access_level": string // access_level ∈ {"viewer", "collaborator"}
  }
  ```

* **Response (200)**:

  ```json
  { 
    "success": bool
    "message": string,
    "data": { 
      "user_id": int, 
      "username": string, 
      "access_level": string, // access_level ∈ {"viewer", "collaborator"}
      "granted_at": string, 
      "granted_by": int 
    } 
  }
  ```

* **Errors**: `400` invalid access level, `404` user/file missing, `403` insufficient perms.

### GET `/api/files/{id}/perms` — List permissions

* **Method**: `GET`
* **URL param**: `id` (integer)
* **Response**:

  ```json
  { 
    "success": bool,
    "message": string, 
    "data": [ 
      { 
        "user_id": int, 
        "username": string, 
        "access_level": string,  // access_level ∈ {"viewer", "collaborator"}
        "granted_at": string, 
        "granted_by": int
      } 
    ] 
  }
  ```

### DELETE `/api/files/{id}/perms/{user_id}` — Revoke permission

* **Method**: `DELETE`
* **URL params**: `id` (file id integer), `user_id` (integer)
* **Response**: 

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```

---

## User management

### GET `/api/user` — List users

* **Access**: Owner only
* **Method**: `GET`
* **Query params**:

  * `name` (string)
  * `perm` (string filter)
  * `is_active` (boolean)
  * `include_deleted` (boolean),
  * `limit` (int) 
  * `offset` (int)

* **Response**: paginated list of users. Each item:

  ```json
  {
    "success": bool,
    "message": string,
    "data": [
      {
        "id": int,
        "username": string,
        "role": string,     // owner|visitor
        "is_active": int,
        "can_upload": int,
        "can_delete_own_files": int,
        "has_upload_limits": int,
        "upload_limit": int,
        "created_at": string,
        "last_login_at": string
      }
    ]
  }
  ```

### DELETE `/api/user/{id}` — Soft-delete user

* **Access**: Owner only (cannot delete owner user)
* **Method**: `DELETE`
* **Response**: 

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```

* **Errors**: `400` cannot delete owner, `404` not found.

### POST `/api/user/{id}/toggle` — Toggle active status

* **Access**: Owner only
* **Response**: 

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```

### POST `/api/user/{id}/perms` — Update user permissions

* **Access**: Owner only
* **Body**:

  ```json
  { 
    "can_upload": true, 
    "can_delete_own_files": true, 
    "has_upload_limits": true, 
    "upload_limit": 1000000 
  }
  ```

* **Response**: 

  ```json
  {
    "success": bool,
    "message": string,
  }
  ```

### GET `/api/user/{id}/accessible` — Files a user can access

* **Access**: Owner or authorized token
* **Response**: list of file objects with `access_type` ∈ `{"owner","viewer","collaborator"}`.

  ```json
  {
    "success": bool,
    "message": string,
    "data": [
      {
        "id": int,
        "name": string,
        "size_bytes": int,
        "mime_type": string, // Optional
        "uploaded_by": int,
        "uploaded_at": string,
        "access_type": string, 
      }
    ]
  }
  ```

---

# Common rules: auth / pagination / errors

* **Auth header**: `Authorization: Bearer <your_jwt_token>`
* **Token TTL**: 1 hour (issued by `/api/auth/login`).
* **Pagination**: `limit` & `offset`. Respect endpoint max limits.
* **Errors**: Standard HTTP codes:

  * `200` OK, `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `500` Internal Server Error.
* **All timestamps** must be ISO-8601 strings in responses.

---

# Appendix — canonical response schemas

## Common response wrapper

```json
{
  "message": string,
  "data": generic_type, // optional
  "token": string,      // for auth only
  "exists": bool        // endpoint-specific
}
```