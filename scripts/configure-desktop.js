const fs = require("fs");
const raw = process.env.CINEMA_API_URL ? process.env.CINEMA_API_URL.trim() : "";
if (!raw) {
  fs.writeFileSync(
    "src/config.json",
    JSON.stringify({ apiBase: null }, null, 2) + "\n",
  );
  console.log("Configured standalone build without external account backend.");
  process.exit(0);
}
const url = new URL(raw);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
)
  throw new Error("CINEMA_API_URL must be an HTTPS origin.");
fs.writeFileSync(
  "src/config.json",
  JSON.stringify({ apiBase: url.origin }, null, 2) + "\n",
);
