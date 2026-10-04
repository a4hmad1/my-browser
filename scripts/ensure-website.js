const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

module.exports = async function ensureWebsite() {
  const { apiBase } = require("../src/config.json");
  const url = new URL(process.env.CINEMA_API_URL || apiBase);
  // Packaged apps use their public server. Only a local checkout starts PHP.
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return;
  require('./ensure-telegram')();
  async function ready() {
    try {
      const response = await fetch(url.origin + '/up', { signal: AbortSignal.timeout(1200) });
      return response.ok;
    } catch { return false; }
  }
  if (await ready()) return;
  const logPath = path.join(os.tmpdir(), 'cinestream-website.log');
  const log = fs.openSync(logPath, 'a', 0o600);
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-website.js')], {
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, PORT: url.port || '4000' },
  });
  server.unref();
  fs.closeSync(log);
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await ready()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('The local website could not start. Check ' + logPath);
};
