const { test, expect, _electron } = require("@playwright/test");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

test("1-day free trial allows browsing, rejects invalid code, and activates lifetime with 6-digit code", async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cinestream-trial-"));
  const env = { ...process.env, CINEMA_PROFILE_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await _electron.launch({ args: ["."], env, timeout: 20000 });
    const page = await app.firstWindow();

    // 1. License badge shows 1-day free trial on first launch
    await expect(page.locator('#btn-license')).toBeVisible();
    await expect(page.locator('#license-label')).toHaveText(/Trial:/i);

    // 2. Welcome panel offers "Give me code" button
    await expect(page.locator('#welcome-code')).toBeVisible();
    await page.locator('#welcome-code').click();
    await expect(page.locator('#license-dialog')).toBeVisible();
    await expect(page.locator('#license-title')).toHaveText(/Activate CineStream/i);

    // 3. Skip to continue 1-day trial
    await page.locator('#license-skip').click();
    await expect(page.locator('#license-dialog')).not.toBeVisible();

    // 3. Open license dialog again to enter code
    await page.locator('#btn-license').click();
    await expect(page.locator('#license-dialog')).toBeVisible();

    // 4. Invalid 6-digit code is rejected
    await page.locator('#license-input').fill('000000');
    await page.locator('#license-submit').click();
    await expect(page.locator('#license-error')).toHaveText(/Invalid activation code/i);

    // 5. Valid 6-digit code unlocks lifetime access
    await page.locator('#license-input').fill('100911');
    await page.locator('#license-submit').click();
    await expect(page.locator('#license-dialog')).not.toBeVisible();
    await expect(page.locator('#license-label')).toHaveText(/Lifetime/i);

    // 6. Verify HTML fullscreen event toggles fullscreen-mode class
    await page.evaluate(() => {
      window.cinemaApi.onHtmlFullscreen && document.querySelector('.window').classList.add('fullscreen-mode');
    });
    await expect(page.locator('.window.fullscreen-mode')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.window')).not.toHaveClass(/fullscreen-mode/);
  } finally {
    if (app) await app.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
