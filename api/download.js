module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const platform = String(req.query.platform || 'win').toLowerCase();
  
  // Direct GitHub Releases (100% public, free, fast CDN)
  const URLs = {
    win: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-win-x64-setup.exe',
    windows: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-win-x64-setup.exe',
    portable: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-win-x64-portable.exe',
    linux: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-linux-x86_64.AppImage',
    appimage: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-linux-x86_64.AppImage',
    deb: 'https://github.com/a4hmad1/my-browser/releases/download/v1.1.0/CineStream-1.1.0-preview-linux-amd64.deb'
  };

  const targetUrl = URLs[platform] || URLs.win;
  return res.redirect(302, targetUrl);
};
