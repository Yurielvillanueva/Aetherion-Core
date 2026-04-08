const express = require('express');
const path = require('path');
const { getConnection } = require('../db');
const { ensureAdmin } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', '..', 'server.sqlite');

router.get('/', (req, res) => {
  const db = getConnection(DB_PATH);
  db.all('SELECT * FROM staff ORDER BY role, username', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to fetch staff list' });
    res.json({ success: true, staff: rows });
  });
});

router.post('/', ensureAdmin, (req, res) => {
  const { username, role, avatar } = req.body;
  if (!username || !role || !avatar) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  const db = getConnection(DB_PATH);
  db.run('INSERT INTO staff (username, role, avatar) VALUES (?, ?, ?)', [username.trim(), role.trim(), avatar.trim()], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to create staff member' });
    res.json({ success: true, staffId: this.lastID });
  });
});

router.put('/:id', ensureAdmin, (req, res) => {
  const { id } = req.params;
  const { username, role, avatar } = req.body;
  if (!username || !role || !avatar) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  const db = getConnection(DB_PATH);
  db.run('UPDATE staff SET username = ?, role = ?, avatar = ? WHERE id = ?', [username.trim(), role.trim(), avatar.trim(), id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to update staff member' });
    res.json({ success: true, updated: this.changes });
  });
});

router.delete('/:id', ensureAdmin, (req, res) => {
  const { id } = req.params;
  const db = getConnection(DB_PATH);
  db.run('DELETE FROM staff WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to remove staff member' });
    res.json({ success: true, deleted: this.changes });
  });
});

module.exports = router;
