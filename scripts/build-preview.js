const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const platform = process.argv[2] || 'linux';
if (!['linux', 'win'].includes(platform)) throw new Error('Use linux or win.');
const file = path.join(root, 'src/config.json');
const original = fs.readFileSync(file);
const artifacts = path.join(root, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const lockFile = path.join(artifacts, '.preview-build.lock');
const lock = fs.openSync(lockFile, 'wx');
const manifestFile = path.join(root, 'dist/preview/releases.json');
const releaseFiles = {
  windows: 'CineStream-1.1.0-preview-win-x64-setup.exe',
  linux: 'CineStream-1.1.0-preview-linux-x86_64.AppImage',
  deb: 'CineStream-1.1.0-preview-linux-amd64.deb',
};
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile)) : { files: {} };
const keys = platform === 'linux' ? ['linux', 'deb'] : ['windows'];
fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
function writeManifest() {
  fs.writeFileSync(manifestFile + '.tmp', JSON.stringify(manifest, null, 2) + '\n');
  fs.renameSync(manifestFile + '.tmp', manifestFile);
}
function releaseRecord(filename) {
  const fullPath = path.join(path.dirname(manifestFile), filename);
  const digest = crypto.createHash('sha256');
  const descriptor = fs.openSync(fullPath, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    let read;
    while ((read = fs.readSync(descriptor, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, read));
  } finally { fs.closeSync(descriptor); }
  return { filename, size: fs.statSync(fullPath).size, sha256: digest.digest('hex') };
}
const temporaryRoot = path.join(os.homedir(), '.cache', 'cinestream-packaging');
fs.mkdirSync(temporaryRoot, { recursive: true });
try {
  keys.forEach(key => delete manifest.files[key]);
  writeManifest();
  fs.writeFileSync(file, JSON.stringify({ apiBase: 'http://127.0.0.1:4000', developmentBuild: true }, null, 2) + '\n');
  const cli = require.resolve('electron-builder/out/cli/cli.js');
  const result = spawnSync(process.execPath, [cli,
    '--' + platform, ...(platform === 'linux' ? ['AppImage', 'deb'] : ['nsis']), '--x64', '--publish', 'never',
    '--config.directories.output=dist/preview',
    '--config.extraMetadata.version=1.1.0-preview',
    '--config.artifactName=CineStream-1.1.0-preview-${os}-${arch}.${ext}',
    '--config.nsis.artifactName=CineStream-1.1.0-preview-win-${arch}-setup.${ext}',
    '--config.portable.artifactName=CineStream-1.1.0-preview-win-${arch}-portable.${ext}',
    '--config.deb.compression=gz',
    ...(platform === 'win' ? ['--config.compression=normal'] : []),
    ...(platform === 'win' ? ['--config.win.signExecutable=false'] : []),
  ], { cwd: root, stdio: 'inherit', env: { ...process.env, TMPDIR: temporaryRoot, CSC_IDENTITY_AUTO_DISCOVERY: 'false' } });
  process.exitCode = result.status || (result.error ? 1 : 0);
  if (!process.exitCode) {
    keys.forEach(key => manifest.files[key] = releaseRecord(releaseFiles[key]));
    writeManifest();
    console.log('Verified local preview downloads recorded in dist/preview/releases.json');
  }
} finally {
  fs.writeFileSync(file, original);
  fs.closeSync(lock);
  fs.unlinkSync(lockFile);
}
