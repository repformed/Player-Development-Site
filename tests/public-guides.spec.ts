import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
const slugs = ["online-football-training", "football-iq", "offensive-line-fundamentals", "parent-guide"];
test.beforeEach(async ({ context }) => { await disableBackend(context); });
test("four unique public guides are readable with no JavaScript and have genuine canonical URLs", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const titles = new Set<string>();
    for (const slug of slugs) {
      await page.goto(`${baseURL}/${slug}/`);
      titles.add(await page.title());
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://repformed.com/${slug}/`);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index,follow");
      expect((await page.locator("main").innerText()).split(/\s+/).length).toBeGreaterThan(350);
      await expect(page.locator("form[data-quiz]:visible")).toHaveCount(0);
      for (const answer of await page.locator("details").all()) {
        await answer.locator("summary").click();
        await expect(answer.locator("p")).toBeVisible();
      }
      for (const link of await page.locator('a[href^="#"]').all()) {
        const id = (await link.getAttribute("href"))!.slice(1);
        await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
      }
    }
    expect(titles.size).toBe(4);
  } finally { await context.close(); }
});
test("reading checks explain mistakes, allow repeated answers and clear on reset, reload and history return", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", r => { if (/\/rest\/v1|\/auth\/v1|\/functions\/v1/.test(r.url())) calls.push(r.url()); });
  for (const slug of ["football-iq", "offensive-line-fundamentals"]) {
    await page.goto(`./${slug}/`);
    for (const form of await page.locator("form[data-quiz]").all()) {
      await form.locator('input[value="1"]').check();
      await form.getByRole("button", { name: "Check answer", exact: true }).click();
      await expect(form.getByRole("status")).not.toBeEmpty();
      await expect(form.getByRole("status")).not.toContainText("Correct:");
      await form.locator('input[value="0"]').check();
      await expect(form.getByRole("status")).toBeEmpty();
      await form.getByRole("button", { name: "Check answer", exact: true }).dblclick();
      await expect(form.getByRole("status")).toContainText("Correct:");
      await form.getByRole("button", { name: "Start again", exact: true }).click();
      await expect(form.locator("input:checked")).toHaveCount(0);
      await expect(form.getByRole("status")).toBeEmpty();
    }
    const first = page.locator("form[data-quiz]").first();
    await first.locator('input[value="0"]').check();
    await page.reload();
    await expect(page.locator("input:checked")).toHaveCount(0);
    await first.locator('input[value="0"]').check();
    await page.locator('.top nav a[href="/online-football-training/"]').click();
    await page.goBack();
    await expect(page.locator("input:checked")).toHaveCount(0);
    await expect(page.locator(".feedback").first()).toBeEmpty();
  }
  expect(calls).toEqual([]);
});
test("guides have working public links, keyboard controls and accessible narrow layouts", async ({ page, baseURL }, info) => {
  await page.setViewportSize({ width: info.project.name === "phone" ? 320 : 1000, height: 900 });
  for (const slug of slugs) {
    await page.goto(`./${slug}/`);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await page.addStyleTag({ content: "body {font-size:125%}" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    for (const href of new Set(await page.locator('a[href^="/"]').evaluateAll(links => links.map(a => a.getAttribute("href")!)))) {
      const response = await page.request.get(new URL(href, baseURL).href);
      expect(response.ok(), href).toBe(true);
    }
    if (slug === "football-iq") {
      const form = page.locator("form[data-quiz]").first();
      await form.locator('input[value="0"]').focus();
      await page.keyboard.press("Space");
      await form.getByRole("button", { name: "Check answer", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(form.getByRole("status")).toContainText("Correct:");
    }
  }
});
test("homepage connects to the collection and guide calls to action preserve real interest/package destinations", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Online football training", exact: true }).click();
  await expect(page).toHaveURL(/\/online-football-training\/$/);
  await expect(page.getByText("Prelaunch: paid membership enrollment is not open.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Express interest", exact: true }).click();
  await expect(page).toHaveURL(/#membership$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/online-football-training\/$/);
  await page.locator('.top nav a[href="/parent-guide/"]').click();
  await expect(page.locator("main")).toContainText("Do not put child names");
  await page.getByRole("link", { name: "Read the interest privacy notice" }).click();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});
