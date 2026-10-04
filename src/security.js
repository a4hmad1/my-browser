const { blockedDomains, blockedUrlKeywords } = require("./adblock/rules");
const { isIP } = require("net");
const paidHosts = ["netflix.com", "primevideo.com", "disneyplus.com", "hulu.com", "max.com", "hbomax.com", "paramountplus.com", "tv.apple.com"];
function paidService(raw) {
  try {
    const host = new URL(raw).hostname;
    return paidHosts.some(value => host === value || host.endsWith("." + value));
  } catch { return true; }
}
function publicHttps(raw) {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !isIP(h) &&
      h.includes(".") &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[|172\.(1[6-9]|2\d|3[01])\.)/.test(
        h,
      ) &&
      !/\.(local|internal|test)$/.test(h)
    );
  } catch {
    return false;
  }
}
function blocked(raw) {
  try {
    const u = new URL(raw);
    return (
      blockedDomains.some(
        (d) => u.hostname === d || u.hostname.endsWith("." + d),
      ) ||
      blockedUrlKeywords.some((k) =>
        (u.pathname + u.search).toLowerCase().includes(k),
      )
    );
  } catch {
    return true;
  }
}
function inCatalog(raw, sites) {
  if (!publicHttps(raw) || blocked(raw) || paidService(raw)) return false;
  const host = new URL(raw).hostname;
  return sites.some((s) =>
    [new URL(s.url).hostname, ...(s.navigationHosts || [])].some((value) => {
      const h = value.replace(/^www\./, "");
      return host === h || host.endsWith("." + h);
    }),
  );
}
module.exports = { publicHttps, blocked, inCatalog, paidService };
