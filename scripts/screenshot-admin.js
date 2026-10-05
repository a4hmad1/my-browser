const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  
  await page.goto('http://127.0.0.1:4000/owner-login');
  await page.getByLabel('Email address').fill('owner@cinestream.local');
  await page.getByLabel('Password', { exact: true }).fill('admin123456');
  await page.getByRole('button', { name: /Sign in/i }).click();

  await page.waitForURL('**/admin');
  await page.waitForTimeout(1000);

  const screenshotPath = path.join(__dirname, '../artifacts/admin-dashboard.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved admin screenshot to: ' + screenshotPath);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
