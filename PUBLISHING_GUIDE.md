# Publish CineStream Browser

CineStream Browser is an Electron desktop application. It runs locally on a user's computer; hosting the Laravel website does not turn the application into a full browser in a webpage. Websites can block embedding, and a hosted webpage cannot provide browser-level popup, download, and network controls.

## Build installers

```bash
npm install
npm test
npm run test:e2e
npm run build:linux
```

Build the Windows installer on Windows with `npm run build:win`. The Linux command produces an AppImage and Debian package; the Windows command produces a setup EXE and portable EXE. Outputs are in `dist/`. Test each installer on its target operating system before distribution.

For a local test package, use `npm run build:preview` and `npm run build:preview:win`. Those packages are in `dist/preview/`; `dist/preview/releases.json` records their sizes and SHA-256 checksums. The local account endpoint in a preview is optional: browsing works without it. Windows preview packages built on Linux have not been verified on Windows.

A general-browser release needs no account service. To enable the existing optional account and movie membership integration, deploy `backend/` behind HTTPS, then run `CINEMA_API_URL=https://your-account-domain.example npm run configure:desktop` before building. Store production secrets only in the backend environment. Localhost account URLs are ignored by public packaged builds.

## Host downloads and the optional website

Upload tested installers to a file host such as Cloudflare R2 or S3. Set `Content-Type: application/octet-stream` and `Content-Disposition: attachment; filename="YOUR_EXACT_FILENAME"`, publish checksums, and test a full download. The existing Laravel website in `backend/` can link to these URLs through its `DOWNLOAD_WINDOWS_URL`, `DOWNLOAD_LINUX_URL`, and `DOWNLOAD_DEB_URL` environment settings. The website and its account features require a deployed database and their own backend configuration; they are not required for general browsing.

The Telegram bot belongs to the optional account service. If you deploy it, configure its token and HTTPS webhook on the server. The browser itself does not need a Telegram bot.

## VPN

CineStream follows the operating system's network route and proxy settings by default. To use a VPN, obtain a provider or operate a VPN server, connect in the operating system, and leave the browser on **Use system settings / VPN**. Providers that supply a browser proxy can be configured in **Settings & VPN** as HTTP or SOCKS5. A proxy is limited to browser traffic and does not create a VPN tunnel for the device.

To reach `.onion` sites, run a Tor SOCKS5 service locally and select **Local Tor SOCKS5** in Settings. The app checks the SOCKS5 connection but does not bundle Tor or verify that a SOCKS5 endpoint really is Tor. A Tor proxy in this browser is not a substitute for Tor Browser's fingerprinting and leak protections. The Settings panel can display local IP addresses and, on request, the public IP seen through the current browser connection.

The browser blocks requested popup windows and filters known ad and tracking resources. It cannot promise that every ad is removed, every site accepts an embedded browser, or every sign-in and payment flow works with popup blocking. Keep Electron and filter lists updated and test releases on the target systems.
