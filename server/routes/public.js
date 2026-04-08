const express = require('express');
const path = require('path');
const { getConnection } = require('../db');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', '..', 'server.sqlite');

function getSettingsMap(callback) {
  const db = getConnection(DB_PATH);
  db.all('SELECT key, value FROM app_settings', [], (err, rows) => {
    db.close();
    if (err) return callback(err);
    const settings = {};
    (rows || []).forEach(row => {
      settings[row.key] = row.value;
    });
    callback(null, settings);
  });
}

router.get('/landing', (req, res) => {
  const db = getConnection(DB_PATH);
  db.get('SELECT COUNT(*) as joins FROM login_history WHERE success = 1', [], (loginErr, loginRow) => {
    if (loginErr) {
      db.close();
      return res.status(500).json({ success: false, error: 'Unable to read login stats' });
    }
    db.get('SELECT COUNT(*) as staffCount FROM staff', [], (staffErr, staffRow) => {
      db.close();
      if (staffErr) return res.status(500).json({ success: false, error: 'Unable to read staff stats' });
      const totalJoins = (loginRow?.joins || 0) + 14000;
      res.json({
        success: true,
        metrics: {
          totalJoins,
          staffCount: staffRow?.staffCount || 0,
          uptimePercent: 99.9,
          tps: 20.0,
          discordOnlineMembers: 142
        }
      });
    });
  });
});

router.get('/events', (req, res) => {
  const db = getConnection(DB_PATH);
  db.all(
    'SELECT id, title, description, startsAt FROM events WHERE isActive = 1 ORDER BY datetime(startsAt) ASC LIMIT 6',
    [],
    (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ success: false, error: 'Unable to fetch events' });
      res.json({ success: true, events: rows || [] });
    }
  );
});

router.get('/settings', (req, res) => {
  getSettingsMap((err, settings) => {
    if (err) return res.status(500).json({ success: false, error: 'Unable to fetch settings' });
    res.json({
      success: true,
      settings: {
        mapEmbedUrl: settings.map_embed_url || '',
        discordWidgetUrl: settings.discord_widget_url || '',
        discordInviteUrl: settings.discord_invite_url || 'https://discord.gg/your-invite'
      }
    });
  });
});

module.exports = router;
