const fs = require('fs');
const path = require('path');
const os = require('os');
const {spawn} = require('child_process');
module.exports = function ensureTelegram() {
  const backend = path.join(__dirname, '..', 'backend');
  const envFile = path.join(backend, '.env');
  if (!fs.existsSync(envFile)) return;
  const env = fs.readFileSync(envFile, 'utf8');
  if (!/^TELEGRAM_BOT_TOKEN=\S+/m.test(env) || !/^APP_ENV=local\s*$/m.test(env)) return;
  const pidFile = path.join(backend, 'storage', 'framework', 'telegram-poll.pid');
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    if (Number.isInteger(pid) && pid > 0) { process.kill(pid, 0); return; }
  } catch {}
  const log = fs.openSync(path.join(os.tmpdir(), 'cinestream-telegram.log'), 'a', 0o600);
  const child = spawn('php', ['artisan', 'cinema:telegram-poll'], {
    cwd: backend, detached: true, stdio: ['ignore', log, log], env: process.env,
  });
  child.on('error', () => {});
  if (child.pid) fs.writeFileSync(pidFile, String(child.pid), {mode: 0o600});
  child.unref();
  fs.closeSync(log);
};
