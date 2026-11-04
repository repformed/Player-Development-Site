import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { disableBackend } from "./backendFixture";

const plans = [
  {
    id: "foundation",
    name: "Foundation",
    audience: "For athletes learning football basics",
    benefit: "Understand the game before adding drills.",
  },
  {
    id: "fundamentals",
    name: "Fundamentals",
    audience: "For athletes ready for guided practice",
    benefit: "Add two fundamental movement sessions each week.",
  },
  {
    id: "position-development",
    name: "Position Development",
    audience: "For a focus on one selected position",
    benefit: "Add two position drills a week for one selected position.",
  },
  {
    id: "elite-coaching",
    name: "Elite Coaching",
    audience: "For athletes seeking personalized corrections",
    benefit:
      "Add two athlete-chosen drill corrections per month, with next-step practice feedback.",
  },
];

test.beforeEach(async ({ context, page }) => {
  await disableBackend(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("essential differences are visible without expanding details and match one comparison", async ({
  page,
}, info) => {
  await page.goto("./#membership");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Choose the support your athlete needs.",
  );
  for (const p of plans) {
    const card = page.getByRole("article", { name: p.name, exact: true });
    await expect(card.getByText(p.audience, { exact: true })).toBeVisible();
    await expect(card.getByText(p.benefit, { exact: true })).toBeVisible();
    await expect(card).toContainText("USD / athlete / month");
    await expect(
      card.getByRole("button", {
        name: `Express interest in ${p.name}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  await expect(page.locator(".proposal-details[open]")).toHaveCount(0);
  await expect(page.getByRole("main")).not.toContainText(
    /group coaching|group film|film.study or coaching session/i,
  );
  await expect(page.getByRole("main")).not.toContainText(
    /pilot pricing|delivery.cost testing|prices.*under review/i,
  );
  for (const [name, annual, saving] of [
    ["Foundation", "99", "20.88"],
    ["Fundamentals", "199", "40.88"],
    ["Position Development", "399", "80.88"],
    ["Elite Coaching", "699", "140.88"],
  ]) {
    const card = page.getByRole("article", { name, exact: true });
    await expect(card.locator(".proposal-annual")).toContainText(
      `$${annual} / year · save $${saving}`,
    );
  }
  if (info.project.name === "desktop") {
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    const rows = [
      [
        "Weekly football IQ",
        [
          "2 videos + 2 quizzes / week",
          "2 videos + 2 quizzes / week",
          "2 videos + 2 quizzes / week",
          "2 videos + 2 quizzes / week",
        ],
      ],
      [
        "Weekly movement training",
        [
          "No drills",
          "2 movement sessions / week",
          "2 movement sessions / week",
          "2 movement sessions / week",
        ],
      ],
      [
        "Weekly position drills",
        [
          "Not included",
          "Not included",
          "2 additional drills / week",
          "2 additional drills / week",
        ],
      ],
      [
        "Position pathway",
        [
          "Not included",
          "Not included",
          "One selected position",
          "One selected position",
        ],
      ],
      [
        "Individual corrections",
        [
          "Not included",
          "Not included",
          "Not included",
          "2 corrections / athlete / month",
        ],
      ],
    ] as const;
    for (const [label, values] of rows)
      await expect(
        table
          .getByRole("row")
          .filter({
            has: page.getByRole("rowheader", { name: label, exact: true }),
          })
          .getByRole("cell"),
      ).toHaveText([...values]);
    for (const list of await page.locator(".proposal-mobile-features").all())
      await expect(list).not.toBeVisible();
  } else {
    await expect(page.locator(".package-comparison")).not.toBeVisible();
    const base = page.getByRole("definition").filter({ hasText: "No drills" });
    await expect(base).toBeVisible();
    const elite = page
      .getByRole("article", { name: "Elite Coaching", exact: true })
      .locator(".proposal-mobile-features");
    await expect(elite).toBeVisible();
    await expect(elite.locator("dd")).toHaveText([
      "2 videos + 2 quizzes / week",
      "2 movement sessions / week",
      "2 additional drills / week",
      "One selected position",
      "2 corrections / athlete / month",
    ]);
  }
  const details = page.getByRole("region", {
    name: "Proposed delivery rhythm",
  });
  await expect(details).toContainText("not shared across siblings");
  await expect(details).toContainText(
    "up to three minutes of footage per submission",
  );
  await expect(details).toContainText("three business days, not guaranteed");
  await expect(details).toContainText(
    "adds two position-specific drills each week",
  );
  await expect(details).toContainText("not an active public delivery schedule");
  await expect(page.getByText(/most popular/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /checkout|pay now|subscribe/i }),
  ).toHaveCount(0);
});

test("keyboard plan choices focus the existing interest flow without sending and details toggle independently", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(r.method()))
      writes.push(r.url());
  });
  await page.goto("./#membership");
  for (const p of plans) {
    const button = page.getByRole("button", {
      name: `Express interest in ${p.name}`,
      exact: true,
    });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", {
        name: "Interested? Tell us what fits.",
        exact: true,
      }),
    ).toBeFocused();
    await expect(page.getByLabel("Package you’re interested in")).toHaveValue(
      p.id,
    );
  }
  const summary = page.getByText("What’s included in Position Development", {
    exact: true,
  });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("group", {
      name: "Position Development complete proposal",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("group", {
      name: "Position Development complete proposal",
      exact: true,
    }),
  ).not.toBeVisible();
  await expect(summary).toBeFocused();
  expect(writes).toEqual([]);
});

test("short stacked summaries and comparison reflow without clipping or page overflow", async ({
  page,
}, info) => {
  await page.goto("./#membership");
  await page.evaluate(() => document.fonts.ready);
  for (const width of info.project.name === "phone"
    ? [320, 375, 390]
    : [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width < 760) {
      for (const p of plans) {
        const card = page.getByRole("article", { name: p.name, exact: true });
        const title = await card.locator("h2").evaluate((el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          return {
            left: r.getBoundingClientRect().left,
            right: r.getBoundingClientRect().right,
            bottom: r.getBoundingClientRect().bottom,
          };
        });
        const price = await card.locator(".proposal-price").boundingBox();
        expect(price).not.toBeNull();
        expect(
          title.right <= price!.x - 4 || title.bottom <= price!.y - 4,
        ).toBe(true);
        expect(title.left).toBeGreaterThanOrEqual(0);
      }
    }
  }
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.html),
    })),
  ).toEqual([]);
  await mkdir("artifacts/package-essentials", { recursive: true });
  await page.screenshot({
    path: `artifacts/package-essentials/packages-${info.project.name}.png`,
    fullPage: true,
  });
});
