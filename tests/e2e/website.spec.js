const { test, expect } = require("@playwright/test");
const { execFileSync } = require("child_process");
test("landing page, pricing, filters and mobile layout", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Ultra-fast cinema browser. Ad protection. Zero popups.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yearly −5%" }).click();
  await expect(page.locator(".price").first()).toContainText("57,000");
  await expect(page.locator(".price").nth(1)).toContainText("114,000");
  await expect(page.locator(".price").nth(2)).toContainText("228,000");
  await expect(page.locator('[data-directory="Kurdish"] li')).toHaveCount(4);
  await expect(page.locator('[data-directory="English"] li')).toHaveCount(7);
  await page.getByRole('button', { name: 'Windows', exact: true }).click();
  await expect(page.locator('#panel-windows')).toBeVisible();
  await expect(page.locator('#panel-linux')).toBeHidden();
  const download = page.locator('#panel-windows .btn-download-primary');
  if (await download.getAttribute('href')) {
    await expect(download).toHaveAttribute('href', '/download/windows');
    const response = await page.request.head('/download/windows');
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-disposition']).toContain('attachment');
  } else {
    await expect(download).toContainText('Release pending');
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({
    path: "artifacts/website-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({
    path: "artifacts/website-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("registration and sign out work through Inertia forms", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Browser Test");
  const email = "ui-" + Date.now() + "@example.com";
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Telegram username").fill("ui_"+Date.now());
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-strong");
  await page.getByLabel("Confirm password").fill("test-password-strong");
  await page.getByRole("button", { name: "Start my free day" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading",{name:"Verify your Telegram account"})).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your free day" }),
  ).toBeVisible();
  execFileSync("php", ["tests/e2e/fixture.php", "admin", email]);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Owner dashboard" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search users" }).fill(email);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp("search=" + encodeURIComponent(email)),
  );
  await expect(page.locator(".admin-search + .table-wrap tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Issue code", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "New subscription code" }),
  ).toHaveValue(/^[a-f0-9]{48}$/);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:"artifacts/owner-dashboard.png",fullPage:true});
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:4000/");
  await page.goto('/login');
  await expect(page.getByLabel('Telegram username')).toHaveCount(0);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('test-password-strong');
  await page.getByRole('button',{name:'Sign in ↗'}).click();
  await expect(page).toHaveURL(/dashboard/);
  expect(errors).toEqual([]);
  execFileSync("php", ["tests/e2e/fixture.php", "delete", email]);
});
