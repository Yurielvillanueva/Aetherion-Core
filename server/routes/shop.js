const express = require('express');
const path = require('path');
const { getConnection } = require('../db');
const { ensureAdmin } = require('../middleware/auth');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', '..', 'server.sqlite');
const categories = ['ranks', 'items', 'kits'];

router.get('/', (req, res) => {
  const db = getConnection(DB_PATH);
  db.all('SELECT * FROM shop ORDER BY category, name', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to fetch shop items' });
    res.json({ success: true, items: rows });
  });
});

router.get('/:category', (req, res) => {
  const category = req.params.category.toLowerCase();
  if (!categories.includes(category)) {
    return res.status(400).json({ success: false, error: 'Invalid category' });
  }
  const db = getConnection(DB_PATH);
  db.all('SELECT * FROM shop WHERE category = ? ORDER BY name', [category], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to fetch category items' });
    res.json({ success: true, items: rows });
  });
});

router.post('/', ensureAdmin, (req, res) => {
  const { name, category, price, description } = req.body;
  if (!name || !category || !price || !description) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  if (!categories.includes(category.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Category must be ranks, items, or kits' });
  }
  const parsedPrice = parseInt(price, 10);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ success: false, error: 'Price must be a positive number' });
  }
  const db = getConnection(DB_PATH);
  db.run('INSERT INTO shop (name, category, price, description) VALUES (?, ?, ?, ?)', [name.trim(), category.toLowerCase(), parsedPrice, description.trim()], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to create shop item' });
    res.json({ success: true, itemId: this.lastID });
  });
});

router.put('/:id', ensureAdmin, (req, res) => {
  const { id } = req.params;
  const { name, category, price, description } = req.body;
  if (!name || !category || !description) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  if (!categories.includes(category.toLowerCase())) {
    return res.status(400).json({ success: false, error: 'Category must be ranks, items, or kits' });
  }
  const parsedPrice = parseInt(price, 10);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ success: false, error: 'Price must be a positive number' });
  }
  const db = getConnection(DB_PATH);
  db.run('UPDATE shop SET name = ?, category = ?, price = ?, description = ? WHERE id = ?', [name.trim(), category.toLowerCase(), parsedPrice, description.trim(), id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to update shop item' });
    res.json({ success: true, updated: this.changes });
  });
});

router.delete('/:id', ensureAdmin, (req, res) => {
  const { id } = req.params;
  const db = getConnection(DB_PATH);
  db.run('DELETE FROM shop WHERE id = ?', [id], function (err) {
    db.close();
    if (err) return res.status(500).json({ success: false, error: 'Unable to delete item' });
    res.json({ success: true, deleted: this.changes });
  });
});

module.exports = router;
