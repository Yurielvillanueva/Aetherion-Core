const path = require('path');
const { getConnection } = require('../db');

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required' });
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Admin access required' });
}

function ensureStaffOrAdmin(req, res, next) {
  if (req.session && req.session.user) {
    const role = req.session.user.role;
    if (role === 'admin' || role === 'staff') {
      return next();
    }
  }
  return res.status(403).json({ success: false, error: 'Staff or admin access required' });
}

function ensureSecureSession(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/login.html');
}

function getUserBySession(req, callback) {
  if (!req.session || !req.session.user) {
    callback(null, null);
    return;
  }
  const db = getConnection(path.join(__dirname, '..', '..', 'server.sqlite'));
  db.get('SELECT id, username, email, role, isBanned FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
    db.close();
    if (err) return callback(err);
    callback(null, user);
  });
}

module.exports = {
  ensureAuthenticated,
  ensureAdmin,
  ensureStaffOrAdmin,
  ensureSecureSession,
  getUserBySession
};
