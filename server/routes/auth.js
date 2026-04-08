const express = require('express');
const bcrypt = require('bcrypt');
const path = require('path');
const RateLimit = require('express-rate-limit');
const { getConnection } = require('../db');
const { loginLimiter } = require('../middleware/rateLimit');
const { getDefaultPermissions, parsePermissions, resolvePermissions, logLoginAttempt } = require('../security');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', '..', 'server.sqlite');

const signupLimiter = RateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many accounts created, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

router.post('/signup', signupLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  if (!isValidUsername(username)) {
    return res.status(400).json({ success: false, error: 'Username must be 3-20 characters, alphanumeric only' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format' });
  }

  if (password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must have at least 8 characters' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const db = getConnection(DB_PATH);
  db.run(
    'INSERT INTO users (username, email, password, role, permissions) VALUES (?, ?, ?, ?, ?)',
    [username.trim(), email.trim().toLowerCase(), hashedPassword, 'user', JSON.stringify(getDefaultPermissions('user'))],
    function (err) {
      db.close();
    if (err) {
      return res.status(400).json({ success: false, error: 'Username or email already exists' });
    }
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Session error' });
      }
      req.session.user = {
        id: this.lastID,
        username,
        email,
        role: 'user',
        permissions: getDefaultPermissions('user')
      };
      res.json({ success: true, user: req.session.user });
    });
    }
  );
});

router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    logLoginAttempt({
      email: email ? email.trim().toLowerCase() : null,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      success: false,
      reason: 'missing_credentials'
    });
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }
  const db = getConnection(DB_PATH);
  db.get('SELECT id, username, email, password, role, permissions, isBanned, isMuted, isRestricted FROM users WHERE email = ?', [email.trim().toLowerCase()], async (err, user) => {
    db.close();
    if (err || !user) {
      logLoginAttempt({
        email: email.trim().toLowerCase(),
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        reason: 'invalid_credentials'
      });
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }
    if (user.isBanned) {
      logLoginAttempt({
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        reason: 'banned'
      });
      return res.status(403).json({ success: false, error: 'Your account is banned' });
    }
    if (user.isRestricted) {
      logLoginAttempt({
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        reason: 'restricted'
      });
      return res.status(403).json({ success: false, error: 'Your account access is restricted' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      logLoginAttempt({
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: false,
        reason: 'invalid_credentials'
      });
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Session error' });
      }
      const overrides = parsePermissions(user.permissions);
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isMuted: Boolean(user.isMuted),
        isRestricted: Boolean(user.isRestricted),
        permissions: resolvePermissions(user.role, overrides)
      };
      logLoginAttempt({
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        success: true,
        reason: 'login_success'
      });
      res.json({ success: true, user: req.session.user });
    });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(200).json({ success: true, user: null });
  }
  res.json({ success: true, user: req.session.user });
});

module.exports = router;
