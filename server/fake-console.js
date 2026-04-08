const readline = require('readline');
const events = [
  '[INFO] World saved successfully.',
  '[WARN] Player connection timeout.',
  '[INFO] Chunk 12, -3 loaded.',
  '[INFO] TPS stable at 20.0.',
  '[INFO] Server heartbeat is healthy.',
  '[INFO] Player Luna has joined the server.',
  '[INFO] New backup created.',
  '[INFO] Lightning strike event handled.'
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
let logInterval = null;

function writeLog() {
  const message = events[Math.floor(Math.random() * events.length)];
  process.stdout.write(`${new Date().toISOString()} ${message}\n`);
}

logInterval = setInterval(writeLog, 3500);
writeLog();

rl.on('line', line => {
  const command = line.trim().toLowerCase();
  if (!command) return;
  
  if (command === 'stop') {
    process.stdout.write(`${new Date().toISOString()} [INFO] Stopping server...\n`);
    clearInterval(logInterval);
    setTimeout(() => {
      process.stdout.write(`${new Date().toISOString()} [INFO] Server stopped cleanly.\n`);
      process.exit(0);
    }, 500);
    return;
  }
  
  process.stdout.write(`${new Date().toISOString()} [COMMAND] Received: ${command}\n`);
  setTimeout(() => {
    process.stdout.write(`${new Date().toISOString()} [COMMAND] Executed: ${command} successfully.\n`);
  }, 800);
});
