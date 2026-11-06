import { test, expect } from "@playwright/test";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => { await disableBackend(context); });
test("compiled homepage supplies crawlable prelaunch copy and consistent search metadata without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(baseURL!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Repformed — Football learning & training");
    await expect(page.locator("main")).toContainText("Membership enrollment is not open");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://repformed.com/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");
    const robots = await (await page.request.get(baseURL! + "/robots.txt")).text();
    expect(robots).toContain("Sitemap: https://repformed.com/sitemap.xml");
    const sitemap = await (await page.request.get(baseURL! + "/sitemap.xml")).text();
    expect([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(x => x[1])).toEqual(["https://repformed.com/", "https://repformed.com/online-football-training/", "https://repformed.com/football-iq/", "https://repformed.com/offensive-line-fundamentals/", "https://repformed.com/parent-guide/", "https://repformed.com/service-policies/"]);
    expect(sitemap).not.toMatch(/account|workspace|preview|#/);
  } finally { await context.close(); }
});
test("client replaces static fallback once and keeps account/sample routes excluded through navigation", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".startup-fallback")).toHaveCount(0);
  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveAttribute("content", "index,follow");
  await page.evaluate(() => location.hash = "account");
  await expect(robots).toHaveAttribute("content", "noindex,nofollow");
  await page.evaluate(() => location.hash = "membership");
  await expect(robots).toHaveAttribute("content", "index,follow");
  await page.evaluate(() => location.hash = "demo");
  await expect(robots).toHaveAttribute("content", "noindex,nofollow");
  await expect(page.getByRole("button", { name: "Open learning example" })).toBeVisible();
  await page.goBack();
  await expect(robots).toHaveAttribute("content", "index,follow");
  await page.goto("./?source=app#app");
  await expect(robots).toHaveAttribute("content", "noindex,nofollow");
});
test("standalone interest privacy keeps its existing noindex", async ({ page }) => {
  await page.goto("./interest-privacy.html");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});
test("a preconfigured preview noindex is never relaxed by public navigation", async ({ page, baseURL }) => {
  await page.route(baseURL! + "/", async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace('name="robots" content="index,follow"', 'name="robots" content="noindex,nofollow"');
    await route.fulfill({ response, body: html });
  });
  await page.goto("./");
  await expect(page.locator(".startup-fallback")).toHaveCount(0);
  await page.evaluate(() => location.hash = "membership");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
});
