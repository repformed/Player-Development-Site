import {
  TrainingWorkspace,
  AssignTrainingWorkspace,
  IndividualTrainingAccess,
  StaffDeliveryWorkspace,
} from "./StaffTraining";
import { StaffSettingsWorkspace } from "./Workspaces";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flag,
  Footprints,
  Menu,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import {
  AGES,
  GOALS,
  LEVELS,
  POSITIONS,
  PROFILES,
  completeRun,
  filterDrills,
  planFor,
  type Drill,
  type Profile,
  type RecordEntry,
  type Run,
  type State,
} from "./model";
import { DRILLS } from "./data";
import { deleteAsset, loadState, putAsset, saveState } from "./storage";
import {
  AssetPreview,
  DrillCard,
  Field,
  Logo,
  Modal,
  Notice,
  Tag,
} from "./components";
import { ContentStudio } from "./ContentStudio";
import { useSharedContent } from "./useSharedContent";
import { AccountInvitationGate } from "./AccountInvitationGate";
import { MotionShell } from "./Experience";
import { usePwa } from "./pwa";
import { InstallApp } from "./InstallApp";
import { MemberAccountPage } from "./MemberAccount";
import { FamilyDemo } from "./FamilyDemo";
import { Home } from "./Home";
import { Membership } from "./Membership";
import { Contact } from "./Contact";
import { MeetTheStaff } from "./MeetTheStaff";
import { CustomerHelp } from "./CustomerHelp";
import { SocialLinks } from "./SocialLinks";
import { QuickHelp } from "./QuickHelp";
import { appSurface, nativeApp } from "./mobile";
import {
  MobileHeader,
  MobileHelp,
  MobileTabs,
  MobileWelcome,
} from "./MobileApp";
import { useNativeApp } from "./useNativeApp";
import { MobileTraining } from "./MobileTraining";
import { MobileStaffHome } from "./MobileStaffHome";
import { CoachVideoReviews } from "./VideoReview";
import { isStaff } from "./roles";
import { ContentApprovals } from "./ContentApprovals";
import { WorkoutBuilder } from "./WorkoutBuilder";
import {
  Workspace,
  AccessWorkspace,
  WorkspaceLibrary,
  LaunchReadiness,
  InterestWorkspace,
} from "./Workspaces";
import { navigationFor, isDemoPage } from "./views";
import { PrivateHeader, PrivateFooter } from "./PrivateShell";
const safeHash = () => {
  const value = window.location.hash.slice(1);
  if (appSurface() && isDemoPage(value)) {
    window.history.replaceState(null, "", "#app");
    return "app";
  }
  const staffPreviews = [
    "demo-owner",
    "demo-manager",
    "demo-coach",
    "demo-owner-access",
    "demo-launch",
  ];
  const consumerPreviews = [
    "family-demo",
    "demo-parent",
    "demo-athlete",
    "demo-junior",
  ];
  if (staffPreviews.includes(value) || consumerPreviews.includes(value)) {
    const target = staffPreviews.includes(value)
      ? "workspace"
      : appSurface()
        ? "app"
        : "demo";
    window.history.replaceState(null, "", `#${target}`);
    return target;
  }
  return [
    "home",
    "app",
    "app-help",
    "app-workouts",
    "app-progress",
    "video-reviews",
    "workout-builder",
    "training",
    "training-assign",
    "training-access",
    "staff-settings",
    "staff-delivery",
    "content-review",
    "onboarding",
    "today",
    "library",
    "progress",
    "session",
    "coach",
    "membership",
    "contact",
    "staff",
    "customer-help",
    "install",
    "account",
    "profiles",
    "interest",
    "family-demo",
    "demo",
    "workspace",
    "access",
    "member-library",
    "launch",
  ].includes(value)
    ? value
    : appSurface()
      ? "app"
      : "home";
};
function go(page: string) {
  window.location.hash = page;
}
export default function App() {
  const app = usePwa();
  const shared = useSharedContent();
  useNativeApp(shared.service?.client);
  const [mobile] = useState(appSurface);
  const [trainingSelection, setTrainingSelection] = useState({
    userId: "",
    playerId: "",
  });
  const wasSignedIn = useRef(false);
  const wasSignedOut = useRef(false);
  const [initial] = useState(loadState);
  const [state, setState] = useState<State>(initial.state);
  const stateSnapshot = useRef<State>(initial.state);
  const [warning, setWarning] = useState(initial.warning);
  const [page, setPage] = useState(safeHash);
  const pageSnapshot = useRef(page);
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<Drill | null>(null);
  const [ready, setReady] = useState<string[] | null>(null);
  const [ack, setAck] = useState(false);
  const [exit, setExit] = useState(false);
  const [reset, setReset] = useState(false);
  const [toast, setToast] = useState("");
  const sessionLock = useRef(false);
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A restored session must keep its deep link. Only an actual sign-in from
    // the account form should send the user to the dashboard.
    if (!shared.loading && !shared.signedIn) wasSignedOut.current = true;
    if (
      mobile &&
      shared.signedIn &&
      !wasSignedIn.current &&
      (page === "app" || (page === "account" && wasSignedOut.current)) &&
      new URLSearchParams(window.location.search).get("flow") !== "recovery"
    )
      go("workspace");
    wasSignedIn.current = shared.signedIn;
    if (shared.signedIn) wasSignedOut.current = false;
  }, [mobile, shared.loading, shared.signedIn, page]);
  useEffect(() => {
    const fn = () => {
      const next = safeHash(),
        changed = next !== pageSnapshot.current;
      pageSnapshot.current = next;
      setPage(next);
      setMenu(false);
      if (changed) {
        window.scrollTo(0, 0);
        requestAnimationFrame(() =>
          mainRef.current?.querySelector<HTMLElement>("h1")?.focus(),
        );
      }
    };
    window.addEventListener("hashchange", fn);
    window.addEventListener("popstate", fn);
    return () => {
      window.removeEventListener("hashchange", fn);
      window.removeEventListener("popstate", fn);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  function commit(next: State) {
    stateSnapshot.current = next;
    try {
      saveState(next);
      setState(next);
      setWarning("");
      return true;
    } catch {
      setState(next);
      setWarning(
        "Browser storage could not be saved. Changes are temporary and may be lost on refresh. Allow site storage to keep demo progress.",
      );
      return false;
    }
  }
  const drills = [
    ...DRILLS,
    ...shared.resources.filter((d) => d.visibility === "public_sample"),
    ...state.custom,
  ];
  const profile = state.profile;
  function requestStart(ids: string[]) {
    if (!profile) {
      go("onboarding");
      return;
    }
    if (state.run) {
      setDetail(null);
      go("session");
      setToast("Your active session is ready to resume.");
      return;
    }
    setAck(false);
    setDetail(null);
    sessionLock.current = false;
    setReady(ids);
  }
  function begin() {
    if (!profile || !ready || !ack || sessionLock.current) return;
    sessionLock.current = true;
    const run: Run = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      drillIds: ready,
      index: 0,
      phase: "lesson",
    };
    commit({ ...state, run });
    setReady(null);
    go("session");
  }
  function chooseProfile(next: Profile) {
    if (state.run) {
      setToast("Finish or end your active session before changing profiles.");
      go("session");
      return;
    }
    commit({ ...state, profile: next, run: null });
    go("today");
  }
  async function publish(drill: Drill, file: File) {
    await putAsset(drill.id, file);
    const current = stateSnapshot.current;
    const next = {
      ...current,
      custom: [
        ...current.custom,
        {
          ...drill,
          assetId: drill.id,
          assetType: file.type,
          assetName: file.name,
        },
      ],
    };
    try {
      saveState(next);
    } catch {
      await deleteAsset(drill.id).catch(() => undefined);
      throw new Error(
        "Publishing failed because browser storage is unavailable or full. Free space or allow site storage, then try again.",
      );
    }
    stateSnapshot.current = next;
    setState(next);
  }
  async function updateResource(drill: Drill, file?: File) {
    const previous = state.custom.find((d) => d.id === drill.id);
    if (!previous)
      throw new Error(
        "This resource is no longer in the local library. Refresh and try again.",
      );
    if (state.run?.drillIds.includes(drill.id))
      throw new Error(
        "Finish or end the active session before editing its resource.",
      );
    const assetId = file ? crypto.randomUUID() : previous.assetId;
    if (file && assetId) await putAsset(assetId, file);
    const current = stateSnapshot.current;
    if (
      current.run?.drillIds.includes(drill.id) ||
      !current.custom.some((d) => d.id === drill.id)
    ) {
      if (file && assetId) await deleteAsset(assetId).catch(() => undefined);
      throw new Error(
        "This resource changed or entered an active session. Cancel and reopen it before editing.",
      );
    }
    const updated = {
      ...drill,
      assetId,
      assetType: file?.type || previous.assetType,
      assetName: file?.name || previous.assetName,
    };
    const next = {
      ...current,
      custom: current.custom.map((d) => (d.id === drill.id ? updated : d)),
    };
    try {
      saveState(next);
    } catch {
      if (file && assetId) await deleteAsset(assetId).catch(() => undefined);
      throw new Error(
        "Changes could not be saved. Your published resource is unchanged. Free browser storage and try again.",
      );
    }
    stateSnapshot.current = next;
    setState(next);
    if (file && previous.assetId)
      await deleteAsset(previous.assetId).catch(() =>
        setToast(
          "Changes saved. The previous attachment could not be cleared from browser storage.",
        ),
      );
  }
  async function removeResource(drill: Drill) {
    if (state.run?.drillIds.includes(drill.id))
      throw new Error(
        "Finish or end the active session before removing its resource.",
      );
    const next = {
      ...state,
      custom: state.custom.filter((d) => d.id !== drill.id),
    };
    try {
      saveState(next);
    } catch {
      throw new Error(
        "Could not save removal. The resource is still available; allow browser storage and try again.",
      );
    }
    stateSnapshot.current = next;
    setState(next);
    if (drill.assetId)
      await deleteAsset(drill.assetId).catch(() =>
        setToast(
          "Resource removed. Its attachment could not be cleared from browser storage.",
        ),
      );
  }
  const onboarding =
    page === "onboarding" ||
    ((page === "today" || page === "session" || page === "progress") &&
      !profile);
  const nav = navigationFor(page, shared.role);
  const privatePage = [
    "workspace",
    "account",
    "profiles",
    "interest",
    "app-workouts",
    "app-progress",
    "access",
    "member-library",
    "launch",
    "workout-builder",
    "training",
    "training-assign",
    "training-access",
    "staff-settings",
    "staff-delivery",
    "content-review",
    "video-reviews",
    "coach",
  ].includes(page);
  const demoPage = isDemoPage(page);
  return (
    <MotionShell>
      <div
        className={`${mobile ? "mobile-layout" : "website-layout"}${privatePage ? " is-private" : ""}`}
      >
        <a
          className="skip-to-content"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            mainRef.current?.focus();
            mainRef.current?.scrollIntoView({ block: "start" });
          }}
        >
          Skip to main content
        </a>
        {mobile ? (
          <MobileHeader
            demo={demoPage}
            signedIn={shared.signedIn}
            page={page}
          />
        ) : privatePage ? (
          <PrivateHeader shared={shared} page={page} />
        ) : (
          <>
            {demoPage && (
              <div
                className="demo-strip"
                role="region"
                aria-label="Platform status"
              >
                <span className="live-dot" /> SAMPLE-DATA DEMO{" "}
                <span className="strip-divider">/</span>
                <span>Fictional profiles · No account required</span>
              </div>
            )}
            <header className="header">
              <div className="header-inner">
                <Logo />
                <nav className="desktop-nav" aria-label="Main navigation">
                  {nav.map(([id, label]) => (
                    <a
                      key={id}
                      className={page === id ? "active" : ""}
                      href={`#${id}`}
                      aria-current={page === id ? "page" : undefined}
                    >
                      {label}
                    </a>
                  ))}
                </nav>
                <div className="header-actions">
                  {!shared.signedIn && (
                    <a className="header-login" href="#account">
                      Log in
                    </a>
                  )}
                  <a
                    className="header-account"
                    href={
                      shared.signedIn ? "#workspace" : "?interest=1#membership"
                    }
                  >
                    {shared.signedIn ? "Dashboard" : "Express interest"}{" "}
                    <ArrowUpRight size={17} />
                  </a>
                  <button
                    className="icon-button mobile-menu"
                    onClick={() => setMenu(!menu)}
                    aria-label={menu ? "Close navigation" : "Open navigation"}
                    aria-expanded={menu}
                  >
                    {menu ? <X /> : <Menu />}
                  </button>
                </div>
              </div>
              {menu && (
                <nav className="mobile-nav" aria-label="Mobile navigation">
                  {nav.map(([id, label]) => (
                    <a key={id} href={`#${id}`}>
                      {id === "workspace" ? "Dashboard" : label}
                      <ArrowUpRight size={18} />
                    </a>
                  ))}
                  {shared.signedIn &&
                    !nav.some(([id]) => id === "workspace") && (
                      <a href="#workspace">
                        Dashboard <ArrowUpRight size={18} />
                      </a>
                    )}
                  {!shared.signedIn &&
                    !nav.some(([id]) => id === "account") && (
                      <a href="#account">
                        Log in <ArrowUpRight size={18} />
                      </a>
                    )}
                  {!nav.some(([id]) => id === "membership") && (
                    <a href="#membership">
                      Proposed packages
                      <ArrowUpRight size={18} />
                    </a>
                  )}
                  <a href="#install">
                    Get the app <ArrowUpRight size={18} />
                  </a>
                </nav>
              )}
            </header>
          </>
        )}
        {!app.online && (
          <div className="connection-banner" role="status">
            You’re offline. Private workouts, profiles and video uploads need a
            connection.
          </div>
        )}
        {warning && (
          <div className="storage-warning" role="alert">
            {warning}
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        <div
          id="main-content"
          tabIndex={-1}
          ref={mainRef}
          className="page-transition"
          key={page}
        >
          <AccountInvitationGate
            shared={shared}
            enforce={
              privatePage ||
              (mobile &&
                ["app", "home", "app-workouts", "app-progress"].includes(page))
            }
          >
            {onboarding ? (
              <Onboarding
                current={profile}
                onChoose={chooseProfile}
                onCancel={() => go(profile ? "today" : "home")}
              />
            ) : page === "demo" ? (
              <FamilyDemo app={mobile} />
            ) : (page === "app" || (mobile && page === "home")) &&
              (!shared.signedIn || !mobile) ? (
              <MobileWelcome signedIn={shared.signedIn} />
            ) : page === "app-help" || (nativeApp() && page === "install") ? (
              <MobileHelp app={app} />
            ) : (page === "workspace" && !isStaff(shared.role)) ||
              (mobile &&
                ["workspace", "app", "home"].includes(page) &&
                !isStaff(shared.role)) ||
              ["app-workouts", "app-progress"].includes(page) ||
              (page === "member-library" && !isStaff(shared.role)) ? (
              <MobileTraining
                shared={shared}
                screen={
                  page === "app-progress"
                    ? "progress"
                    : page === "app-workouts" || page === "member-library"
                      ? "workouts"
                      : "today"
                }
                selection={trainingSelection}
                onSelect={setTrainingSelection}
              />
            ) : mobile && ["workspace", "app", "home"].includes(page) ? (
              <MobileStaffHome shared={shared} />
            ) : page === "workspace" ? (
              <Workspace shared={shared} />
            ) : page === "video-reviews" ? (
              <CoachVideoReviews shared={shared} />
            ) : page === "training" ? (
              <TrainingWorkspace shared={shared} />
            ) : page === "training-assign" ? (
              <AssignTrainingWorkspace shared={shared} />
            ) : page === "training-access" ? (
              <IndividualTrainingAccess shared={shared} />
            ) : page === "staff-settings" ? (
              <StaffSettingsWorkspace shared={shared} />
            ) : page === "staff-delivery" ? (
              <StaffDeliveryWorkspace shared={shared} />
            ) : page === "access" ? (
              <AccessWorkspace shared={shared} />
            ) : page === "interest" ? (
              <InterestWorkspace shared={shared} />
            ) : page === "profiles" ? (
              <MemberAccountPage shared={shared} profiles />
            ) : page === "member-library" ? (
              <WorkspaceLibrary
                key={`${shared.session?.user.id}-${shared.role}`}
                shared={shared}
              />
            ) : page === "launch" ? (
              <LaunchReadiness shared={shared} />
            ) : page === "account" ? (
              <MemberAccountPage shared={shared} />
            ) : page === "home" ? (
              <Home />
            ) : page === "staff" ? (
              <MeetTheStaff />
            ) : page === "contact" ? (
              <Contact />
            ) : page === "today" && profile ? (
              <Dashboard
                profile={profile}
                drills={drills}
                state={state}
                onStart={requestStart}
                onOpen={setDetail}
              />
            ) : page === "library" ? (
              <Library
                drills={drills.filter(
                  (d) =>
                    d.source !== "shared" || d.visibility === "public_sample",
                )}
                onOpen={setDetail}
              />
            ) : page === "progress" && profile ? (
              <Progress
                profile={profile}
                history={state.history.filter(
                  (h) => h.profileId === profile.id,
                )}
                onReset={() => setReset(true)}
              />
            ) : page === "session" && profile ? (
              <Session
                run={state.run}
                drills={drills}
                profile={profile}
                onUpdate={(run) => commit({ ...state, run })}
                onExit={() => setExit(true)}
                onComplete={(reflection) => {
                  if (!state.run) return;
                  const next = completeRun(
                    state,
                    state.run,
                    drills,
                    reflection,
                  );
                  commit(next);
                  // Update the view in the same render that clears the run so a
                  // second tap cannot activate the empty-session fallback.
                  setPage("progress");
                  go("progress");
                  setToast("Practice recorded. Showing your session history.");
                }}
              />
            ) : page === "install" ? (
              <InstallApp app={app} signedIn={shared.signedIn} />
            ) : page === "customer-help" ? (
              <CustomerHelp />
            ) : page === "content-review" ? (
              <ContentApprovals shared={shared} />
            ) : page === "workout-builder" ? (
              <WorkoutBuilder shared={shared} />
            ) : page === "coach" ? (
              <ContentStudio
                shared={shared}
                onPublish={publish}
                onUpdate={updateResource}
                onRemove={removeResource}
                resources={state.custom}
                lockedIds={state.run?.drillIds}
              />
            ) : (
              <Membership
                interestEndpoint={shared.interestEndpoint}
                interestLoading={shared.interestLoading}
              />
            )}
          </AccountInvitationGate>
        </div>
        {mobile ? (
          <MobileTabs shared={shared} page={page} />
        ) : privatePage ? (
          <PrivateFooter />
        ) : (
          <footer className="website-footer">
            <div className="footer-inner">
              <div className="footer-brand">
                <Logo />
                <p>
                  Learn the game.
                  <br />
                  Build purposeful practice.
                </p>
              </div>
              <nav className="footer-nav" aria-label="Footer navigation">
                <div className="footer-group">
                  <h2>Explore</h2>
                  <a href="#home">Home</a>
                  <a href="#membership">Proposed packages</a>
                  <a href="#staff">Meet the staff</a>
                  <a href="#demo">Fictional preview</a>
                </div>
                <div className="footer-group">
                  <h2>Help & access</h2>
                  <a href="#customer-help">Customer help</a>
                  <a href="#contact">Contact</a>
                  <QuickHelp />
                  <a href={shared.signedIn ? "#workspace" : "#account"}>
                    {shared.signedIn ? "Dashboard" : "Log in"}
                  </a>
                  <a href="#install">App & installation</a>
                </div>
              </nav>
            </div>
            <div className="footer-follow">
              <span>Follow Repformed</span>
              <SocialLinks compact />
            </div>
            <div className="footer-bottom">
              <span>© {new Date().getFullYear()} Repformed</span>
              <nav
                className="footer-legal"
                aria-label="Account help and credits"
              >
                <a href={`${import.meta.env.BASE_URL}account-help.html`}>
                  Account & privacy help
                </a>
                <a href={`${import.meta.env.BASE_URL}credits.html`}>
                  Credits & licenses
                </a>
              </nav>
            </div>
          </footer>
        )}
      </div>
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          <Tag>
            {detail.skill} · {detail.minutes} MIN
          </Tag>
          <Field kind={detail.kind} />
          <p>{detail.lesson}</p>
          <p className="equipment">
            <Flag size={18} />
            {detail.equipment}
          </p>
          {detail.assetId && <AssetPreview drill={detail} />}
          <h3>Practice walkthrough</h3>
          <ol className="instruction-list">
            {detail.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="coaching-cue">
            <Sparkles size={19} />
            <p>
              <strong>Coaching cue</strong>
              {detail.cue}
            </p>
          </div>
          <small>
            Illustrative, noncontact activity. Pending qualified review.
          </small>
          {profile &&
          (!detail.ages.includes(profile.age) ||
            !detail.levels.includes(profile.level) ||
            (detail.positions.length > 0 &&
              !detail.positions.includes(profile.position))) ? (
            <Notice>
              This activity does not match {profile.name}’s age, position, or
              level.{" "}
              <a href="#onboarding" onClick={() => setDetail(null)}>
                Change the fictional profile
              </a>{" "}
              to try a different audience.
            </Notice>
          ) : (
            <button
              className="button full"
              onClick={() => requestStart([detail.id])}
            >
              {profile ? "Practice this drill" : "Choose a demo player"}
              <ArrowRight size={18} />
            </button>
          )}
        </Modal>
      )}
      {ready && profile && (
        <Modal
          title={
            profile.guardian ? "Parent practice check" : "Before you begin"
          }
          onClose={() => setReady(null)}
        >
          <Tag>ILLUSTRATIVE NONCONTACT PRACTICE</Tag>
          <p>
            {profile.guardian
              ? "This fictional profile is parent-managed. An adult should choose and supervise activities, especially for younger players."
              : "Choose a comfortable pace and a clear, flat practice area."}
          </p>
          <Notice>
            These sample activities are pending qualified coaching review.
            Review every instruction before trying it. Pause if an activity
            feels uncomfortable; this demo does not provide medical advice.
          </Notice>
          <label className="checkbox-label readiness">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            {profile.guardian
              ? "I’m exploring as the parent/guardian and understand that real practice needs adult supervision and qualified guidance."
              : "I understand this is illustrative content, not a reviewed training prescription."}
          </label>
          <div className="actions">
            <button className="button" disabled={!ack} onClick={begin}>
              Begin guided session <ArrowRight size={18} />
            </button>
            <button className="text-button" onClick={() => setReady(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
      {exit && (
        <Modal title="End this session?" onClose={() => setExit(false)}>
          <p>
            Your completed history stays saved. This unfinished session will not
            count as completed practice.
          </p>
          <div className="actions">
            <button
              className="button danger"
              onClick={() => {
                commit({ ...state, run: null });
                setExit(false);
                go("today");
              }}
            >
              End without recording
            </button>
            <button className="button secondary" onClick={() => setExit(false)}>
              Keep practicing
            </button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal title="Reset demo history?" onClose={() => setReset(false)}>
          <p>
            This removes only {profile?.name}’s recorded practice on this
            browser. It cannot be undone. Uploaded content and other fictional
            players stay saved.
          </p>
          <div className="actions">
            <button
              className="button danger"
              onClick={() => {
                commit({
                  ...state,
                  history: state.history.filter(
                    (h) => h.profileId !== profile?.id,
                  ),
                });
                setReset(false);
              }}
            >
              Reset this history
            </button>
            <button
              className="button secondary"
              onClick={() => setReset(false)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </MotionShell>
  );
}
function Onboarding({
  current,
  onChoose,
  onCancel,
}: {
  current: Profile | null;
  onChoose: (p: Profile) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Profile>(current || PROFILES[1]);
  const [guardian, setGuardian] = useState(false);
  const update = (key: keyof Profile, value: string) => {
    setForm({ ...form, [key]: value });
    setGuardian(false);
  };
  return (
    <main className="page onboarding">
      <div className="page-intro centered">
        <Tag>YOUR STARTING POINT</Tag>
        <h1 tabIndex={-1}>Choose your demo player</h1>
        <p>
          Choose a fictional player, or adjust their training preferences.
          <br />
          No names, accounts, or real player information needed.
        </p>
      </div>
      <div className="profile-options">
        {PROFILES.map((p) => (
          <button
            key={p.id}
            className={`profile-option ${form.id === p.id ? "selected" : ""}`}
            onClick={() => {
              setForm(p);
              setGuardian(false);
            }}
          >
            <span className={`avatar avatar-${p.id}`}>{p.name[0]}</span>
            <strong>{p.name}</strong>
            <span>{p.age === "18+" ? "18+ & adults" : `Ages ${p.age}`}</span>
            <small>
              {p.position === "Explore all positions"
                ? "First steps"
                : p.position}
            </small>
            {form.id === p.id && (
              <CheckCircle2 className="profile-selected" size={19} />
            )}
          </button>
        ))}
      </div>
      <form
        className="panel profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          const minor = form.age !== "18+";
          if (minor && !guardian) return;
          const base = PROFILES.find((p) => p.id === form.id);
          const same =
            base &&
            base.age === form.age &&
            base.position === form.position &&
            base.level === form.level &&
            base.goal === form.goal;
          const id = same
            ? form.id
            : `custom:${form.id.split(":")[0]}:${form.age}:${form.position}:${form.level}:${form.goal}`;
          onChoose({
            ...form,
            id,
            name: same ? form.name : "Sample player",
            guardian: minor,
          });
        }}
      >
        <div className="form-heading">
          <div>
            <h2>Make the demo yours.</h2>
            <p>Training preferences for a fictional player.</p>
          </div>
          <Tag>FOOTBALL</Tag>
        </div>
        <div className="form-grid">
          <label>
            Age group
            <select
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
            >
              {AGES.map((a) => (
                <option value={a} key={a}>
                  {a === "18+" ? "18+ & adults" : `Ages ${a}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Football position
            <select
              value={form.position}
              onChange={(e) => update("position", e.target.value)}
            >
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Experience
            <select
              value={form.level}
              onChange={(e) => update("level", e.target.value)}
            >
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Main goal
            <select
              value={form.goal}
              onChange={(e) => update("goal", e.target.value)}
            >
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
        {form.age !== "18+" ? (
          <div className="guardian-box">
            <ShieldCheck size={23} />
            <div>
              <strong>Parent-managed demo</strong>
              <p>
                {form.age === "5–7"
                  ? "Short, playful activities with a parent alongside every step."
                  : "A parent or guardian manages this fictional minor’s training preferences and supervises practice."}
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={guardian}
                  onChange={(e) => setGuardian(e.target.checked)}
                  required
                />{" "}
                I’m exploring as a parent or guardian using fictional
                information only.
              </label>
            </div>
          </div>
        ) : (
          <Notice>
            Adult sample profile. All activities are illustrative, noncontact,
            and pending qualified review.
          </Notice>
        )}
        <div className="actions">
          <button className="button" type="submit">
            See my training <ArrowRight size={18} />
          </button>
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        <small className="form-footnote">
          Saved in this browser only. No personal information is needed or
          requested.
        </small>
      </form>
    </main>
  );
}
function Dashboard({
  profile,
  drills,
  state,
  onStart,
  onOpen,
}: {
  profile: Profile;
  drills: Drill[];
  state: State;
  onStart: (ids: string[]) => void;
  onOpen: (d: Drill) => void;
}) {
  const plan = planFor(profile, drills);
  const total = plan.reduce((n, d) => n + d.minutes, 0);
  const history = state.history.filter((h) => h.profileId === profile.id);
  return (
    <main className="page dashboard">
      <div className="dashboard-heading">
        <div>
          <div className="eyebrow">
            <span className="green-dot" /> YOUR TRAINING PLAN
          </div>
          <h1 tabIndex={-1}>Today’s training</h1>
          <p>
            {profile.guardian
              ? `You’re managing ${profile.name}’s fictional training.`
              : `Welcome to your sample practice, ${profile.name}.`}{" "}
            Here’s a clear place to start.
          </p>
        </div>
        <a href="#onboarding" className="profile-badge">
          <span className="avatar">{profile.name[0]}</span>
          <span>
            <strong>
              {profile.name} <small>FICTIONAL</small>
            </strong>
            <span>
              {profile.age} · {profile.position}
            </span>
            <small>
              {profile.guardian ? "Parent-managed" : "Adult player"} · Change
              profile
            </small>
          </span>
          <ChevronRight size={17} />
        </a>
      </div>
      <div className="dashboard-grid">
        <section className="next-session">
          <div className="next-copy">
            <Tag light>TODAY’S TRAINING</Tag>
            <h2>
              {profile.age === "5–7"
                ? "Little steps, big curiosity."
                : profile.goal === "Footwork"
                  ? "Find your footing."
                  : profile.goal === "Ball skills"
                    ? "Get a feel for the game."
                    : profile.goal === "Coordination"
                      ? "Move with intention."
                      : "See the next possibility."}
            </h2>
            <p>
              A guided foundations session built around{" "}
              {profile.goal.toLowerCase()}.
            </p>
            <div className="session-meta">
              <span>
                <Clock3 size={17} />
                {total} minutes
              </span>
              <span>
                <BookOpen size={17} />
                {plan.length} {plan.length === 1 ? "drill" : "drills"}
              </span>
              <span>
                <ShieldCheck size={17} />
                Noncontact
              </span>
            </div>
            <button
              className="button lime"
              onClick={() =>
                state.run ? go("session") : onStart(plan.map((d) => d.id))
              }
              disabled={!plan.length}
            >
              {state.run ? "Resume session" : "Start today’s session"}{" "}
              <Play size={17} fill="currentColor" />
            </button>
          </div>
          <div className="next-art">
            <Field kind={plan[0]?.kind} />
          </div>
        </section>
        <aside className="why-card">
          <span className="eyebrow">
            <Sparkles size={17} /> WHY THIS FITS
          </span>
          <h3>Matched to your player</h3>
          <p>
            Selected for{" "}
            <strong>
              {profile.age === "18+" ? "adults" : `ages ${profile.age}`}
            </strong>
            , <strong>{profile.level.toLowerCase()}</strong>, and your goal of{" "}
            <strong>{profile.goal.toLowerCase()}</strong>.
          </p>
          <p>
            {profile.position === "Explore all positions"
              ? "Explore foundational skills before choosing a position."
              : `Foundations apply to ${profile.position.toLowerCase()} play. Position-specific resources are included when available.`}
          </p>
          <div className="why-note">
            {profile.guardian ? (
              <ShieldCheck size={18} />
            ) : (
              <Target size={18} />
            )}
            <span>
              {profile.age === "5–7"
                ? "Short activities. Parent alongside. Plenty of room for play."
                : profile.guardian
                  ? "Parent-managed preferences. Adult-supervised practice."
                  : "A comfortable pace. Simple instructions. No contact."}
            </span>
          </div>
          <small>Rule-based sample matching · no AI assessment</small>
        </aside>
      </div>
      <div className="dashboard-lower">
        <section>
          <div className="section-heading compact">
            <div>
              <span className="eyebrow">ONE STEP AT A TIME</span>
              <h2>Inside your session</h2>
            </div>
            <span className="muted">{plan.length} guided activities</span>
          </div>
          <div className="session-list">
            {plan.map((d, i) => (
              <button key={d.id} onClick={() => onOpen(d)}>
                <span className="list-number">0{i + 1}</span>
                <div>
                  <strong>{d.title}</strong>
                  <span>{d.equipment}</span>
                </div>
                <span className="list-time">
                  {d.minutes} min <ArrowUpRight size={19} />
                </span>
              </button>
            ))}
          </div>
        </section>
        <aside className="routine-card">
          <TrendingUp size={26} />
          <span className="eyebrow">BUILD YOUR ROUTINE</span>
          <strong>
            {history.length}
            <small>sessions recorded</small>
          </strong>
          <p>
            Practice history tracks participation, not proven athletic
            improvement.
          </p>
          <a className="text-button" href="#progress">
            See my progress <ArrowRight size={17} />
          </a>
        </aside>
      </div>
      <Notice>
        Before you practice: use a clear, flat space and review the equipment in
        each activity. All content is illustrative and pending qualified
        coaching review.
      </Notice>
      <div className="library-prompt">
        <div>
          <h3>Keep exploring</h3>
          <p>Find more activities in the drill library.</p>
        </div>
        <a className="button secondary" href="#library">
          Browse drills <ArrowRight size={17} />
        </a>
      </div>
    </main>
  );
}
function Library({
  drills,
  onOpen,
}: {
  drills: Drill[];
  onOpen: (d: Drill) => void;
}) {
  const [filters, setFilters] = useState({
    query: "",
    age: "",
    position: "",
    level: "",
    skill: "",
  });
  const filtered = filterDrills(drills, filters);
  const set = (key: keyof typeof filters, value: string) =>
    setFilters({ ...filters, [key]: value });
  return (
    <main className="page library">
      <div className="page-intro">
        <Tag>THE PRACTICE PLAYBOOK</Tag>
        <h1 tabIndex={-1}>Drill library</h1>
        <p>
          Short lessons. Clear instructions. A purpose for every rep.
          <br />
          Explore illustrative American football activities for your starting
          point.
        </p>
      </div>
      <div className="library-tools">
        <label className="search-input">
          <Search size={20} />
          <input
            type="search"
            placeholder="Search drills, skills, or ideas…"
            aria-label="Search drills"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
          />
        </label>
        <div className="filters">
          <label>
            Age group
            <select
              value={filters.age}
              onChange={(e) => set("age", e.target.value)}
            >
              <option value="">All ages</option>
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {a === "18+" ? "18+ & adults" : a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Position
            <select
              value={filters.position}
              onChange={(e) => set("position", e.target.value)}
            >
              <option value="">All positions</option>
              {POSITIONS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Experience
            <select
              value={filters.level}
              onChange={(e) => set("level", e.target.value)}
            >
              <option value="">All levels</option>
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Skill
            <select
              value={filters.skill}
              onChange={(e) => set("skill", e.target.value)}
            >
              <option value="">All skills</option>
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="results-heading">
        <p role="status">
          <strong>{filtered.length}</strong>{" "}
          {filtered.length === 1 ? "activity" : "activities"} to explore
        </p>
        <button
          className="text-button"
          onClick={() =>
            setFilters({
              query: "",
              age: "",
              position: "",
              level: "",
              skill: "",
            })
          }
        >
          Clear filters <X size={15} />
        </button>
      </div>
      {filtered.length ? (
        <div className="three-grid">
          {filtered.map((d) => (
            <DrillCard key={d.id} drill={d} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={35} />
          <h2>No drills match just yet.</h2>
          <p>Try a broader age group, position, or skill.</p>
          <button
            className="button secondary"
            onClick={() =>
              setFilters({
                query: "",
                age: "",
                position: "",
                level: "",
                skill: "",
              })
            }
          >
            Clear all filters
          </button>
        </div>
      )}
      <Notice>
        Original illustrative practice resources, not certified coaching
        demonstrations. Local coach uploads appear only on the browser where
        they were published.
      </Notice>
    </main>
  );
}
function Session({
  run,
  drills,
  profile,
  onUpdate,
  onExit,
  onComplete,
}: {
  run: Run | null;
  drills: Drill[];
  profile: Profile;
  onUpdate: (run: Run) => void;
  onExit: () => void;
  onComplete: (r: RecordEntry["reflection"]) => void;
}) {
  const [reflection, setReflection] =
    useState<RecordEntry["reflection"]>("Prefer not to say");
  const [checked, setChecked] = useState(false);
  const [attempt, setAttempt] = useState(false);
  const [paused, setPaused] = useState(false);
  if (!run)
    return (
      <main className="page empty-state">
        <Footprints size={40} />
        <h1 tabIndex={-1}>Your next step is waiting.</h1>
        <p>Choose today’s guided session to begin.</p>
        <a className="button" href="#today">
          Go to today’s training <ArrowRight size={18} />
        </a>
      </main>
    );
  const current = drills.find((d) => d.id === run.drillIds[run.index]);
  if (!current)
    return (
      <main className="page">
        <h1 tabIndex={-1}>This practice resource is unavailable.</h1>
        <p>End the session and choose another activity from the library.</p>
        <button className="button" onClick={onExit}>
          End session
        </button>
      </main>
    );
  const update = (next: Run) => {
    setChecked(false);
    setAttempt(false);
    setPaused(false);
    onUpdate(next);
    window.scrollTo(0, 0);
  };
  const done = run.phase === "done";
  return (
    <main className="page training">
      <div className="training-top">
        <a className="text-button" href="#today">
          <ArrowLeft size={17} /> Save & return to Today
        </a>
        <button className="text-button" onClick={onExit}>
          End session <X size={17} />
        </button>
      </div>
      <div className="session-progress" aria-label="Session progress">
        {run.drillIds.map((id, i) => (
          <div
            className={
              done || i < run.index
                ? "finished"
                : i === run.index
                  ? "current"
                  : ""
            }
            key={id}
          >
            <span>{done || i < run.index ? <Check size={13} /> : i + 1}</span>
            <b>{drills.find((d) => d.id === id)?.title}</b>
          </div>
        ))}
      </div>
      {done ? (
        <section className="session-finish panel">
          <span className="finish-icon">
            <Flag size={34} />
          </span>
          <Tag>YOU SHOWED UP</Tag>
          <h1 tabIndex={-1}>Practice complete</h1>
          <p>
            You’ve reached the end of {run.drillIds.length} guided{" "}
            {run.drillIds.length === 1 ? "activity" : "activities"}. Record only
            practice you actually completed.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={attempt}
              onChange={(e) => setAttempt(e.target.checked)}
            />{" "}
            {profile.guardian
              ? "As the parent/guardian, I confirm the sample practice was completed."
              : "I confirm the sample practice was completed."}
          </label>
          <label>
            How did practice feel?{" "}
            <span className="muted">Optional reflection</span>
            <select
              value={reflection}
              onChange={(e) =>
                setReflection(e.target.value as RecordEntry["reflection"])
              }
            >
              <option>Prefer not to say</option>
              <option>Felt comfortable</option>
              <option>Still practicing</option>
            </select>
          </label>
          <Notice>
            This records self-reported participation, not athletic ability or
            improvement. Watching a lesson alone does not count as completed
            practice.
          </Notice>
          <button
            className="button"
            disabled={!attempt}
            onClick={() => onComplete(reflection)}
          >
            Record completed practice <CheckCircle2 size={18} />
          </button>
        </section>
      ) : (
        <>
          <div className="training-heading">
            <span className="eyebrow">
              DRILL {run.index + 1} OF {run.drillIds.length}{" "}
              <span className="muted">
                /{" "}
                {run.phase === "lesson"
                  ? "UNDERSTAND IT"
                  : "TRY IT AT YOUR PACE"}
              </span>
            </span>
            <h1 tabIndex={-1}>{current.title}</h1>
            <p>
              <Clock3 size={17} />
              {current.minutes} min practice <span>·</span> {current.skill}
              <span>·</span> Noncontact
            </p>
          </div>
          <div className="training-grid">
            <section className="training-main">
              <div className="lesson-art">
                <Field kind={current.kind} />
                <div>
                  <span>ILLUSTRATIVE FIELD DIAGRAM</span>
                  <span>
                    {run.phase === "lesson" ? "01 / LEARN" : "02 / PRACTICE"}
                  </span>
                </div>
              </div>
              {current.assetId && <AssetPreview drill={current} />}
              <div className="panel lesson-copy">
                {run.phase === "lesson" ? (
                  <>
                    <Tag>THE SHORT LESSON</Tag>
                    <h2>
                      A little understanding
                      <br />
                      before the first step.
                    </h2>
                    <p>{current.lesson}</p>
                    <Notice>
                      {profile.guardian
                        ? "Parent: read the activity first and supervise the practice. "
                        : ""}
                      This is illustrative content pending qualified review. No
                      contact, sprinting, or performance assessment.
                    </Notice>
                    <button
                      className="button"
                      onClick={() => update({ ...run, phase: "practice" })}
                    >
                      Show practice steps <ArrowRight size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <Tag>PUT IT INTO PRACTICE</Tag>
                    <h2>Take it one step at a time.</h2>
                    <ol className="instruction-list">
                      {current.steps.map((s, i) => (
                        <li key={i}>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="coaching-cue">
                      <Sparkles size={21} />
                      <p>
                        <strong>Keep this cue in mind</strong>
                        {current.cue}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setPaused(!paused)}
                    >
                      {paused ? "Continue practice" : "Pause for a break"}{" "}
                      {paused ? <Play size={16} /> : <Clock3 size={16} />}
                    </button>
                    {paused ? (
                      <Notice>
                        Practice paused. Take the time you need. Your place is
                        saved; continue when ready.
                      </Notice>
                    ) : (
                      <>
                        <label className="checkbox-label readiness">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                          />
                          {profile.guardian
                            ? "We completed the practice steps together."
                            : "I completed the practice steps, not only the lesson."}
                        </label>
                        <button
                          className="button"
                          disabled={!checked}
                          onClick={() =>
                            update(
                              run.index === run.drillIds.length - 1
                                ? { ...run, phase: "done" }
                                : {
                                    ...run,
                                    index: run.index + 1,
                                    phase: "lesson",
                                  },
                            )
                          }
                        >
                          {run.index === run.drillIds.length - 1
                            ? "Finish & reflect"
                            : "Next drill"}
                          <ArrowRight size={18} />
                        </button>
                      </>
                    )}
                    <button
                      className="text-button back-lesson"
                      onClick={() => update({ ...run, phase: "lesson" })}
                    >
                      <ArrowLeft size={15} /> Review lesson
                    </button>
                  </>
                )}
              </div>
            </section>
            <aside>
              <div className="panel training-kit">
                <span className="eyebrow">SET YOURSELF UP</span>
                <h3>
                  <Flag size={21} /> What you’ll need
                </h3>
                <p>{current.equipment}</p>
                <hr />
                <h3>
                  <ShieldCheck size={21} /> Before you move
                </h3>
                <p>
                  Check for a clear, flat space. Keep it comfortable and
                  noncontact. Pause if anything feels uncomfortable.
                </p>
                {profile.guardian && <Tag>PARENT SUPERVISION</Tag>}
                <small>
                  Instructions are illustrative. Qualified coaching review is
                  required before real use.
                </small>
              </div>
              <div className="up-next">
                <span className="eyebrow">UP NEXT</span>
                <h3>
                  {drills.find((d) => d.id === run.drillIds[run.index + 1])
                    ?.title || "Reflect & record your practice"}
                </h3>
                <p>
                  {run.index + 1 < run.drillIds.length
                    ? "Another small step in your session."
                    : "A moment to notice how practice felt."}
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
function Progress({
  profile,
  history,
  onReset,
}: {
  profile: Profile;
  history: RecordEntry[];
  onReset: () => void;
}) {
  const minutes = history.reduce((n, h) => n + h.minutes, 0);
  return (
    <main className="page progress-page">
      <div className="page-intro">
        <Tag>THE WORK YOU’VE PUT IN</Tag>
        <h1 tabIndex={-1}>Practice progress</h1>
        <p>
          {profile.name}’s fictional practice history. A record of showing up,
          <br />
          with space to reflect along the way.
        </p>
      </div>
      <div className="stats-grid">
        <article>
          <Flag size={23} />
          <strong>{history.length}</strong>
          <span>Sessions recorded</span>
        </article>
        <article>
          <Clock3 size={23} />
          <strong>{minutes}</strong>
          <span>Planned practice minutes*</span>
        </article>
        <article>
          <Footprints size={23} />
          <strong>{history.reduce((n, h) => n + h.titles.length, 0)}</strong>
          <span>Drills practiced</span>
        </article>
      </div>
      <p className="metric-note">
        *Minutes are estimated from each activity, not measured with a timer.
        All records are self-reported.
      </p>
      <Notice>
        Practice history shows participation only. It does not measure athletic
        improvement, validate technique, or predict recruiting or scholarship
        outcomes. Video completion is never used as proof of ability.
      </Notice>
      <div className="section-heading compact">
        <h2>Your practice history</h2>
        {history.length > 0 && (
          <button className="text-button" onClick={onReset}>
            Reset demo history
          </button>
        )}
      </div>
      {!history.length ? (
        <div className="empty-state panel">
          <Flag size={36} />
          <h2>Your first small step is ahead.</h2>
          <p>
            Complete a guided session and record it to see your history here.
          </p>
          <a className="button" href="#today">
            Find today’s training <ArrowRight size={18} />
          </a>
        </div>
      ) : (
        <div className="history-list">
          {history.map((h) => (
            <article key={h.id}>
              <span className="history-check">
                <Check size={21} />
              </span>
              <div>
                <span className="eyebrow">
                  {new Date(h.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <h3>{h.titles.join(" + ")}</h3>
                <p>
                  {h.titles.length} {h.titles.length === 1 ? "drill" : "drills"}{" "}
                  · {h.minutes} planned minutes · Self-reported practice
                </p>
                <span className="reflection">
                  {h.reflection === "Prefer not to say"
                    ? "No reflection added"
                    : h.reflection}
                </span>
              </div>
              <Tag>RECORDED</Tag>
            </article>
          ))}
        </div>
      )}
      <p className="local-note">
        Saved on this browser for this fictional profile only. No public
        profiles, comparisons, or leaderboards.
      </p>
    </main>
  );
}
