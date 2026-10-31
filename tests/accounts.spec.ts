import { practiceResumeFixture } from "./practiceResumeFixture";
import { DRILLS as SAMPLES } from "../src/data";
import { disableBackend } from "./backendFixture";
import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Fictional assigned resources, independent of the public demo catalog.
const DRILLS = SAMPLES.map((d, i) => ({
  ...d,
  id: `70000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  source: "shared" as const,
}));
const parentId = "10000000-0000-4000-8000-000000000001";
const otherId = "20000000-0000-4000-8000-000000000002";
type Row = Record<string, unknown>;
function jwt(id: string) {
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fictional-signature`;
}
function fixture(
  under18Enabled = true,
  signupEnabled = true,
  primaryRole:
    "owner" | "manager" | "coach" | "parent" | "athlete" | null = null,
) {
  const paused = practiceResumeFixture();
  const accounts = new Map<string, Row>();
  const players = new Map<string, Row>();
  const levels = new Map<string, { role: string; version: number }>();
  const links = new Map<string, string>();
  const guardianAccounts = new Set<string>();
  const controls = new Map<string, { allowed: boolean; version: number }>();
  const workouts = new Map<string, Row>();
  const invitations = new Map<string, string>();

  let rejectRoleChange = false;
  const levelFor = (id: string) =>
    levels.get(id) ||
    (id === parentId && primaryRole
      ? { role: primaryRole, version: 1 }
      : accounts.has(id)
        ? {
            role:
              accounts.get(id)!.account_type === "parent"
                ? "parent"
                : "athlete",
            version: 1,
          }
        : null);
  const counts = {
    writes: 0,
    signup: 0,
    recover: 0,
    password: 0,
    resend: 0,
    roleWrites: 0,
    workoutWrites: 0,
    parentReviews: 0,
  };
  let failNextSave = false;
  let ambiguousSave = false;
  const user = (id: string) => ({
    id,
    aud: "authenticated",
    role: "authenticated",
    email:
      id === parentId
        ? "fictional-parent@example.test"
        : "fictional-adult@example.test",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  });
  async function install(context: BrowserContext) {
    await context.route("**/content-config.json", (route) =>
      route.fulfill({
        json: {
          enabled: true,
          membersEnabled: true,
          membersSignupEnabled: signupEnabled,
          url: "https://member-fixture.supabase.co",
          publishableKey: "sb_publishable_fixture_only",
        },
      }),
    );
    await context.route(
      "https://member-fixture.supabase.co/**",
      async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          method = req.method();
        const body = req.postData() ? req.postDataJSON() : {};
        const bearer = req.headers().authorization?.slice(7);
        const id = bearer?.includes(".")
          ? JSON.parse(
              Buffer.from(bearer.split(".")[1], "base64url").toString(),
            ).sub
          : parentId;
        const singular = req
          .headers()
          .accept?.includes("application/vnd.pgrst.object+json");
        const resume = paused.handle(url.pathname, body, id);
        if (resume)
          return route.fulfill({ json: resume.data, status: resume.status });
        if (url.pathname.endsWith("/token")) {
          const loginId = body.email?.includes("adult") ? otherId : parentId;
          return route.fulfill({
            json: {
              access_token: jwt(loginId),
              refresh_token: "fictional-refresh",
              expires_in: 3600,
              token_type: "bearer",
              user: user(loginId),
            },
          });
        }
        if (url.pathname.endsWith("/signup")) {
          counts.signup++;
          return route.fulfill({ json: user(parentId) });
        }
        if (url.pathname.endsWith("/resend")) {
          counts.resend++;
          return route.fulfill({ json: {} });
        }
        if (url.pathname.endsWith("/recover")) {
          counts.recover++;
          return route.fulfill({ json: {} });
        }
        if (url.pathname.endsWith("/user")) {
          if (method === "PUT") counts.password++;
          return route.fulfill({ json: user(id) });
        }
        if (url.pathname.endsWith("/logout"))
          return route.fulfill({ status: 204, body: "" });
        if (
          url.pathname.includes("/coach_members") ||
          url.pathname.includes("/training_resources") ||
          url.pathname.endsWith("/rpc/staff_training_resources")
        )
          return route.fulfill({ json: [] });
        if (url.pathname.endsWith("/rpc/athlete_account_context"))
          return route.fulfill({
            json: {
              guardian_managed: guardianAccounts.has(id),
              linked_profile_id:
                [...links.entries()].find(([, user]) => user === id)?.[0] ||
                null,
            },
          });
        if (url.pathname.endsWith("/rpc/athlete_training_plan"))
          return route.fulfill({
            json: DRILLS.map((d) => ({
              id: d.id,
              content: d,
              asset_path: `${parentId}/${d.id}/${d.id}.mp4`,
              asset_type: "video/mp4",
              asset_name: "fictional.mp4",
              version: 1,
              visibility: "member_only",
            })),
          });
        if (url.pathname.includes("/storage/v1/object/sign/"))
          return route.fulfill({
            json: {
              signedURL:
                "/object/sign/training-media/fictional.mp4?token=fixture",
            },
          });
        if (url.pathname.endsWith("/rpc/athlete_video_state"))
          return route.fulfill({
            json: { can_submit: false, adult_only: false, reviews: [] },
          });
        if (url.pathname.includes("/member_training_access"))
          return route.fulfill({ json: null });
        if (url.pathname.endsWith("/rpc/family_profile_state")) {
          const p = players.get(body.target_profile);
          if (!p || (p.owner_id !== id && links.get(p.id as string) !== id))
            return route.fulfill({
              status: 403,
              json: { message: "Athlete unavailable" },
            });
          const permission = controls.get(p.id as string) || {
            allowed: false,
            version: 0,
          };
          return route.fulfill({
            json: {
              is_family:
                accounts.get(p.owner_id as string)?.account_type === "parent",
              is_parent:
                accounts.get(p.owner_id as string)?.account_type === "parent" &&
                p.owner_id === id,
              can_record: p.owner_id === id || permission.allowed,
              self_recording_allowed: permission.allowed,
              permission_version: permission.version,
              has_link: links.has(p.id as string),
              child_access_ready: true,
              workouts: [...workouts.values()].filter(
                (w) => w.profile_id === p.id,
              ),
            },
          });
        }
        if (url.pathname.endsWith("/rpc/set_athlete_permission")) {
          const p = players.get(body.target_profile),
            old = controls.get(body.target_profile) || {
              allowed: false,
              version: 0,
            };
          if (p?.owner_id !== id || old.version !== body.expected_version)
            return route.fulfill({
              status: 409,
              json: {
                message:
                  "Permission changed on another device. Refresh before retrying.",
              },
            });
          controls.set(body.target_profile, {
            allowed: body.allowed,
            version: old.version + 1,
          });
          return route.fulfill({ json: {} });
        }
        if (url.pathname.endsWith("/rpc/create_athlete_invite")) {
          if (
            players.get(body.target_profile)?.owner_id !== id ||
            !controls.get(body.target_profile)?.allowed
          )
            return route.fulfill({
              status: 403,
              json: { message: "Parent permission required" },
            });
          const code = "ab".repeat(32);
          invitations.set(code, body.target_profile);
          return route.fulfill({ json: code });
        }
        if (url.pathname.endsWith("/rpc/accept_athlete_invite")) {
          const profile = invitations.get(body.access_code);
          if (!profile)
            return route.fulfill({
              status: 400,
              json: { message: "This access code is unavailable or expired." },
            });
          links.set(profile, id);
          levels.set(id, { role: "athlete", version: 1 });
          if (players.get(profile)?.age_group !== "18+")
            guardianAccounts.add(id);
          invitations.delete(body.access_code);
          return route.fulfill({ json: profile });
        }
        if (url.pathname.endsWith("/rpc/remove_athlete_access")) {
          if (players.get(body.target_profile)?.owner_id !== id)
            return route.fulfill({
              status: 403,
              json: { message: "Parent required" },
            });
          links.delete(body.target_profile);
          return route.fulfill({ status: 204, body: "" });
        }
        if (url.pathname.endsWith("/rpc/report_athlete_workout")) {
          const p = players.get(body.target_profile);
          if (
            !p ||
            (p.owner_id !== id &&
              (links.get(body.target_profile) !== id ||
                !controls.get(body.target_profile)?.allowed))
          )
            return route.fulfill({
              status: 403,
              json: {
                message: "The parent has paused independent workout recording.",
              },
            });
          if (workouts.has(body.workout_id))
            return route.fulfill({ json: workouts.get(body.workout_id) });
          const drills = body.requested_drills.map((d: string) =>
            DRILLS.find((x) => x.id === d)!,
          );
          counts.workoutWrites++;
          const row = {
            id: body.workout_id,
            profile_id: body.target_profile,
            reported_by: id,
            drill_ids: body.requested_drills,
            titles: drills.map((d: (typeof DRILLS)[number]) => d.title),
            minutes: drills.reduce(
              (sum: number, d: (typeof DRILLS)[number]) => sum + d.minutes,
              0,
            ),
            status:
              p.owner_id === id
                ? accounts.get(id)?.account_type === "parent"
                  ? "approved"
                  : "self_reported"
                : "pending_parent",
            created_at: new Date().toISOString(),
            reviewed_by:
              p.owner_id === id && accounts.get(id)?.account_type === "parent"
                ? id
                : null,
            reviewed_at:
              p.owner_id === id && accounts.get(id)?.account_type === "parent"
                ? new Date().toISOString()
                : null,
            version: 1,
          };
          workouts.set(row.id, row);
          paused.complete(id, row.profile_id, row.id);
          return route.fulfill({ json: row });
        }
        if (url.pathname.endsWith("/rpc/review_athlete_workout")) {
          const w = workouts.get(body.workout_id);
          if (
            !w ||
            players.get(w.profile_id as string)?.owner_id !== id ||
            w.version !== body.expected_version
          )
            return route.fulfill({
              status: 409,
              json: {
                message: "Only this athlete’s parent can review the workout.",
              },
            });
          counts.parentReviews++;
          const next = {
            ...w,
            status: body.decision,
            version: body.expected_version + 1,
            reviewed_by: id,
            reviewed_at: new Date().toISOString(),
          };
          workouts.set(body.workout_id, next);
          return route.fulfill({ json: next });
        }
        if (url.pathname.includes("/athlete_workouts")) {
          const requested = url.searchParams.get("id")?.replace(/^eq\./, "");
          return route.fulfill({
            json:
              requested && workouts.has(requested)
                ? [workouts.get(requested)]
                : [],
          });
        }
        if (url.pathname.endsWith("/rpc/complete_member_account")) {
          const account = {
            user_id: id,
            account_type: body.kind,
            privacy_version: "profile-pilot-2026-10",
          };
          accounts.set(id, account);
          return route.fulfill({ json: account });
        }
        if (url.pathname.endsWith("/rpc/delete_member_data")) {
          accounts.delete(id);
          for (const [key, player] of players)
            if (player.owner_id === id) players.delete(key);
          return route.fulfill({ status: 204, body: "" });
        }
        if (url.pathname.endsWith("/rpc/list_account_access")) {
          if (levelFor(id)?.role !== "owner")
            return route.fulfill({
              status: 403,
              json: { message: "Owner access required" },
            });
          return route.fulfill({
            json: [parentId, otherId]
              .map((target) => ({
                user_id: target,
                email: user(target).email,
                role: levelFor(target)?.role || null,
                version: levelFor(target)?.version || 0,
                email_verified: true,
                adult_setup: accounts.has(target),
              }))
              .filter((row) => row.email.includes(body.search_text || "")),
          });
        }
        if (url.pathname.endsWith("/rpc/assign_account_role")) {
          if (
            levelFor(id)?.role !== "owner" ||
            body.target_user === id ||
            rejectRoleChange ||
            levelFor(body.target_user)?.version !== body.expected_version
          ) {
            rejectRoleChange = false;
            return route.fulfill({
              status: 409,
              json: { message: "Access change rejected" },
            });
          }
          counts.roleWrites++;
          levels.set(body.target_user, {
            role: body.new_role,
            version: body.expected_version + 1,
          });
          return route.fulfill({
            json: {
              user_id: body.target_user,
              ...levels.get(body.target_user),
            },
          });
        }
        if (url.pathname.includes("/account_roles"))
          return route.fulfill({ json: levelFor(id) ? [levelFor(id)] : [] });
        if (url.pathname.includes("/profile_settings"))
          return route.fulfill({ json: { under18_enabled: under18Enabled } });
        if (url.pathname.includes("/member_accounts"))
          return route.fulfill({
            json: accounts.has(id) ? [accounts.get(id)] : [],
          });
        if (url.pathname.includes("/player_profiles")) {
          const playerId = url.searchParams.get("id")?.replace(/^eq\./, "");
          const version = Number(
            url.searchParams.get("version")?.replace(/^eq\./, ""),
          );
          if (method === "GET")
            return route.fulfill({
              json: [...players.values()].filter(
                (p) =>
                  (p.owner_id === id || links.get(p.id as string) === id) &&
                  (!playerId || p.id === playerId),
              ),
            });
          if (failNextSave) {
            failNextSave = false;
            return route.fulfill({
              status: 403,
              json: { message: "Simulated rejected save" },
            });
          }
          counts.writes++;
          if (method === "POST") {
            const row = { ...body, owner_id: id, version: 1 };
            players.set(row.id, row);
            if (ambiguousSave) {
              ambiguousSave = false;
              return route.fulfill({
                status: 409,
                json: { message: "Simulated lost response after commit" },
              });
            }
            return route.fulfill({ status: 201, json: singular ? row : [row] });
          }
          const old = playerId && players.get(playerId);
          if (!old || old.owner_id !== id || old.version !== version)
            return route.fulfill({ json: [] });
          if (method === "PATCH") {
            const row = { ...old, ...body, version: version + 1 };
            players.set(playerId!, row);
            return route.fulfill({ json: singular ? row : [row] });
          }
          players.delete(playerId!);
          return route.fulfill({
            json: singular ? { id: playerId } : [{ id: playerId }],
          });
        }
        return route.fulfill({
          status: 404,
          json: { message: "Unexpected fixture request" },
        });
      },
    );
  }
  return {
    install,
    counts,
    players,
    accounts,
    levels,
    links,
    controls,
    workouts,
    rejectRole: () => {
      rejectRoleChange = true;
    },
    rejectSave: () => {
      failNextSave = true;
    },
    loseSaveResponse: () => {
      ambiguousSave = true;
    },
  };
}
async function signIn(
  page: import("@playwright/test").Page,
  email = "fictional-parent@example.test",
) {
  await page.goto("./#account");
  const signInMode = page.getByRole("button", { name: "Sign in", exact: true });
  if (await signInMode.isVisible()) await signInMode.click();
  await page.getByLabel(/^(Adult|Account) email$/).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-only");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  // Full-page navigation must wait for Auth to persist the successful session.
  // Otherwise the following goto can cancel the token request on slower workers.
  await expect(page.getByLabel(/^(Adult|Account) email$/)).toHaveCount(0);
  await expect(page).toHaveURL(/#workspace$/);
  // This suite exercises profile administration; login itself lands in training.
  await page.goto("./#profiles");
}
async function signOut(page: import("@playwright/test").Page) {
  await page.goto("./#account");
  await page.getByRole("button", { name: "Sign out of this browser" }).click();
}
async function setup(
  page: import("@playwright/test").Page,
  kind: "parent" | "adult" = "parent",
) {
  await page.goto("./#profiles");
  await page.getByLabel("Account type").selectOption(kind);
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: "Finish account setup" }).click();
  await expect(
    page.getByRole("heading", { name: "A fresh start for your players." }),
  ).toBeVisible();
}
test.beforeEach(async ({ context }) => {
  await disableBackend(context);
});

