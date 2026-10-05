const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const winUnpacked = path.join(root, 'dist/preview/win-unpacked');
const nsisBase = '/home/ahmad/.cache/electron-builder/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n';
const makensis = path.join(nsisBase, 'linux/makensis');
const iconIco = path.join(root, 'build/icon.ico');

console.log('1. Packaging latest win-unpacked files with electron-builder...');
const res = spawnSync('npx', ['electron-builder', '--win', '--dir', '--x64', '--config.directories.output=dist/preview'], { cwd: root, stdio: 'inherit' });
if (res.status !== 0) {
  console.error('Failed to create win-unpacked');
  process.exit(1);
}

const nsiPath = path.join(root, 'dist/preview/installer.nsi');
const outExeSetup = path.join(root, 'dist/preview/CineStream-1.1.0-preview-win-x64-setup.exe');
const outExePortable = path.join(root, 'dist/preview/CineStream-1.1.0-preview-win-x64-portable.exe');

const nsiScript = `
!include "MUI2.nsh"
!include "FileFunc.nsh"

Unicode true
SetCompressor /SOLID lzma

RequestExecutionLevel user

!define PRODUCT_NAME "CineStream Browser"
!define PRODUCT_VERSION "1.2.0"
!define PRODUCT_PUBLISHER "CineStream Team"
!define PRODUCT_WEB_SITE "https://github.com/a4hmad1/my-browser"
!define PRODUCT_DIR_REGKEY "Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\CineStream Browser.exe"
!define PRODUCT_UNINST_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CineStreamBrowser"

Name "\${PRODUCT_NAME}"
OutFile "${outExeSetup}"
InstallDir "$LOCALAPPDATA\\Programs\\CineStream Browser"
InstallDirRegKey HKCU "\${PRODUCT_DIR_REGKEY}" ""

; Chrome-like automated installer: Installs directly with progress bar
ShowInstDetails nevershow
ShowUnInstDetails nevershow
AutoCloseWindow true

!define MUI_ICON "${iconIco}"
!define MUI_UNICON "${iconIco}"
!define MUI_PAGE_HEADER_TEXT "Installing \${PRODUCT_NAME}"
!define MUI_PAGE_HEADER_SUBTEXT "Please wait while \${PRODUCT_NAME} is installed to your system..."
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function .onInit
  SetShellVarContext current
FunctionEnd

Function un.onInit
  SetShellVarContext current
FunctionEnd

Section "MainSection" SEC01
  SetShellVarContext current

  ; Close any running CineStream process before writing files
  nsExec::Exec 'cmd.exe /c taskkill /F /IM "CineStream Browser.exe" >nul 2>&1'
  Sleep 500

  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Copy all program files
  File /r "${winUnpacked}/*.*"

  ; Copy icon file directly into install dir for reliable desktop shortcuts
  File "/oname=$INSTDIR\\app.ico" "${iconIco}"

  ; Create Desktop Shortcut (Guaranteed to show on user's Desktop)
  SetOutPath "$INSTDIR"
  CreateShortcut "$DESKTOP\\\${PRODUCT_NAME}.lnk" "$INSTDIR\\CineStream Browser.exe" "" "$INSTDIR\\app.ico" 0 "" "" "\${PRODUCT_NAME}"

  ; Create Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\\\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\\\${PRODUCT_NAME}\\\${PRODUCT_NAME}.lnk" "$INSTDIR\\CineStream Browser.exe" "" "$INSTDIR\\app.ico" 0 "" "" "\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\\\${PRODUCT_NAME}\\Uninstall \${PRODUCT_NAME}.lnk" "$INSTDIR\\Uninstall.exe" "" "$INSTDIR\\Uninstall.exe" 0 "" "" "Uninstall \${PRODUCT_NAME}"

  ; Write Uninstaller
  WriteUninstaller "$INSTDIR\\Uninstall.exe"

  ; Register in Windows Programs & Features
  WriteRegStr HKCU "\${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\\CineStream Browser.exe"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "DisplayName" "\${PRODUCT_NAME}"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "UninstallString" '"$INSTDIR\\Uninstall.exe"'
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "DisplayIcon" '"$INSTDIR\\CineStream Browser.exe",0'
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "DisplayVersion" "\${PRODUCT_VERSION}"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "URLInfoAbout" "\${PRODUCT_WEB_SITE}"
  WriteRegStr HKCU "\${PRODUCT_UNINST_KEY}" "Publisher" "\${PRODUCT_PUBLISHER}"
  WriteRegDWORD HKCU "\${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "\${PRODUCT_UNINST_KEY}" "NoRepair" 1

  ; Force Windows Explorer to refresh desktop and show shortcut immediately
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'

  ; Launch CineStream Browser immediately (ChromeSetup experience)
  Exec '"$INSTDIR\\CineStream Browser.exe"'
SectionEnd

Section "Uninstall"
  SetShellVarContext current

  ; Close running process before uninstalling
  nsExec::Exec 'cmd.exe /c taskkill /F /IM "CineStream Browser.exe" >nul 2>&1'
  Sleep 500

  ; Remove Desktop Shortcut
  Delete "$DESKTOP\\\${PRODUCT_NAME}.lnk"

  ; Remove Start Menu Shortcuts
  Delete "$SMPROGRAMS\\\${PRODUCT_NAME}\\\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\\\${PRODUCT_NAME}\\Uninstall \${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\\\${PRODUCT_NAME}"

  ; Remove Registry Keys
  DeleteRegKey HKCU "\${PRODUCT_DIR_REGKEY}"
  DeleteRegKey HKCU "\${PRODUCT_UNINST_KEY}"

  ; Remove Installed Files
  RMDir /r "$INSTDIR"

  ; Refresh Windows Explorer
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
SectionEnd
`;

fs.writeFileSync(nsiPath, nsiScript);
console.log('2. Compiling Windows NSIS Setup Installer with makensis...');
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

console.log('3. Successfully created Chrome-like Windows Setup Installer:');
console.log(' - ' + outExeSetup);
console.log(' - ' + outExePortable);
console.log('Updated dist/preview/releases.json with windows release entry.');
