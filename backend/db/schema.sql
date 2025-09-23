PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'visitor')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    is_active BOOLEAN DEFAULT 1,
    can_upload BOOLEAN DEFAULT 0,
    can_delete_own_files BOOLEAN DEFAULT 0,
    has_upload_limits BOOLEAN DEFAULT 0,
    upload_limit INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT 0 CHECK(is_deleted IN (0, 1)),
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_username ON Users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON Users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON Users(is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_active ON Users(is_active) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS Files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    internal_path TEXT UNIQUE NOT NULL,
    size_bytes INTEGER DEFAULT 0,
    mime_type TEXT,
    uploaded_by INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT 0 CHECK(is_deleted IN (0, 1)),
    is_public BOOLEAN DEFAULT 0,
    deleted_at DATETIME,
    FOREIGN KEY (uploaded_by) REFERENCES Users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_files_internal_path ON Files(internal_path);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON Files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON Files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON Files(uploaded_at);

CREATE TABLE IF NOT EXISTS FilePermissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    access_level TEXT NOT NULL CHECK(access_level IN ('viewer', 'collaborator')),
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    UNIQUE(file_id, user_id),
    FOREIGN KEY (file_id) REFERENCES Files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES Users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fileperms_user ON FilePermissions(user_id);
CREATE INDEX IF NOT EXISTS idx_fileperms_file ON FilePermissions(file_id);
CREATE INDEX IF NOT EXISTS idx_fileperms_user_file ON FilePermissions(user_id, file_id);

CREATE TABLE IF NOT EXISTS AuditLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    description TEXT,
    ip_address TEXT,
    file_id INTEGER,
    success BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
    FOREIGN KEY (file_id) REFERENCES Files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON AuditLog(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_file ON AuditLog(file_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON AuditLog(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON AuditLog(event_type);

CREATE TRIGGER IF NOT EXISTS trg_enforce_single_owner
BEFORE INSERT ON Users
WHEN NEW.role = 'owner'
BEGIN
    SELECT CASE
        WHEN (SELECT COUNT(*) FROM Users WHERE role = 'owner' AND is_deleted = 0) > 0
        THEN RAISE(ABORT, 'There can only be one owner')
    END;
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_perms_insert
AFTER INSERT ON FilePermissions
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description, file_id)
    VALUES (
        NEW.granted_by, 
        'PERMISSION_GRANT', 
        'Access level ' || NEW.access_level || ' granted to user ' || NEW.user_id || ' for file ' || NEW.file_id,
        NEW.file_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_perms_update
AFTER UPDATE OF access_level ON FilePermissions
WHEN OLD.access_level IS NOT NEW.access_level
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description, file_id)
    VALUES (
        NEW.granted_by, 
        'PERMISSION_UPDATE', 
        'Access level changed to ' || NEW.access_level || ' for user ' || NEW.user_id || ' on file ' || NEW.file_id,
        NEW.file_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_perms_delete
AFTER DELETE ON FilePermissions
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description, file_id)
    VALUES (
        OLD.granted_by, 
        'PERMISSION_REVOKE', 
        'Permissions revoked from user ' || OLD.user_id || ' for file ' || OLD.file_id,
        OLD.file_id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_users_perm_update
AFTER UPDATE OF can_upload, can_delete_own_files ON Users
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description)
    VALUES (
        NEW.id, 
        'USER_PERM_UPDATE', 
        'Global permissions updated for user ' || NEW.username
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_user_soft_delete
AFTER UPDATE OF is_deleted ON Users
WHEN OLD.is_deleted = 0 AND NEW.is_deleted = 1
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description)
    VALUES (
        NEW.id, 
        'USER_SOFT_DELETE', 
        'User soft deleted: ' || NEW.username
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_user_restore
AFTER UPDATE OF is_deleted ON Users
WHEN OLD.is_deleted = 1 AND NEW.is_deleted = 0
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description)
    VALUES (
        NEW.id, 
        'USER_RESTORE', 
        'User restored: ' || NEW.username
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_file_soft_delete
AFTER UPDATE OF is_deleted ON Files
WHEN OLD.is_deleted = 0 AND NEW.is_deleted = 1
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description, file_id)
    VALUES (
        NEW.uploaded_by, 
        'FILE_SOFT_DELETE', 
        'File soft deleted: ' || NEW.name,
        NEW.id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_file_restore
AFTER UPDATE OF is_deleted ON Files
WHEN OLD.is_deleted = 1 AND NEW.is_deleted = 0
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description, file_id)
    VALUES (
        NEW.uploaded_by, 
        'FILE_RESTORE', 
        'File restored: ' || NEW.name,
        NEW.id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_delete_users
BEFORE DELETE ON Users
BEGIN
    SELECT RAISE(ABORT, 'Physical DELETE on Users is not allowed. Use soft delete instead.');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_delete_files
BEFORE DELETE ON Files
BEGIN
    SELECT RAISE(ABORT, 'Physical DELETE on Files is not allowed. Use soft delete instead.');
END;

DROP VIEW IF EXISTS UserFilePermissions;
CREATE VIEW IF NOT EXISTS ActiveUsers AS
SELECT id, username, role, can_upload, can_delete_own_files, has_upload_limits, upload_limit 
FROM Users WHERE is_deleted = 0 AND is_active = 1;

CREATE VIEW IF NOT EXISTS ActiveFiles AS
SELECT id, name, size_bytes, mime_type, uploaded_by, uploaded_at 
FROM Files WHERE is_deleted = 0;
