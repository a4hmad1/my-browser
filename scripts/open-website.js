const { spawn } = require('child_process');
const url = new URL(process.env.CINEMA_API_URL || require('../src/config.json').apiBase).origin;
async function main() {
  await require('./ensure-website')();
  console.log('CineStream website: ' + url);
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  const opener = spawn(command, [url], { stdio: 'ignore' });
  opener.on('error', error => { console.error(error.message); process.exitCode = 1; });
  opener.on('exit', code => { if (code) process.exitCode = 1; });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
