import { test } from "node:test";
import assert from "node:assert/strict";
import { reportCases, completeCaseEvidence } from "../pages-public-cases.mjs";
const report = () => ({
  errors: [],
  stats: { unexpected: 0, skipped: 0, flaky: 0 },
  suites: [
    {
      title: "public-home-focus.spec.ts",
      file: "public-home-focus.spec.ts",
      specs: [
        {
          title: "keyboard focus",
          file: "public-home-focus.spec.ts",
          tests: [
            {
              projectName: "desktop",
              expectedStatus: "passed",
              results: [{ status: "passed", retry: 0 }],
            },
          ],
        },
      ],
    },
  ],
});
test("mandatory identities remain required while new feature cases and counts are accepted", () => {
  const r = report(),
    baseline = { e2e: reportCases(r).map((c) => c.key) };
  r.suites.push({
    ...globalThis.structuredClone(r.suites[0]),
    file: "public-features/new.spec.ts",
    title: "public-features/new.spec.ts",
    specs: [
      {
        ...globalThis.structuredClone(r.suites[0].specs[0]),
        file: "public-features/new.spec.ts",
      },
    ],
  });
  const p = completeCaseEvidence(r, baseline, "e2e");
  assert.equal(p.cases, 2);
  assert.equal(p.hostedKeys.length, 2);
  assert.throws(
    () => completeCaseEvidence(r, { e2e: ["missing"] }, "e2e"),
    /Mandatory/,
  );
});
test("missing, duplicate, retried, skipped, expected-failing or conditionally hidden hosted tests block", () => {
  const r = report(),
    b = { hosted: reportCases(r).map((c) => c.key) };
  assert.throws(
    () => completeCaseEvidence(r, b, "hosted", [...b.hosted, "missing"]),
    /Hosted collection/,
  );
  for (const mode of ["duplicate", "retry", "skip", "expected"]) {
    const x = report();
    if (mode === "duplicate")
      x.suites.push(globalThis.structuredClone(x.suites[0]));
    if (mode === "retry") x.suites[0].specs[0].tests[0].results[0].retry = 1;
    if (mode === "skip") x.stats.skipped = 1;
    if (mode === "expected")
      x.suites[0].specs[0].tests[0].expectedStatus = "failed";
    assert.throws(() => completeCaseEvidence(x, b, "hosted"));
  }
});
