import AxeBuilder from "@axe-core/playwright";
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
for (const [route, label] of [
  ["/#membership", "packages"],
  ["/service-policies/", "policies"],
  ["/account-help.html", "help"],
])
  for (const width of [320, 390, 1280])
    for (const scale of [1, 2])
      test(`${label} reflows at ${scale * 100}% text width ${width}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        if (label === "packages")
          await expect(page.locator(".proposed-package")).toHaveCount(4);
        await page.evaluate(() => document.fonts.ready);
        if (scale === 2) await doubledText(page);
        const result = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          overflow: [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.width > 0 &&
                (r.right > innerWidth + 1 ||
                  r.left < -1 ||
                  e.scrollWidth > e.clientWidth + 1) &&
                !e.closest(".comparison-scroll") &&
                getComputedStyle(e).position !== "fixed"
              );
            })
            .slice(0, 8)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              text: (e.innerText || "").slice(0, 70),
              width: e.getBoundingClientRect().width,
              scroll: e.scrollWidth,
              whiteSpace: getComputedStyle(e).whiteSpace,
            })),
        }));
        if (result.scroll !== width) console.log(JSON.stringify(result));
        expect(
          result,
          result.overflow.map((e) => e.text).join(" | "),
        ).toMatchObject({ scroll: width });
        if (label === "packages" && width === 320 && scale === 2)
          await page
            .locator(".proposed-package")
            .first()
            .screenshot({
              path: testInfo.outputPath("foundation-200percent-320.png"),
            });
        if (width === 320 && scale === 2)
          await page.screenshot({
            path: testInfo.outputPath(`${label}-200percent-320.png`),
            fullPage: true,
          });
      });
for (const [route, label] of [
  ["/#membership", "packages"],
  ["/service-policies/", "policies"],
  ["/account-help.html", "help"],
])
  test(`${label} key controls are tabbable with visible focus`, async ({
    page,
  }) => {
    await page.goto(route);
    if (label === "packages")
      await expect(page.locator(".proposed-package")).toHaveCount(4);
    const targets =
      label === "packages"
        ? [
            "Express interest in Foundation",
            "Express interest in Fundamentals",
            "Express interest in Position Development",
            "Express interest in Elite",
          ]
        : label === "policies"
          ? ["Skip to content", "Express interest as an adult"]
          : ["Skip to account help", "Prepare account-deletion request email"];
    const found = new Set<string>();
    for (let n = 0; n < 110 && found.size < targets.length; n++) {
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement,
          s = getComputedStyle(e);
        return {
          text: (e.innerText || e.getAttribute("aria-label") || "").trim(),
          outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0,
          shadow: s.boxShadow !== "none",
        };
      });
      for (const target of targets)
        if (focus.text.startsWith(target)) {
          expect(focus.outline || focus.shadow).toBe(true);
          found.add(target);
        }
    }
    expect([...found].sort()).toEqual([...targets].sort());
  });
test("interest email validation stays local and exposes an understandable invalid field", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.method());
  });
  await page.goto("/#membership");
  await expect(page.locator(".proposed-package")).toHaveCount(4);
  const email = page.locator("#adult-interest-email");
  await expect(email).toBeVisible();
  await email.fill("not-an-email");
  await email.evaluate((e: HTMLInputElement) => e.reportValidity());
  await expect(email).toBeFocused();
  expect(
    await email.evaluate(
      (e: HTMLInputElement) =>
        e.validity.typeMismatch && e.validationMessage.length > 0,
    ),
  ).toBe(true);
  expect(writes).toEqual([]);
});

for (const route of [
  "/#membership",
  "/service-policies/",
  "/account-help.html",
])
  test(`accessibility scan ${route}`, async ({ page }) => {
    await page.goto(route);
    if (route.includes("membership"))
      await expect(page.locator(".proposed-package")).toHaveCount(4);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

test("enlarged package skip link stays hidden until keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/#membership");
  await expect(page.locator(".proposed-package")).toHaveCount(4);
  await doubledText(page);
  const skip = page.locator(".skip-to-content");
  expect(
    await skip.evaluate((e) => ({
      bottom: e.getBoundingClientRect().bottom,
      focus: document.activeElement === e,
      transform: getComputedStyle(e).transform,
    })),
  ).toMatchObject({ focus: false });
  expect(
    (await skip.boundingBox())!.y + (await skip.boundingBox())!.height,
  ).toBeLessThanOrEqual(0);
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
});

// The policy-page repair shares this stylesheet with these public learning hubs.
test("shared guide stylesheet preserves readable public hubs", async ({
  page,
}) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/online-football-training/",
      "/football-iq/",
      "/offensive-line-fundamentals/",
      "/parent-guide/",
    ]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${route} at ${width}`,
      ).toBe(width);
      await expect(
        page
          .getByRole("navigation", { name: "More from Repformed", exact: true })
          .getByRole("link", { name: "Proposed packages", exact: true }),
      ).toBeVisible();
    }
  }
});
