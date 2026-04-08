const sqlite3 = require('sqlite3');
const fs = require('fs');

function getConnection(dbPath) {
  const db = new sqlite3.Database(dbPath);
  db.serialize();
  return db;
}

function initDatabase(dbPath) {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '');
  }

  const db = getConnection(dbPath);

  const setupSql = `
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      isBanned INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shop (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS file_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      filePath TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      email TEXT,
      ip TEXT,
      userAgent TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actorUserId INTEGER,
      actorUsername TEXT,
      action TEXT NOT NULL,
      targetType TEXT,
      targetId TEXT,
      details TEXT,
      ip TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      startsAt TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(setupSql, err => {
    if (err) {
      console.error('Database setup error', err);
      db.close();
      return;
    }

    ensureUsersSchema(db);
  });
}

function ensureUsersSchema(db) {
  db.all('PRAGMA table_info(users)', [], (err, columns) => {
    if (err) {
      console.error('Schema migration error', err);
      db.close();
      return;
    }

    const columnNames = new Set(columns.map(col => col.name));
    const migrations = [];

    if (!columnNames.has('isMuted')) {
      migrations.push("ALTER TABLE users ADD COLUMN isMuted INTEGER NOT NULL DEFAULT 0");
    }
    if (!columnNames.has('isRestricted')) {
      migrations.push("ALTER TABLE users ADD COLUMN isRestricted INTEGER NOT NULL DEFAULT 0");
    }
    if (!columnNames.has('permissions')) {
      migrations.push("ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '{}'");
    }

    if (!migrations.length) {
      db.close();
      return;
    }

    db.serialize(() => {
      migrations.forEach(sql => {
        db.run(sql, migrationErr => {
          if (migrationErr) console.error('Migration failed:', sql, migrationErr);
        });
      });
      db.close();
    });
  });
}

module.exports = {
  getConnection,
  initDatabase
};
