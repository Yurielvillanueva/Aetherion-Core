const express = require('express');
const path = require('path');
const http = require('http');
const session = require('express-session');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { Rcon } = require('rcon-client');
const authRoutes = require('./server/routes/auth');
const usersRoutes = require('./server/routes/users');
const shopRoutes = require('./server/routes/shop');
const staffRoutes = require('./server/routes/staff');
const serverRoutes = require('./server/routes/server');
const filesRoutes = require('./server/routes/files');
const publicRoutes = require('./server/routes/public');
const { initDatabase } = require('./server/db');
const { ensureSecureSession } = require('./server/middleware/auth');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;
const SERVER_DIR = process.env.MC_SERVER_PATH || path.join('C:', 'Users', 'yurie', 'AppData', 'Roaming', '.feather', 'player-server', 'servers', 'be454106-9901-4c1e-9552-e362526b8c51');
const SERVER_JAR_NAME = process.env.MC_SERVER_JAR || 'server.jar';
const MC_RCON_HOST = process.env.MC_RCON_HOST || '';
const MC_RCON_PORT = Number.parseInt(process.env.MC_RCON_PORT || '25575', 10);
const MC_RCON_PASSWORD = process.env.MC_RCON_PASSWORD || '';
const RCON_ENABLED = Boolean(MC_RCON_HOST && MC_RCON_PASSWORD);
const isProduction = process.env.NODE_ENV === 'production';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const SESSION_COOKIE_SAMESITE = (process.env.SESSION_COOKIE_SAMESITE || 'lax').toLowerCase();
const resolvedSameSite = ['lax', 'strict', 'none'].includes(SESSION_COOKIE_SAMESITE)
  ? SESSION_COOKIE_SAMESITE
  : 'lax';
const forceSecureCookie = process.env.SESSION_COOKIE_SECURE === 'true';
const secureCookie = forceSecureCookie || resolvedSameSite === 'none';
if (!process.env.SESSION_SECRET) {
  const message = 'SESSION_SECRET is not set. Set a strong secret in your environment.';
  if (isProduction) {
    throw new Error(message);
  }
  console.warn('[security] ' + message + ' Using an insecure development fallback.');
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'aetherion-dev-insecure-secret';
const SESSION_IDLE_TIMEOUT_MS = Number.parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || `${1000 * 60 * 30}`, 10);
const databaseFile = path.join(__dirname, 'server.sqlite');
const logHistoryFile = path.join(__dirname, 'server', 'logs', 'console-history.log');

initDatabase(databaseFile);

fs.writeFileSync(logHistoryFile, '', { flag: 'a' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const origin = req.get('origin');
  const allowAll = CORS_ORIGINS.includes('*');
  const originAllowed = Boolean(origin && (allowAll || CORS_ORIGINS.includes(origin)));
  if (originAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});
const sessionParser = session({
  name: 'aetherion.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: resolvedSameSite,
    secure: secureCookie
  }
});
app.use(sessionParser);
app.use((req, res, next) => {
  if (!req.session?.user) return next();
  const now = Date.now();
  const lastActivity = req.session.lastActivity || now;
  if ((now - lastActivity) > SESSION_IDLE_TIMEOUT_MS) {
    req.session.destroy(() => {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
      }
      return res.redirect('/login.html');
    });
    return;
  }
  req.session.lastActivity = now;
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/server', serverRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/public', publicRoutes);

app.get('/admin', ensureSecureSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws/console' });
let consoleProcess = null;
let consoleHistory = [];
let stopRequested = false;
let restartRequested = false;

wss.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`WebSocket server port ${PORT} is already in use.`);
    return;
  }
  console.error('WebSocket server error', err);
});

function broadcastConsole(message) {
  const payload = JSON.stringify({ type: 'console', message });
  consoleHistory.push(message);
  if (consoleHistory.length > 200) consoleHistory.shift();
  fs.appendFile(logHistoryFile, message + '\n', () => {});
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}

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

