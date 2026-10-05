module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const currentVersion = String(req.query.current || '1.1.0').trim();
  const latestVersion = '1.2.0';
  const hasUpdate = latestVersion !== currentVersion;

  return res.status(200).json({
    latestVersion,
    currentVersion,
    updateAvailable: hasUpdate,
    mandatory: false,
    releaseDate: '2026-10-05',
    title: 'CineStream v1.2.0 — Chrome UI & Automatic Updates',
    notes: '✨ Modern Google Chrome dark interface, Ask Google with AI Mode, direct one-click automatic browser updater, and enhanced ad/popup blocker.',
    downloads: {
      windows: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-win-x64-setup.exe',
      windowsPortable: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-win-x64-portable.exe',
      linuxAppImage: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-linux-x86_64.AppImage',
      linuxDeb: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-linux-amd64.deb'
    }
  });
};
