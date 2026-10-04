const { test, expect, _electron } = require("@playwright/test");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("temporary account outage keeps the session; rejected token returns to sign in", async () => {
  let accountStatus = 200;
  const server = http.createServer((request, response) => {
    const route = new URL(request.url, "http://localhost").pathname;
    response.setHeader("content-type", "application/json");
    if (route === "/api/login") {
      response.end(JSON.stringify({ token: "fixture-token" }));
    } else if (route === "/api/account") {
      response.statusCode = accountStatus;
      response.end(JSON.stringify(accountStatus === 200 ? {
        user: { name: "Movie Viewer", email: "viewer@example.com" },
        access: { active: true, trial: true, ends_at: "2099-01-01T00:00:00Z", custom_site_limit: 0, telegram_verified: true },
      } : { message: accountStatus === 401 ? "Session expired." : "Server temporarily unavailable." }));
    } else if (route === "/api/catalog") {
      response.end(JSON.stringify({ sites: [{ name: "NFB", url: "https://www.nfb.ca", language: "English", tag: "Films", icon: "nfb.svg" }] }));
    } else if (route === "/api/telegram/link") {
      response.end(JSON.stringify({ url: "file:///tmp/unsafe-link" }));
    } else {
      response.statusCode = 404;
      response.end(JSON.stringify({ message: "Not found" }));
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cinestream-reliability-"));
  const env = { ...process.env, CINEMA_PROFILE_DIR: profile, CINEMA_API_URL: `http://127.0.0.1:${server.address().port}` };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await _electron.launch({ args: ["."], env, timeout: 20000 });
    const page = await app.firstWindow();
    await page.locator('#btn-account').click();
    await page.locator('#account-form [name=email]').fill('viewer@example.com');
    await page.locator('#account-form [name=password]').fill('test-password-strong');
    await page.locator('#account-submit').click();
    await expect(page.locator('#account-name')).toHaveText('Movie Viewer');
    const unsafeLink = await page.evaluate(() => window.cinemaApi.linkTelegram({ password: 'test-password-strong' }).then(() => false, () => true));
    expect(unsafeLink).toBe(true);
    await page.locator('#account-close').click();
    await expect(page.locator('#start-page')).toBeVisible();

    accountStatus = 503;
    const outage = await page.evaluate(() => window.cinemaApi.getAccount().then(() => null, error => error.message));
    expect(outage).toContain("Server temporarily unavailable");
    await expect(page.locator('#start-page')).toBeVisible();

    accountStatus = 200;
    expect((await page.evaluate(() => window.cinemaApi.getAccount())).user.name).toBe("Movie Viewer");

    accountStatus = 401;
    await page.evaluate(() => window.cinemaApi.getAccount().catch(() => {}));
    await page.locator('#btn-account').click();
    await expect(page.locator('#account-form')).toBeVisible();
    await expect(page.locator('#start-page')).toBeVisible();
  } finally {
    if (app) await app.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