function startConsoleProcess() {
  if (consoleProcess) return true;
  stopRequested = false;
  restartRequested = false;
  const serverDir = SERVER_DIR;
  const jarPath = findServerJarPath();
  if (!jarPath) {
    const message = `Minecraft server jar not found in ${serverDir}. Place a valid .jar file there (for example ${SERVER_JAR_NAME}) to start the actual server.`;
    console.log(message);
    broadcastConsole(message);
    return false;
  }
  const fork = require('child_process').spawn('java', ['-Xmx1024M', '-Xms1024M', '-jar', jarPath, 'nogui'], {
    cwd: serverDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true
  });
  consoleProcess = fork;
  serverRoutes.setServerProcess(fork);

  fork.stdout.on('data', data => {
    broadcastConsole(data.toString().trim());
  });

  fork.stderr.on('data', data => {
    broadcastConsole(`ERROR: ${data.toString().trim()}`);
  });

  fork.on('exit', code => {
    broadcastConsole(`Console process exited with code ${code}`);
    consoleProcess = null;
    serverRoutes.setServerProcess(null);
    if (restartRequested) {
      restartRequested = false;
      broadcastConsole('Restarting server...');
      setTimeout(startConsoleProcess, 3000);
      return;
    }
    if (stopRequested) {
      stopRequested = false;
      broadcastConsole('Server stopped.');
      return;
    }
    setTimeout(startConsoleProcess, 3000);
  });
  return true;
}

function stopConsoleProcess() {
  if (!consoleProcess?.stdin?.writable) return false;
  stopRequested = true;
  restartRequested = false;
  consoleProcess.stdin.write('stop\n');
  return true;
}

function restartConsoleProcess() {
  if (!consoleProcess?.stdin?.writable) return false;
  restartRequested = true;
  stopRequested = false;
  consoleProcess.stdin.write('stop\n');
  return true;
}

async function sendCommandToMinecraft(command) {
  if (consoleProcess?.stdin?.writable) {
    consoleProcess.stdin.write(`${command}\n`);
    broadcastConsole(`[WEB] Command sent: ${command}`);
    return { success: true, message: `Command sent locally: ${command}` };
  }

  if (RCON_ENABLED) {
    const rcon = await Rcon.connect({
      host: MC_RCON_HOST,
      port: MC_RCON_PORT,
      password: MC_RCON_PASSWORD
    });
    try {
      const response = await rcon.send(command);
      const reply = String(response || '').trim();
      if (reply) broadcastConsole(`[RCON] ${reply}`);
      broadcastConsole(`[WEB] RCON command sent: ${command}`);
      return { success: true, message: reply || `Command sent via RCON: ${command}` };
    } finally {
      rcon.end();
    }
  }

  const missingRcon = [];
  if (!MC_RCON_HOST) missingRcon.push('MC_RCON_HOST');
  if (!MC_RCON_PASSWORD) missingRcon.push('MC_RCON_PASSWORD');
  const missingText = missingRcon.length ? ` Missing: ${missingRcon.join(', ')}.` : '';
  throw new Error(`Minecraft server is not running locally and RCON is not configured.${missingText}`);
}

serverRoutes.setStartCallback(startConsoleProcess);
serverRoutes.setStopCallback(stopConsoleProcess);
serverRoutes.setRestartCallback(restartConsoleProcess);
serverRoutes.setExecuteCommandCallback(sendCommandToMinecraft);

wss.on('connection', (socket, req) => {
  const sessionResShim = {
    getHeader: () => undefined,
    setHeader: () => {},
    end: () => {}
  };

  sessionParser(req, sessionResShim, () => {
    const user = req.session?.user;
    const canViewConsole = Boolean(
      user && ((user.permissions && user.permissions.can_view_console) || user.role === 'admin')
    );
    if (!canViewConsole) {
      socket.send(JSON.stringify({ type: 'console', message: 'Unauthorized console connection.' }));
      socket.close(1008, 'Unauthorized');
      return;
    }

    socket.send(JSON.stringify({ type: 'console', message: 'Connected to Aetherion Core live console.' }));
    consoleHistory.forEach(line => socket.send(JSON.stringify({ type: 'console', message: line })));

    socket.on('message', async raw => {
      try {
        const data = JSON.parse(raw);
        if (data.type === 'command') {
          const command = String(data.command || '').trim();
          if (!command) return;
          try {
            const result = await sendCommandToMinecraft(command);
            if (result?.message) {
              socket.send(JSON.stringify({ type: 'console', message: `[WEB] ${result.message}` }));
            }
          } catch (cmdErr) {
            socket.send(JSON.stringify({ type: 'console', message: `[WEB] Command failed: ${cmdErr.message}` }));
          }
        }
      } catch (error) {
        console.error('WebSocket parse error', error);
      }
    });
  });
});

// startConsoleProcess(); // Temporarily disabled

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  next();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Server error' });
});

httpServer.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing process or set a different PORT environment variable.`);
    process.exit(1);
  }
  console.error('HTTP server error', err);
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`Aetherion Core listening on http://localhost:${PORT}`);
  // Server process now starts only from the admin "Start Server" button.
});
