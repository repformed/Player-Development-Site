import { must } from "./pages-auto-scope.mjs";
export const hostedFiles = [
  "search-metadata.spec.ts",
  "deletion-request-help.spec.ts",
  "service-policies.spec.ts",
  "public-home-focus.spec.ts",
  "public-usability.spec.ts",
];
export function reportCases(report) {
  const cases = [];
  function walk(s, titles = []) {
    const parents =
      s.title && s.title !== s.file ? [...titles, s.title] : titles;
    for (const spec of s.specs || [])
      for (const t of spec.tests || []) {
        const file = (spec.file || s.file)
          .replaceAll("\\", "/")
          .replace(/^tests\//, "");
        cases.push({
          key: JSON.stringify([t.projectName, file, ...parents, spec.title]),
          file,
          test: t,
        });
      }
    for (const child of s.suites || []) walk(child, parents);
  }
  for (const s of report.suites || []) walk(s);
  must(
    new Set(cases.map((c) => c.key)).size === cases.length,
    "Duplicate release test identity",
  );
  return cases;
}
export function completeCaseEvidence(
  report,
  baseline,
  mode,
  expectedHosted = null,
) {
  const cases = reportCases(report),
    keys = cases.map((c) => c.key).sort();
  must(
    cases.length > 0 &&
      !report.errors?.length &&
      !report.stats.unexpected &&
      !report.stats.skipped &&
      !report.stats.flaky,
    "Complete first-attempt report required",
  );
  must(
    cases.every(
      ({ test: t }) =>
        t.expectedStatus === "passed" &&
        t.results.length === 1 &&
        t.results[0].status === "passed" &&
        t.results[0].retry === 0,
    ),
    "No failed, skipped, expected-failing or retried release case",
  );
  const required = baseline[mode];
  must(
    Array.isArray(required) &&
      required.length > 0 &&
      required.every((k) => keys.includes(k)),
    "Mandatory release test identity missing",
  );
  if (expectedHosted)
    must(
      JSON.stringify(keys) === JSON.stringify([...expectedHosted].sort()),
      "Hosted collection differs from tested source public cases",
    );
  return {
    keys,
    cases: cases.length,
    hostedKeys: cases
      .filter(
        (c) =>
          hostedFiles.includes(c.file) || c.file.startsWith("public-features/"),
      )
      .map((c) => c.key)
      .sort(),
  };
}
