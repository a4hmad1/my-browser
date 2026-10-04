const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

if (process.platform !== "linux") {
  throw new Error("This desktop launcher installer supports Linux.");
}
const root = path.resolve(__dirname, "..");
const desktopResult = spawnSync("xdg-user-dir", ["DESKTOP"], { encoding: "utf8" });
const desktop = desktopResult.status === 0 && desktopResult.stdout.trim()
  ? desktopResult.stdout.trim()
  : path.join(os.homedir(), "Desktop");
const applications = path.join(
  process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
  "applications",
);
// Escape arguments for the desktop-entry Exec grammar, without invoking a shell.
const quote = (value) => '"' + value.replace(/[\\"`$]/g, "\\$&").replace(/%/g, "%%") + '"';
const entry = `[Desktop Entry]
Version=1.0
Type=Application
Name=CineStream Browser
GenericName=Web Browser
Comment=Browse websites with tabs and ad protection
Exec=${quote(process.execPath)} ${quote(path.join(root, "scripts", "start-desktop.js"))}
TryExec=${process.execPath}
Path=${root}
Icon=${path.join(root, "build", "icon.png")}
Terminal=false
Categories=Network;WebBrowser;
StartupNotify=false
StartupWMClass=cinestream
`;
for (const directory of new Set([applications, desktop])) {
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, "cinestream.desktop");
  fs.writeFileSync(target, entry, { mode: 0o755 });
  fs.chmodSync(target, 0o755);
  spawnSync("gio", ["set", target, "metadata::trusted", "true"]);
  console.log("Installed browser launcher: " + target);
}
spawnSync("update-desktop-database", [applications]);
