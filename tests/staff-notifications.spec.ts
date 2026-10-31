import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import {
  staffFixture,
  staffState,
  athleteA,
  athleteB,
  coachA,
  coachB,
} from "./staffServiceFixture";
import { fixture, state, uid, staffId } from "./workoutFixture";
import type { StaffMailState } from "../src/staffNotifications";

async function alerts(
  context: BrowserContext,
  role = "owner",
  rosterEnabled = true,
) {
  const roster = staffState();
  if (role === "parent") await fixture(context, state(), role);
  else
    await staffFixture(
      context,
      roster,
      role,
      role === "coach" ? coachA : staffId,
    );
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        membersEnabled: true,
        membersSignupEnabled: false,
        staffRosterEnabled: rosterEnabled,
        staffNotificationEmailsEnabled: true,
        interestIntakeEnabled: true,
      },
    }),
  );
  const now = new Date().toISOString();
  const interestRows: Array<Record<string, unknown>> = [
    {
      id: uid(240),
      adult_name: "Fictional Adult",
      email: "fictional-adult@example.test",
      package_interest: "undecided",
      created_at: now,
      email_state: "retry",
    },
  ];
  const snapshot: StaffMailState = {
    email_enabled: false,
    inapp_observation_enabled: false,
    signup_status: "interest_submission",
    routing_mode: "shared_inbox",
    recipient_label: "Repformed@gmail.com",
    jobs: [
      {
        id: uid(230),
        profile_id: athleteA,
        athlete_name: "Fictional Jordan",
        kind: "review_overdue",
        state: "accepted",
        attempts: 1,
        due_at: now,
        updated_at: now,
        code: null,
        provider_id: "TEST-provider-reference",
      },
      {
        id: uid(231),
        profile_id: athleteB,
        athlete_name: "Fictional Avery",
        kind: "training_overdue",
        state: "uncertain",
        attempts: 2,
        due_at: now,
        updated_at: now,
        code: "reconcile_required",
        provider_id: null,
      },
    ],
  };
  const calls = {
    reads: 0,
    interestReads: 0,
    preferences: 0,
    provider: 0,
    readFailure: false,
    interestFailure: false,
    interestDelay: 0,
    writeFailure: false,
  };
  await context.route("https://api.resend.com/**", (r) => {
    calls.provider++;
    return r.abort();
  });
  await context.route("**/rest/v1/rpc/**", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "staff_notification_workspace") {
      calls.reads++;
      if (calls.readFailure)
        return r.fulfill({
          status: 503,
          json: { message: "TEST status unavailable" },
        });
      const allowed = new Set(
        roster.rows
          .filter((a) => role !== "coach" || a.coach_id === coachA)
          .map((a) => a.athlete_id),
      );
      return r.fulfill({
        json: {
          ...snapshot,
          jobs: snapshot.jobs
            .filter((j) => allowed.has(j.profile_id))
            .map((j) => ({
              ...j,
              provider_id: role === "coach" ? null : j.provider_id,
            })),
        },
      });
    }
    if (name === "interest_staff_inbox") {
      calls.interestReads++;
      if (calls.interestDelay)
        await new Promise((resolve) =>
          setTimeout(resolve, calls.interestDelay),
        );
      if (calls.interestFailure)
        return r.fulfill({
          status: 503,
          json: { message: "Fictional inbox unavailable" },
        });
      return r.fulfill({
        json: role === "owner" || role === "manager" ? interestRows : [],
      });
    }
    if (name === "set_staff_notification_opt_out") {
      calls.preferences++;
      return r.fulfill({
        status: 403,
        json: { message: "Shared inbox routing is fixed" },
      });
    }
    return r.fallback();
  });
  return { snapshot, calls, roster, interestRows };
}

