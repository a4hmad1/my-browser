const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const version = require('../package.json').version;
const distPreview = path.join(__dirname, '..', 'dist', 'preview');

console.log(`\n🚀 Preparing to publish CineStream v${version} to GitHub Releases...`);

if (!fs.existsSync(distPreview)) {
  console.error(`❌ Output directory ${distPreview} not found. Run preview builds first.`);
  process.exit(1);
}

const files = fs.readdirSync(distPreview).filter(f => 
  f.endsWith('.exe') || f.endsWith('.AppImage') || f.endsWith('.deb')
).map(f => path.join(distPreview, f));

if (files.length === 0) {
  console.error(`❌ No release binaries found in ${distPreview}.`);
  process.exit(1);
}

console.log(`📦 Found ${files.length} release files:`);
files.forEach(f => console.log(`   - ${path.basename(f)}`));

try {
  // Check if release already exists
  try {
    execSync(`gh release view v${version}`, { stdio: 'pipe' });
    console.log(`\n⚡ Release v${version} exists, uploading new asset files...`);
    execSync(`gh release upload v${version} ${files.map(f => `"${f}"`).join(' ')} --clobber`, { stdio: 'inherit' });
  } catch {
    console.log(`\n✨ Creating new release v${version}...`);
    execSync(`gh release create v${version} ${files.map(f => `"${f}"`).join(' ')} --title "CineStream v${version}" --notes "CineStream Browser v${version} release. Ad & popup free movie streaming browser."`, { stdio: 'inherit' });
  }
  console.log(`\n✅ Release published successfully on GitHub! No Cloudflare R2 needed.\n`);
} catch (err) {
  console.error(`\n❌ Failed to publish release:`, err.message);
  process.exit(1);
}
