const { allowedPage } = require("./browser-url");

const FORMAT = "cinestream-browser-backup-v1";
const MAX_BOOKMARKS = 500;
const MAX_BYTES = 1024 * 1024;

function normalize(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.bookmarks))
    throw new Error("This is not a valid browser backup.");
  if (data.bookmarks.length > MAX_BOOKMARKS)
    throw new Error("The backup has too many bookmarks.");
  if (!["duckduckgo", "brave"].includes(data.searchEngine))
    throw new Error("The backup has an unsupported search setting.");
  const seen = new Set();
  const bookmarks = [];
  for (const item of data.bookmarks) {
    if (!item || typeof item !== "object" || typeof item.url !== "string" ||
        !allowedPage(item.url) || item.url.length > 2048 ||
        typeof item.title !== "string" || item.title.length > 200)
      throw new Error("The backup contains an invalid bookmark.");
    const url = new URL(item.url).href;
    if (!seen.has(url)) {
      seen.add(url);
      bookmarks.push({ title: item.title || new URL(url).hostname, url });
    }
  }
  return { bookmarks, searchEngine: data.searchEngine };
}

function createBackup(data) {
  const normalized = normalize(data);
  const raw = JSON.stringify({ format: FORMAT, createdAt: new Date().toISOString(), ...normalized }, null, 2) + "\n";
  if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error("The backup file is too large.");
  return raw;
}

function parseBackup(raw) {
  if (typeof raw !== "string" || Buffer.byteLength(raw) > MAX_BYTES)
    throw new Error("The backup file is too large.");
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error("The backup file is not valid JSON."); }
  if (data?.format !== FORMAT) throw new Error("This is not a CineStream browser backup.");
  return normalize(data);
}

module.exports = { createBackup, parseBackup, MAX_BYTES };
