const { spawn } = require("child_process");
const path = require("path");
const child = spawn(
  "php",
  [
    "artisan",
    "serve",
    "--host=127.0.0.1",
    "--port=" + (process.env.PORT || 4000),
  ],
  { cwd: path.join(__dirname, "../backend"), stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
