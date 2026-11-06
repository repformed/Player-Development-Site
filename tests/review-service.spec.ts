import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  fixture,
  id,
  userId,
  playerId,
  drillId,
  file,
  content,
  media,
  coachId,
} from "./videoReviewFixture";
import type { ReviewService } from "../src/reviewServices";
function request(overrides: Partial<ReviewService> = {}): ReviewService {
  return {
    id: id(60),
    account_id: userId,
    profile_id: playerId,
    video_id: null,
    assigned_to: coachId,
    drill_title: "Fictional original footwork",
    state: "requested",
    funding: "manual_pilot",
    blocker: "none",
    ready_at: null,
    due_at: null,
    delivered_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}
test("one-review request is shared, survives reload and repeated taps, and can be cancelled without payment", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "athlete", false, 1, true);
  backend.setAccess(false);
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("list", { name: "How a drill review works" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request one drill review" })
    .dblclick();
  await expect(
    page.getByText("Request received", { exact: true }),
  ).toBeVisible();
  expect(backend.serviceCounts.requests).toBe(1);
  expect(backend.services).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByText("Request received", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request one drill review" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel review request" }).click();
  await expect(
    page.getByRole("button", { name: "Request one drill review" }),
  ).toBeVisible();
  expect(backend.serviceCounts.cancels).toBe(1);
  await expect(page.getByRole("status")).toContainText("No charge");
});
test("record, preview and send creates one tracked submission with a 48-hour target", async ({
  page,
  context,
}) => {
  const ready = Date.parse("2026-11-06T12:00:00.999Z");
  let clockReads = 0;
  const backend = await fixture(
    context, "athlete", false, 1, true, userId,
    () => ready + clockReads++,
  );
  await page.goto("./?source=app#workspace");
  await page.getByRole("button", { name: "Send a drill video" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Choose drill video").setInputFiles(file);
  await expect(d.getByLabel("Your video preview")).toBeVisible();
  await d
    .getByRole("button", { name: "Send for coach review", exact: true })
    .dblclick();
  await expect(d).toHaveCount(0);
  await expect(
    page.getByText("Feedback target:", { exact: false }),
  ).toBeVisible();
  expect(backend.services).toHaveLength(1);
  const row = backend.services[0];
  const readyAt = row.ready_at, dueAt = row.due_at;
  expect(clockReads).toBe(1);
  expect(row.ready_at).toBe(new Date(ready).toISOString());
  expect(Date.parse(row.due_at!) - Date.parse(row.ready_at!)).toBe(
    48 * 3600000,
  );
  await page.reload();
  await expect(page.getByText("Feedback target:", { exact: false })).toBeVisible();
  expect(backend.services).toHaveLength(1);
  expect(clockReads).toBe(1);
  expect(backend.services[0].ready_at).toBe(readyAt);
  expect(backend.services[0].due_at).toBe(dueAt);
});
test("Owner and Manager service desk tracks deadlines, filters, assignments, cancelled edits and refresh", async ({
  page,
  context,
}, info) => {
  const backend = await fixture(context, "manager", false, 1, true);
  backend.services.push(
    request({
      state: "queued",
      due_at: new Date(Date.now() - 3600000).toISOString(),
      ready_at: new Date(Date.now() - 49 * 3600000).toISOString(),
    }),
    request({
      id: id(61),
      state: "queued",
      due_at: new Date(Date.now() + 4 * 3600000).toISOString(),
    }),
    request({
      id: id(62),
      state: "delivered",
      delivered_at: new Date().toISOString(),
    }),
  );
  await page.goto("./?source=app#video-reviews");
  const desk = page.getByRole("region", {
    name: "Service fulfillment tracker",
  });
  await expect(
    desk.getByRole("heading", { name: "Every review. Followed through." }),
  ).toBeVisible();
  await expect(desk.getByText("Overdue — follow up now")).toBeVisible();
  await desk
    .getByLabel("Show requests", { exact: true })
    .selectOption("overdue");
  await expect(desk.locator(".service-requests article")).toHaveCount(1);
  await desk
    .getByRole("button", { name: `Manage request ${id(60).slice(0, 8)}` })
    .click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Assigned review coach").selectOption(userId);
  await page.keyboard.press("Escape");
  expect(backend.serviceCounts.manages).toBe(0);
  await desk
    .getByRole("button", { name: `Manage request ${id(60).slice(0, 8)}` })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Assigned review coach").selectOption(userId);
  await d.getByLabel("Follow-up needed").selectOption("customer_follow_up");
  await d.getByRole("button", { name: "Save request" }).dblclick();
  await expect(d).toHaveCount(0);
  expect(backend.serviceCounts.manages).toBe(1);
  expect(backend.services[0].assigned_to).toBe(userId);
  await expect(
    desk.getByText("Customer follow-up needed", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    desk.getByText("Customer follow-up needed", { exact: true }),
  ).toBeVisible();
  await desk
    .getByLabel("Show requests", { exact: true })
    .selectOption("delivered");
  await expect(desk.locator(".service-requests article")).toHaveCount(1);
  await desk.getByLabel("Find a request").fill("no matching drill");
  await expect(
    desk.getByRole("heading", { name: "No requests in this view." }),
  ).toBeVisible();
  await desk.getByLabel("Find a request").fill("");
  await desk.getByLabel("Show requests", { exact: true }).selectOption("open");
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({
    width: info.project.name === "phone" ? 390 : 1440,
    height: 900,
  });
  await page.screenshot({
    path: `artifacts/service-desk-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("failed stale service updates stay open and never claim delivery", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "owner", false, 1, true);
  backend.services.push(request());
  backend.setFailManage(true);
  await page.goto("./?source=app#video-reviews");
  await page.getByRole("button", { name: /Manage request/ }).click();
  const d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Save request" }).click();
  await expect(d.getByRole("alert")).toContainText("changed");
  expect(backend.services[0].state).toBe("requested");
  expect(backend.services[0].delivered_at).toBeNull();
});
test("opening a review starts work, feedback alone marks shared service delivered", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "owner", false, 1, true);
  backend.rows.push({
    id: id(40),
    profile_id: playerId,
    account_id: userId,
    submitted_by: userId,
    resource_id: drillId,
    drill_title: content.title,
    asset_path: `${userId}/${playerId}/${id(40)}.webm`,
    media_type: "video/webm",
    byte_size: media.length,
    duration_seconds: 1,
    status: "queued",
    feedback: "",
    created_at: new Date().toISOString(),
    version: 2,
  });
  await page.goto("./?source=app#video-reviews");
  await page.getByRole("button", { name: "Open review", exact: true }).click();
  await expect(page.getByLabel("Private athlete practice video")).toBeVisible();
  expect(backend.services[0].state).toBe("in_review");
  expect(backend.services[0].delivered_at).toBeNull();
  await page
    .getByLabel("Coaching feedback")
    .fill("Good control. Take smaller steps and repeat slowly.");
  await page.getByRole("button", { name: "Send coaching feedback" }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("Show requests", { exact: true })
    .selectOption("delivered");
  await expect(
    page
      .locator(".service-requests")
      .getByText("Feedback ready", { exact: true }),
  ).toBeVisible();
  expect(backend.counts.feedback).toBe(1);
  expect(backend.services[0].delivered_at).toBeTruthy();
});

test("Owner can open the exact requesting account without searching or retyping", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, "owner", false, 1, true);
  backend.services.push(request());
  await page.goto("./?source=app#video-reviews");
  await page.getByRole("button", { name: /Manage request/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Open Account access" })
    .click();
  await expect(page).toHaveURL(/accessSection=training#access$/);
  await expect(
    page.getByRole("heading", { name: "Lesson & review access.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Customer account")).toHaveValue(userId);
  await expect(
    page.getByLabel("Enable the optional video review feature"),
  ).toBeVisible();
  expect(backend.counts.access).toBe(0);
});
