import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";
test.beforeEach(async ({ context, page }) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
});
async function open(page: import("@playwright/test").Page) {
  await page.goto("./#demo");
  await page.getByRole("button", { name: "Open learning example" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Example lesson: read the diagram’s key.",
    }),
  ).toBeFocused();
}
async function correct(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Try the sample question" }).click();
  await page
    .getByRole("radio", { name: "A player’s planned movement" })
    .check();
  await page.getByRole("button", { name: "Check example answer" }).click();
  await page.getByRole("button", { name: "See the example week" }).click();
}
test("public learning example connects text lesson, answer feedback and proposed week without video or saved records", async ({
  page,
}, info) => {
  const calls: string[] = [];
  page.on("request", (r) => {
    if (/\/rest\/v1|\/auth\/v1|\/functions\/v1/.test(r.url()))
      calls.push(r.url());
  });
  await open(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("pd-family-demo-v1"),
  );
  await expect(
    page.getByText(
      "Membership videos and public enrollment are not available.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.locator(".learning-example video")).toHaveCount(0);
  await page.getByRole("button", { name: "Try the sample question" }).click();
  await expect(
    page.getByRole("button", { name: "Check example answer" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "See the example week" }),
  ).toBeDisabled();
  await page
    .getByRole("radio", { name: "A guaranteed result of the play" })
    .check();
  await page.getByRole("button", { name: "Check example answer" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "The example’s key says planned movement" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "See the example week" }),
  ).toBeDisabled();
  await page
    .getByRole("radio", { name: "A player’s planned movement" })
    .check();
  await page.getByRole("button", { name: "Check example answer" }).dblclick();
  await expect(
    page.getByRole("status").filter({ hasText: "That matches this example" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "See the example week" }).click();
  await expect(
    page.getByRole("heading", { name: "An example weekly pattern" }),
  ).toBeFocused();
  await expect(page.locator(".learning-example")).toContainText(
    "Foundation has no drills",
  );
  await expect(page.locator(".learning-example")).toContainText(
    "no second lesson is supplied here",
  );
  await expect(page.locator(".learning-example")).toContainText(
    "does not schedule or deliver anything",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("pd-family-demo-v1")),
  ).toBe(before);
  expect(calls).toEqual([]);
  await page.screenshot({
    path: info.outputPath("learning-example-week.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Explore drill-plan practice example" })
    .click();
  await expect(page.locator("#demo-setup-label")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Open learning example" }),
  ).toBeVisible();
});
test("closing, backtracking, refresh and interrupted navigation clear the sample without changing practice controls", async ({
  page,
}) => {
  await open(page);
  await correct(page);
  await page.getByRole("button", { name: "Back to sample question" }).click();
  await page
    .getByRole("radio", { name: "How fast the player must move" })
    .check();
  await expect(
    page.getByRole("button", { name: "See the example week" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Back to example lesson" }).click();
  await page.getByRole("button", { name: "Try the sample question" }).click();
  await expect(
    page.getByRole("radio", { name: "A player’s planned movement" }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Close learning example" }).click();
  await expect(
    page.getByRole("button", { name: "Open learning example" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open learning example" }).click();
  await page.getByRole("button", { name: "Try the sample question" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open learning example" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open learning example" }).click();
  await page.getByRole("button", { name: "Try the sample question" }).click();
  await page
    .getByRole("link", { name: "← Exit demo · Back to website" })
    .click();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Open learning example" }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "A player’s planned movement" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Solo athlete", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Who are you setting up training for?" }),
  ).toBeVisible();
});
test("example is keyboard accessible and fits narrow/enlarged layouts in the existing black and gold shell", async ({
  page,
}, info) => {
  await page.setViewportSize({
    width: info.project.name === "phone" ? 320 : 900,
    height: 900,
  });
  await open(page);
  await page.getByRole("button", { name: "Try the sample question" }).click();
  await expect(
    page.getByRole("heading", { name: "Sample question", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("radio", { name: "A player’s planned movement" })
    .focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Check example answer" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "See the example week" }),
  ).toBeEnabled();
  await page.addStyleTag({ content: ".learning-example {font-size:125%}" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const checks = await new AxeBuilder({ page })
    .include(".learning-example")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(checks.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("learning-example-question.png"),
    fullPage: true,
  });
});
