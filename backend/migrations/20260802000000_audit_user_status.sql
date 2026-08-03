-- Log user active-status toggles so the audit trail reflects every change done
-- through the POST /api/user/{id}/toggle endpoint.

CREATE TRIGGER IF NOT EXISTS trg_audit_users_status_update
AFTER UPDATE OF is_active ON Users
WHEN OLD.is_active IS NOT NEW.is_active AND NEW.is_deleted = 0
BEGIN
    INSERT INTO AuditLog(user_id, event_type, description)
    VALUES (
        NEW.id,
        'USER_ACTIVE_UPDATE',
        'User status changed to ' || CASE
            WHEN NEW.is_active = 1 THEN 'active'
            ELSE 'inactive'
        END || ': ' || NEW.username
    );
END;