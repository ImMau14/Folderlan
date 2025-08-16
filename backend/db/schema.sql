PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner','visitor')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    expiration_date DATETIME,
    can_download BOOLEAN DEFAULT 0,
    can_upload BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    can_access_all_files BOOLEAN DEFAULT 0,
    can_edit BOOLEAN DEFAULT 0,
    can_delete BOOLEAN DEFAULT 0,
    -- soft-delete fields
    is_deleted INTEGER DEFAULT 0 NOT NULL CHECK(is_deleted IN (0,1)),
    deleted_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_username ON Users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON Users(is_deleted);

CREATE TABLE IF NOT EXISTS Files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    internal_path TEXT UNIQUE NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT,
    uploaded_by INTEGER NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    uploader_username TEXT,
    uploader_role TEXT,
    is_deleted INTEGER DEFAULT 0 NOT NULL CHECK(is_deleted IN (0,1)),
    deleted_at DATETIME,
    FOREIGN KEY (uploaded_by) REFERENCES Users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_files_internal_path ON Files(internal_path);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON Files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON Files(is_deleted);

CREATE TABLE IF NOT EXISTS FileVisibilityGrants (
    file_id INTEGER NOT NULL,
    visitor_id INTEGER NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER,
    PRIMARY KEY (file_id, visitor_id),
    FOREIGN KEY (file_id) REFERENCES Files(id) ON DELETE CASCADE,
    FOREIGN KEY (visitor_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES Users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fvg_visitor ON FileVisibilityGrants(visitor_id);
CREATE INDEX IF NOT EXISTS idx_fvg_file ON FileVisibilityGrants(file_id);

CREATE TABLE IF NOT EXISTS FileAccessOverrides (
    file_id INTEGER NOT NULL,
    visitor_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('view','download','edit','delete')),
    permission TEXT NOT NULL CHECK(permission IN ('allow','deny')),
    changed_by INTEGER,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (file_id, visitor_id, action),
    FOREIGN KEY (file_id) REFERENCES Files(id) ON DELETE CASCADE,
    FOREIGN KEY (visitor_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES Users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_o_visitor_action ON FileAccessOverrides(visitor_id, action);
CREATE INDEX IF NOT EXISTS idx_o_file_action ON FileAccessOverrides(file_id, action);

CREATE TABLE IF NOT EXISTS AuditLog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    description TEXT,
    ip_address TEXT,
    file_id INTEGER,
    success BOOLEAN,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
    FOREIGN KEY (file_id) REFERENCES Files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON AuditLog(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_file ON AuditLog(file_id);

CREATE TRIGGER IF NOT EXISTS trg_audit_override_insert
AFTER INSERT ON FileAccessOverrides
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, file_id, success)
  VALUES(
    NEW.changed_by,
    'PERMISSION_CHANGE',
    'OVERRIDE INSERT: visitor=' || NEW.visitor_id || ' action=' || NEW.action || ' perm=' || NEW.permission,
    NEW.file_id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_override_update
AFTER UPDATE ON FileAccessOverrides
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, file_id, success)
  VALUES(
    NEW.changed_by,
    'PERMISSION_CHANGE',
    'OVERRIDE UPDATE: visitor=' || NEW.visitor_id || ' action=' || NEW.action || ' perm=' || NEW.permission,
    NEW.file_id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_override_delete
AFTER DELETE ON FileAccessOverrides
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, file_id, success)
  VALUES(
    OLD.changed_by,
    'PERMISSION_CHANGE',
    'OVERRIDE DELETE: visitor=' || OLD.visitor_id || ' action=' || OLD.action || ' perm=' || OLD.permission,
    OLD.file_id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_fvg_insert
AFTER INSERT ON FileVisibilityGrants
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, file_id, success)
  VALUES(
    NEW.granted_by,
    'PERMISSION_CHANGE',
    'GRANT VISIBILITY: visitor=' || NEW.visitor_id,
    NEW.file_id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_fvg_delete
AFTER DELETE ON FileVisibilityGrants
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, file_id, success)
  VALUES(
    OLD.granted_by,
    'PERMISSION_CHANGE',
    'REVOKE VISIBILITY: visitor=' || OLD.visitor_id,
    OLD.file_id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_users_update
AFTER UPDATE OF can_access_all_files, can_download, can_edit, can_delete ON Users
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, success)
  VALUES(
    NEW.id,
    'USER_PERMISSIONS_UPDATE',
    'Updated global permission flags for user=' || NEW.id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_files_after_insert_snapshot_uploader
AFTER INSERT ON Files
BEGIN
  UPDATE Files
  SET
    uploader_username = COALESCE(NEW.uploader_username, (SELECT username FROM Users WHERE id = NEW.uploaded_by)),
    uploader_role = COALESCE(NEW.uploader_role, (SELECT role FROM Users WHERE id = NEW.uploaded_by))
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_user_soft_delete
AFTER UPDATE ON Users
WHEN OLD.is_deleted = 0 AND NEW.is_deleted = 1
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, success)
  VALUES(
    NEW.id,
    'USER_SOFT_DELETE',
    'User soft-deleted: ' || NEW.id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_user_restore
AFTER UPDATE ON Users
WHEN OLD.is_deleted = 1 AND NEW.is_deleted = 0
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, success)
  VALUES(
    NEW.id,
    'USER_RESTORE',
    'User restored from soft-delete: ' || NEW.id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_file_soft_delete
AFTER UPDATE ON Files
WHEN OLD.is_deleted = 0 AND NEW.is_deleted = 1
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, file_id, success)
  VALUES(
    NEW.uploaded_by,
    'FILE_SOFT_DELETE',
    'File soft-deleted: ' || NEW.id,
    NEW.id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_file_restore
AFTER UPDATE ON Files
WHEN OLD.is_deleted = 1 AND NEW.is_deleted = 0
BEGIN
  INSERT INTO AuditLog(user_id, event_type, description, file_id, success)
  VALUES(
    NEW.uploaded_by,
    'FILE_RESTORE',
    'File restored from soft-delete: ' || NEW.id,
    NEW.id,
    1
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_delete_users
BEFORE DELETE ON Users
BEGIN
  SELECT RAISE(ABORT, 'Physical DELETE on Users disallowed. Use UPDATE Users SET is_deleted=1 WHERE id=?;');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_delete_files
BEFORE DELETE ON Files
BEGIN
  SELECT RAISE(ABORT, 'Physical DELETE on Files disallowed. Use UPDATE Files SET is_deleted=1 WHERE id=?;');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_delete_fvg
BEFORE DELETE ON FileVisibilityGrants
BEGIN
  SELECT RAISE(ABORT, 'Physical DELETE on FileVisibilityGrants disallowed.');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_delete_overrides
BEFORE DELETE ON FileAccessOverrides
BEGIN
  SELECT RAISE(ABORT, 'Physical DELETE on FileAccessOverrides disallowed.');
END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_delete_auditlog
BEFORE DELETE ON AuditLog
BEGIN
  SELECT RAISE(ABORT, 'Physical DELETE on AuditLog disallowed.');
END;

CREATE VIEW IF NOT EXISTS ActiveUsers AS
SELECT * FROM Users WHERE is_deleted = 0;

CREATE VIEW IF NOT EXISTS ActiveFiles AS
SELECT * FROM Files WHERE is_deleted = 0;