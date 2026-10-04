const { test, expect, _electron } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('first-open welcome and local backup restore browser data', async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cinestream-backup-test-'));
  const backupFile = path.join(profile, 'browser-backup.json');
  const env = { ...process.env, CINEMA_PROFILE_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await _electron.launch({ args: ['.'], env, timeout: 20000 });
    const page = await app.firstWindow();
    await expect(page.locator('#welcome-panel')).toBeVisible();
    await page.locator('#welcome-settings').click();
    await expect(page.locator('#welcome-panel')).toBeHidden();
    await expect(page.locator('#side-panel')).toBeVisible();
    await page.evaluate(() => {
      localStorage.setItem('browser-bookmarks', JSON.stringify([{ title: 'Example', url: 'https://example.com/' }]));
      localStorage.setItem('browser-search-engine', 'brave');
    });
    await page.reload();
    await expect(page.locator('#welcome-panel')).toBeHidden();
    await page.locator('#btn-menu').click();
    await page.getByRole('button', { name: /Settings & VPN/ }).click();
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, backupFile);
    await page.locator('#export-backup').click();
    await expect.poll(() => fs.existsSync(backupFile)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    expect(saved.bookmarks).toEqual([{ title: 'Example', url: 'https://example.com/' }]);
    expect(saved.searchEngine).toBe('brave');
    await page.evaluate(() => {
      localStorage.setItem('browser-bookmarks', '[]');
      localStorage.setItem('browser-search-engine', 'duckduckgo');
    });
    await page.reload();
    await page.locator('#btn-menu').click();
    await page.getByRole('button', { name: /Settings & VPN/ }).click();
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, backupFile);
    await page.locator('#import-backup').click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('browser-search-engine'))).toBe('brave');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('browser-bookmarks')))).toEqual([{ title: 'Example', url: 'https://example.com/' }]);
    await expect(page.locator('#search-engine')).toHaveValue('brave');
  } finally {
    if (app) await app.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
