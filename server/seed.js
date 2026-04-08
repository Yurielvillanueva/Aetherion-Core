const sqlite3 = require('sqlite3');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const { initDatabase } = require('./db');
const fs = require('fs');
const { getDefaultPermissions } = require('./security');

const dbPath = path.join(__dirname, '..', 'server.sqlite');
initDatabase(dbPath);
const db = new sqlite3.Database(dbPath);

async function seed() {
  const generatedPassword = crypto.randomBytes(18).toString('base64url');
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || generatedPassword;
  const password = await bcrypt.hash(adminPassword, 10);

  db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin'], (err, row) => {
    if (!err && row.count === 0) {
      db.run(
        'INSERT INTO users (username, email, password, role, permissions) VALUES (?, ?, ?, ?, ?)',
        ['admin', 'admin@aetherion.local', password, 'admin', JSON.stringify(getDefaultPermissions('admin'))]
      );
      console.log('Created default admin account.');
      if (process.env.ADMIN_SEED_PASSWORD) {
        console.log('Admin password sourced from ADMIN_SEED_PASSWORD.');
      } else {
        console.warn('No ADMIN_SEED_PASSWORD set. Generated temporary admin password:', generatedPassword);
      }
    }
  });

  db.get('SELECT COUNT(*) as count FROM shop', (err, row) => {
    if (!err && row.count === 0) {
      const items = [
        ['Diamond Rank', 'ranks', 1200, 'Unlock exclusive rank boost and custom tag.'],
        ['Starter Kit', 'kits', 350, 'Beginner kit with tools, armor, and food.'],
        ['Epic word', 'items', 750, 'Powerful sword with enhanced damage.']
      ];
      const stmt = db.prepare('INSERT INTO shop (name, category, price, description) VALUES (?, ?, ?, ?)');
      items.forEach(item => stmt.run(item));
      stmt.finalize();
      console.log('Added sample shop items.');
    }
  });

  db.get('SELECT COUNT(*) as count FROM staff', (err, row) => {
    if (!err && row.count === 0) {
      const staff = [
        ['Luna', 'admin', 'https://i.pravatar.cc/150?img=12'],
        ['PixelGuard', 'staff', 'https://i.pravatar.cc/150?img=32'],
        ['Nova', 'staff', 'https://i.pravatar.cc/150?img=48']
      ];
      const stmt = db.prepare('INSERT INTO staff (username, role, avatar) VALUES (?, ?, ?)');
      staff.forEach(member => stmt.run(member));
      stmt.finalize();
      console.log('Added sample staff members.');
    }
  });

  db.get('SELECT COUNT(*) as count FROM app_settings', (err, row) => {
    if (!err && row.count === 0) {
      const defaults = [
        ['map_embed_url', ''],
        ['discord_widget_url', ''],
        ['discord_invite_url', 'https://discord.gg/your-invite']
      ];
      const stmt = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)');
      defaults.forEach(item => stmt.run(item));
      stmt.finalize();
      console.log('Added default app settings.');
    }
  });

  db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
    if (!err && row.count === 0) {
      const now = Date.now();
      const events = [
        ['The Great Airship Race', 'Competitive sky route event with rewards.', new Date(now + 1000 * 60 * 60 * 3).toISOString()],
        ['Cathedral Defense', 'Team PvE defense raid against elite mobs.', new Date(now + 1000 * 60 * 60 * 8).toISOString()],
        ['Aether Cup', 'Weekly PvP elimination bracket for top ranks.', new Date(now + 1000 * 60 * 60 * 20).toISOString()]
      ];
      const stmt = db.prepare('INSERT INTO events (title, description, startsAt, isActive) VALUES (?, ?, ?, 1)');
      events.forEach(item => stmt.run(item));
      stmt.finalize();
      console.log('Added default upcoming events.');
    }
  });

  const serverFile = path.join(__dirname, '..', 'server_files', 'welcome.txt');
  if (!fs.existsSync(serverFile)) {
    fs.writeFileSync(serverFile, 'Welcome to Aetherion Core file manager!');
  }

  db.close(() => {
    console.log('Database seed complete.');
  });
}

seed();
