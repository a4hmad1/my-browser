const { spawn } = require("child_process");
const path = require("path");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
async function main() {
  const linuxFlags = process.platform === 'linux' && process.env.DISPLAY
    ? ['--ozone-platform=x11', '--disable-gpu', '--disable-gpu-compositing'] : [];
  const child = spawn(
    require("electron"),
    [path.join(__dirname, ".."), ...linuxFlags, ...process.argv.slice(2)],
    { env, stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
