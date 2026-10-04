const fs = require("fs");
const value = process.env.CINEMA_API_URL;
if (!value)
  throw new Error(
    "Set CINEMA_API_URL to the public HTTPS Laravel URL before building.",
  );
const url = new URL(value);
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
