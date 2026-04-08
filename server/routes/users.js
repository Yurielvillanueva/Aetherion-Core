const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getConnection } = require('../db');
const { ensurePermission, parsePermissions, resolvePermissions, logAuditEntry } = require('../security');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', '..', 'server.sqlite');
const manageUsersGuard = ensurePermission('can_manage_users');
const activityGuard = ensurePermission('can_view_activity_logs');

router.get('/', manageUsersGuard, (req, res) => {
  const db = getConnection(DB_PATH);
  db.all('SELECT id, username, email, role, permissions, isBanned, isMuted, isRestricted, createdAt FROM users ORDER BY createdAt DESC', [], (err, rows) => {
    db.close();
    if (err) {
      return res.status(500).json({ success: false, error: 'Unable to fetch users' });
    }
    const users = rows.map(user => ({
      ...user,
      permissions: resolvePermissions(user.role, parsePermissions(user.permissions))
    }));
    res.json({ success: true, users });
  });
});

router.post('/', manageUsersGuard, async (req, res) => {
  const { username, email, password, role = 'user', permissions = {} } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
  }
  if (!['admin', 'staff', 'user'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ success: false, error: 'Password must have at least 8 characters' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const mergedPermissions = resolvePermissions(role, permissions);
  const db = getConnection(DB_PATH);
  db.run(
    `INSERT INTO users (username, email, password, role, permissions)
     VALUES (?, ?, ?, ?, ?)`,
    [String(username).trim(), String(email).trim().toLowerCase(), hashedPassword, role, JSON.stringify(mergedPermissions)],
    function (err) {
      db.close();
      if (err) return res.status(400).json({ success: false, error: 'Username or email already exists' });
      logAuditEntry({
        actorUserId: req.session?.user?.id,
        actorUsername: req.session?.user?.username,
        action: 'user_create',
        targetType: 'user',
        targetId: String(this.lastID),
        details: { username, email, role },
        ip: req.ip
      });
      res.json({ success: true, userId: this.lastID });
    }
  );
});

router.put('/:id(\\d+)', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const { username, email } = req.body;
  if (!username || !email) {
    return res.status(400).json({ success: false, error: 'Username and email are required' });
  }
  const db = getConnection(DB_PATH);
  db.run('UPDATE users SET username = ?, email = ? WHERE id = ?', [String(username).trim(), String(email).trim().toLowerCase(), id], function (err) {
    db.close();
    if (err) return res.status(400).json({ success: false, error: 'Unable to update user' });
    if (!this.changes) return res.status(404).json({ success: false, error: 'User not found' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_edit',
      targetType: 'user',
      targetId: String(id),
      details: { username, email },
      ip: req.ip
    });
    res.json({ success: true, updated: this.changes });
  });
});

router.put('/:id(\\d+)/role', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'staff', 'user'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Invalid role' });
  }
  const currentUserId = req.session?.user?.id;
  if (Number(currentUserId) === Number(id)) {
    return res.status(400).json({ success: false, error: 'You cannot change your own role while logged in' });
  }
  const db = getConnection(DB_PATH);
  db.get('SELECT permissions FROM users WHERE id = ?', [id], (readErr, user) => {
    if (readErr || !user) {
      db.close();
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const mergedPermissions = resolvePermissions(role, parsePermissions(user.permissions));
    db.run('UPDATE users SET role = ?, permissions = ? WHERE id = ?', [role, JSON.stringify(mergedPermissions), id], function (err) {
      db.close();
      if (err) return res.status(500).json({ success: false, error: 'Unable to update role' });
      logAuditEntry({
        actorUserId: req.session?.user?.id,
        actorUsername: req.session?.user?.username,
        action: 'user_role_change',
        targetType: 'user',
        targetId: String(id),
        details: { role },
        ip: req.ip
      });
      res.json({ success: true, updated: this.changes });
    });
  });
});

router.post('/:id(\\d+)/ban', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const db = getConnection(DB_PATH);
  db.run('UPDATE users SET isBanned = 1 WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to ban user' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_ban',
      targetType: 'user',
      targetId: String(id),
      ip: req.ip
    });
    res.json({ success: true, updated: this.changes });
  });
});

router.post('/:id(\\d+)/unban', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const db = getConnection(DB_PATH);
  db.run('UPDATE users SET isBanned = 0 WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to unban user' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_unban',
      targetType: 'user',
      targetId: String(id),
      ip: req.ip
    });
    res.json({ success: true, updated: this.changes });
  });
});

