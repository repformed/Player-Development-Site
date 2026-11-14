import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async ({ context, baseURL }) => {
  if (!baseURL) throw new Error("An explicit public test origin is required");
  const allowed = new URL(baseURL);
  const loopback =
    allowed.protocol === "http:" && allowed.hostname === "127.0.0.1";
  const deployment =
    allowed.protocol === "https:" &&
    !allowed.port &&
    /^[a-z0-9-]+\.repformed\.pages\.dev$/.test(allowed.hostname);
  if (allowed.username || allowed.password || (!loopback && !deployment))
    throw new Error(
      "Only loopback or an explicit Repformed deployment origin is permitted",
    );
  await context.route("**/*", (route) => {
    const r = route.request(),
      u = new URL(r.url());
    if (u.origin !== allowed.origin || r.method() !== "GET")
      return route.abort();
    return route.continue();
  });
});
async function doubledText(page: Page) {
  await page.evaluate(() => {
    const sizes = [
      ...document.querySelectorAll<HTMLElement>("body, body *"),
    ].map((e) => [e, parseFloat(getComputedStyle(e).fontSize)] as const);
    for (const [e, size] of sizes) e.style.fontSize = `${size * 2}px`;
  });
}
test("enlarged Contact header keeps interest and menu reachable by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/#contact");
  await expect(page.getByLabel("Search help questions")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await doubledText(page);
  await page.locator(".header .brand").focus();
  await page.keyboard.press("Tab");
  const interest = page.locator(".header-account");
  await expect(interest).toBeFocused();
  expect(await interest.evaluate(e => e.getBoundingClientRect().right)).toBeLessThanOrEqual(320);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  await page.keyboard.press("Enter");
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link").first()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Close navigation" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(nav).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

for (const width of [320,390,1280]) for (const scale of [1,2]) {
  test(`Contact public feature reflows at ${scale*100}% text width ${width}`,async ({page})=>{
    await page.setViewportSize({width,height:900});await page.goto('/#contact');
    await expect(page.getByLabel('Search help questions')).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);if(scale===2) await doubledText(page);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    if(width===320&&scale===2) await page.screenshot({path:test.info().outputPath('contact-200percent-320.png'),fullPage:true});
  });
}
