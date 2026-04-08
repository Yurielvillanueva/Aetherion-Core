const express = require('express');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { ensurePermission } = require('../security');

const router = express.Router();
const logFile = path.join(__dirname, '..', 'logs', 'console-history.log');
const defaultHost = process.env.MC_SERVER_HOST || 'localhost';
const defaultPort = Number.parseInt(process.env.MC_SERVER_PORT || '25565', 10);
const SERVER_DIR = process.env.MC_SERVER_PATH || path.join('C:', 'Users', 'yurie', 'AppData', 'Roaming', '.feather', 'player-server', 'servers', 'be454106-9901-4c1e-9552-e362526b8c51');
const SERVER_JAR_NAME = process.env.MC_SERVER_JAR || 'server.jar';
const consoleGuard = ensurePermission('can_view_console');

function findServerJarPath() {
  const explicitJar = path.join(SERVER_DIR, SERVER_JAR_NAME);
  if (fs.existsSync(explicitJar)) {
    return explicitJar;
  }

  const jarFiles = fs.readdirSync(SERVER_DIR)
    .filter(file => file.toLowerCase().endsWith('.jar'))
    .filter(file => !file.toLowerCase().endsWith('-sources.jar'))
    .filter(file => !file.toLowerCase().endsWith('-javadoc.jar'));

  if (jarFiles.length === 1) {
    return path.join(SERVER_DIR, jarFiles[0]);
  }

  const preferred = jarFiles.find(file => /purpur|paper|spigot|server|minecraft/i.test(file));
  if (preferred) {
    return path.join(SERVER_DIR, preferred);
  }

  return null;
}

let serverProcessRef = null;
let startServerCallback = null;
let stopServerCallback = null;
let restartServerCallback = null;

router.setServerProcess = (process) => {
  serverProcessRef = process;
};

router.setStartCallback = (callback) => {
  startServerCallback = callback;
};

router.setStopCallback = (callback) => {
  stopServerCallback = callback;
};

router.setRestartCallback = (callback) => {
  restartServerCallback = callback;
};

router.get('/status', async (req, res) => {
  const jarPath = findServerJarPath();
  try {
    const online = await pingMinecraft(defaultHost, defaultPort, 1500);
    res.json({
      success: true,
      online,
      host: defaultHost,
      port: defaultPort,
      jarExists: Boolean(jarPath),
      jarName: jarPath ? path.basename(jarPath) : null,
      serverPath: SERVER_DIR
    });
  } catch (error) {
    res.json({
      success: true,
      online: false,
      host: defaultHost,
      port: defaultPort,
      jarExists: Boolean(jarPath),
      jarName: jarPath ? path.basename(jarPath) : null,
      serverPath: SERVER_DIR,
      error: error.message
    });
  }
});

router.get('/players', async (req, res) => {
  const online = await pingMinecraft(defaultHost, defaultPort, 1500).catch(() => false);
  res.json({ success: true, online, players: [] });
});

router.get('/logs', consoleGuard, (req, res) => {
  if (!fs.existsSync(logFile)) {
    return res.json({ success: true, logs: [] });
  }
  const content = fs.readFileSync(logFile, 'utf8');
  const logs = content.trim().split(/\r?\n/).filter(Boolean).slice(-200);
  res.json({ success: true, logs });
});

router.post('/start', consoleGuard, (req, res) => {
  if (serverProcessRef) {
    return res.json({ success: false, error: 'Server is already running' });
  }
  if (!startServerCallback) {
    return res.status(500).json({ success: false, error: 'Start callback is not configured' });
  }
  const started = startServerCallback();
  if (!started) {
    return res.status(500).json({ success: false, error: 'Unable to start server. server.jar missing or startup failed.' });
  }
  res.json({ success: true, message: 'Server start requested' });
});

router.post('/stop', consoleGuard, (req, res) => {
  if (!serverProcessRef) {
    return res.json({ success: false, error: 'Server is not running' });
  }
  if (!stopServerCallback) {
    return res.status(500).json({ success: false, error: 'Stop callback is not configured' });
  }
  const stopped = stopServerCallback();
  if (!stopped) {
    return res.status(500).json({ success: false, error: 'Unable to stop server.' });
  }
  res.json({ success: true, message: 'Stop command sent' });
});

router.post('/restart', consoleGuard, (req, res) => {
  if (!serverProcessRef) {
    return res.json({ success: false, error: 'Server is not running' });
  }
  if (!restartServerCallback) {
    return res.status(500).json({ success: false, error: 'Restart callback is not configured' });
  }
  const restarted = restartServerCallback();
  if (!restarted) {
    return res.status(500).json({ success: false, error: 'Unable to restart server.' });
  }
  res.json({ success: true, message: 'Restart command sent' });
});

function pingMinecraft(host, port, timeout) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    socket.setTimeout(timeout);
    socket.once('error', err => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(err);
      }
    });
    socket.once('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error('Connection timeout'));
      }
    });
    socket.connect(port, host, () => {
      if (!settled) {
        settled = true;
        socket.end();
        resolve(true);
      }
    });
  });
}

router.setServerProcess = (process) => {
  serverProcessRef = process;
};

router.getServerProcess = () => {
  return serverProcessRef;
};

module.exports = router;
