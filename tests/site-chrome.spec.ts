import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
import { fixture, state, accountId, staffId } from "./workoutFixture";

test("public header prioritizes interest and keeps member login without a universal status strip", async ({
  page,
  context,
}, info) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["home", "membership", "contact"]) {
    await page.goto(`./#${route}`);
    const header = page.getByRole("banner");
    await expect(header.locator(".header-account")).toHaveText(
      "Express interest",
    );
    if (info.project.name === "phone")
      await header.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      header.getByRole("link", { name: "Log in", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".demo-strip")).toHaveCount(0);
    if (info.project.name === "phone")
      await header.getByRole("button", { name: "Close navigation" }).click();
  }
  if (info.project.name === "phone") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(
      nav.getByRole("link", { name: "Log in", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveCount(0);
  }
  await page.goto("./#demo");
  await expect(
    page.getByRole("region", { name: "Platform status" }),
  ).toContainText("SAMPLE-DATA DEMO");
});
for (const role of [
  "owner",
  "manager",
  "coach",
  "parent",
  "athlete",
] as const) {
  test(`${role} session restores Dashboard and signout clears header, menu and footer`, async ({
    page,
    context,
  }, info) => {
    await fixture(
      context,
      state(),
      role,
      ["parent", "athlete"].includes(role) ? accountId : staffId,
      true,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./#home");
    const header = page.getByRole("banner");
    await expect(
      header.getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveAttribute("href", "#workspace");
    await expect(
      header.getByRole("link", { name: "Log in", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .locator("footer")
        .getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveAttribute("href", "#workspace");
    await expect(page.locator(".demo-strip")).toHaveCount(0);
    await page.reload();
    await expect(
      header.getByRole("link", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    if (info.project.name === "phone") {
      await page.getByRole("button", { name: "Open navigation" }).click();
      const nav = page.getByRole("navigation", { name: "Mobile navigation" });
      await expect(
        nav.getByRole("link", { name: "Dashboard", exact: true }),
      ).toHaveAttribute("href", "#workspace");
      await expect(nav.locator('a[href="#account"]')).toHaveCount(0);
      await expect(
        nav.getByRole("link", { name: "Account settings", exact: true }),
      ).toHaveCount(0);
      await nav.getByRole("link", { name: "Dashboard", exact: true }).click();
    } else
      await header
        .getByRole("link", { name: "Dashboard", exact: true })
        .click();
    await expect(page).toHaveURL(/#workspace$/);
    const titles = {
      owner: "Athletes.",
      manager: "Athletes.",
      coach: "Your athletes.",
      parent: "Today’s training.",
      athlete: "Today’s training.",
    };
    await expect(
      page.getByRole("heading", { name: titles[role], level: 1 }),
    ).toBeVisible();
    await page.goto("./#account");
    await page.getByRole("button", { name: /^Sign out/ }).click();
    await expect(
      page.getByRole("button", { name: "Sign in securely", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Workspace navigation" }),
    ).toHaveCount(0);
    await page.goto("./#home");
    await page.reload();
    await expect(header.locator(".header-account")).toHaveText(
      "Express interest",
    );
    await expect(
      header.getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveCount(0);
    if (info.project.name === "phone")
      await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      header.getByRole("link", { name: "Log in", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator("footer")
        .getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveCount(0);
    if (info.project.name === "phone") {
      await expect(
        page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("link", { name: "Log in", exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("link", { name: "Log in", exact: true }),
      ).toHaveAttribute("href", "#account");
    }
  });
}
test("footer groups navigation and retains five compact accessible social targets on narrow phones", async ({
  page,
  context,
}, info) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#home");
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 800 });
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  const nav = footer.getByRole("navigation", { name: "Footer navigation" });
  await expect(
    nav.getByRole("link", { name: "Proposed packages", exact: true }),
  ).toHaveAttribute("href", "#membership");
  await expect(
    nav.getByRole("link", { name: "Contact", exact: true }),
  ).toHaveAttribute("href", "#contact");
  await expect(
    nav.getByRole("link", { name: "App & installation", exact: true }),
  ).toHaveAttribute("href", "#install");
  await expect(
    nav.getByRole("link", { name: "Get the app", exact: true }),
  ).toHaveCount(0);
  const social = footer.getByRole("navigation", {
    name: "Official social accounts",
  });
  await expect(social.getByRole("link")).toHaveCount(5);
  for (const name of ["Instagram", "TikTok", "Facebook", "X", "YouTube"]) {
    const link = social.getByRole("link", {
      name: `${name} (opens outside Repformed)`,
    });
    const bounds = await link.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    await link.focus();
    await expect(link).toBeFocused();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .include("footer")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.html),
    })),
  ).toEqual([]);
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await footer.screenshot({
    path: `artifacts/home-package-journey/footer-${info.project.name}.png`,
  });
  await nav
    .getByRole("link", { name: "App & installation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Add it to your phone." }),
  ).toBeVisible();
});
