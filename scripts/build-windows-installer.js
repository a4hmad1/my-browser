const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const winUnpacked = path.join(root, 'dist/preview/win-unpacked');
const nsisBase = '/home/ahmad/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n';
const makensis = path.join(nsisBase, 'linux/makensis');
const iconIco = path.join(root, 'build/icon.ico');

if (!fs.existsSync(winUnpacked)) {
  console.log('Building win-unpacked files first...');
  const res = spawnSync('npx', ['electron-builder', '--win', '--dir', '--x64', '--config.directories.output=dist/preview'], { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) process.exit(1);
}

const nsiPath = path.join(root, 'dist/preview/installer.nsi');
const outExeSetup = path.join(root, 'dist/preview/CineStream-1.1.0-preview-win-x64-setup.exe');
const outExePortable = path.join(root, 'dist/preview/CineStream-1.1.0-preview-win-x64-portable.exe');

const nsiScript = `
!include "MUI2.nsh"
!include "FileFunc.nsh"

Unicode true
SetCompressor /SOLID lzma

!define PRODUCT_NAME "CineStream Browser"
!define PRODUCT_VERSION "1.1.0"
!define PRODUCT_PUBLISHER "CineStream Team"
!define PRODUCT_WEB_SITE "https://github.com/a4hmad1/my-browser"
!define PRODUCT_DIR_REGKEY "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\CineStream Browser.exe"
!define PRODUCT_UNINST_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CineStreamBrowser"

Name "\${PRODUCT_NAME}"
OutFile "${outExeSetup}"
InstallDir "$LOCALAPPDATA\\Programs\\CineStream Browser"
InstallDirRegKey HKCU "\${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

!define MUI_ICON "${iconIco}"
!define MUI_UNICON "${iconIco}"
!define MUI_HEADERIMAGE
!define MUI_ABORTWARNING

; Welcome page
!insertmacro MUI_PAGE_WELCOME
; Directory page
!insertmacro MUI_PAGE_DIRECTORY
; Instfiles page
!insertmacro MUI_PAGE_INSTFILES
; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\\CineStream Browser.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch CineStream Browser now"
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite try
  File /r "${winUnpacked}/*.*"

  ; Create Desktop Shortcut (Always visible on Desktop!)
  SetOutPath "$INSTDIR"
  CreateShortcut "$DESKTOP\\\${PRODUCT_NAME}.lnk" "$INSTDIR\\CineStream Browser.exe" "" "$INSTDIR\\CineStream Browser.exe" 0

  ; Create Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\\\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\\\${PRODUCT_NAME}\\\${PRODUCT_NAME}.lnk" "$INSTDIR\\CineStream Browser.exe" "" "$INSTDIR\\CineStream Browser.exe" 0
  CreateShortcut "$SMPROGRAMS\\\${PRODUCT_NAME}\\Uninstall \${PRODUCT_NAME}.lnk" "$INSTDIR\\Uninstall.exe" "" "$INSTDIR\\Uninstall.exe" 0

  ; Write Uninstaller
  WriteUninstaller "$INSTDIR\\Uninstall.exe"

  ; Registry Keys for Windows Add/Remove Programs
  WriteRegStr HKCU "\${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\\CineStream Browser.exe"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "DisplayName" "\${PRODUCT_NAME}"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "UninstallString" '"$INSTDIR\\Uninstall.exe"'
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\\CineStream Browser.exe"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "DisplayVersion" "\${PRODUCT_VERSION}"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "URLInfoAbout" "\${PRODUCT_WEB_SITE}"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "Publisher" "\${PRODUCT_PUBLISHER}"
SectionEnd

Section "Uninstall"
  ; Remove Desktop Shortcut
  Delete "$DESKTOP\\\${PRODUCT_NAME}.lnk"

  ; Remove Start Menu Shortcuts
  Delete "$SMPROGRAMS\\\${PRODUCT_NAME}\\\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\\\${PRODUCT_NAME}\\Uninstall \${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\\\${PRODUCT_NAME}"

  ; Remove Installed Files
  RMDir /r "$INSTDIR"

  ; Remove Registry Keys
  DeleteRegKey HKCU "\${PRODUCT_DIR_REGKEY}"
  DeleteRegKey HKCU "\${PRODUCT_UNINST_KEY}"
  SetAutoClose true
SectionEnd
`;

fs.writeFileSync(nsiPath, nsiScript);
console.log('Compiling Windows NSIS Setup Installer with desktop shortcut support...');
const buildRes = spawnSync(makensis, [nsiPath], {
  stdio: 'inherit',
  env: { ...process.env, NSISDIR: nsisBase }
});
if (buildRes.status !== 0) {
  console.error('makensis compilation failed');
  process.exit(1);
}

// Copy to portable filename as well so both setup.exe and portable.exe URLs work
fs.copyFileSync(outExeSetup, outExePortable);

// Update releases.json
const crypto = require('crypto');
const manifestPath = path.join(root, 'dist/preview/releases.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { files: {} };
if (!manifest.files) manifest.files = {};
const fileBuf = fs.readFileSync(outExePortable);
manifest.files.windows = {
  filename: 'CineStream-1.1.0-preview-win-x64-portable.exe',
  size: fs.statSync(outExePortable).size,
  sha256: crypto.createHash('sha256').update(fileBuf).digest('hex')
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log('Successfully created Windows Setup Installer:');
console.log(' - ' + outExeSetup);
console.log(' - ' + outExePortable);
console.log('Updated dist/preview/releases.json with windows release entry.');

