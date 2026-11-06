import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context }) => { await disableBackend(context); });
test("approved service choices are readable without JavaScript and keep exact clocks and inactive-window boundaries", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage(); await page.goto(`${baseURL}/service-policies/`);
    const main = page.locator("main");
    for (const term of ["Enrollment and payments are not open", "including an annual paid period", "case by case", "two drill corrections per month", "up to three minutes", "expire at the monthly reset", "last day", "does not receive 24 credits upfront", "5 p.m. on the third business day", "arrival day does not count", "America/Chicago", "30 days after it is issued", "without requiring another payment", "does not extend access to the whole Elite plan", "child and teen participation remains paused", "Devyn and Victor", "one business day", "30 days after the coach review is delivered", "90 days after delivery", "Cancellation or restart does not reset", "12 calendar months after paid access ends", "Logging in alone is not paid reactivation", "advance-warning interval has not been set", "Automated deletion is not active"])
      await expect(main).toContainText(term);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://repformed.com/service-policies/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");
    expect(await page.locator("form,input,video").count()).toBe(0);
    for (const link of await page.locator('a[href^="#"]').all()) await expect(page.locator(`[id="${(await link.getAttribute("href"))!.slice(1)}"]`)).toHaveCount(1);
  } finally { await context.close(); }
});
test("policy preview is linked from actual packages, stays accessible on phones and returns to the unchanged interest flow", async ({ page }, info) => {
  await page.goto("./#membership");
  await page.getByRole("link", { name: "Read the planned cancellation, refund, review and retention policies" }).click();
  await expect(page).toHaveURL(/\/service-policies\/$/);
  await page.setViewportSize({ width: info.project.name === "phone" ? 320 : 1000, height: 900 });
  await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter"); await expect(page.locator("main")).toBeFocused();
  await page.addStyleTag({ content: "body {font-size:125%}" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.getByRole("link", { name: "Express interest as an adult" }).click();
  await expect(page).toHaveURL(/#membership$/);
  await expect(page.getByRole("region", { name: "Current availability" })).toContainText("Enrollment is not");
  await page.goBack(); await expect(page).toHaveURL(/\/service-policies\/#main$/);
});