test("unconfigured public member entry is honest and collects no profile data", async ({
  page,
}) => {
  await page.goto("./#account");
  await expect(
    page.getByRole("heading", {
      name: "Private profiles are being connected.",
    }),
  ).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Try the sample demo" }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("parent profiles support private create, edit, cancel, repeated clicks, refresh, cross-device access and deletion", async ({
  page,
  context,
  browser,
}) => {
  const backend = fixture();
  await backend.install(context);
  await page.addInitScript(() =>
    localStorage.setItem(
      "pd-demo-v1",
      JSON.stringify({
        version: 1,
        profile: {
          id: "morgan",
          name: "Morgan",
          age: "18+",
          position: "Quarterback",
          level: "Experienced",
          goal: "Footwork",
          guardian: false,
        },
        history: [],
        custom: [],
        run: null,
      }),
    ),
  );
  await signIn(page);
  await setup(page);
  await page.getByRole("button", { name: "Add your first player" }).click();
  await page.getByLabel("Player nickname").fill("Fictional Comet");
  await page.getByLabel("Age group", { exact: true }).selectOption("8–12");
  await page.getByRole("checkbox").check();
  backend.loseSaveResponse();
  await page.getByRole("button", { name: "Save private player" }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Fictional Comet", exact: true }),
  ).toBeVisible();
  expect(backend.counts.writes).toBe(1);
  await page.getByRole("button", { name: "Edit Fictional Comet" }).click();
  await page.getByLabel("Player nickname").fill("Discarded draft");
  await page.getByRole("button", { name: "Cancel changes" }).click();
  expect(backend.counts.writes).toBe(1);
  await page.getByRole("button", { name: "Edit Fictional Comet" }).click();
  await page.getByLabel("Primary goal").selectOption("Ball skills");
  await page.getByRole("button", { name: "Save private player" }).click();
  await expect(page.getByText("Private player profile saved.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Fictional Comet", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ball skills", { exact: true })).toBeVisible();
  const localState = JSON.parse(
    (await page.evaluate(() => localStorage.getItem("pd-demo-v1")))!,
  );
  expect(JSON.stringify(localState)).not.toContain("Fictional Comet");
  expect(localState.profile.name).toBe("Morgan");
  await expect(page.locator("main").getByText("Morgan")).toHaveCount(0);
  const second = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  await backend.install(second);
  const partner = await second.newPage();
  await signIn(partner);
  await expect(
    partner.getByRole("heading", { name: "Fictional Comet", exact: true }),
  ).toBeVisible();
  await second.close();
  await page.getByRole("button", { name: "Delete Fictional Comet" }).click();
  await page.getByRole("button", { name: "Keep profile" }).click();
  expect(backend.players.size).toBe(1);
  await page.getByRole("button", { name: "Delete Fictional Comet" }).click();
  await page
    .getByRole("button", { name: "Delete player profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A fresh start for your players." }),
  ).toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.goto(new URL("#account", page.url()).href);
  await expect(
    otherTab.getByRole("button", { name: "Sign out of this browser" }),
  ).toBeVisible();
  await signOut(page);
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await expect(
    otherTab.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await otherTab.close();
});
test("signup verifies email, recovery updates a password and adult accounts cannot add minors", async ({
  page,
  context,
}) => {
  const backend = fixture();
  await backend.install(context);
  await page.goto("./#account");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel(/^(Adult|Account) email$/)
    .fill("fictional-parent@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Fictional-signup8!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create adult account" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(backend.counts.signup).toBe(1);
  // The real SDK created a PKCE verifier. Intercept only the service response,
  // then exercise the actual callback exchange and URL cleanup.
  await page.goto("./?code=fictional-verification-code");
  await expect(
    page.getByRole("heading", { name: "Account settings.", exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/code=/);
  await setup(page, "adult");
  await page.getByRole("button", { name: "Add your first player" }).click();
  await expect(
    page.getByLabel("Age group", { exact: true }).locator("option"),
  ).toHaveText(["18+"]);
  await page.getByRole("button", { name: "Cancel changes" }).click();
  await signOut(page);
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page
    .getByLabel(/^(Adult|Account) email$/)
    .fill("fictional-parent@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  expect(backend.counts.recover).toBe(1);
  await page.goto("./?flow=recovery&code=fictional-recovery-code");
  await page
    .getByLabel("New password", { exact: true })
    .fill("Fictional-next8!");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  expect(backend.counts.password).toBe(1);
  await expect(page).not.toHaveURL(/flow=|code=/);
});
test("failed saves preserve drafts; signout and switching accounts expose no previous profiles; member deletion is explicit", async ({
  page,
  context,
}) => {
  const backend = fixture();
  await backend.install(context);
  await signIn(page);
  await setup(page);
  await page.getByRole("button", { name: "Add your first player" }).click();
  await page.getByLabel("Player nickname").fill("Fictional Private");
  backend.rejectSave();
  await page.getByRole("button", { name: "Save private player" }).click();
  await expect(page.getByRole("alert")).toContainText("Save was not confirmed");
  await expect(page.getByLabel("Player nickname")).toHaveValue(
    "Fictional Private",
  );
  await page.getByRole("button", { name: "Save private player" }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional Private", exact: true }),
  ).toBeVisible();
  await signOut(page);
  await signIn(page, "fictional-adult@example.test");
  await setup(page, "adult");
  await expect(
    page.getByRole("heading", { name: "Fictional Private", exact: true }),
  ).toHaveCount(0);
  await signOut(page);
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Fictional Private", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete member profile data", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep my data" }).click();
  expect(backend.players.size).toBe(1);
  await page
    .getByRole("button", { name: "Delete member profile data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Permanently delete profile data" }),
  ).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete profile data" })
    .click();
  await expect(page.getByLabel("Account type")).toBeVisible();
  expect(backend.players.size).toBe(0);
  expect(backend.accounts.has(otherId)).toBe(true);
});
test("member forms and private dashboard fit small phones and pass automated accessibility checks", async ({
  page,
  context,
}, testInfo) => {
  const backend = fixture();
  await backend.install(context);
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (testInfo.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("./#account");
  const check = async () => {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
    ).toEqual([]);
  };
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await check();
  await page.screenshot({
    path: `artifacts/member-signin-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await signIn(page);
  await setup(page);
  await check();
  await page.getByRole("button", { name: "Add your first player" }).click();
  await check();
  await page.getByLabel("Player nickname").fill("Fictional Champ");
  await page.getByLabel("Age group", { exact: true }).selectOption("5–7");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save private player" }).click();
  await expect(
    page.getByRole("heading", { name: "Fictional Champ", exact: true }),
  ).toBeVisible();
  await check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/member-dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Profile privacy details", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your login session is saved in this browser.",
  );
  await check();
});

test("expired email callbacks recover safely and the closed under-18 gate is reflected in the editor", async ({
  page,
  context,
}) => {
  const backend = fixture(false);
  await backend.install(context);
  await page.goto(
    "./?error=access_denied&error_description=fictional-expired-link#account",
  );
  await expect(page.getByRole("alert")).toContainText("invalid or expired");
  await expect(page).not.toHaveURL(/error=/);
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await page
    .getByLabel(/^(Adult|Account) email$/)
    .fill("fictional-parent@example.test");
  await page
    .getByRole("button", { name: "Resend verification link", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "fresh verification link",
  );
  expect(backend.counts.resend).toBe(1);
  await signIn(page);
  await setup(page);
  await page.getByRole("button", { name: "Add your first player" }).click();
  await expect(
    page.getByLabel("Age group", { exact: true }).locator("option"),
  ).toHaveText(["18+"]);
  await expect(
    page.getByText("Under-18 enrollment is not open yet.", { exact: false }),
  ).toBeVisible();
});

test("private pilot accepts a verified email session, removes URL credentials and sets a password without opening signup", async ({
  page,
  context,
}) => {
  const backend = fixture(false, false);
  await backend.install(context);
  const fragment = new URLSearchParams({
    access_token: jwt(parentId),
    refresh_token: "fictional-refresh",
    type: "magiclink",
    token_type: "bearer",
  });
  await page.goto("./?flow=recovery#" + fragment.toString());
  await expect(
    page.getByRole("heading", { name: "Choose a new password." }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/access_token=|refresh_token=/);
  await page
    .getByLabel("New password", { exact: true })
    .fill("Fictional-owner8!");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(
    page.getByRole("heading", { name: "Account settings.", exact: true }),
  ).toBeVisible();
  expect(backend.counts.password).toBe(1);
  await setup(page, "adult");
  await signOut(page);
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Invited accounts only.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
});

test("Owner manages five levels with protected self access, confirmation, cancellation, failure and refresh persistence", async ({
  page,
  context,
}, testInfo) => {
  const backend = fixture(false, false, "owner");
  await backend.install(context);
  backend.accounts.set(otherId, {
    user_id: otherId,
    account_type: "adult",
    privacy_version: "profile-pilot-2026-10",
  });
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Owner", exact: true }),
  ).toBeVisible();
  await page.goto("./#access");
  const allAccounts = page.getByRole("button", {
    name: "All accounts",
    exact: true,
  });
  if (await allAccounts.isVisible()) await allAccounts.click();
  for (const summary of await page
    .locator("details.access-person > summary")
    .all())
    await summary.click();
  await expect(
    page.getByLabel("Account level for fictional-parent@example.test", {
      exact: true,
    }),
  ).toBeDisabled();
  const target = page.getByLabel(
    "Account level for fictional-adult@example.test",
    { exact: true },
  );
  await target.selectOption("coach");
  await page
    .getByRole("button", { name: "Review access change" })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Keep current level" }).click();
  expect(backend.counts.roleWrites).toBe(0);
  await target.selectOption("manager");
  await page
    .getByRole("button", { name: "Review access change" })
    .nth(1)
    .click();
  backend.rejectRole();
  await page.getByRole("button", { name: "Confirm account level" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "not confirmed",
  );
  expect(backend.counts.roleWrites).toBe(0);
  await page.getByRole("button", { name: "Confirm account level" }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.counts.roleWrites).toBe(1);
  await expect(target).toHaveValue("manager");
  await page.reload();
  await expect(target).toHaveValue("manager");
  await page.getByLabel("Find an account by email").fill("fictional-adult");
  await page.getByRole("button", { name: "Search accounts" }).click();
  await expect(page.locator(".access-person")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const checks = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(checks.violations).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `artifacts/account-levels-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
for (const role of ["manager", "coach", "parent", "athlete"] as const) {
  test(`${role} sees the correct level without Owner access controls`, async ({
    page,
    context,
  }) => {
    const backend = fixture(false, false, role);
    await backend.install(context);
    await signIn(page);
    await page.goto("./#account");
    await expect(
      page.getByRole("heading", {
        name: role[0].toUpperCase() + role.slice(1),
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Manage account access", exact: true }),
    ).toHaveCount(0);
  });
}

test("a private family athlete joins with a parent code, reports practice without adult setup, and remains under parent review and revocation", async ({
  page,
  context,
}) => {
  const backend = fixture(true, false);
  await backend.install(context);
  await signIn(page);
  await setup(page);
  const profile = "90000000-0000-4000-8000-000000000001";
  const sibling = "90000000-0000-4000-8000-000000000002";
  for (const [id, nickname] of [
    [profile, "Fictional Pat"],
    [sibling, "Fictional Sibling"],
  ])
    backend.players.set(id, {
      id,
      owner_id: parentId,
      nickname,
      age_group: "13–17",
      sport: "football",
      position: "Quarterback",
      experience: "New to the game",
      goal: "Footwork",
      guardian_confirmed: true,
      version: 1,
    });
  await page
    .getByRole("button", { name: "Refresh profiles", exact: true })
    .click();
  const openParentWorkspace = async () => {
    const detail = page.getByRole("region", {
      name: "Athlete training and permissions",
    });
    const choose = page
      .locator("article.private-player")
      .filter({
        has: page.getByRole("heading", { name: "Fictional Pat", exact: true }),
      })
      .getByRole("button", { name: "Workouts & permissions", exact: true });
    await expect(detail.or(choose)).toBeVisible();
    if (await detail.isVisible()) return;
    await page
      .locator("article.private-player")
      .filter({
        has: page.getByRole("heading", { name: "Fictional Pat", exact: true }),
      })
      .getByRole("button", { name: "Workouts & permissions", exact: true })
      .click();
  };
  await openParentWorkspace();
  await page
    .getByRole("button", { name: "Allow athlete self-recording" })
    .click();
  await page.getByRole("button", { name: "Save athlete permission" }).click();
  await page
    .getByRole("button", { name: "Create private athlete access code" })
    .click();
  const code = await page.getByLabel("One-time access code").inputValue();
  await page.getByRole("button", { name: "Close access code" }).click();
  await signOut(page);
  await signIn(page, "fictional-adult@example.test");
  await page.getByLabel("Parent’s private athlete access code").fill(code);
  await page
    .getByRole("button", { name: "Connect my athlete profile" })
    .click();
  await page.goto("./#workspace");
  await expect(
    page.getByRole("heading", {
      name: "Today’s training.",
      exact: true,
    }),
  ).toBeVisible();
  // A copied profile-detail query must not switch a linked junior into an owned-profile view.
  await page.goto(`./?playerProfile=${profile}#profiles`);
  await expect(
    page.getByRole("region", { name: "Athlete training and permissions" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Fictional Pat’s workouts" }),
  ).toBeVisible();
  await expect(page.getByLabel("Account type")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Fictional Sibling", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Begin workout" }).click();
  for (;;) {
    const last = dialog.getByRole("button", {
      name: "Finish workout",
    });
    if (await last.isVisible()) {
      await last.dblclick();
      break;
    }
    await dialog.getByRole("button", { name: "Complete drill · Next" }).click();
    await page.waitForTimeout(700);
  }
  await expect(
    page.getByText("Awaiting parent review", { exact: true }),
  ).toBeVisible();
  expect(backend.counts.workoutWrites).toBe(1);
  await expect(
    page.getByRole("button", { name: "Approve workout", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage })),
  ).not.toContain("Fictional Pat");
  await signOut(page);
  await signIn(page);
  await openParentWorkspace();
  await page
    .getByRole("button", { name: "Approve workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm parent review" }).dblclick();
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
  expect(backend.counts.parentReviews).toBe(1);
  await page.reload();
  await openParentWorkspace();
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Turn self-recording off" }).click();
  await page.getByRole("button", { name: "Save athlete permission" }).click();
  await page
    .getByRole("button", { name: "Remove athlete account access" })
    .click();
  await page
    .getByRole("button", { name: "Remove athlete connection", exact: true })
    .click();
  await signOut(page);
  await signIn(page, "fictional-adult@example.test");
  await expect(
    page.getByRole("heading", { name: "Your parent manages athlete access." }),
  ).toBeVisible();
  await expect(page.getByLabel("Account type")).toHaveCount(0);
});

for (const [role, heading] of [
  ["owner", "Athletes."],
  ["manager", "Athletes."],
  ["coach", "Your athletes."],
] as const) {
  test(`${role} receives the matching authenticated workspace and old preview links do not elevate permissions`, async ({
    page,
    context,
  }) => {
    const backend = fixture(false, false, role);
    await backend.install(context);
    await signIn(page);
    await page.goto("./#workspace");
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Workspace navigation" })
        .getByRole("link", { name: "Training", exact: true }),
    ).toBeVisible();
    await page.goto("./#demo-owner");
    await expect(
      page.getByRole("heading", {
        name: heading,
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("./#workspace");
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await page.goto("./#access");
    for (const summary of await page
      .locator("details.access-person > summary")
      .all())
      await summary.click();
    if (role === "owner")
      await expect(
        page.getByRole("group", { name: "Team access sections" }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", { name: "Owner access is required." }),
      ).toBeVisible();
    expect(backend.counts.roleWrites).toBe(0);
  });
}
test("Parent and adult Athlete workspaces use private profiles; inactive memberships never unlock protected training", async ({
  page,
  context,
}) => {
  const backend = fixture(false, false, "parent");
  await backend.install(context);
  backend.accounts.set(parentId, {
    user_id: parentId,
    account_type: "parent",
    adult_confirmed_at: "2026-01-01T00:00:00Z",
    privacy_acknowledged_at: "2026-01-01T00:00:00Z",
    privacy_version: "prototype-2026-01",
  });
  backend.accounts.set(otherId, {
    user_id: otherId,
    account_type: "adult",
    adult_confirmed_at: "2026-01-01T00:00:00Z",
    privacy_acknowledged_at: "2026-01-01T00:00:00Z",
    privacy_version: "prototype-2026-01",
  });
  const player = {
    id: crypto.randomUUID(),
    owner_id: otherId,
    nickname: "Fictional Solo",
    age_group: "18+",
    sport: "football",
    position: "Defensive back",
    experience: "Experienced",
    goal: "Game understanding",
    guardian_confirmed: false,
    version: 1,
  };
  backend.players.set(player.id, player);
  await signIn(page);
  await page.goto("./#workspace");
  await expect(
    page.getByRole("heading", {
      name: "Today’s training.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Fictional Solo", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("./#member-library");
  await expect(
    page.getByRole("heading", { name: "Your workouts.", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Fictional Solo", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("./#account");
  await signOut(page);
  await signIn(page, "fictional-adult@example.test");
  await page.goto("./#app-workouts");
  await expect(
    page.getByRole("heading", {
      name: "Your workouts.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Solo’s workouts",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start workout", exact: true }),
  ).toBeVisible();
  await page.goto("./#member-library");
  await expect(
    page.getByRole("heading", {
      name: "Fictional Solo’s workouts",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("./#access");
  const allAccounts = page.getByRole("button", {
    name: "All accounts",
    exact: true,
  });
  if (await allAccounts.isVisible()) await allAccounts.click();
  for (const summary of await page
    .locator("details.access-person > summary")
    .all())
    await summary.click();
  await expect(
    page.getByRole("heading", { name: "Owner access is required." }),
  ).toBeVisible();
});

function appProfile(
  ownerId: string,
  nickname: string,
  age: "18+" | "8–12" | "13–17" = "18+",
) {
  return {
    id: crypto.randomUUID(),
    owner_id: ownerId,
    nickname,
    age_group: age,
    sport: "football",
    position: "Quarterback",
    experience: "New to the game",
    goal: "Footwork",
    guardian_confirmed: age !== "18+",
    version: 1,
  };
}
async function completeAppWorkout(
  page: import("@playwright/test").Page,
  label: string,
  checkResume = false,
) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  if (checkResume) {
    const refreshed = page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/player_profiles") &&
        response.request().method() === "GET",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await refreshed;
    await expect(dialog.getByRole("checkbox")).toBeChecked();
  }
  await dialog.getByRole("button", { name: "Begin workout" }).click();
  for (;;) {
    const submit = dialog.getByRole("button", {
      name: "Finish workout",
    });
    if (await submit.isVisible()) {
      await submit.dblclick();
      break;
    }
    await dialog.getByRole("button", { name: "Complete drill · Next" }).click();
    await page.waitForTimeout(700);
  }
  await expect(dialog).toHaveCount(0);
}

test("member app separates Today, Workouts, Progress and Account and keeps family selection and reviews private", async ({
  page,
  context,
}, info) => {
  const backend = fixture(false, false, "parent");
  await backend.install(context);
  backend.accounts.set(parentId, {
    user_id: parentId,
    account_type: "parent",
    privacy_version: "prototype-2026-01",
  });
  const first = appProfile(parentId, "Fictional First"),
    second = appProfile(parentId, "Fictional Second");
  backend.players.set(first.id, first);
  backend.players.set(second.id, second);
  const report = {
    id: crypto.randomUUID(),
    profile_id: first.id,
    reported_by: otherId,
    drill_ids: [DRILLS[0].id],
    titles: ["First athlete only"],
    minutes: 5,
    status: "pending_parent",
    created_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    version: 1,
  };
  backend.workouts.set(report.id, report);
  await signIn(page);
  await page.goto("./?source=app#workspace");
  const nav = page.getByRole("navigation", { name: "App navigation" });
  await expect(nav.getByRole("link")).toHaveText([
    "Today",
    "Workouts",
    "Progress",
    "Account",
  ]);
  await expect(
    page.getByRole("heading", { name: "Today’s training." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Practice history", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Delete member|Add another/ }),
  ).toHaveCount(0);
  await page
    .getByLabel("Training athlete", { exact: true })
    .selectOption(second.id);
  await nav.getByRole("link", { name: "Workouts", exact: true }).click();
  await expect(
    page.getByLabel("Training athlete", { exact: true }),
  ).toHaveValue(second.id);
  await expect(
    page.getByRole("heading", { name: "Your workouts." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your assigned workout", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-session-drills li").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Guide and record practice", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End workout" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard unfinished workout" })
    .click();
  expect(backend.counts.workoutWrites).toBe(0);
  await completeAppWorkout(page, "Guide and record practice");
  expect(backend.counts.workoutWrites).toBe(1);
  await nav.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByLabel("Training athlete", { exact: true }),
  ).toHaveValue(second.id);
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Guide and record practice",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("First athlete only", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Training athlete", { exact: true })
    .selectOption(first.id);
  await expect(
    page.getByText("Awaiting parent review", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve workout", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel review" })
    .click();
  expect(backend.counts.parentReviews).toBe(0);
  await page
    .getByRole("button", { name: "Approve workout", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm parent review" })
    .dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(backend.counts.parentReviews).toBe(1);
  await page.reload();
  await expect(
    page.getByText("Parent approved", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({
    path: `artifacts/focused-app-progress-${info.project.name}.png`,
    fullPage: true,
  });
  await nav.getByRole("link", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional First’s next session",
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.screenshot({
    path: `artifacts/focused-app-today-${info.project.name}.png`,
  });
  await nav.getByRole("link", { name: "Account", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Account settings.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Manage athletes & permissions/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Workouts & permissions" }).first(),
  ).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("pd-demo-v1"));
  expect(stored || "").not.toContain("Fictional First");
});

test("solo app training reports survive navigation and refresh while failed reads and signout expose no previous profile", async ({
  page,
  context,
}, info) => {
  const backend = fixture(false, false, "athlete");
  await backend.install(context);
  backend.accounts.set(parentId, {
    user_id: parentId,
    account_type: "adult",
    privacy_version: "prototype-2026-01",
  });
  const player = appProfile(parentId, "Fictional Solo App");
  backend.players.set(player.id, player);
  await signIn(page);
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("heading", {
      name: "Fictional Solo App’s next session",
      exact: true,
    }),
  ).toBeVisible();
  await completeAppWorkout(page, "Start workout", true);
  const nav = page.getByRole("navigation", { name: "App navigation" });
  await nav.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByText("Self-reported practice", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Self-reported practice", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Training athlete", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Approve workout" }),
  ).toHaveCount(0);
  await page.route("**/rest/v1/player_profiles**", (route) =>
    route.fulfill({
      status: 403,
      json: { message: "Fictional access unavailable" },
    }),
  );
  await nav.getByRole("link", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry loading training" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fictional Solo App", { exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/rest/v1/player_profiles**");
  await page.getByRole("button", { name: "Retry loading training" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Solo App’s next session",
      exact: true,
    }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Workouts", exact: true }).click();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.screenshot({
    path: `artifacts/focused-app-workouts-${info.project.name}.png`,
    fullPage: true,
  });
  await nav.getByRole("link", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("./?source=app#app-progress");
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fictional Solo App", { exact: true }),
  ).toHaveCount(0);
});

test("a connected junior app sees one athlete and respects parent recording permission", async ({
  page,
  context,
}) => {
  const backend = fixture(true, false, "parent");
  await backend.install(context);
  backend.accounts.set(parentId, {
    user_id: parentId,
    account_type: "parent",
    privacy_version: "prototype-2026-01",
  });
  const child = appProfile(parentId, "Fictional Junior", "8–12"),
    sibling = appProfile(parentId, "Fictional Sibling", "13–17");
  backend.players.set(child.id, child);
  backend.players.set(sibling.id, sibling);
  backend.links.set(child.id, otherId);
  backend.levels.set(otherId, { role: "athlete", version: 1 });
  backend.controls.set(child.id, { allowed: false, version: 0 });
  await signIn(page, "fictional-adult@example.test");
  await page.goto("./?source=app#workspace");
  await expect(
    page.getByRole("heading", {
      name: "Fictional Junior’s next session",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Fictional Sibling", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Training athlete", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start workout", exact: true }),
  ).toBeDisabled();
  backend.controls.set(child.id, { allowed: true, version: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Start workout", exact: true }),
  ).toBeEnabled();
  await completeAppWorkout(page, "Start workout");
  await page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Progress", exact: true })
    .click();
  await expect(
    page.getByText("Awaiting parent review", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve workout" }),
  ).toHaveCount(0);
  backend.controls.set(child.id, { allowed: false, version: 2 });
  await page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Today", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start workout", exact: true }),
  ).toBeDisabled();
});

test("staff app navigation stays on authorized content tools rather than member or public marketing screens", async ({
  page,
  context,
}) => {
  const backend = fixture(false, false, "coach");
  await backend.install(context);
  await signIn(page);
  await page.goto("./?source=app#workspace");
  const nav = page.getByRole("navigation", { name: "App navigation" });
  await expect(nav.getByRole("link")).toHaveText([
    "Athletes",
    "Training",
    "Staff",
    "Account",
  ]);
  await expect(
    page.getByRole("heading", { name: "Your athletes." }),
  ).toBeVisible();
  await page.goto("./?source=app#app-progress");
  await expect(
    page.getByRole("heading", { name: "Your staff workspace." }),
  ).toBeVisible();
  await expect(page.locator(".app-athlete-picker")).toHaveCount(0);
  await page.goto("./#home");
  await expect(
    page.getByRole("heading", { name: /Know the game/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "App navigation" }),
  ).toHaveCount(0);
});

for (const role of ["owner", "manager", "coach"] as const) {
  test(`${role} account opens staff tools without household setup, including delayed access checks and app refresh`, async ({
    page,
    context,
  }, info) => {
    const backend = fixture(false, false, role);
    await backend.install(context);
    let householdReads = 0;
    await context.route("**/rest/v1/member_accounts**", (route) => {
      householdReads++;
      return route.fulfill({
        status: 503,
        json: { message: "Household service intentionally unavailable" },
      });
    });
    await context.route("**/rest/v1/account_roles**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return route.fulfill({ json: [{ role, version: 1 }] });
    });
    await page.addInitScript(() => {
      (window as Window & { sawCustomerSetup?: boolean }).sawCustomerSetup =
        false;
      new MutationObserver(() => {
        if (document.body?.textContent?.includes("Who is the training for?"))
          (window as Window & { sawCustomerSetup?: boolean }).sawCustomerSetup =
            true;
      }).observe(document, { childList: true, subtree: true });
    });
    await signIn(page);
    await expect(
      page.getByRole("heading", {
        name: "Account settings.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Account type", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Finish account setup", exact: true }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("navigation", { name: "Workspace navigation" })
        .getByRole("link", { name: "Training", exact: true }),
    ).toBeVisible();
    await page.goto("./?source=app#workspace");
    const nav = page.getByRole("navigation", { name: "App navigation" });
    await expect(
      nav.getByRole("link", { name: "Athletes", exact: true }),
    ).toBeVisible();
    await nav.getByRole("link", { name: "Account", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Account settings.",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      nav.getByRole("link", { name: "Athletes", exact: true }),
    ).toBeVisible();
    await nav.getByRole("link", { name: "Account", exact: true }).click();
    await expect(page.getByLabel("Account type", { exact: true })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () =>
          (window as Window & { sawCustomerSetup?: boolean }).sawCustomerSetup,
      ),
    ).toBe(false);
    expect(householdReads).toBe(0);
    expect(backend.counts.writes).toBe(0);
    expect(backend.accounts.size).toBe(0);
    if (role === "owner") {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/staff-account-${info.project.name}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Sign out", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "Sign in securely", exact: true }),
    ).toBeVisible();
  });
}

test("Owner password setup finishes on the staff account without creating a Parent or Athlete account", async ({
  page,
  context,
}) => {
  const backend = fixture(false, false, "owner");
  await backend.install(context);
  const fragment = new URLSearchParams({
    access_token: jwt(parentId),
    refresh_token: "fictional-refresh",
    type: "magiclink",
    token_type: "bearer",
  });
  await page.goto("./?flow=recovery#" + fragment.toString());
  await page
    .getByLabel("New password", { exact: true })
    .fill("Fictional-staff8!");
  await page
    .getByRole("button", { name: "Save new password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account settings.", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Account type", { exact: true })).toHaveCount(0);
  expect(backend.accounts.size).toBe(0);
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose a new password.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel password change", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account settings.", exact: true }),
  ).toBeVisible();
});

test("failed role checks never fall back to customer setup and can be retried", async ({
  page,
  context,
}) => {
  const backend = fixture(false, false, "owner");
  await backend.install(context);
  let fail = true;
  await context.route("**/rest/v1/account_roles**", (route) =>
    route.fulfill(
      fail
        ? {
            status: 403,
            json: { message: "Fictional permission lookup unavailable" },
          }
        : { json: [{ role: "owner", version: 1 }] },
    ),
  );
  await signIn(page);
  await expect(
    page.getByRole("heading", {
      name: "Account access could not be verified.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Account type", { exact: true })).toHaveCount(0);
  fail = false;
  await page
    .getByRole("button", { name: "Retry account access", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Account settings.", exact: true }),
  ).toBeVisible();
  expect(backend.accounts.size).toBe(0);
});

test("new passwords accept eight characters with all required groups and reject missing groups before sending", async ({
  page,
  context,
}) => {
  const backend = fixture();
  await backend.install(context);
  await page.goto("./#account");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel(/^(Adult|Account) email$/)
    .fill("fictional-parent@example.test");
  await page.getByRole("checkbox").check();
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("minlength", "8");
  for (const invalid of [
    "Aa1!bbb",
    "aa1!bbbb",
    "AA1!BBBB",
    "Aa!!bbbb",
    "Aa12bbbb",
    "Aa1 bbbb",
  ]) {
    await password.fill(invalid);
    await page.getByRole("button", { name: "Create adult account" }).click();
    if (invalid.length >= 8)
      await expect(page.getByRole("alert")).toContainText(
        "Use 8 or more characters",
      );
    expect(backend.counts.signup).toBe(0);
  }
  await password.fill("Aa1!bbbb");
  await page.getByRole("button", { name: "Create adult account" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(backend.counts.signup).toBe(1);
  await page.goto("./?flow=recovery&code=fictional-recovery-code");
  const replacement = page.getByLabel("New password", { exact: true });
  await expect(replacement).toHaveAttribute("minlength", "8");
  await expect(page.locator("#new-password-help")).toContainText(
    "uppercase letter",
  );
  await replacement.fill("Aa12bbbb");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("alert")).toContainText("special character");
  expect(backend.counts.password).toBe(0);
  await replacement.fill("Bb2!cccc");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  expect(backend.counts.password).toBe(1);
});

test("app login reaches the dashboard while a restored settings route stays in settings", async ({
  page,
  context,
}) => {
  const f = fixture();
  await f.install(context);
  await page.goto("./?source=app#account");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.getByLabel("Account email").fill("fictional-parent@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-only");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/#workspace$/);
  await page
    .locator("header")
    .getByRole("link", { name: "Account settings", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account settings." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Account settings." }),
  ).toBeVisible();
});
