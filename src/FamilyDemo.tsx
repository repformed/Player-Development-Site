import { LearningExample } from "./LearningExample";
import { useMemo, useState } from "react";
import { z } from "zod";
import { PROFILES } from "./model";
import { DRILLS } from "./data";
import { playerSchema } from "./accounts";
import { workoutSchema, type FamilyService, type FamilyState } from "./family";
import { AthleteTraining } from "./FamilyTraining";
import { Notice, Tag } from "./components";
const owner = "00000000-0000-4000-8000-000000000001";
const individual = "00000000-0000-4000-8000-000000000002";
const actor = "00000000-0000-4000-8000-000000000003";
const key = "pd-family-demo-v1";
const samples = PROFILES.map((p, i) =>
  playerSchema.parse({
    id: `00000000-0000-4000-8000-${String(10 + i).padStart(12, "0")}`,
    owner_id: p.guardian ? owner : individual,
    nickname: p.name,
    age_group: p.age,
    sport: "football",
    position: p.position,
    experience: p.level,
    goal: p.goal,
    guardian_confirmed: p.guardian,
    version: 1,
  }),
);
const schema = z.object({
  added: z.boolean(),
  permissions: z.record(
    z.string(),
    z.object({ allowed: z.boolean(), version: z.number().int().nonnegative() }),
  ),
  workouts: z.array(workoutSchema),
});
type DemoState = z.infer<typeof schema>;
const empty: DemoState = { added: false, permissions: {}, workouts: [] };
function read(): DemoState {
  try {
    return schema.parse(
      JSON.parse(localStorage.getItem(key) || JSON.stringify(empty)),
    );
  } catch {
    return empty;
  }
}
export function FamilyDemo({ app = false }: { app?: boolean }) {
  const [revision, setRevision] = useState(0),
    [view, setView] = useState<"parent" | "athlete" | "individual">("parent"),
    [selected, setSelected] = useState(samples[0].id),
    [warning, setWarning] = useState("");
  const data = useMemo(() => {
    void revision;
    return read();
  }, [revision]);
  const familyPlayers = samples.filter(
    (p, i) => p.age_group !== "18+" && (i !== 1 || data.added),
  );
  const available =
    view === "individual"
      ? [samples[3]]
      : view === "athlete"
        ? [familyPlayers.find((p) => p.id === selected) || familyPlayers[0]]
        : familyPlayers;
  const player = available.find((p) => p.id === selected) || available[0];
  const service = useMemo<FamilyService>(() => {
    function save(next: DemoState) {
      try {
        localStorage.setItem(key, JSON.stringify(next));
        setRevision((old) => old + 1);
      } catch {
        setWarning(
          "Demo changes could not be saved. Allow browser storage to try the persistent family demo.",
        );
        throw new Error(
          "Demo storage is unavailable; no saved record was changed.",
        );
      }
    }
    return {
      async load(p) {
        const state = read(),
          permission = state.permissions[p.id] || {
            allowed: false,
            version: 0,
          };
        const family = p.age_group !== "18+";
        return {
          guardian_managed: family,
          is_family: family,
          is_parent: view === "parent",
          can_record:
            view === "parent" || view === "individual" || permission.allowed,
          self_recording_allowed: permission.allowed,
          permission_version: permission.version,
          has_link: family,
          child_access_ready: true,
          workouts: state.workouts.filter((w) => w.profile_id === p.id),
        } satisfies FamilyState;
      },
      async permission(p, allowed, version) {
        if (view !== "parent")
          throw new Error("Only the parent can change permission.");
        const state = read(),
          current = state.permissions[p.id] || { allowed: false, version: 0 };
        if (current.version !== version)
          throw new Error("Permission changed. Refresh the history.");
        save({
          ...state,
          permissions: {
            ...state.permissions,
            [p.id]: { allowed, version: version + 1 },
          },
        });
      },
      async report(p, id, drills) {
        const state = read();
        if (view === "athlete" && !state.permissions[p.id]?.allowed)
          throw new Error("The parent has paused independent recording.");
        if (state.workouts.some((w) => w.id === id)) return;
        const selectedDrills = drills.map((d) =>
          DRILLS.find((x) => x.id === d)!,
        );
        save({
          ...state,
          workouts: [
            {
              id,
              profile_id: p.id,
              reported_by:
                view === "parent"
                  ? owner
                  : view === "individual"
                    ? individual
                    : actor,
              drill_ids: drills,
              titles: selectedDrills.map((d) => d.title),
              minutes: selectedDrills.reduce(
                (total, d) => total + d.minutes,
                0,
              ),
              status:
                view === "parent"
                  ? "approved"
                  : view === "individual"
                    ? "self_reported"
                    : "pending_parent",
              created_at: new Date().toISOString(),
              reviewed_by: view === "parent" ? owner : null,
              reviewed_at: view === "parent" ? new Date().toISOString() : null,
              version: 1,
            },
            ...state.workouts,
          ],
        });
      },
      async review(id, decision, version) {
        if (view !== "parent") throw new Error("Only the parent can review.");
        const state = read(),
          workout = state.workouts.find((w) => w.id === id);
        if (
          !workout ||
          workout.version !== version ||
          workout.status !== "pending_parent"
        )
          throw new Error("This workout was already reviewed. Refresh.");
        save({
          ...state,
          workouts: state.workouts.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status: decision,
                  reviewed_by: owner,
                  reviewed_at: new Date().toISOString(),
                  version: w.version + 1,
                }
              : w,
          ),
        });
      },
      async invite() {
        throw new Error(
          "No real account connections are created in the family demo.",
        );
      },
      async remove() {
        throw new Error("Demo identities are fictional.");
      },
    };
  }, [view]);
  function changeView(next: typeof view) {
    setView(next);
    if (next === "individual") setSelected(samples[3].id);
    else if (selected === samples[3].id) setSelected(samples[0].id);
  }
  return (
    <main
      className={`page member-page family-demo customer-demo ${view === "athlete" ? "junior-workspace" : ""}`}
    >
      <a href={app ? "#app" : "#home"} className="text-button demo-exit">
        {app ? "← Exit demo · Back to app" : "← Exit demo · Back to website"}
      </a>
      <div className="member-heading">
        <Tag>FOOTBALL DEMO · SAMPLE DATA</Tag>
        <h1 tabIndex={-1}>Explore fictional practice.</h1>
        <p>
          Try a text-only lesson, a sample question and an example weekly
          learning pattern, then explore fictional family controls and guided
          practice.
        </p>
      </div>
      <LearningExample
        onPractice={() =>
          requestAnimationFrame(() => {
            const target = document.getElementById("demo-setup-label");
            target?.scrollIntoView({ block: "start", behavior: "auto" });
            target?.focus();
          })
        }
      />
      <p className="eyebrow" id="demo-setup-label" tabIndex={-1}>
        Who are you setting up training for?
      </p>
      <div
        className="scene-tabs family-view-tabs"
        role="group"
        aria-labelledby="demo-setup-label"
      >
        <button
          aria-pressed={view !== "individual"}
          onClick={() => changeView("parent")}
        >
          Parent &amp; family
        </button>
        <button
          aria-pressed={view === "individual"}
          onClick={() => changeView("individual")}
        >
          Solo athlete
        </button>
      </div>
      <ol className="demo-walkthrough" aria-label="How this demo works">
        {(view === "individual"
          ? [
              "Meet your sample athlete",
              "Follow a guided workout",
              "See your practice history",
            ]
          : [
              "Choose or add a sample athlete",
              "Choose who records practice",
              "Review the reported workout",
            ]
        ).map((step, i) => (
          <li key={step}>
            <span>0{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <Notice>
        Everyone in this demo is fictional. Practice reports stay in this
        browser and never become real member records. These noncontact sample
        activities are illustrative and pending qualified review.
      </Notice>
      {warning && (
        <p className="form-error" role="alert">
          {warning}
        </p>
      )}
      {view !== "individual" && (
        <div className="demo-parent-step">
          <p>
            {view === "parent"
              ? "You manage each athlete separately. Allow recording below to try submitting a workout from that athlete’s screen, then return here to approve it."
              : "This is the selected athlete’s screen. Only their own workout and history are shown. Return to the parent controls to review a report."}
          </p>
          <button
            className="button secondary"
            onClick={() => changeView(view === "parent" ? "athlete" : "parent")}
          >
            {view === "parent"
              ? "Try athlete's screen"
              : "Back to parent controls"}
          </button>
        </div>
      )}
      <div
        className="family-athlete-picker"
        role="group"
        aria-label="Fictional athletes"
      >
        {available.map((p) => (
          <button
            key={p.id}
            className={
              p.id === player.id
                ? "family-athlete-choice selected"
                : "family-athlete-choice"
            }
            aria-pressed={p.id === player.id}
            onClick={() => setSelected(p.id)}
          >
            <strong>{p.nickname}</strong>
            <span>
              Age {p.age_group} · {p.position}
            </span>
          </button>
        ))}
        {view === "parent" && !data.added && (
          <button
            className="button secondary"
            onClick={() => {
              try {
                localStorage.setItem(
                  key,
                  JSON.stringify({ ...read(), added: true }),
                );
                setRevision((old) => old + 1);
                setSelected(samples[1].id);
              } catch {
                setWarning("Demo storage is unavailable.");
              }
            }}
          >
            Add fictional athlete Jordan
          </button>
        )}
      </div>
      <AthleteTraining
        key={`${view}-${player.id}`}
        player={player}
        service={service}
        demo
        junior={view === "athlete"}
      />
      <a className="text-button" href="#account">
        Member sign-in
      </a>
    </main>
  );
}
