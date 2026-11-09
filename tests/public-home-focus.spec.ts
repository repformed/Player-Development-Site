import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ context, page, baseURL }) => {
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
    const request = route.request();
    if (
      new URL(request.url()).origin !== allowed.origin ||
      request.method() !== "GET"
    )
      return route.abort();
    return route.continue();
  });
  // Observe native methods, without replacing browser focus or scrolling.
  await page.addInitScript(() => {
    const events: {
      kind: string;
      id: string;
      behavior?: string;
      active?: string;
      preventScroll?: boolean;
    }[] = [];
    Object.assign(window, { publicFocusEvents: events });
    const nativeFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options) {
      nativeFocus.call(this, options);
      if (this.id === "how-it-works")
        events.push({
          kind: "focus",
          id: this.id,
          active: document.activeElement?.id,
          preventScroll: options?.preventScroll,
        });
    };
    const nativeScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (options) {
      if (this.id === "how-it-works")
        events.push({
          kind: "scroll",
          id: this.id,
          active: document.activeElement?.id,
          behavior: typeof options === "object" ? options.behavior : undefined,
        });
      nativeScroll.call(this, options);
    };
  });
});

async function tabToHeroControl(page: Page) {
  const control = page.getByRole("button", {
    name: "See how it works",
    exact: true,
  });
  await expect(control).toBeVisible();
  for (let n = 0; n < 60; n++) {
    await page.keyboard.press("Tab");
    if (await control.evaluate((e) => document.activeElement === e))
      return control;
  }
  throw new Error("Home how-it-works control was not reached by Tab");
}

for (const width of [390, 1440])
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    test(`Home keyboard destination and history ${width} ${reducedMotion}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/#home");
      const control = await tabToHeroControl(page);
      const initialURL = page.url(),
        initialHistory = await page.evaluate(() => history.length);
      await page.keyboard.press("Enter");
      const target = page.locator("#how-it-works");
      await expect(target).toBeFocused();
      await expect(
        page.getByRole("region", {
          name: "A week with a clear next step.",
          exact: true,
        }),
      ).toHaveCount(1);
      await expect(target).toHaveAttribute("tabindex", "-1");
      await expect
        .poll(() =>
          target.evaluate((e) => Math.round(e.getBoundingClientRect().top)),
        )
        .toBeGreaterThanOrEqual(70);
      await expect
        .poll(() =>
          target.evaluate((e) => Math.round(e.getBoundingClientRect().top)),
        )
        .toBeLessThanOrEqual(160);
      await expect(target.locator("h2")).toBeVisible();
      expect(page.url()).toBe(initialURL);
      expect(await page.evaluate(() => history.length)).toBe(initialHistory);
      const events = await page.evaluate(() =>
        Reflect.get(window, "publicFocusEvents"),
      );
      expect(events).toEqual([
        {
          kind: "focus",
          id: "how-it-works",
          active: "how-it-works",
          preventScroll: true,
        },
        {
          kind: "scroll",
          id: "how-it-works",
          active: "how-it-works",
          behavior: reducedMotion === "reduce" ? "auto" : "smooth",
        },
      ]);
      await page.keyboard.press("Tab");
      const next = page.getByRole("link", {
        name: "Find the right package",
        exact: true,
      });
      await expect(next).toBeFocused();
      // Repeat using Space; this focus setup is explicit, initial arrival above used Tab.
      await control.focus();
      await page.keyboard.press("Space");
      await expect(target).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(next).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#membership$/);
      await expect(page.locator(".proposed-package")).toHaveCount(4);
      await page.goBack();
      await expect(page).toHaveURL(initialURL);
      await expect(control).toBeVisible();
      expect(await page.evaluate(() => location.hash)).toBe("#home");
    });

    test(`Home scroll interruption keeps package route ${width} ${reducedMotion}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion });
      await page.goto("/#home");
      await tabToHeroControl(page);
      await page.keyboard.press("Enter");
      await expect(page.locator("#how-it-works")).toBeFocused();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#membership$/);
      await expect(page.locator(".proposed-package")).toHaveCount(4);
      await expect(
        page.getByRole("heading", {
          name: "Choose the support your athlete needs.",
          exact: true,
        }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.activeElement?.id)).not.toBe(
        "how-it-works",
      );
      await page.goBack();
      await expect(page).toHaveURL(/#home$/);
      await expect(
        page.getByRole("button", { name: "See how it works", exact: true }),
      ).toBeVisible();
    });
  }