router.post('/:id(\\d+)/mute', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const db = getConnection(DB_PATH);
  db.run('UPDATE users SET isMuted = 1 WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to mute user' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_mute',
      targetType: 'user',
      targetId: String(id),
      ip: req.ip
    });
    res.json({ success: true, updated: this.changes });
  });
});

router.post('/:id(\\d+)/unmute', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const db = getConnection(DB_PATH);
  db.run('UPDATE users SET isMuted = 0 WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to unmute user' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_unmute',
      targetType: 'user',
      targetId: String(id),
      ip: req.ip
    });
    res.json({ success: true, updated: this.changes });
  });
});

router.post('/:id(\\d+)/restrict', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const db = getConnection(DB_PATH);
  db.run('UPDATE users SET isRestricted = 1 WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to restrict user' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_restrict',
      targetType: 'user',
      targetId: String(id),
      ip: req.ip
    });
    res.json({ success: true, updated: this.changes });
  });
});

router.post('/:id(\\d+)/unrestrict', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const db = getConnection(DB_PATH);
  db.run('UPDATE users SET isRestricted = 0 WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to remove restriction' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_unrestrict',
      targetType: 'user',
      targetId: String(id),
      ip: req.ip
    });
    res.json({ success: true, updated: this.changes });
  });
});

router.put('/:id(\\d+)/permissions', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ success: false, error: 'Permissions object is required' });
  }
  const db = getConnection(DB_PATH);
  db.get('SELECT role FROM users WHERE id = ?', [id], (readErr, user) => {
    if (readErr || !user) {
      db.close();
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const mergedPermissions = resolvePermissions(user.role, permissions);
    db.run('UPDATE users SET permissions = ? WHERE id = ?', [JSON.stringify(mergedPermissions), id], function (err) {
      db.close();
      if (err) return res.status(500).json({ success: false, error: 'Unable to update permissions' });
      logAuditEntry({
        actorUserId: req.session?.user?.id,
        actorUsername: req.session?.user?.username,
        action: 'user_permissions_update',
        targetType: 'user',
        targetId: String(id),
        details: mergedPermissions,
        ip: req.ip
      });
      res.json({ success: true, updated: this.changes });
    });
  });
});

router.post('/:id(\\d+)/reset-password', manageUsersGuard, async (req, res) => {
  const { id } = req.params;
  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  const db = getConnection(DB_PATH);
  db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to reset password' });
    if (!this.changes) return res.status(404).json({ success: false, error: 'User not found' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_password_reset',
      targetType: 'user',
      targetId: String(id),
      ip: req.ip
    });
    res.json({ success: true, tempPassword });
  });
});

router.delete('/:id(\\d+)', manageUsersGuard, (req, res) => {
  const { id } = req.params;
  const currentUserId = req.session?.user?.id;
  if (Number(currentUserId) === Number(id)) {
    return res.status(400).json({ success: false, error: 'You cannot delete your own account while logged in' });
  }
  const db = getConnection(DB_PATH);
  db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to delete user' });
    if (!this.changes) return res.status(404).json({ success: false, error: 'User not found or already deleted' });
    logAuditEntry({
      actorUserId: req.session?.user?.id,
      actorUsername: req.session?.user?.username,
      action: 'user_delete',
      targetType: 'user',
      targetId: String(id),
      ip: req.ip
    });
    res.json({ success: true, deleted: this.changes });
  });
});

router.get('/activity/audit', activityGuard, (req, res) => {
  const db = getConnection(DB_PATH);
  db.all(
    `SELECT id, actorUserId, actorUsername, action, targetType, targetId, details, ip, createdAt
     FROM audit_logs ORDER BY id DESC LIMIT 300`,
    [],
    (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ success: false, error: 'Unable to fetch audit logs' });
      res.json({ success: true, logs: rows });
    }
  );
});

router.get('/activity/login-history', activityGuard, (req, res) => {
  const db = getConnection(DB_PATH);
  db.all(
    `SELECT id, userId, email, ip, userAgent, success, reason, createdAt
     FROM login_history ORDER BY id DESC LIMIT 300`,
    [],
    (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ success: false, error: 'Unable to fetch login history' });
      res.json({ success: true, entries: rows });
    }
  );
});

module.exports = router;
