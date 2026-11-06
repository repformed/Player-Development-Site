import { useEffect, useState } from "react";
import { ArrowRight, Copy, Mail } from "lucide-react";
import { Tag, CheckLine } from "./components";
import { CONTACT_EMAIL } from "./contactContent";
import {
  PACKAGE_PROPOSALS,
  PACKAGE_COMPARISON_ROWS,
  packageInterestLink,
} from "./packageProposals";
import "./memberships.css";
import { InterestForm } from "./InterestForm";
import type { InterestPackage } from "./interestContract";

function focusInterest() {
  document.getElementById("interest-title")?.focus({ preventScroll: true });
  document
    .getElementById("package-interest")
    ?.scrollIntoView({ block: "start" });
}

export function Membership({
  interestEndpoint = null,
  interestLoading = false,
}: {
  interestEndpoint?: string | null;
  interestLoading?: boolean;
}) {
  const pending = interestLoading && !interestEndpoint;
  const [interest, setInterest] = useState<InterestPackage>("undecided"),
    [copy, setCopy] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [submissionState, setSubmissionState] = useState<
    "idle" | "sending" | "received"
  >("idle");
  function changePackage(id: InterestPackage) {
    setInterest(id);
    setSelectionNotice("");
    setCopy("");
  }
  function selectPackage(id: InterestPackage, name: string) {
    if (submissionState !== "idle") return;
    setInterest(id);
    setCopy("");
    setSelectionNotice(`${name} selected. Review your details before sending.`);
    focusInterest();
  }
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("interest") !== "1") return;
    let second: number | undefined;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        focusInterest();
        url.searchParams.delete("interest");
        history.replaceState(history.state, "", url);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      if (second !== undefined) cancelAnimationFrame(second);
    };
  }, []);
  return (
    <main className="page memberships proposed-memberships">
      <div className="page-intro centered">
        <Tag>FOUR LEVELS OF SUPPORT</Tag>
        <h1 tabIndex={-1}>Choose the support your athlete needs.</h1>
        <p>
          Football IQ means learning and understanding football: the rules,
          positions, terminology, reading plays and each player’s job. Start
          there, then add practice and coaching support as needed.
        </p>
      </div>
      <section
        className="membership-availability"
        aria-label="Current availability"
      >
        <strong>Interest is open. Enrollment is not.</strong>
        <p>
          Explore the planned packages below. Enrollment, payments and
          reservations are not open.
        </p>
        <p>
          All prices are in USD per athlete. Choose a plan to tell us what
          interests you—no account or payment needed.
        </p>
        <p><a href="/service-policies/">Read the planned cancellation, refund, review and retention policies</a>.</p>
        <button className="text-button" onClick={focusInterest}>
          Share your interest <ArrowRight size={17} />
        </button>
      </section>
      <section
        className="proposed-package-grid"
        aria-label="Compare proposed packages"
      >
        {PACKAGE_PROPOSALS.map((p) => (
          <article
            className="package-card proposed-package"
            aria-labelledby={`package-${p.id}`}
            key={p.id}
          >
            <div className="proposal-identity">
              <h2 id={`package-${p.id}`}>{p.name}</h2>
              <div className="proposal-price">
                <strong>${p.monthly}</strong>
                <span>USD / athlete / month</span>
              </div>
              <p className="proposal-annual">
                ${p.annual} / year · save ${p.annualSavings}
              </p>
            </div>
            <p className="proposal-audience">{p.audience}</p>
            <p className="proposal-benefit">{p.benefit}</p>
            <dl
              className="proposal-mobile-features"
              aria-label={`${p.name} proposed features`}
            >
              {PACKAGE_COMPARISON_ROWS.filter(
                (row) => p.comparison[row.key] !== "Not included",
              ).map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{p.comparison[row.key]}</dd>
                </div>
              ))}
            </dl>
            <div className="proposal-action">
              <button
                className="button secondary"
                disabled={submissionState !== "idle"}
                onClick={() => selectPackage(p.id, p.name)}
              >
                Express interest in {p.name}{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <span className="proposal-closed">Not available to purchase</span>
            </div>
          </article>
        ))}
      </section>
      <section
        className="package-comparison"
        aria-labelledby="comparison-title"
      >
        <h2 id="comparison-title">See what each level adds.</h2>
        <div
          className="comparison-scroll"
          role="region"
          aria-label="Detailed proposed package comparison"
          tabIndex={0}
        >
          <table>
            <caption>
              Every level includes its lower-level benefits. Annual savings
              compare 12 monthly payments.
            </caption>
            <thead>
              <tr>
                <th scope="col">Proposed support</th>
                {PACKAGE_PROPOSALS.map((p) => (
                  <th scope="col" key={p.id}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PACKAGE_COMPARISON_ROWS.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  {PACKAGE_PROPOSALS.map((p) => (
                    <td
                      className={
                        p.comparison[row.key] === "Not included"
                          ? "is-excluded"
                          : undefined
                      }
                      key={p.id}
                    >
                      {p.comparison[row.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section
        className="proposal-rhythm"
        aria-label="Proposed delivery rhythm"
      >
        <h2>Delivery, family access and reviews.</h2>
        <div className="proposal-practical-grid">
          <section aria-labelledby="planned-delivery">
            <h3 id="planned-delivery">A planned weekly rhythm</h3>
            <p>
              The planned packages would deliver the upcoming week’s content on
              Sundays. This is not an active public delivery schedule.
              Foundation includes football-IQ lessons and quizzes, not drills.
            </p>
            <p>
              Position Development adds two position-specific drills each week,
              alongside the two movement sessions included in Fundamentals.
            </p>
          </section>
          <section aria-labelledby="planned-family">
            <h3 id="planned-family">One family account</h3>
            <p>
              One guardian account can manage multiple athletes. Packages are
              priced per athlete. Each subscribed Elite athlete would have two
              monthly drill corrections, not shared across siblings.
            </p>
          </section>
          <section aria-labelledby="planned-reviews">
            <h3 id="planned-reviews">Personalized drill corrections</h3>
            <p>
              Elite proposes two athlete-chosen drill corrections per month,
              with up to three minutes of footage per submission. Feedback
              identifies corrections, how to improve and next-step practice
              recommendations. The target is three business days, not
              guaranteed. Review capacity and retention are still being
              validated.
            </p>
          </section>
        </div>
        <p className="proposal-current-access">
          Existing invited accounts keep their current access and review limits.{" "}
          <a href="#contact">Questions about current access?</a>
        </p>
      </section>
      <section
        className="proposal-full-details"
        aria-label="Full proposed package details"
      >
        {PACKAGE_PROPOSALS.map((p) => (
          <details className="proposal-details" key={p.id}>
            <summary>What’s included in {p.name}</summary>
            <div
              className="proposal-details-content"
              role="group"
              aria-label={`${p.name} complete proposal`}
            >
              <p className="proposal-focus">{p.focus}</p>
              <p className="proposal-cadence">{p.cadence}</p>
              <p className="proposal-includes">{p.includes}</p>
              <div className="check-lines">
                {p.items.map((text) => (
                  <CheckLine key={text}>{text}</CheckLine>
                ))}
              </div>
              {"note" in p && <p className="proposal-note">{p.note}</p>}
            </div>
          </details>
        ))}
      </section>
      <section
        id="package-interest"
        className="package-interest"
        aria-labelledby="interest-title"
      >
        <div>
          <Tag>
            {pending
              ? "INTEREST"
              : interestEndpoint
                ? "ADULT INTEREST"
                : "FOR PARENTS, GUARDIANS & ADULTS"}
          </Tag>
          <h2 id="interest-title" tabIndex={-1}>
            Interested? Tell us what fits.
          </h2>
          {selectionNotice && (
            <p role="status" className="interest-selection">
              {selectionNotice}
            </p>
          )}
          <p role={pending ? "status" : undefined}>
            {pending
              ? "Loading interest form…"
              : interestEndpoint
                ? "Leave your adult email and package interest. No account needed."
                : "Choose a proposal or send your feedback. This opens your email app; write and send your message there."}
          </p>
          <p>
            {pending || interestEndpoint
              ? "Interest only—not enrollment, payment or a reservation. Please leave out children’s information."
              : "Interest only—not enrollment, payment or a reservation. No launch date is promised. Please leave out child names, birth dates, videos and health details."}
          </p>
        </div>
        {!pending && interestEndpoint && (
          <InterestForm
            endpoint={interestEndpoint}
            packageChoice={interest}
            onPackageChange={changePackage}
            onStateChange={(next) => {
              setSubmissionState(next);
              if (next !== "idle") setSelectionNotice("");
            }}
          />
        )}
        {!pending && (
          <details
            className="interest-email-fallback"
            open={interestEndpoint ? undefined : true}
          >
            <summary>
              {interestEndpoint
                ? "Need another way? Email us directly"
                : "Email your interest"}
            </summary>
            <div className="interest-actions">
              <label htmlFor="interest-package">
                Package you’re interested in
                <select
                  id="interest-package"
                  value={interest}
                  disabled={submissionState !== "idle"}
                  onChange={(e) => {
                    changePackage(e.target.value as InterestPackage);
                  }}
                >
                  <option value="undecided">
                    Not sure yet / general feedback
                  </option>
                  {PACKAGE_PROPOSALS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <a className="button" href={packageInterestLink(interest)}>
                <Mail size={18} />
                Email package interest
              </a>
              <p className="interest-address">{CONTACT_EMAIL}</p>
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(CONTACT_EMAIL);
                    setCopy(
                      "Email address copied. Paste it into your email app.",
                    );
                  } catch {
                    setCopy(
                      "Copy is unavailable. Select the address above and paste it into your email app.",
                    );
                  }
                }}
              >
                <Copy size={16} />
                Copy email address
              </button>
              {copy && <p role="status">{copy}</p>}
              <p className="interest-fallback">
                No email app opening? Copy the address and email us directly.
                The
                {interestEndpoint
                  ? "email fallback does not submit the form; write and send your message in your email app."
                  : "website does not submit, store or add you to a mailing list."}
              </p>
            </div>
          </details>
        )}
      </section>
      <div className="centered">
        <a className="button secondary" href="#demo">
          Optional fictional preview <ArrowRight size={18} />
        </a>
      </div>
    </main>
  );
}
