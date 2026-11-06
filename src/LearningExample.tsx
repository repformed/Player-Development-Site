import { useRef, useState } from "react";
import { Tag } from "./components";
import "./learningExample.css";
type Step = "closed" | "lesson" | "question" | "week";
/** Public illustration only: no backend, media, learner identity, score or persistence. */
export function LearningExample({ onPractice }: { onPractice: () => void }) {
  const [step, setStep] = useState<Step>("closed");
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const correct = checked && answer === "movement";
  function move(next: Step) {
    setStep(next);
    requestAnimationFrame(() => title.current?.focus());
  }
  function reset() {
    setAnswer("");
    setChecked(false);
    setStep("closed");
    requestAnimationFrame(() => opener.current?.focus());
  }
  return (
    <section className="learning-example" aria-label="Lesson and quiz example">
      <Tag>LESSON → QUIZ → WEEKLY PLAN</Tag>
      <h2>See how a learning week could work.</h2>
      <p>
        Text-only preview of the proposed learning journey. Membership videos
        and public enrollment are not available. This example creates no real
        score, learner progress, account or purchase.
      </p>
      {step === "closed" ? (
        <button ref={opener} className="button" onClick={() => move("lesson")}>
          Open learning example
        </button>
      ) : (
        <>
          <ol className="learning-example-steps" aria-label="Example journey">
            {[
              "Read the example",
              "Try a question",
              "See the weekly pattern",
            ].map((text, i) => (
              <li
                key={text}
                aria-current={
                  (["lesson", "question", "week"] as Step[])[i] === step
                    ? "step"
                    : undefined
                }
              >
                <span>0{i + 1}</span>
                {text}
              </li>
            ))}
          </ol>
          <div className="learning-example-panel">
            {step === "lesson" ? (
              <>
                <h3 ref={title} tabIndex={-1}>
                  Example lesson: read the diagram’s key.
                </h3>
                <p>
                  A football play diagram uses a key to explain its symbols. For
                  this example, the key says an arrow shows a player’s planned
                  movement. It does not tell you how fast to move or guarantee
                  the result of a play.
                </p>
                <p>
                  This is an illustrative reading example, pending coach
                  review—not a training instruction. No physical activity is
                  needed.
                </p>
                <button className="button" onClick={() => move("question")}>
                  Try the sample question
                </button>
              </>
            ) : step === "question" ? (
              <>
                <h3 ref={title} tabIndex={-1}>
                  Sample question
                </h3>
                <fieldset>
                  <legend>
                    In this example’s key, what does the arrow show?
                  </legend>
                  {[
                    ["movement", "A player’s planned movement"],
                    ["speed", "How fast the player must move"],
                    ["result", "A guaranteed result of the play"],
                  ].map(([value, label]) => (
                    <label className="learning-example-answer" key={value}>
                      <input
                        type="radio"
                        name="example-answer"
                        value={value}
                        checked={answer === value}
                        onChange={() => {
                          setAnswer(value);
                          setChecked(false);
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <div className="actions">
                  <button
                    className="button"
                    disabled={!answer}
                    onClick={() => setChecked(true)}
                  >
                    Check example answer
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setAnswer("");
                      setChecked(false);
                      move("lesson");
                    }}
                  >
                    Back to example lesson
                  </button>
                </div>
                {checked && (
                  <p role="status">
                    {correct
                      ? "That matches this example: the arrow shows planned movement."
                      : "The example’s key says planned movement. Read it again or choose another answer."}
                  </p>
                )}
                <button
                  className="button"
                  disabled={!correct}
                  onClick={() => move("week")}
                >
                  See the example week
                </button>
              </>
            ) : (
              <>
                <h3 ref={title} tabIndex={-1}>
                  An example weekly pattern
                </h3>
                <p>
                  The proposed Foundation plan pairs two football-IQ video
                  lessons with two lesson quizzes each week. Foundation has no
                  drills.
                </p>
                <ol>
                  <li>
                    Lesson one → its lesson quiz. You just tried a text-only
                    illustration.
                  </li>
                  <li>
                    Lesson two → its lesson quiz. This is a planned slot; no
                    second lesson is supplied here.
                  </li>
                  <li>
                    Drill-including plans add practice alongside the IQ
                    learning. You can explore the separate fictional practice
                    controls below.
                  </li>
                </ol>
                <p>
                  Weekly release is planned for Sunday at midnight,
                  America/Chicago. This example does not schedule or deliver
                  anything.
                </p>
                <div className="actions">
                  <button
                    className="button secondary"
                    onClick={() => move("question")}
                  >
                    Back to sample question
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      setAnswer("");
                      setChecked(false);
                      setStep("closed");
                      onPractice();
                    }}
                  >
                    Explore drill-plan practice example
                  </button>
                  <a className="button secondary" href="#membership">
                    Compare proposed plans
                  </a>
                </div>
              </>
            )}
          </div>
          <p className="learning-example-note">
            Closing, refreshing or leaving clears your example answers.
          </p>
          <button className="text-button" onClick={reset}>
            Close learning example
          </button>
        </>
      )}
    </section>
  );
}
