const { test } = require("node:test");
const assert = require("node:assert/strict");
const { publicHttps, blocked, inCatalog } = require("../src/security");
const sites = [
  { url: "https://www.nfb.ca" },
  { url: "https://kurdbin.kurdsat.tv" },
];
test("remote navigation uses HTTPS without local hosts or credentials", () => {
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://nfb.ca",
    "https://localhost",
    "https://127.0.0.1",
    "https://10.0.0.1",
    "https://100.64.0.1",
    "https://198.18.0.1",
    "https://[::1]",
    "https://x.local",
    "https://user:pass@nfb.ca",
    "https://nfb.ca:444",
  ])
    assert.equal(publicHttps(url), false, url);
  assert.equal(publicHttps("https://nfb.ca/film"), true);
});
test("paid services cannot be added as personal movie navigation targets", () => {
  for (const url of ["https://netflix.com", "https://www.primevideo.com", "https://disneyplus.com", "https://tv.apple.com"]) {
    assert.equal(inCatalog(url, [{ url }]), false, url);
  }
});
test("catalog restrictions resist hostname suffix spoofing", () => {
  assert.equal(inCatalog("https://nfb.ca/film", sites), true);
  assert.equal(inCatalog("https://media.nfb.ca/film", sites), true);
  for (const url of [
    "https://nfb.ca.evil.com",
    "https://evil-nfb.ca",
    "https://evil.com/?next=https://nfb.ca",
    "https://netflix.com",
  ])
    assert.equal(inCatalog(url, sites), false, url);
});
test("ad domains match only exact host or subdomains", () => {
  assert.equal(blocked("https://ad.doubleclick.net/a"), true);
  assert.equal(blocked("https://doubleclick.net/a"), true);
  assert.equal(blocked("https://notdoubleclick.net/a"), false);
  assert.equal(blocked("https://nfb.ca/film?title=doubleclick.net"), false);
  assert.equal(blocked("https://nfb.ca/popunder"), true);
});
