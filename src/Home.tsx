import { lazy, Suspense, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Pause,
  Play,
} from "lucide-react";
import { AthleteScene } from "./AthleteScene";
import { Reveal } from "./Experience";
import { PACKAGE_PROPOSALS } from "./packageProposals";
import { useMotion } from "./motion";

const BackToTop = lazy(() => import("./publicFeatures/BackToTop"));

const media = `${import.meta.env.BASE_URL}media/`;

export function Home() {
  const { enabled } = useMotion();
  const [videoPaused, setVideoPaused] = useState(false);
  return (
    <main className="home home-package-journey">
      <section className="hero">
        <AthleteScene paused={videoPaused} />
        <div className="hero-copy">
          <div className="sport-tag">
            <span /> FOOTBALL · PLAYER DEVELOPMENT
          </div>
          <h1 tabIndex={-1}>
            Know the game.
            <br />
            <span className="electric-text">Own your rep.</span>
          </h1>
          <p className="hero-description">
            Football IQ means understanding the rules, positions, terminology,
            reading plays and each player’s job. We’re building a path from
            learning the game to purposeful practice for families and adult
            athletes.
          </p>
          <p className="home-availability">
            Prelaunch. Membership enrollment is not open; explore the plans and
            express interest.
          </p>
          <div className="actions">
            <a className="button" href="#membership">
              Explore packages <ArrowUpRight size={20} />
            </a>
            <a className="text-button" href="?interest=1#membership">
              Express interest <ArrowRight size={18} />
            </a>
          </div>
          <div className="hero-how-link">
            <button
              className="text-button"
              onClick={() => {
                const target = document.getElementById("how-it-works");
                target?.focus({ preventScroll: true });
                target?.scrollIntoView({
                  behavior: enabled ? "smooth" : "auto",
                });
              }}
            >
              See how it works <ArrowDown size={17} />
            </button>
          </div>
        </div>
        {enabled && (
          <button
            className="hero-motion-control"
            type="button"
            aria-label={
              videoPaused ? "Resume background video" : "Pause background video"
            }
            title={
              videoPaused ? "Resume background video" : "Pause background video"
            }
            aria-pressed={videoPaused}
            onClick={() => setVideoPaused((value) => !value)}
          >
            {videoPaused ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
          </button>
        )}
        <div className="hero-edition" aria-hidden="true">
          <span>REPFORMED</span>
          <span>THE WORK STARTS HERE / 01</span>
        </div>
      </section>

      <div className="training-principles" aria-label="The training approach">
        {[
          "Understand the game.",
          "Practice with purpose.",
          "Keep the next step clear.",
        ].map((text, i) => (
          <div key={text}>
            <span>0{i + 1}</span>
            <p>{text}</p>
            <ArrowUpRight size={24} aria-hidden="true" />
          </div>
        ))}
      </div>

      <Reveal>
        <section
          className="page home-package-path"
          aria-labelledby="package-path-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">FOUR WAYS TO BUILD YOUR GAME</span>
              <h2 id="package-path-title">
                Learn first.
                <br />
                Build from there.
              </h2>
            </div>
            <p>
              Start with understanding the game. Add guided practice, position
              focus or closer coaching support as the athlete’s needs change.
            </p>
          </div>
          <ol className="home-package-ladder">
            {PACKAGE_PROPOSALS.map((p, i) => (
              <li key={p.id}>
                <span className="package-step-number" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3>{p.name}</h3>
                <p>{p.focus}</p>
                <strong>{p.cadence}</strong>
                {p.id === "position-development" && (
                  <small>
                    Adds two position drills alongside the two movement
                    sessions.
                  </small>
                )}
                {p.id === "elite-coaching" && (
                  <small>
                    Personalized feedback · up to three minutes of footage per
                    submission.
                  </small>
                )}
              </li>
            ))}
          </ol>
          <div className="home-package-path-footer">
            <span>Planned package features. Enrollment is not open.</span>
            <a className="text-button" href="#membership">
              Compare package plans <ArrowRight size={18} />
            </a>
          </div>
        </section>
      </Reveal>

      <Reveal className="athlete-paths-section">
        <section
          className="page athlete-paths"
          aria-labelledby="platform-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">BUILT AROUND THE PLAYER</span>
              <h2 id="platform-title">
                Know what
                <br />
                they’re learning.
              </h2>
            </div>
            <p>
              See what the athlete is learning, what to practice and where to
              help. Parent-managed and individual adult accounts use the same
              platform.
            </p>
          </div>
          <div className="path-grid">
            <article className="path-card path-family">
              <img
                src={`${media}family-football.jpg`}
                alt=""
                loading="lazy"
                width={1440}
                height={960}
              />
              <div className="path-shade" aria-hidden="true" />
              <span className="path-tag">SUPPORT AROUND THE ATHLETE</span>
              <div className="path-copy">
                <h3>
                  Keep the week
                  <br />
                  in view.
                </h3>
                <p>
                  Our parent-managed approach connects lessons, practice history
                  and athlete permissions, keeping support close to the routine.
                </p>
                <span className="path-detail">
                  <ShieldCheck size={16} /> Parent-managed experience
                </span>
              </div>
            </article>
            <article className="path-card path-solo">
              <img
                src={`${media}solo-football.jpg`}
                alt=""
                loading="lazy"
                width={1440}
                height={2160}
              />
              <div className="path-shade" aria-hidden="true" />
              <span className="path-tag">TRAINING THAT FITS THE PLAYER</span>
              <div className="path-copy">
                <h3>
                  Give the work
                  <br />a purpose.
                </h3>
                <p>
                  Fundamental and position plans pair clear practice steps and
                  coaching cues. Elite proposes personalized corrections on
                  athlete-chosen drills.
                </p>
                <span className="path-detail">
                  Progression designed around age, position and experience.
                </span>
              </div>
            </article>
          </div>
        </section>
      </Reveal>

      <Reveal className="practice-section">
        <section
          id="how-it-works"
          className="page how-section"
          tabIndex={-1}
          aria-labelledby="how-it-works-title"
        >
          <div className="practice-intro">
            <span className="eyebrow">YOUR WEEK, WITH PURPOSE</span>
            <h2 id="how-it-works-title">A week with a clear next step.</h2>
            <p>
              Understand the lesson. Follow the practice steps. Reflect on the
              work. The planned packages would deliver the upcoming week’s
              content on Sundays to give the week a clear starting point.
            </p>
            <a className="text-button" href="#membership">
              Find the right package <ArrowUpRight size={19} />
            </a>
          </div>
          <div className="practice-steps">
            {[
              {
                n: "01",
                title: "Learn the why",
                text: "The Foundation plan pairs two football-IQ videos and short quizzes each week. No drills.",
              },
              {
                n: "02",
                title: "Put it into practice",
                text: "Fundamentals proposes two movement sessions a week. Position Development adds two position-specific drills each week.",
              },
              {
                n: "03",
                title: "Bring the work back",
                text: "Keep a record of participation. Elite proposes two athlete-chosen drill corrections per month, with feedback and next-step practice recommendations.",
              },
            ].map((step) => (
              <article className="practice-step" key={step.n}>
                <span>{step.n}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section
          id="about-repformed"
          className="page home-about"
          aria-labelledby="about-repformed-title"
        >
          <img
            src={`${media}repformed-horizontal-football-field.webp`}
            alt="Repformed-branded football field illustration"
            loading="lazy"
            width={1672}
            height={941}
          />
          <div>
            <span className="eyebrow">ABOUT REPFORMED</span>
            <h2 id="about-repformed-title">
              Understanding first.
              <br />
              Purpose in every rep.
            </h2>
            <p>
              Repformed is building an online football learning and training
              platform for families and adult athletes. Our approach connects
              understanding the game with clear practice instructions and
              support around the player.
            </p>
            <ul>
              <li>
                <strong>Learn the why.</strong> Give each lesson a clear
                purpose.
              </li>
              <li>
                <strong>Make practice clear.</strong> Steps, equipment and
                coaching cues in one place.
              </li>
              <li>
                <strong>Keep support close.</strong> Parent-managed experiences
                and individual adult training.
              </li>
            </ul>
            <a className="text-button" href="#staff">
              Meet the staff <ArrowRight size={18} aria-hidden="true" />
            </a>
            <p className="home-sport-note">
              Football is our first focus. Additional sports will be announced
              as programs develop.
            </p>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="page" aria-labelledby="public-learning-title">
          <span className="eyebrow">
            READ. UNDERSTAND. ASK A BETTER QUESTION.
          </span>
          <h2 id="public-learning-title">Start learning before launch.</h2>
          <p>
            Free text lessons, diagrams and reading checks. Explore what online
            football learning can support, without an account or purchase.
          </p>
          <div className="actions">
            <a className="button" href="/online-football-training/">
              Online football training
            </a>
            <a className="text-button" href="/football-iq/">
              Football IQ lessons
            </a>
            <a className="text-button" href="/offensive-line-fundamentals/">
              Offensive-line fundamentals
            </a>
            <a className="text-button" href="/parent-guide/">
              A parent’s guide
            </a>
          </div>
        </section>
      </Reveal>
      <Reveal>
        <section className="home-finish" aria-labelledby="finish-title">
          <div className="page finish-inner">
            <div>
              <span className="eyebrow">YOUR NEXT STEP</span>
              <h2 id="finish-title">
                Find your
                <br />
                starting point.
              </h2>
            </div>
            <div className="finish-actions">
              <p>
                Tell us which package fits, or choose “Not sure yet.” No account
                or payment is needed to express interest.
              </p>
              <a className="button" href="?interest=1#membership">
                Express interest <ArrowUpRight size={20} />
              </a>
              <a className="text-button" href="#membership">
                Explore packages <ArrowRight size={17} />
              </a>
            </div>
          </div>
        </section>
      </Reveal>
      <Suspense fallback={null}>
        <BackToTop animate={enabled} />
      </Suspense>
    </main>
  );
}
import "./publicFeatures/contact-reflow.css";
