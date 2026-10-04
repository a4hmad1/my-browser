# CineStream Browser

CineStream is a desktop web browser for Linux and Windows. It opens public and private HTTP/HTTPS websites, searches DuckDuckGo by default from the address bar, and has tabs, bookmarks, session history, downloads, popup blocking, and ad and tracking filters. Settings offers DuckDuckGo or Brave Search; an old Google search preference is changed to DuckDuckGo when the app starts. The History panel can clear visited pages and each tab's Back/Forward history. Website content runs in sandboxed Electron webviews. Browser cookies and site storage use an in-memory session; bookmarks stay on this device.

On first launch, a welcome panel introduces search, bookmarks, and privacy controls. In **Settings & VPN → Back up your browser**, save a JSON file containing bookmarks and the search choice, then restore it on another installation. The file is not encrypted and does not contain cookies, passwords, or history. Google account sign-in and automatic cloud sync require a Google OAuth client ID, consent-screen configuration, and a hosted backup service; they are not enabled in this build.

Security measures reduce risk but cannot guarantee that a browser will never be attacked. Keep the operating system and browser updated. Some sites may require features that this Electron browser does not support, and some search providers may challenge automated or embedded browser traffic.

## Run

```bash
npm install
npm start
```

The browser does not require an account or the Laravel server. `npm run install:desktop` creates a Linux desktop launcher. `npm run open:website` starts the optional legacy account website, if its PHP dependencies and database are configured.

## VPN and proxy

Connect a VPN supplied by your provider in the operating system. Leave **Settings & VPN → Connection mode** on **Use system settings / VPN**. If your provider supplies an HTTP or SOCKS5 proxy instead, select **Manual proxy** and enter its host and port. The proxy affects this browser only. CineStream does not provide a VPN server or subscription.

For `.onion` addresses, start a local Tor service or Tor Browser and select **Local Tor SOCKS5**. Tor service commonly uses port 9050 and Tor Browser may use 9150. CineStream checks that the local port speaks SOCKS5 before applying it. It cannot prove the service is Tor. Bare `.onion` addresses default to HTTP, which is normal for onion services. [Tor explicitly discourages using another browser as a substitute for Tor Browser](https://support.torproject.org/tor-browser/security/using-tor-with-other-browsers/); this mode does not promise anonymity. Normal websites continue to work without Tor, and Tor browsing can be slower.

The Tor and manual proxy settings apply to browser page traffic and the public IP check. Optional account requests and public favicon lookups use separate connections; favicon lookups are disabled in Tor mode. Do not use this browser when strong anonymity is required.

Settings shows the laptop's local IP addresses. Press **Check public IP** to ask [ipify](https://www.ipify.org/) what address it sees through the browser's current connection. The public check is optional and uses the browser session and its configured proxy.

## Build and test

```bash
npm test
npm run test:e2e
npm run build:linux
npm run build:win
```

Installer files are written to `dist/`. Local test packages can be made with `npm run build:preview` and `npm run build:preview:win`. A public release can optionally connect to a deployed HTTPS account service through `src/config.json`; general browsing works without it. Browser releases need native testing on each target operating system.

The ad blocker combines built-in domain rules with an online filter list when it can reach the list provider. It blocks new windows at the Electron level. No filter can guarantee every ad on every site, and sites that require popup windows for sign-in or payment may need another browser. Some sites restrict embedded browsers, DRM, or automated traffic independently of CineStream.
