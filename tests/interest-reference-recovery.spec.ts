import { test, expect } from "@playwright/test";

async function fixture(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext) {
  const posts: Array<Record<string, unknown>> = [];
  const blocked: string[] = [];
  let loseResponse = false;
  const base = new URL(String(test.info().project.use.baseURL));
  expect(
    (base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname)) ||
    (base.protocol === "https:" && /^[a-z0-9-]+\.repformed\.pages\.dev$/.test(base.hostname) && !base.port),
  ).toBe(true);
  await context.route(/^https?:\/\//, route => {
    const u = new URL(route.request().url());
    if (u.origin === base.origin && ["GET", "HEAD"].includes(route.request().method())) return route.continue();
    blocked.push(u.hostname);return route.abort();
  });
  await context.route("**/content-config.json", route => route.fulfill({ json: {
    enabled: true, url: "https://separate-demo.supabase.co", publishableKey: "sb_publishable_fixture_only",
    membersEnabled: true, membersSignupEnabled: false, interestIntakeEnabled: true,
  } }));
  await context.route("https://separate-demo.supabase.co/**", route => {
    const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (new URL(route.request().url()).pathname !== "/functions/v1/interest-intake") return route.fulfill({ json: [], headers });
    const body = route.request().postDataJSON();posts.push(body);
    if (loseResponse) { loseResponse = false;return route.abort(); }
    return route.fulfill({ status: 202, json: { status: "accepted", reference: body.id }, headers });
  });
  await page.goto("./#membership");
  const form = page.getByRole("form", { name: "Send adult package interest" });
  await form.getByLabel("Adult name").fill("Fictional Adult");
  await form.getByLabel("Adult email").fill("fictional-adult@example.test");
  await form.getByLabel("I’m 18 or older.").check();
  await form.getByLabel("Email me when Repformed launches").check();
  return { form, posts, blocked, loseNext: () => { loseResponse = true; } };
}
async function breakReference(page: import("@playwright/test").Page, mode: "missing" | "throws") {
  await page.evaluate(mode => {
    const original = crypto.randomUUID.bind(crypto);
    Object.defineProperty(window, "restoreInterestReference", { configurable: true, value: () => Object.defineProperty(crypto, "randomUUID", { configurable: true, value: original }) });
    Object.defineProperty(crypto, "randomUUID", { configurable: true, value: mode === "missing" ? undefined : () => { throw new Error("fictional internal reference failure"); } });
  }, mode);
}
for (const mode of ["missing", "throws"] as const) {
  test(`reference creation ${mode} releases the form and preserves the draft for explicit recovery`, async ({ page, context }) => {
    const f = await fixture(page, context);
    await breakReference(page, mode);
    await f.form.getByRole("button", { name: "Send interest", exact: true }).click();
    await expect(f.form.getByRole("alert")).toContainText("We could not prepare this request.");
    await expect(f.form.getByRole("button", { name: "Send interest", exact: true })).toBeEnabled();
    await expect(f.form.getByLabel("Adult name")).toHaveValue("Fictional Adult");
    await expect(f.form.getByLabel("Adult email")).toHaveValue("fictional-adult@example.test");
    await expect(f.form.getByLabel("I’m 18 or older.")).toBeChecked();
    await expect(f.form.getByLabel("Email me when Repformed launches")).toBeChecked();
    expect(f.posts).toHaveLength(0);
    await page.locator(".interest-email-fallback summary").click();
    await expect(page.getByRole("link", { name: "Email package interest" })).toHaveAttribute("href", /^mailto:Repformed@gmail.com/);
    await page.evaluate(() => (window as unknown as { restoreInterestReference: () => void }).restoreInterestReference());
    await f.form.getByRole("button", { name: "Send interest", exact: true }).click();
    await expect(page.getByText("Interest received.", { exact: true })).toBeVisible();
    expect(f.posts).toHaveLength(1);expect(f.blocked).toEqual([]);
  });
}
test("an uncertain request retries its existing reference even if new reference creation becomes unavailable", async ({ page, context }) => {
  const f = await fixture(page, context);f.loseNext();
  await f.form.getByRole("button", { name: "Send interest", exact: true }).click();
  await expect(f.form.getByRole("alert")).toContainText("could not confirm receipt");
  await breakReference(page, "throws");
  await f.form.getByRole("button", { name: "Send interest", exact: true }).click();
  await expect(page.getByText("Interest received.", { exact: true })).toBeVisible();
  expect(f.posts).toHaveLength(2);expect(f.posts[1].id).toBe(f.posts[0].id);expect(f.blocked).toEqual([]);
});
