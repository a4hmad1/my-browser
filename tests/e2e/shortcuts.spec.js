const { test, expect, _electron } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('Chrome keyboard shortcuts and search keywords work correctly', async () => {
  test.setTimeout(45000);
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<title>Shortcut Test Page</title><h1>Finding text inside this page</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cinestream-shortcuts-test-'));
  const env = { ...process.env, CINEMA_PROFILE_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await _electron.launch({ args: ['.'], env, timeout: 20000 });
    const page = await app.firstWindow();

    // 1. Initial tab check
    await expect(page.locator('.tab')).toHaveCount(1);

    // 2. Open a page
    await page.locator('#url-input').fill(`localhost:${port}`);
    await page.locator('#url-input').press('Enter');
    await expect(page.locator('.tab-title')).toHaveText('Shortcut Test Page');

    // 3. Test Ctrl+T (New Tab)
    await page.keyboard.press('Control+t');
    await expect(page.locator('.tab')).toHaveCount(2);

    // 4. Test Alt+D / Ctrl+L (Focus Omnibar)
    await page.keyboard.press('Alt+d');
    await expect(page.locator('#url-input')).toBeFocused();

    // 5. Test Ctrl+W (Close Tab)
    await page.keyboard.press('Control+w');
    await expect(page.locator('.tab')).toHaveCount(1);
    await expect(page.locator('.tab-title')).toHaveText('Shortcut Test Page');

    // 6. Test Ctrl+Shift+T (Reopen Closed Tab)
    await page.keyboard.press('Control+Shift+T');
    await expect(page.locator('.tab')).toHaveCount(2);

    // 7. Test Ctrl+W again
    await page.keyboard.press('Control+w');
    await expect(page.locator('.tab')).toHaveCount(1);

    // 8. Test Ctrl+D (Toggle Bookmark)
    await page.keyboard.press('Control+d');
    await expect(page.locator('#btn-bookmark')).toHaveText('★');

    // 9. Test Ctrl+F (Find in Page bar)
    await page.keyboard.press('Control+f');
    await expect(page.locator('#find-bar')).toBeVisible();
    await expect(page.locator('#find-input')).toBeFocused();

    // 10. Test Escape (Dismiss Find Bar)
    await page.keyboard.press('Escape');
    await expect(page.locator('#find-bar')).toBeHidden();

    // 11. Test Chrome search keyword (g for Google)
    await page.locator('#url-input').fill('g interstellar 2014');
    await page.locator('#url-input').press('Enter');
    await expect.poll(() => page.locator('#url-input').inputValue()).toBe('https://www.google.com/search?q=interstellar%202014');

    // 12. Test Chrome search keyword (yt for YouTube)
    await page.locator('#url-input').fill('yt lofi hip hop');
    await page.locator('#url-input').press('Enter');
    await expect.poll(() => page.locator('#url-input').inputValue()).toBe('https://www.youtube.com/results?search_query=lofi%20hip%20hop');

    // 13. Test Ctrl+B (Toggle Bookmarks panel)
    await page.keyboard.press('Control+b');
    await expect(page.locator('#side-panel')).toBeVisible();
    await expect(page.locator('#panel-title')).toHaveText('Bookmarks');

    // 14. Test Escape closes side panel
    await page.keyboard.press('Escape');
    await expect(page.locator('#side-panel')).toBeHidden();

  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