test("Owner status separates provider acceptance, uncertain outcomes and disabled capabilities", async ({
  page,
  context,
}, info) => {
  const data = await alerts(context);
  await page.goto("./?source=app#staff-delivery");
  await page.getByText("Staff email status", { exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Staff operational email status",
  });
  await expect(panel).toContainText("Staff email dispatch disabled");
  await expect(panel).toContainText(
    "Provider accepted · inbox delivery not confirmed",
  );
  await expect(panel).toContainText(
    "Outcome uncertain · reconcile before resending",
  );
  await expect(panel).toContainText("saved adult interest submissions only");
  await expect(panel).toContainText("Automatic in-app observation disabled");
  await expect(panel).toContainText("TEST-provider-reference");
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(panel.getByRole("button")).toHaveCount(1);
  expect(data.calls.provider).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[aria-label="Staff operational email status"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await mkdir("artifacts/staff-notifications", { recursive: true });
  await panel.screenshot({
    path: `artifacts/staff-notifications/status-${info.project.name}.png`,
    style: ".app-header,.app-tabs{visibility:hidden !important}",
  });
});

test("interest inbox works without roster rollout and separates loading, empty and retryable error", async ({
  page,
  context,
}) => {
  const data = await alerts(context, "owner", false);
  data.interestRows.splice(0);
  data.calls.interestDelay = 250;
  await page.goto("./#interest");
  const inbox = page.getByRole("region", {
    name: "Private package interest inbox",
  });
  await expect(inbox.getByRole("status")).toHaveText(
    "Loading interest requests…",
  );
  await expect(inbox.getByText("No interest requests recorded.")).toHaveCount(
    0,
  );
  await expect(inbox).toContainText("No interest requests recorded.");
  data.calls.interestFailure = true;
  await inbox
    .getByRole("button", { name: "Refresh interest requests" })
    .click();
  await expect(inbox.getByRole("alert")).toContainText("could not be loaded");
  await expect(inbox.getByText("No interest requests recorded.")).toHaveCount(
    0,
  );
  data.calls.interestFailure = false;
  await inbox
    .getByRole("button", { name: "Refresh interest requests" })
    .click();
  await expect(inbox).toContainText("No interest requests recorded.");
  expect(data.calls.provider).toBe(0);
});
test("Coach direct interest URL is denied before a private inbox read", async ({
  page,
  context,
}) => {
  const data = await alerts(context, "coach");
  await page.goto("./#interest");
  await expect(
    page.getByRole("heading", { name: "Staff interest inbox." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Private package interest inbox" }),
  ).toHaveCount(0);
  expect(data.calls.interestReads).toBe(0);
});

test("Manager sees the shared inbox status and private interest without recipient-edit controls", async ({
  page,
  context,
}) => {
  const data = await alerts(context, "manager");
  await page.goto("./?source=app#staff-delivery");
  await page.getByText("Staff email status", { exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Staff operational email status",
  });
  await expect(panel).toContainText("Repformed@gmail.com");
  await expect(panel).toContainText(
    "Owner/Manager email routing is not active",
  );
  await expect(panel.getByRole("button")).toHaveCount(1);
  const inbox = page.getByRole("region", {
    name: "Private package interest inbox",
  });
  await page.goto("./?source=app#interest");
  await expect(inbox).toContainText("fictional-adult@example.test");
  await expect(inbox).not.toContainText("Waiting for safe retry");
  await expect(inbox.locator("details")).toHaveCount(0);
  await page.reload();
  await expect(inbox).toContainText("fictional-adult@example.test");
  expect(data.calls.preferences).toBe(0);
  expect(data.calls.provider).toBe(0);
});

test("Coach renders only scoped jobs and clears revoked assignment results on refresh", async ({
  page,
  context,
}) => {
  const data = await alerts(context, "coach");
  await page.goto("./?source=app#staff-delivery");
  await page.getByText("Staff email status", { exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Staff operational email status",
  });
  await expect(panel).toContainText("Fictional Jordan");
  await expect(panel).not.toContainText("Fictional Avery");
  await expect(panel).not.toContainText("TEST-provider-reference");
  await expect(
    page.getByRole("region", { name: "Private package interest inbox" }),
  ).toHaveCount(0);
  data.roster.rows.find((r) => r.athlete_id === athleteA)!.coach_id = coachB;
  await panel
    .getByRole("button", { name: "Refresh staff email status" })
    .click();
  await expect(panel).toContainText("No operational email attempts recorded");
  await expect(panel).not.toContainText("Fictional Jordan");
});
test("private interest distinguishes unrecorded, unchecked and earlier affirmative launch choices", async ({
  page,
  context,
}) => {
  const data = await alerts(context);
  await page.goto("./?source=app#interest");
  const inbox = page.getByRole("region", {
    name: "Private package interest inbox",
  });
  await expect(inbox).toContainText("Latest launch-email choice: Not recorded");
  await expect(inbox).toContainText("Launch-email permission: Review needed");
  await expect(
    inbox.getByText("Launch preference record", { exact: true }),
  ).toHaveCount(0);
  Object.assign(data.interestRows[0], {
    launch_choice: false,
    launch_choice_at: "2026-10-28T10:00:00Z",
    launch_notice_version: "repformed-launch-notice-v1",
    launch_requested_at: "2026-10-27T10:00:00Z",
    launch_requested_version: "repformed-launch-notice-v1",
  });
  await inbox
    .getByRole("button", { name: "Refresh interest requests" })
    .click();
  await expect(inbox).toContainText("Latest launch-email choice: Not selected");
  await expect(inbox).toContainText("Launch request on record for this email.");
  await expect(inbox).toContainText("Check prior requests and withdrawals");
  await expect(inbox).not.toContainText("Launch email: Not requested");
  await expect(inbox.locator("details")).toHaveCount(0);
  await expect(inbox).not.toContainText("repformed-launch-notice-v1");
  await expect(inbox).not.toContainText("2026-10-27");
  expect(data.interestRows[0].launch_requested_at).toBe("2026-10-27T10:00:00Z");
  Object.assign(data.interestRows[0], { launch_choice: true });
  await inbox
    .getByRole("button", { name: "Refresh interest requests" })
    .click();
  await expect(inbox).toContainText("Latest launch-email choice: Requested");
  await expect(inbox).not.toContainText(
    "Launch request on record for this email.",
  );
  Object.assign(data.interestRows[0], {
    adult_name: "",
    launch_choice: false,
    launch_choice_at: null,
    launch_notice_version: null,
  });
  await inbox
    .getByRole("button", { name: "Refresh interest requests" })
    .click();
  await expect(inbox).toContainText("Latest launch-email choice: Not recorded");
  await expect(inbox).toContainText("Launch request on record for this email.");
  await expect(inbox).toContainText("Launch-email permission: Review needed");
  await expect(inbox).not.toContainText("Adult contact");
  await expect(inbox).toContainText("fictional-adult@example.test");
  expect(data.interestRows[0].launch_requested_at).toBe("2026-10-27T10:00:00Z");
  expect(data.calls.provider).toBe(0);
  expect(data.calls.preferences).toBe(0);
});

test("an unchecked first form does not imply an opt-in or a withdrawal", async ({
  page,
  context,
}) => {
  const data = await alerts(context);
  Object.assign(data.interestRows[0], {
    launch_choice: false,
    launch_choice_at: "2026-10-31T10:00:00Z",
    launch_notice_version: "repformed-launch-notice-v1",
    launch_requested_at: null,
    launch_requested_version: null,
  });
  await page.goto("./?source=app#interest");
  const inbox = page.getByRole("region", {
    name: "Private package interest inbox",
  });
  const card = inbox.locator("li").first();
  await expect(card).toContainText("Latest launch-email choice: Not selected");
  await expect(card).not.toContainText("Launch request on record");
  await expect(card).not.toContainText("withdrawn");
  await expect(inbox).toContainText("Launch-email permission: Review needed");
  expect(data.calls.provider).toBe(0);
  expect(data.calls.preferences).toBe(0);
});

test("incomplete legacy choice metadata never becomes a yes or no permission", async ({
  page,
  context,
}) => {
  const data = await alerts(context);
  await page.goto("./?source=app#interest");
  const inbox = page.getByRole("region", {
    name: "Private package interest inbox",
  });
  for (const choice of [
    {
      launch_choice: true,
      launch_choice_at: null,
      launch_notice_version: "repformed-launch-notice-v1",
    },
    {
      launch_choice: null,
      launch_choice_at: "2026-10-31T10:00:00Z",
      launch_notice_version: "repformed-launch-notice-v1",
    },
    {
      launch_choice: false,
      launch_choice_at: "2026-10-31T10:00:00Z",
      launch_notice_version: null,
    },
  ]) {
    Object.assign(data.interestRows[0], choice);
    await inbox
      .getByRole("button", { name: "Refresh interest requests" })
      .click();
    await expect(inbox).toContainText(
      "Latest launch-email choice: Not recorded",
    );
    await expect(inbox).not.toContainText(
      "Latest launch-email choice: Requested",
    );
    await expect(inbox).not.toContainText(
      "Latest launch-email choice: Not selected",
    );
    await expect(inbox).toContainText("Launch-email permission: Review needed");
  }
  expect(data.calls.provider).toBe(0);
  expect(data.calls.preferences).toBe(0);
});

test("interest cards contain only recorded inputs and never expose technical details", async ({
  page,
  context,
}) => {
  const data = await alerts(context);
  Object.assign(data.interestRows[0], {
    package_interest: "elite-coaching",
    launch_choice: true,
    launch_choice_at: "2026-10-28T10:00:00Z",
    launch_notice_version: "repformed-launch-notice-v1",
    launch_requested_at: "2026-10-28T10:00:00Z",
    launch_requested_version: "repformed-launch-notice-v1",
  });
  await page.goto("./?source=app#interest");
  const inbox = page.getByRole("region", {
    name: "Private package interest inbox",
  });
  const card = inbox.locator("li").first();
  await expect(card).toContainText("Latest launch-email choice: Requested");
  await expect(inbox).toContainText("Launch-email permission: Review needed");
  expect(
    (await card.innerText())
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean),
  ).toEqual([
    "Fictional Adult",
    "fictional-adult@example.test",
    "Elite Coaching",
    "Latest launch-email choice: Requested",
  ]);
  await expect(card.locator("details,summary")).toHaveCount(0);
  expect(data.interestRows[0].email_state).toBe("retry");
  expect(data.interestRows[0].launch_notice_version).toBe(
    "repformed-launch-notice-v1",
  );
  expect(data.calls.provider).toBe(0);
});

test("Status read failures are retryable and do not retain stale job data", async ({
  page,
  context,
}) => {
  const data = await alerts(context);
  await page.goto("./?source=app#staff-delivery");
  await page.getByText("Staff email status", { exact: true }).click();
  const panel = page.getByRole("region", {
    name: "Staff operational email status",
  });
  await expect(panel).toContainText("Fictional Jordan");
  data.calls.readFailure = true;
  await panel
    .getByRole("button", { name: "Refresh staff email status" })
    .click();
  await expect(panel.getByRole("alert")).toContainText(
    "TEST status unavailable",
  );
  await expect(panel).not.toContainText("Fictional Jordan");
  data.calls.readFailure = false;
  await panel
    .getByRole("button", { name: "Refresh staff email status" })
    .click();
  await expect(panel).toContainText("Fictional Jordan");
  expect(data.calls.preferences).toBe(0);
  expect(data.calls.provider).toBe(0);
});

test("Parent workspace never loads the staff email projection even with its UI feature flag enabled", async ({
  page,
  context,
}) => {
  const data = await alerts(context, "parent");
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("heading", { name: "Today’s training.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Staff operational email status" }),
  ).toHaveCount(0);
  expect(data.calls.reads).toBe(0);
  expect(data.calls.preferences).toBe(0);
});
