import { ArrowLeft, ArrowUpRight, CircleHelp } from "lucide-react";
import { AccountShortcut } from "./AccountShortcut";
import { Logo } from "./components";
import { isStaff, ROLE_LABELS, type AccountRole } from "./roles";
import { SocialLinks } from "./SocialLinks";
import type { SharedState } from "./useSharedContent";
import "./privateWorkspace.css";

function workspaceNavigation(role: AccountRole | null): [string, string][] {
  if (isStaff(role))
    return [
      ["workspace", "Athletes"],
      ["training", "Training"],
      ["staff-settings", "Staff & settings"],
    ];
  return [
    ["workspace", "Today"],
    ["app-workouts", "Workouts"],
    ["app-progress", "Progress"],
    ["profiles", role === "parent" ? "Family profiles" : "Profile"],
    ["account", "Account"],
  ];
}
export function PrivateHeader({
  shared,
  page,
}: {
  shared: SharedState;
  page: string;
}) {
  const ready = shared.signedIn && shared.accessReady && !shared.accessError;
  const staff = isStaff(shared.role);
  const trainingPages = [
    "training",
    "training-assign",
    "training-access",
    "coach",
    "workout-builder",
    "content-review",
    "member-library",
  ];
  const legacyTrainingAccess =
    page === "access" &&
    new URLSearchParams(location.search).get("accessSection") === "training";
  const active = (route: string) =>
    route === page ||
    (staff &&
      route === "training" &&
      (trainingPages.includes(page) || legacyTrainingAccess)) ||
    (staff &&
      route === "workspace" &&
      ["video-reviews", "interest"].includes(page)) ||
    (staff &&
      route === "staff-settings" &&
      ["access", "launch", "staff-delivery"].includes(page) &&
      !legacyTrainingAccess) ||
    (!staff && route === "app-workouts" && page === "member-library");
  const secondary: [string, string][] =
    staff && (trainingPages.includes(page) || legacyTrainingAccess)
      ? [
          ["training", "Training bank"],
          ["coach", "Upload lesson"],
          ["workout-builder", "Build workout"],
          ["content-review", "Drafts & approvals"],
        ]
      : staff && ["workspace", "video-reviews", "interest"].includes(page)
        ? [
            ["workspace", "Roster"],
            ["video-reviews", "Video reviews"],
            ...(shared.role !== "coach" && shared.interestEndpoint
              ? [["interest", "Interest"] as [string, string]]
              : []),
          ]
        : [];
  return (
    <header className="private-header">
      <div className="private-header-top">
        <Logo href={ready ? "#workspace" : "#home"} />
        <div className="private-header-meta">
          {ready && shared.role && (
            <span className="private-role">{ROLE_LABELS[shared.role]}</span>
          )}
          <a href="#contact" aria-label="Account help" className="private-help">
            <CircleHelp size={19} />
            <span>Help</span>
          </a>
          <a href="#home" className="private-website">
            <ArrowUpRight size={16} />
            <span>Website</span>
          </a>
          {shared.signedIn && <AccountShortcut page={page} />}
        </div>
      </div>
      {ready ? (
        <nav className="private-nav" aria-label="Workspace navigation">
          {workspaceNavigation(shared.role).map(([route, label]) => (
            <a
              key={route}
              href={`#${route}`}
              aria-current={active(route) ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      ) : (
        <div className="private-auth-back">
          <a href="#home">
            <ArrowLeft size={16} /> Back to website
          </a>
          <span>Repformed account access</span>
        </div>
      )}
      {ready && !!secondary.length && (
        <nav className="private-subnav" aria-label="Workspace tools">
          {secondary.map(([route, label]) => (
            <a
              key={route}
              href={`#${route}`}
              aria-current={page === route ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
export function PrivateFooter() {
  return (
    <footer className="private-footer">
      <nav aria-label="Account help and credits">
        <a href="#customer-help">Customer help</a>
        <a href="#contact">Contact</a>
        <a href={`${import.meta.env.BASE_URL}account-help.html`}>
          Account & privacy help
        </a>
        <a href={`${import.meta.env.BASE_URL}credits.html`}>
          Credits & licenses
        </a>
      </nav>
      <SocialLinks compact />
      <small>© {new Date().getFullYear()} Repformed</small>
    </footer>
  );
}

export function PrivateAccessMessage({
  signedIn,
  title,
  children,
}: {
  signedIn: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="page narrow private-message">
      <span className="eyebrow">ACCOUNT ACCESS</span>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{children}</p>
      <a className="button" href={signedIn ? "#workspace" : "#account"}>
        {signedIn ? "Back to dashboard" : "Log in"}
        <ArrowUpRight size={17} />
      </a>
      <a href="#contact" className="text-button">
        Get account help
      </a>
    </main>
  );
}
