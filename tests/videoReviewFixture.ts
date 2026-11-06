import { practiceResumeFixture } from "./practiceResumeFixture";
import type { ReviewService } from "../src/reviewServices";
import type { BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
export const id = (n: number) =>
  `80000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const userId = id(1),
  playerId = id(2),
  drillId = id(3),
  coachId = id(4);
export const file = new URL("./fixtures/fictional-video.webm", import.meta.url)
  .pathname;
export const media = readFileSync(file);
export const content = {
  sport: "football",
  title: "Fictional assigned footwork",
  skill: "Footwork",
  ages: ["18+"],
  positions: [],
  levels: ["New to the game"],
  minutes: 3,
  equipment: "Clear flat space",
  lesson: "Practice controlled steps.",
  steps: ["Set two markers.", "Walk between the markers."],
  cue: "Keep steps controlled.",
  kind: "movement",
};
const resource = {
  id: drillId,
  content,
  asset_path: `${coachId}/${drillId}/${drillId}.webm`,
  asset_type: "video/webm",
  asset_name: "fixture.webm",
  version: 1,
  status: "published",
  visibility: "member_only",
};
type Review = {
  id: string;
  profile_id: string;
  account_id: string;
  submitted_by: string;
  resource_id: string;
  drill_title: string;
  asset_path: string;
  media_type: string;
  byte_size: number;
  duration_seconds: number;
  status: string;
  feedback: string;
  created_at: string;
  version: number;
};
export async function fixture(
  context: BrowserContext,
  role = "athlete",
  failFirstUpload = false,
  drillCount = 1,
  tracking = false,
  actorId = userId,
  reviewClock: () => number = Date.now,
) {
  const paused = practiceResumeFixture();
  const rows: Review[] = [];
  const counts = {
    uploads: 0,
    finishes: 0,
    feedback: 0,
    deletes: 0,
    access: 0,
    reports: 0,
  };
  let uploaded = false;
  let accessEnabled = true;
  let failManage = false;
  const services: ReviewService[] = [];
  const serviceCounts = { requests: 0, cancels: 0, manages: 0, starts: 0 };
  function syncServices() {
    for (const row of rows) {
      let s = services.find((s) => s.video_id === row.id);
      if (!s) {
        s = services.find(
          (s) => s.profile_id === row.profile_id && s.state === "requested",
        );
        if (!s) {
          s = {
            id: row.id,
            account_id: userId,
            profile_id: playerId,
            video_id: null,
            assigned_to: userId,
            drill_title: row.drill_title,
            state: "uploading",
            funding: "manual_pilot",
            blocker: "none",
            ready_at: null,
            due_at: null,
            delivered_at: null,
            created_at: row.created_at,
            updated_at: row.created_at,
            version: 1,
          };
          services.push(s);
        }
        s.video_id = row.id;
        s.drill_title = row.drill_title;
      }
      if (["queued", "reviewed"].includes(row.status) && !s.ready_at) {
        const ready = reviewClock();
        s.ready_at = new Date(ready).toISOString();
        s.due_at = new Date(ready + 48 * 3600000).toISOString();
      }
      if (row.status === "reviewed") {
        s.state = "delivered";
        s.delivered_at ||= new Date().toISOString();
      } else if (s.state !== "in_review")
        s.state = row.status as ReviewService["state"];
    }
  }
  const workouts: Record<string, unknown>[] = [];
  const resources = Array.from({ length: drillCount }, (_, n) =>
    n === 0
      ? resource
      : {
          ...resource,
          id: id(100 + n),
          content: {
            ...content,
            title: `Fictional next drill ${n + 1}`,
            steps: [`Read marker ${n + 1}.`],
            equipment: `Paper marker ${n + 1}`,
          },
          asset_path: `${coachId}/${id(100 + n)}/${id(100 + n)}.webm`,
        },
  );
  const user = {
    id: actorId,
    aud: "authenticated",
    role: "authenticated",
    email: "fictional-athlete@example.test",
    email_confirmed_at: "2026-01-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const encode = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const session = {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: actorId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fictional-signature`,
    refresh_token: "fictional-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  await context.addInitScript(
    (session) =>
      localStorage.setItem(
        "sb-separate-demo-auth-token",
        JSON.stringify(session),
      ),
    session,
  );
  await context.route("**/content-config.json", (r) =>
    r.fulfill({
      json: {
        enabled: true,
        url: "https://separate-demo.supabase.co",
        publishableKey: "sb_publishable_fixture_only",
        serviceTrackingEnabled: tracking,
        membersEnabled: true,
        membersSignupEnabled: false,
      },
    }),
  );
  await context.route("https://separate-demo.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname,
      body = (p.includes("/rpc/") ? req.postDataJSON() : {}) as Record<
        string,
        unknown
      >;
    const json = (v: unknown, status = 200) =>
      route.fulfill({ status, json: v });
    if (p.endsWith("/user")) return json(user);
    if (p.endsWith("/account_roles")) return json([{ role, version: 1 }]);
    if (p.endsWith("/member_accounts"))
      return json({
        user_id: actorId,
        account_type: role === "parent" ? "parent" : "adult",
        privacy_version: "pilot",
      });
    if (p.endsWith("/profile_settings"))
      return json({ under18_enabled: false });
    if (p.endsWith("/player_profiles"))
      return json([
        {
          id: playerId,
          owner_id: userId,
          nickname: "Fictional Pilot",
          age_group: "18+",
          sport: "football",
          position: "Quarterback",
          experience: "New to the game",
          goal: "Footwork",
          guardian_confirmed: false,
          version: 1,
        },
      ]);
    const resume = paused.handle(p, body, userId);
    if (resume) return json(resume.data, resume.status);
    if (p.endsWith("/rpc/athlete_account_context"))
      return json({ guardian_managed: false, linked_profile_id: null });
    if (
      p.endsWith("/rpc/athlete_training_plan") ||
      p.endsWith("/training_resources") ||
      p.endsWith("/rpc/staff_training_resources")
    )
      return json(resources);
    if (p.endsWith("/rpc/family_profile_state"))
      return json({
        guardian_managed: false,
        is_family: role === "parent",
        is_parent: role === "parent",
        can_record: true,
        self_recording_allowed: false,
        permission_version: 0,
        has_link: false,
        child_access_ready: true,
        workouts,
      });
    if (p.endsWith("/rpc/athlete_video_state")) {
      syncServices();
      return json({
        can_submit: accessEnabled,
        adult_only: false,
        reviews: rows,
        service_tracking: tracking,
        services,
      });
    }
    if (p.endsWith("/rpc/request_drill_review")) {
      serviceCounts.requests++;
      let row = services.find((s) => s.state === "requested");
      if (!row) {
        row = {
          id: String(body.request_id),
          account_id: userId,
          profile_id: playerId,
          video_id: null,
          assigned_to: null,
          drill_title: "One drill review",
          state: "requested",
          funding: "manual_pilot",
          blocker: "access_needed",
          ready_at: null,
          due_at: null,
          delivered_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
        };
        services.push(row);
      }
      return json(row);
    }
    if (p.endsWith("/rpc/cancel_drill_review")) {
      serviceCounts.cancels++;
      const row = services.find((s) => s.id === body.request_id)!;
      row.state = "cancelled";
      row.version++;
      return json(null);
    }
    if (p.endsWith("/rpc/review_service_desk")) {
      syncServices();
      return json({
        requests: services,
        staff: [
          { id: userId, label: "fictional-owner@example.test", role: "owner" },
          { id: coachId, label: "fictional-coach@example.test", role: "coach" },
        ],
      });
    }
    if (p.endsWith("/rpc/manage_review_service")) {
      serviceCounts.manages++;
      if (failManage) return json({ message: "Version changed" }, 400);
      const row = services.find((s) => s.id === body.request_id)!;
      row.assigned_to = body.coach as string | null;
      row.blocker = body.blocker_code as ReviewService["blocker"];
      row.version++;
      return json(null);
    }
    if (p.endsWith("/rpc/start_drill_review")) {
      serviceCounts.starts++;
      syncServices();
      services.find((s) => s.video_id === body.review_id)!.state = "in_review";
      return json(null);
    }
    if (p.endsWith("/rpc/report_athlete_workout")) {
      counts.reports++;
      const existing = workouts.find(
        (workout) => workout.id === body.workout_id,
      );
      if (existing) return json(existing);
      const requested = (body.requested_drills as string[]).map((key) =>
        resources.find((resource) => resource.id === key),
      );
      if (!requested.length || requested.some((resource) => !resource))
        return json({ message: "Assigned drills required" }, 400);
      const w = {
        id: body.workout_id,
        profile_id: playerId,
        reported_by: userId,
        drill_ids: requested.map((resource) => resource!.id),
        titles: requested.map((resource) => resource!.content.title),
        minutes: requested.reduce(
          (sum, resource) => sum + resource!.content.minutes,
          0,
        ),
        status: role === "parent" ? "approved" : "self_reported",
        created_at: new Date().toISOString(),
        reviewed_by: role === "parent" ? actorId : null,
        reviewed_at: role === "parent" ? new Date().toISOString() : null,
        version: 1,
      };
      workouts.push(w);
      paused.complete(userId, w.profile_id, w.id);
      return json(w);
    }
    if (p.endsWith("/rpc/begin_athlete_video")) {
      let row = rows.find((v) => v.id === body.review_id);
      if (!row) {
        row = {
          id: String(body.review_id),
          profile_id: playerId,
          account_id: userId,
          submitted_by: userId,
          resource_id: drillId,
          drill_title: content.title,
          asset_path: `${userId}/${playerId}/${body.review_id}.webm`,
          media_type: "video/webm",
          byte_size: Number(body.byte_size),
          duration_seconds: Number(body.duration_seconds),
          status: "uploading",
          feedback: "",
          created_at: new Date().toISOString(),
          version: 1,
        };
        rows.push(row);
      }
      return json(row);
    }
    if (
      p.includes("/storage/v1/object/athlete-review-videos/") &&
      req.method() === "POST"
    ) {
      counts.uploads++;
      if (failFirstUpload && counts.uploads === 1)
        return json({ message: "Simulated failed upload" }, 400);
      uploaded = true;
      return json({ Key: p, Id: "fixture-upload" });
    }
    if (p.endsWith("/rpc/finish_athlete_video")) {
      counts.finishes++;
      if (!uploaded) return json({ message: "Upload incomplete" }, 400);
      const row = rows.find((v) => v.id === body.review_id)!;
      row.status = "queued";
      row.version = 2;
      return json(row);
    }
    if (p.endsWith("/athlete_video_reviews")) {
      const wanted = url.searchParams.get("id")?.replace("eq.", "");
      return json(
        wanted
          ? rows.find((v) => v.id === wanted) || null
          : rows.filter((v) => ["queued", "reviewed"].includes(v.status)),
      );
    }
    if (
      p.endsWith("/storage/v1/object/athlete-review-videos") &&
      req.method() === "DELETE"
    ) {
      counts.deletes++;
      return json([]);
    }
    if (p.endsWith("/rpc/delete_athlete_video")) {
      const i = rows.findIndex((v) => v.id === body.review_id);
      if (i >= 0) rows.splice(i, 1);
      return json({});
    }
    if (p.endsWith("/rpc/save_athlete_video_feedback")) {
      counts.feedback++;
      const row = rows.find((v) => v.id === body.review_id)!;
      row.feedback = String(body.feedback_text);
      row.status = "reviewed";
      row.version++;
      return json({});
    }
    if (p.includes("/storage/v1/object/sign/") && req.method() === "POST")
      return json({
        signedURL:
          "/object/sign/athlete-review-videos/fixture.webm?token=fictional",
      });
    if (p.includes("/storage/v1/object/sign/") && req.method() === "GET")
      return route.fulfill({ contentType: "video/webm", body: media });
    if (p.endsWith("/rpc/list_account_access"))
      return json([
        {
          user_id: userId,
          email: user.email,
          role,
          version: 1,
          email_verified: true,
          adult_setup: true,
        },
        {
          user_id: coachId,
          email: "fictional-coach@example.test",
          role: "coach",
          version: 1,
          email_verified: true,
          adult_setup: true,
        },
      ]);
    if (p.endsWith("/member_training_access")) return json(null);
    if (p.endsWith("/rpc/set_member_training_access")) {
      counts.access++;
      return json({
        resource_ids: body.resources,
        video_review_enabled: body.video_enabled,
        review_coach_id: body.coach,
        version: 1,
      });
    }
    return json({ message: `Unexpected fixture path: ${p}` }, 500);
  });
  return {
    workouts,
    rows,
    counts,
    services,
    serviceCounts,
    setAccess: (enabled: boolean) => {
      accessEnabled = enabled;
    },
    setFailManage: (fail: boolean) => {
      failManage = fail;
    },
  };
}
