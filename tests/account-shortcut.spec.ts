import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixture, state } from "./workoutFixture";
import { mockProject } from "./contentFixture";

for (const role of ["owner", "manager", "coach", "parent", "athlete"]) {
  for (const app of [false, true]) {
    test(`${role} ${app ? "app" : "website"} account icon opens settings directly and preserves navigation`, async ({
      page,
      context,
    }, info) => {
      const backend = state();
      await fixture(context, backend, role);
      await page.goto(`./${app ? "?source=app" : ""}#workspace`);
      const icon = page.locator("header").getByRole("link", {
        name: "Account settings",
        exact: true,
      });
      await expect(icon).toBeVisible();
      await expect(icon).toHaveAttribute("href", "#account");
      await expect(icon).not.toHaveAttribute("aria-haspopup");
      const box = await icon.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await icon.focus();
      await expect(icon).toBeFocused();
      await page.keyboard.press("Enter");
      const heading = page.getByRole("heading", {
        level: 1,
        name: "Account settings.",
      });
      await expect(heading).toBeFocused();
      await expect(icon).toHaveAttribute("aria-current", "page");
      await icon.click();
      await icon.click();
      await expect(heading).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/#workspace$/);
      await page.goForward();
      await expect(heading).toBeFocused();
      await page.reload();
      await expect(heading).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Change password", exact: true }),
      ).toBeVisible();
      if (role === "parent" || role === "athlete") {
        await expect(
          page.getByRole("link", {
            name:
              role === "parent"
                ? "Manage athletes & permissions"
                : "Manage your profile",
          }),
        ).toBeVisible();
      }
      await page
        .getByRole("link", { name: "Back to dashboard", exact: true })
        .click();
      await expect(page).toHaveURL(/#workspace$/);
      await expect(icon).not.toHaveAttribute("aria-current");
      if (role === "parent") {
        for (const viewport of [
          { width: 320, height: 640 },
          { width: 844, height: 390 },
        ]) {
          await page.setViewportSize(viewport);
          await expect(icon).toBeVisible();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await icon.click();
          await expect(heading).toBeVisible();
          await page
            .getByRole("link", { name: "Back to dashboard", exact: true })
            .click();
          await page.screenshot({
            path: info.outputPath(`account-icon-${viewport.width}.png`),
            fullPage: true,
          });
        }
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      }
      expect(backend.counts).toEqual({
        saves: 0,
        assigns: 0,
        reports: 0,
        removes: 0,
      });
      await page.screenshot({
        path: info.outputPath("dashboard-account-icon.png"),
        fullPage: true,
      });
    });
  }
}

for (const app of [false, true]) {
  test(`signed-out ${app ? "app" : "website"} retains login without an account icon`, async ({
    page,
    context,
  }) => {
    await mockProject(context, new Map());
    await page.goto(`./${app ? "?source=app" : ""}#account`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Welcome back." }),
    ).toBeVisible();
    await expect(
      page
        .locator("header")
        .getByRole("link", { name: "Account settings", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Account email")).toBeVisible();
  });
}
