import { test, expect } from "@playwright/test";
test.beforeEach(async ({ context, baseURL }) => {
  if (!baseURL) throw Error("Explicit public origin required");
  const origin = new URL(baseURL);
  if (
    !(origin.protocol === "http:" && origin.hostname === "127.0.0.1") &&
    !(
      origin.protocol === "https:" &&
      /^[a-z0-9-]+\.repformed\.pages\.dev$/.test(origin.hostname)
    )
  )
    throw Error("Unexpected test origin");
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin.origin &&
    route.request().method() === "GET"
      ? route.continue()
      : route.abort(),
  );
});
test("keyboard return focuses the Home heading and preserves its URL", async ({
  page,
}) => {
  await page.goto("/#home");
  const button = page.getByRole("button", { name: "Back to top", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page).toHaveURL(/#home$/);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Explore packages", exact: true }).first(),
  ).toBeFocused();
});
test("reduced motion uses immediate scroll and focus before scrolling", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const events: string[] = [];
    Object.assign(window, { backTopEvents: events });
    const native = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (options) {
      if (this.matches("main.home h1")) {
        events.push(document.activeElement === this ? "focused" : "unfocused");
        events.push(typeof options === "object" ? options.behavior || "" : "");
      }
      native.call(this, options);
    };
  });
  await page.goto("/#home");
  await page.getByRole("button", { name: "Back to top", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  expect(
    await page.evaluate(() => Reflect.get(window, "backTopEvents")),
  ).toEqual(["focused", "auto"]);
});
test("repeated use after route interruption does not change history or leave stale focus", async ({
  page,
}) => {
  await page.goto("/#home");
  await page.getByRole("button", { name: "Back to top", exact: true }).click();
  await page
    .getByRole("link", { name: "Explore packages", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/#membership$/);
  await page.goBack();
  await expect(page).toHaveURL(/#home$/);
  const button = page.getByRole("button", { name: "Back to top", exact: true });
  await button.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/#membership$/);
});
test("missing decorative image keeps a named usable control without horizontal overflow", async ({
  page,
}) => {
  await page.route("**/features/back-to-top.svg", (r) => r.abort());
  await page.goto("/#home");
  const button = page.getByRole("button", { name: "Back to top", exact: true });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
