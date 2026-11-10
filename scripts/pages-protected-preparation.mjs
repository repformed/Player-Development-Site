// Read-only/offline preparation; deliberately no provider or publication port.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import process from "node:process";
import console from "node:console";
import { protectedScope } from "./pages-protected-scope.mjs";
import {
  publicBuildInputs,
  inspectPublicArtifact,
} from "./pages-public-artifact.mjs";
import { completeCaseEvidence } from "./pages-public-cases.mjs";
const must = (ok, message) => {
  if (!ok) throw Error(message);
};
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
export function unchangedRuntimeOutput(baseline, candidate) {
  const names = Object.keys(baseline.manifest)
    .filter((n) => n !== "sw.js")
    .sort();
  must(
    JSON.stringify(names) ===
      JSON.stringify(
        Object.keys(candidate.manifest)
          .filter((n) => n !== "sw.js")
          .sort(),
      ),
    "Dependency-only runtime output topology changed",
  );
  for (const name of names)
    must(
      JSON.stringify(baseline.manifest[name]) ===
        JSON.stringify(candidate.manifest[name]),
      "Dependency-only runtime bytes changed: " + name,
    );
  return {
    unchangedFiles: names.length,
    workerPolicy:
      "Both workers separately validated against exact unchanged source template and ordered precache; no raw-byte equivalence assumed",
  };
}
export function boundContainedProof(proof, report, scope, baselineCases, mode) {
  const cases = completeCaseEvidence(report, baselineCases, mode);
  must(
    proof.sourceTree === scope.sourceTree &&
      /^[a-f0-9]{40}$/.test(proof.sourceSha || "") &&
      proof.suite === mode &&
      proof.cases === cases.cases &&
      proof.passed === cases.cases &&
      proof.failed === 0 &&
      proof.skipped === 0 &&
      proof.retries === 0 &&
      proof.forwarded_upstream === 0 &&
      proof.guard === "deny-only loopback proxy",
    "Exact-tree contained first-attempt evidence required",
  );
  return {
    testSourceSha: proof.sourceSha,
    sourceTree: proof.sourceTree,
    cases: cases.cases,
    blocked: proof.blocked,
    forwardedUpstream: 0,
    hostedKeys: cases.hostedKeys,
  };
}
export function remainingGates(kind) {
  const common = [
    "Independent exact integrated-tree review",
    "Reviewed trusted-controller bootstrap; no self-authorization",
    "Fresh repository/main/source/review reconciliation",
  ];
  if (kind === "reader-documentation")
    return [
      ...common,
      "Required CI on actual integrated source",
      "Documentation-aware main routing before merge; no provider deployment",
    ];
  if (kind === "development-dependencies")
    return [
      ...common,
      "Credential-separated clean install, audits and required tests",
      "Reviewed unchanged-output candidate evidence",
      "Protected dependency workflow activation and scope discriminator",
      "Revalidate exact review with dependency-free trusted code before any credential-bearing operation",
      "Hosted byte/header/case acceptance and immutable-artifact promotion",
      "Fresh provider baseline/serialization checks and known-outcome handling",
      "Explicit rollback authorization and original reviewed artifact; never blind rollback after collision",
    ];
  return [
    "Not eligible for this preparation route",
    "Separate reviewed source/schema/provider release design",
    "Applicable action-time sensitive approval; no automatic activation",
    "Existing denied authentication implementation remains excluded",
  ];
}
export async function prepareDependencyArtifact(
  source,
  scope,
  baselineBuild,
  baselineSite,
  evidenceDir,
) {
  must(
    scope.kind === "development-dependencies",
    "Dependency preparation only; documentation has no deployment artifact",
  );
  must(
    baselineBuild.sourceSha === scope.baselineSha &&
      baselineBuild.sourceTree === scope.baselineTree,
    "Exact accepted baseline/source binding required",
  );
  const baseline = await inspectPublicArtifact(
    baselineSite,
    baselineBuild.inputInventory,
  );
  must(
    baseline.manifestDigest === baselineBuild.manifestDigest,
    "Baseline artifact digest differs",
  );
  // Recompute scope and source inventory after tests; never trust a supplied eligibility flag.
  const now = protectedScope(source, scope.baselineSha, scope.sourceSha);
  must(
    JSON.stringify(now) === JSON.stringify(scope),
    "Scope changed during preparation",
  );
  execFileSync("git", ["diff", "--exit-code", "HEAD"], {
    cwd: source,
    stdio: "pipe",
  });
  const candidate = await inspectPublicArtifact(
    resolve(source, "dist"),
    await publicBuildInputs(source),
  );
  const comparison = unchangedRuntimeOutput(baseline, candidate);
  const baselineCases = await json(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../.github/pages-release/public-baseline-cases.json",
    ),
  );
  const suites = {};
  for (const mode of ["e2e", "app"]) {
    const proof = await json(resolve(evidenceDir, "fixture-" + mode + ".json"));
    suites[mode] = boundContainedProof(
      proof,
      await json(resolve(evidenceDir, "fixture-" + mode + ".json.tests.json")),
      scope,
      baselineCases,
      mode,
    );
    const testedTree = execFileSync(
      "git",
      ["rev-parse", proof.sourceSha + "^{tree}"],
      { cwd: source, encoding: "utf8" },
    ).trim();
    must(testedTree === scope.sourceTree, "Test checkout tree differs");
  }
  return {
    version: 1,
    status: "prepared-not-authorized-for-publication",
    releaseKind: scope.kind,
    scope,
    candidate,
    comparison,
    suites,
    requiredGates: remainingGates(scope.kind),
    grantsDeploymentAuthority: false,
  };
}
async function main() {
  const [
    mode,
    source,
    baseline,
    selected,
    output,
    baselineBuildPath,
    baselineSite,
    evidenceDir,
  ] = process.argv.slice(2);
  must(
    ["scope", "artifact"].includes(mode) &&
      source &&
      baseline &&
      selected &&
      output,
    "Explicit preparation mode/source/baseline/head/output required",
  );
  const scope = protectedScope(resolve(source), baseline, selected);
  const result =
    mode === "scope"
      ? {
          ...scope,
          status: "scope-only-not-release-approval",
          requiredGates: remainingGates(scope.kind),
        }
      : await prepareDependencyArtifact(
          resolve(source),
          scope,
          await json(baselineBuildPath),
          resolve(baselineSite),
          resolve(evidenceDir),
        );
  const destination = resolve(output);
  must(
    destination !== resolve(source) &&
      !destination.startsWith(resolve(source) + "/"),
    "Evidence must be outside source checkout",
  );
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      kind: scope.kind,
      sourceSha: scope.sourceSha,
      sourceTree: scope.sourceTree,
      status: result.status,
      grantsDeploymentAuthority: false,
    }),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
