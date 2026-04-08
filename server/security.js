const path = require('path');
const { getConnection } = require('./db');

const DB_PATH = path.join(__dirname, '..', 'server.sqlite');

const ROLE_PERMISSIONS = {
  admin: {
    can_view_console: true,
    can_edit_files: true,
    can_manage_users: true,
    can_view_activity_logs: true
  },
  staff: {
    can_view_console: true,
    can_edit_files: false,
    can_manage_users: false,
    can_view_activity_logs: true
  },
  user: {
    can_view_console: false,
    can_edit_files: false,
    can_manage_users: false,
    can_view_activity_logs: false
  }
};

function getDefaultPermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user;
}

function resolvePermissions(role, overrides) {
  return { ...getDefaultPermissions(role), ...(overrides || {}) };
}

function parsePermissions(rawPermissions) {
  if (!rawPermissions) return {};
  try {
    const parsed = JSON.parse(rawPermissions);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch (error) {
    return {};
  }
}

function ensurePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const { role, permissions } = req.session.user;
    const resolved = resolvePermissions(role, permissions);
    if (resolved[permissionKey]) return next();
    return res.status(403).json({ success: false, error: `Missing permission: ${permissionKey}` });
  };
}

function logAuditEntry({ actorUserId, actorUsername, action, targetType, targetId, details, ip }) {
  const db = getConnection(DB_PATH);
  const payload = details ? JSON.stringify(details) : null;
  db.run(
    `INSERT INTO audit_logs (actorUserId, actorUsername, action, targetType, targetId, details, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [actorUserId || null, actorUsername || null, action, targetType || null, targetId || null, payload, ip || null],
    () => db.close()
  );
}

function logLoginAttempt({ userId, email, ip, userAgent, success, reason }) {
  const db = getConnection(DB_PATH);
  db.run(
    `INSERT INTO login_history (userId, email, ip, userAgent, success, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId || null, email || null, ip || null, userAgent || null, success ? 1 : 0, reason || null],
    () => db.close()
  );
}

module.exports = {
  ensurePermission,
  getDefaultPermissions,
  parsePermissions,
  resolvePermissions,
  logAuditEntry,
  logLoginAttempt
};
