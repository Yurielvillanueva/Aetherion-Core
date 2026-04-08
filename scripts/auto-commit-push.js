#!/usr/bin/env node

const { execSync } = require('child_process');

function run(command) {
  execSync(command, { stdio: 'inherit' });
}

function hasChanges() {
  const output = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  return output.length > 0;
}

function buildMessage() {
  const fromArgs = process.argv.slice(2).join(' ').trim();
  if (fromArgs) return fromArgs;
  const now = new Date();
  const iso = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
  return `chore: auto update ${iso}`;
}

try {
  if (!hasChanges()) {
    console.log('No changes detected. Nothing to commit.');
    process.exit(0);
  }

  const message = buildMessage();
  run('git add -A');
  run(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  run('git push');
} catch (error) {
  console.error('Auto commit/push failed.');
  process.exit(1);
}
