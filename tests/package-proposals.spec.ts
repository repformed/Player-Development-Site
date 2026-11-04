import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { disableBackend } from "./backendFixture";

test.beforeEach(async ({ context, page }) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("four future proposals distinguish cadence, price and review terms without checkout", async ({
  page,
}) => {
  await page.goto("./#membership");
  await expect(
    page.getByRole("region", { name: "Current availability" }),
  ).toContainText("Interest is open. Enrollment is not.");
  const names = [
    "Foundation",
    "Fundamentals",
    "Position Development",
    "Elite Coaching",
  ];
  const prices = [
    ["9.99", "99"],
    ["19.99", "199"],
    ["39.99", "399"],
    ["69.99", "699"],
  ];
  for (let i = 0; i < names.length; i++) {
    const card = page.getByRole("article", { name: names[i], exact: true });
    await expect(card).toContainText(`$${prices[i][0]}`);
    await expect(card).toContainText(`$${prices[i][1]} / year`);
    await expect(card).toContainText("Not available to purchase");
    await expect(
      card.getByRole("button", {
        name: `Express interest in ${names[i]}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("article", { name: "Foundation", exact: true }),
  ).toContainText("No drills");
  await expect(
    page.getByRole("article", { name: "Fundamentals", exact: true }),
  ).toContainText("2 movement sessions / week");
  await page
    .getByText("What’s included in Position Development", { exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Position Development complete proposal" }),
  ).toContainText(
    "The two position-specific drills are additional to the two movement sessions",
  );
  await page
    .getByText("What’s included in Elite Coaching", { exact: true })
    .click();
  const elite = page.getByRole("group", {
    name: "Elite Coaching complete proposal",
  });
  await expect(elite).toContainText(
    "Two personalized drill corrections per month for each subscribed Elite athlete; the athlete chooses the drills",
  );
  await expect(elite).toContainText(
    "Feedback identifying corrections and how to improve",
  );
  await expect(elite).toContainText("three business days, not guaranteed");
  await expect(elite).toContainText(
    "Up to three minutes of footage per submission",
  );
  await expect(page.getByRole("main")).not.toContainText(
    /group coaching|group film|film.study or coaching session/i,
  );
  await expect(
    page.getByRole("region", { name: "Proposed delivery rhythm" }),
  ).toContainText(
    "planned packages would deliver the upcoming week’s content on Sundays",
  );
  await expect(
    page.getByRole("button", { name: /checkout|pay|purchase|subscribe/i }),
  ).toHaveCount(0);
});

test("interest scroll preserves route, package selection prepares only an adult email", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH"].includes(r.method())) writes.push(r.url());
  });
  await page.goto("./#membership");
  await page.getByRole("button", { name: "Share your interest" }).click();
  await expect(page).toHaveURL(/#membership$/);
  await expect(
    page.getByRole("heading", { name: "Interested? Tell us what fits." }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Interested? Tell us what fits." }),
  ).toBeInViewport();
  const select = page.getByLabel("Package you’re interested in");
  for (const [id, name] of [
    ["foundation", "Foundation"],
    ["elite-coaching", "Elite Coaching"],
    ["undecided", "Not sure yet"],
  ]) {
    await select.selectOption(id);
    const link = new URL(
      (await page
        .getByRole("link", { name: "Email package interest" })
        .getAttribute("href"))!,
    );
    expect(link.protocol).toBe("mailto:");
    expect(link.pathname).toBe("Repformed@gmail.com");
    expect([...link.searchParams.keys()].sort()).toEqual(["body", "subject"]);
    expect(link.searchParams.get("body")).toContain(
      `Interested package: ${name}`,
    );
    expect(link.searchParams.get("body")).toContain(
      "not enrollment, payment or a reservation",
    );
    expect(link.searchParams.get("body")).toContain(
      "Please do not include child names",
    );
  }
  await expect(page.locator("input, textarea")).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.reload();
  await expect(select).toHaveValue("undecided");
});

test("copy address handles repeated clicks and clipboard denial without a submitted request", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          if (value !== "Repformed@gmail.com") throw new Error("wrong address");
        },
      },
    }),
  );
  await page.goto("./#membership");
  const button = page.getByRole("button", { name: "Copy email address" });
  await button.dblclick();
  await expect(page.getByRole("status")).toHaveText(
    "Email address copied. Paste it into your email app.",
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await button.click();
  await expect(page.getByRole("status")).toContainText("Copy is unavailable");
  await expect(
    page.getByText("Repformed@gmail.com", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/message sent|interest submitted|you’re enrolled/i),
  ).toHaveCount(0);
});

test("availability is above the fold and packages fit narrow screens with accessible controls", async ({
  page,
}, info) => {
  await page.goto("./#home");
  await expect(page.locator(".home-availability")).toBeInViewport();
  await expect(page.locator(".home-availability")).toContainText(
    "Membership enrollment is not open",
  );
  await page.goto("./#membership");
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 780 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.html),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: `docs/package-review/packages-${info.project.name}.png`,
    fullPage: true,
  });
});
