import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Dumbbell,
  House,
  LogIn,
  TrendingUp,
  ShieldCheck,
  UserRound,
  Video,
} from "lucide-react";
import { Logo, Notice, Tag } from "./components";
import {
  mobileNavigation,
  nativeApp,
  openWebsite,
  websiteNavigationUrl,
} from "./mobile";
import type { SharedState } from "./useSharedContent";
import type { PwaState } from "./pwa";
import { SocialLinks } from "./SocialLinks";
import { QuickHelp } from "./QuickHelp";
import { AccountShortcut } from "./AccountShortcut";

export function WebsiteLink({
  children,
  path = "#home",
  className = "text-button",
}: {
  children: ReactNode;
  path?: string;
  className?: string;
}) {
  const [error, setError] = useState("");
  return (
    <>
      <a
        className={className}
        href={websiteNavigationUrl(path)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          if (!nativeApp()) return;
          event.preventDefault();
          void openWebsite(path).catch(() =>
            setError("Open Repformed in Safari to continue."),
          );
        }}
      >
        {children}
      </a>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

export function MobileHeader({
  demo,
  signedIn,
  page,
}: {
  demo: boolean;
  signedIn: boolean;
  page: string;
}) {
  return (
    <header className="app-header">
      <Logo href={signedIn ? "#workspace" : "#app"} />
      <div className="app-header-tools">
        {!signedIn && !nativeApp() ? (
          <WebsiteLink className="app-website-back">
            Back to website
          </WebsiteLink>
        ) : (
          <span className="app-build-label">
            {demo
              ? "SAMPLE DEMO"
              : signedIn
                ? "PRIVATE ACCOUNT"
                : "ACCOUNT ACCESS"}
          </span>
        )}
        <a href="#app-help" className="app-help-shortcut" aria-label="App help">
          <CircleHelp size={21} />
        </a>
        {signedIn && <AccountShortcut page={page} />}
      </div>
    </header>
  );
}
export function MobileTabs({
  shared,
  page,
}: {
  shared: SharedState;
  page: string;
}) {
  const icons: Record<string, typeof House> = {
    app: House,
    demo: Dumbbell,
    workspace: ["owner", "manager", "coach"].includes(shared.role || "")
      ? House
      : Dumbbell,
    coach: BookOpen,
    training: BookOpen,
    "staff-settings": ShieldCheck,
    "video-reviews": Video,
    "member-library": BookOpen,
    "app-workouts": BookOpen,
    "app-progress": TrendingUp,
    account: shared.signedIn ? UserRound : LogIn,
    "app-help": CircleHelp,
  };
  return (
    <nav className="app-tabs" aria-label="App navigation">
      {mobileNavigation(shared.signedIn, shared.role).map(([route, label]) => {
        const Icon = icons[route];
        const active =
          page === route ||
          (route === "training" &&
            [
              "coach",
              "workout-builder",
              "content-review",
              "training-assign",
              "training-access",
              "member-library",
            ].includes(page)) ||
          (route === "app" && page === "home") ||
          (route === "workspace" &&
            ["app", "home", "interest"].includes(page) &&
            shared.signedIn) ||
          (route === "staff-settings" &&
            ["access", "launch", "staff-delivery"].includes(page)) ||
          (route === "account" && page === "profiles") ||
          (route === "app-workouts" && page === "member-library");
        return (
          <a
            key={route}
            href={`#${route}`}
            aria-current={active ? "page" : undefined}
            className={active ? "active" : ""}
          >
            <Icon size={22} />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
export function MobileWelcome({ signedIn }: { signedIn: boolean }) {
  return (
    <main className="app-start">
      <div className="app-start-photo">
        <img
          src={`${import.meta.env.BASE_URL}media/solo-football.jpg`}
          alt="Licensed stock image of an adult football athlete on a field."
          width={1440}
          height={2160}
        />
        <div className="app-start-shade" />
        <div className="app-start-title">
          <Tag>FOOTBALL · REPFORMED</Tag>
          <h1 tabIndex={-1}>
            Your training
            <br />
            <span>starts here.</span>
          </h1>
        </div>
      </div>
      <section className="app-start-content" aria-label="Get started">
        <p>Your next workout. Guided practice. Progress you can follow.</p>
        <a href={signedIn ? "#workspace" : "#account"} className="button full">
          {signedIn ? "Open my training" : "Log in to your account"}
          <ArrowRight size={19} />
        </a>
        <div className="app-start-note">
          <ShieldCheck size={19} />
          <p>
            Your private workouts, practice history and coach video reviews.
            Sign in with your Repformed account.
          </p>
        </div>
        <p className="app-pilot-note">
          Account access is by invitation. Youth enrollment and paid memberships
          are not open. Training activities await qualified review.
        </p>
      </section>
    </main>
  );
}
export function MobileHelp({ app }: { app: PwaState }) {
  return (
    <main className="page app-help">
      <div className="page-intro">
        <Tag>REPFORMED · APP HELP</Tag>
        <h1 tabIndex={-1}>Your app, explained.</h1>
        <p>
          {nativeApp()
            ? "The iOS training app, with screens bundled on your device."
            : "The mobile app experience, ready to add to your home screen."}
        </p>
      </div>
      <section className="panel">
        <h2>Train here. Explore on the website.</h2>
        <QuickHelp />
        <p>
          Today brings up your next session. Workouts holds your available
          training. Progress shows reported practice and parent reviews. Account
          holds profiles, family permissions and sign-out. Coaches and staff see
          their authorized content tools.
        </p>
        <p>
          The website explains planned programs, packages and how to express
          interest. Both use the same private account service. The public demo
          stays on the website.
        </p>
        <div className="help-actions">
          <WebsiteLink path="#membership">
            View website membership information
          </WebsiteLink>
          <WebsiteLink path="#contact">
            Contact the team <ArrowRight size={17} />
          </WebsiteLink>
          <WebsiteLink path="#customer-help">
            Customer help <ArrowRight size={17} />
          </WebsiteLink>
        </div>
        <SocialLinks />
      </section>
      <section className="panel">
        <h2>Accounts & privacy</h2>
        <p>
          Log in with your approved Repformed account. Real profiles use the
          same private account service as the website. Account access determines
          which workspace you see.
        </p>
        <p>
          {nativeApp()
            ? "Sign-in sessions use the iOS Keychain. Private player profiles and media are not saved in the public offline cache."
            : "Private profiles stay separate from fictional demo data. Installing does not create an account or start a subscription."}
        </p>
        <a href="#account" className="button secondary">
          Account settings <ArrowRight size={17} />
        </a>
      </section>
      <section className="panel">
        <h2>Reset your password</h2>
        <p>
          Open account access on the website in Safari to reset a password or
          resend verification. Complete the email steps there, then return here
          and log in.
        </p>
        <WebsiteLink path="#account">
          Open website account access <ArrowRight size={17} />
        </WebsiteLink>
      </section>
      <section className="panel">
        <h2>Workouts & video review</h2>
        <p>
          {app.online
            ? "You’re connected."
            : "Reconnect to load private training and reviews."}
        </p>
        <p>
          Assigned workouts, private video submissions and feedback require
          internet access. Your unfinished practice position saves after each
          drill; use Save & leave and Resume workout without recording a
          completion. Video review is an optional account feature enabled by an
          Owner; no subscription charge is started here. Keep clips to 60
          seconds and 40 MB. Real junior video uploads remain closed pending
          consent and retention review.
        </p>
      </section>
      <section className="panel">
        <h2>Invitations & account deletion</h2>
        <p>
          Owners prepare private adult account invitations. Customers can review
          full account deletion after confirming their password; staff and
          guardian-managed accounts request an ownership review.
        </p>
        <WebsiteLink path="account-help.html">
          Open account setup & deletion help <ArrowRight size={17} />
        </WebsiteLink>
      </section>
      {nativeApp() && (
        <details className="panel">
          <summary>TestFlight testing resources</summary>
          <p>
            Use the adult acceptance guide when testing an invited account. Keep
            real child information out of testing.
          </p>
          <WebsiteLink path="phone-test.html">
            Open the two-phone test guide <ArrowRight size={17} />
          </WebsiteLink>
          <WebsiteLink path="phone-test.pdf">Open printable PDF</WebsiteLink>
        </details>
      )}
      <section className="panel">
        <h2>
          {nativeApp()
            ? "About this TestFlight build"
            : "Installation & updates"}
        </h2>
        {nativeApp() ? (
          <p>
            This is a TestFlight pilot build. Updates arrive through TestFlight.
            Use fictional profiles or approved adult pilot accounts while
            testing.
          </p>
        ) : (
          <>
            <p>
              Add this app from Safari’s Share menu → Add to Home Screen. Check
              app updates after saving any work.
            </p>
            <a className="button secondary" href="#install">
              Install or update the web app <ArrowRight size={17} />
            </a>
          </>
        )}
        <Notice>
          Football is the current program. Future sports have not been
          announced. Memberships, payments and real junior enrollment remain
          closed. Practice records show participation, not proven ability.
        </Notice>
      </section>
      <div className="app-help-links">
        <WebsiteLink>
          Visit the website <ArrowRight size={17} />
        </WebsiteLink>
        <WebsiteLink path="media/credits.txt">
          Licensed media credits <ArrowRight size={17} />
        </WebsiteLink>
      </div>
    </main>
  );
}
