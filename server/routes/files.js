const express = require('express');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const { ensurePermission } = require('../security');

const router = express.Router();
const rootDir = path.join('C:', 'Users', 'yurie', 'AppData', 'Roaming', '.feather', 'player-server', 'servers', 'be454106-9901-4c1e-9552-e362526b8c51');
const editFilesGuard = ensurePermission('can_edit_files');

router.use(fileUpload({ createParentPath: true }));

function sanitizePath(targetPath) {
  const normalized = path.normalize(targetPath || '.').replace(/^[\/]+/, '').replace(/^[:\\]+/, '');
  const resolved = path.resolve(rootDir, normalized);
  const resolvedNormalized = path.normalize(resolved);
  const rootNormalized = path.normalize(rootDir);
  if (!resolvedNormalized.startsWith(rootNormalized + path.sep) && resolvedNormalized !== rootNormalized) {
    throw new Error('Invalid path');
  }
  return resolved;
}

router.get('/list', editFilesGuard, (req, res) => {
  const target = req.query.path || '.';
  let resolved;
  try {
    resolved = sanitizePath(target);
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid folder path' });
  }

  fs.readdir(resolved, { withFileTypes: true }, (err, entries) => {
    if (err) return res.status(500).json({ success: false, error: 'Unable to read directory' });
    const files = entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory()
    }));
    res.json({ success: true, path: target, files });
  });
});

router.get('/read', editFilesGuard, (req, res) => {
  const target = req.query.path;
  if (!target) return res.status(400).json({ success: false, error: 'Path is required' });
  let resolved;
  try {
    resolved = sanitizePath(target);
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid path' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return res.status(400).json({ success: false, error: 'Path is a directory' });
  }
  const content = fs.readFileSync(resolved, 'utf8');
  res.json({ success: true, content });
});

router.post('/edit', editFilesGuard, (req, res) => {
  const { path: target, content } = req.body;
  if (!target) return res.status(400).json({ success: false, error: 'Path is required' });
  let resolved;
  try {
    resolved = sanitizePath(target);
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid path' });
  }
  fs.writeFile(resolved, content || '', 'utf8', err => {
    if (err) return res.status(500).json({ success: false, error: 'Unable to save file' });
    res.json({ success: true });
  });
});

router.post('/delete', editFilesGuard, (req, res) => {
  const { path: target } = req.body;
  if (!target) return res.status(400).json({ success: false, error: 'Path is required' });
  let resolved;
  try {
    resolved = sanitizePath(target);
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid path' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ success: false, error: 'File or folder not found' });
  }
  const stat = fs.statSync(resolved);
  const action = stat.isDirectory() ? fs.rmdirSync : fs.unlinkSync;
  try {
    action(resolved, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unable to delete file or folder' });
  }
});

router.post('/upload', editFilesGuard, async (req, res) => {
  if (!req.files || !req.files.upload) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }
  const targetPath = req.body.path || '.';
  let resolved;
  try {
    resolved = sanitizePath(targetPath);
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid path' });
  }
  const uploads = Array.isArray(req.files.upload) ? req.files.upload : [req.files.upload];
  const results = [];
  for (const file of uploads) {
    const safeName = path.basename(file.name || '');
    if (!safeName || safeName === '.' || safeName === '..') {
      return res.status(400).json({ success: false, error: 'Invalid upload filename' });
    }
    const dest = path.join(resolved, safeName);
    try {
      await new Promise((resolve, reject) => file.mv(dest, err => err ? reject(err) : resolve()));
      results.push(safeName);
    } catch (err) {
      return res.status(500).json({ success: false, error: `Upload failed for ${safeName}` });
    }
  }
  res.json({ success: true, files: results });
});

module.exports = router;
