import { expect, it } from "vitest";
import {
  packageInterestLink,
  PACKAGE_PROPOSALS,
  PACKAGE_COMPARISON_ROWS,
} from "./packageProposals";

it("excludes undefined group services while preserving inherited training and Elite review terms", () => {
  expect(JSON.stringify(PACKAGE_PROPOSALS)).not.toMatch(/group|film.study/i);
  expect(PACKAGE_COMPARISON_ROWS.map((row) => row.key)).toEqual([
    "iq",
    "movement",
    "positionDrills",
    "position",
    "reviews",
  ]);
  const position = PACKAGE_PROPOSALS[2],
    elite = PACKAGE_PROPOSALS[3];
  for (const offer of [position, elite]) {
    expect(offer.comparison.iq).toBe("2 videos + 2 quizzes / week");
    expect(offer.comparison.movement).toBe("2 movement sessions / week");
    expect(offer.comparison.positionDrills).toBe("2 additional drills / week");
    expect(offer.comparison.position).toBe("One selected position");
  }
  expect(elite.comparison.reviews).toBe("2 corrections / athlete / month");
  expect(elite.items).toContain(
    "Up to three minutes of footage per submission",
  );
  expect(elite.note).toContain("three business days, not guaranteed");
});

it("unknown package selections cannot inject recipients or email headers", () => {
  for (const value of [
    "",
    "Elite\r\nBcc: other@example.test",
    "?bcc=other@example.test",
    "mailto:other@example.test",
  ]) {
    const link = new URL(packageInterestLink(value));
    expect(link.pathname).toBe("Repformed@gmail.com");
    expect([...link.searchParams.keys()].sort()).toEqual(["body", "subject"]);
    expect(link.searchParams.get("body")).toContain(
      "Interested package: Not sure yet",
    );
    expect(link.searchParams.get("body")).not.toContain("other@example.test");
  }
});

it("the approved annual savings equal twelve monthly payments minus the annual price", () => {
  expect(
    PACKAGE_PROPOSALS.map((p) => [p.monthly, p.annual, p.annualSavings]),
  ).toEqual([
    ["9.99", "99", "20.88"],
    ["19.99", "199", "40.88"],
    ["39.99", "399", "80.88"],
    ["69.99", "699", "140.88"],
  ]);
  for (const p of PACKAGE_PROPOSALS)
    expect((Number(p.monthly) * 12 - Number(p.annual)).toFixed(2)).toBe(
      p.annualSavings,
    );
});

it("explains each added benefit plainly without changing the proposed allowance or inheritance", () => {
  const [foundation, fundamentals, position, elite] = PACKAGE_PROPOSALS;
  for (const phrase of ["rules", "positions", "terminology", "read plays", "each player’s job"])
    expect(foundation.benefit).toContain(phrase);
  expect(foundation.items[0]).toBe("Two age-appropriate football-IQ videos each week, with a quiz for each lesson");
  expect(foundation.comparison.movement).toBe("No drills");
  expect(fundamentals.benefit).toContain("two guided movement sessions each week");
  expect(position.benefit).toContain("two drills a week for one selected position");
  expect(elite.benefit).toContain("two athlete-chosen drill corrections per month");
  expect(elite.benefit).toContain("coach feedback on what to adjust next");
  expect(fundamentals.includes).toBe("Everything proposed in Foundation, plus");
  expect(position.includes).toBe("Everything proposed in Fundamentals, plus");
  expect(elite.includes).toBe("Everything proposed in Position Development, plus");
});
