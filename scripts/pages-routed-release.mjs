// Only pinned controller code executes with repository/provider credentials.
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import process from "node:process";
import console from "node:console";
import { root, must } from "./pages-auto-scope.mjs";
import {
  autoGuard,
  boundBuild,
  automaticRead,
  automaticDeploy,
  providerPreflight,
  knownNoWrite,
} from "./pages-auto-release.mjs";
import {
  graphReader,
  publicReviewEvidence,
  sameSourceAuthorization,
} from "./pages-public-evidence.mjs";
import {
  routedScope,
  routeAuthorization,
  revalidateAuthorization,
  validateUncredentialedRoute,
  changedPaths,
  docsContinuity,
} from "./pages-release-routing.mjs";
import {
  ordinaryCI,
  baselineIdentity,
  downloadVerifiedArtifact,
  extractVerifiedZip,
  baselineFiles,
} from "./pages-release-baseline.mjs";
import {
  publicBuildInputs,
  inspectPublicArtifact,
} from "./pages-public-artifact.mjs";
import { completeCaseEvidence } from "./pages-public-cases.mjs";
import { unchangedRuntimeOutput } from "./pages-protected-preparation.mjs";
import { publicPath, treeInventory } from "./pages-public-inputs.mjs";
import { readerDocuments } from "./pages-protected-scope.mjs";
const repo = "/repos/repformed/Player-Development-Site";
const project =
  "/accounts/7d7af2c3863a2d09d830f52bd459d5ba/pages/projects/repformed";
const hash = (x) => createHash("sha256").update(x).digest("hex");
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const save = async (path, value) => {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
};
const gh =
  (env, ports = { read: automaticRead }) =>
  (path) =>
    ports.read(path, env.GH_TOKEN, "https://api.github.com");
const cf =
  (env, ports = { read: automaticRead }) =>
  (path) =>
    ports.read(path, env.CLOUDFLARE_API_TOKEN);
const git = (source, args) =>
  execFileSync("git", args, { cwd: source, encoding: "utf8" }).trim();
export async function currentMain(env, read) {
  if (
    (await read(repo + "/git/ref/heads/main")).object?.sha !== env.GITHUB_SHA
  ) {
    const error = Error("Selected source superseded without write");
    error.code = "PUBLIC_SUPERSEDED";
    throw error;
  }
}
export function bindRoutedBuild(build, route, context, env) {
  boundBuild(build, env);
  must(
    [
      "public-feature",
      "development-dependencies",
      "controller-bootstrap",
    ].includes(route.kind) &&
      build.releaseKind === route.kind &&
      route.sourceSha === env.GITHUB_SHA &&
      route.controlSha === env.PUBLIC_CONTROL_SHA &&
      route.sourceTree === build.sourceTree &&
      route.runId === env.GITHUB_RUN_ID &&
      route.workflowSha === env.GITHUB_SHA &&
      route.attempt === 1 &&
      JSON.stringify(build.authorization) ===
        JSON.stringify(route.authorization) &&
      build.routeDigest === hash(JSON.stringify(route)) &&
      build.baselineDigest === hash(JSON.stringify(context)),
    "Routed build/source/review/baseline binding differs",
  );
  must(
    JSON.stringify(build.baselineIdentity) === JSON.stringify(context.identity),
    "Build baseline identity differs from authenticated context",
  );
}
export function compareTestedArtifact(tested, site, route, context, env) {
  bindRoutedBuild(tested, route, context, env);
  must(
    JSON.stringify(tested.manifest) === JSON.stringify(site.manifest) &&
      tested.manifestDigest === site.manifestDigest &&
      tested.workerCacheVersion === site.workerCacheVersion,
    "Fresh compiler output differs from the complete tested artifact",
  );
}
export function verifyCopiedPublicInputs(source, build) {
  const expected = [];
  for (const [path, row] of treeInventory(source, build.sourceSha)) {
    if (!path.startsWith("public/")) continue;
    must(
      row.mode === "100644" && row.type === "blob",
      "Copied source must be regular Git blobs",
    );
    const bytes = execFileSync("git", ["show", build.sourceSha + ":" + path], {
      cwd: source,
      maxBuffer: 100 * 1024 * 1024,
    });
    expected.push([path.slice(7), bytes.length, hash(bytes), row.sha]);
  }
  const actual = Object.entries(build.inputInventory?.publicFiles || {}).map(
    ([name, row]) => [name, row.bytes, row.sha256, row.gitBlobSha],
  );
  must(
    JSON.stringify(expected.sort((a, b) => a[0].localeCompare(b[0], "en"))) ===
      JSON.stringify(actual.sort((a, b) => a[0].localeCompare(b[0], "en"))),
    "Copied artifact inventory differs from actual reviewed Git source",
  );
}
export function containedEvidence(proof, report, route, baseline, mode, env) {
  const result = completeCaseEvidence(report, baseline, mode);
  must(
    proof.guard === "deny-only loopback proxy" &&
      proof.forwarded_upstream === 0 &&
      proof.suite === mode &&
      proof.sourceSha === route.sourceSha &&
      proof.sourceTree === route.sourceTree &&
      proof.controlSha === route.controlSha &&
      proof.workflowSha === env.GITHUB_SHA &&
      proof.runId === env.GITHUB_RUN_ID &&
      proof.attempt === 1 &&
      proof.cases === result.cases &&
      proof.passed === result.cases &&
      proof.failed === 0 &&
      proof.skipped === 0 &&
      proof.retries === 0 &&
      JSON.stringify(proof.caseKeys) === JSON.stringify(result.keys),
    "Contained report/source/controller/run proof mismatch",
  );
  return result;
}
export function noWriteDisposition(command, contextPath) {
  return {
    path:
      command === "route"
        ? "route/route.json"
        : command === "baseline"
          ? contextPath
          : "proof/no-write-" + command + ".json",
    outputs: command === "route" ? "kind=superseded\n" : "ready=false\n",
  };
}
export async function validateDependencyComparison(build, baselineDirectory) {
  const accepted = await baselineFiles(
    build.baselineIdentity,
    baselineDirectory,
  );
  const before = await inspectPublicArtifact(
    accepted.site,
    accepted.build.inputInventory,
  );
  must(
    before.manifestDigest === accepted.build.manifestDigest,
    "Accepted producer artifact differs",
  );
  return unchangedRuntimeOutput(before, build);
}
async function revalidate(
  route,
  context,
  env,
  source,
  ports = { read: automaticRead },
) {
  const read = gh(env, ports),
    graph = graphReader(env.GH_TOKEN, ports.fetch || globalThis.fetch);
  await currentMain(env, read);
  await revalidateAuthorization(source, route, read, graph);
  for (const step of context.documentChain || []) {
    if (step.coveredPublicAncestor) continue; // Current exact full-tree review/narrow proof already binds these immutable public bytes.
    const latest = await publicReviewEvidence(step.sourceSha, read, graph);
    must(latest, "Intervening documentation review unavailable");
    sameSourceAuthorization(step.authorization, latest);
    await ordinaryCI(step.sourceSha, read);
  }
  await currentMain(env, read);
}
async function comparison(
  build,
  route,
  context,
  env,
  baselineDirectory,
  ports = { read: automaticRead },
) {
  if (route.kind !== "development-dependencies") return;
  must(
    JSON.stringify(build.baselineIdentity) === JSON.stringify(context.identity),
    "Dependency baseline authority differs",
  );
  await validateDependencyComparison(build, baselineDirectory);
  const fresh = await baselineIdentity(
    await cf(env, ports)(project),
    gh(env, ports),
    true,
    env.PUBLIC_CONTROL_SHA,
  );
  must(
    JSON.stringify(fresh) === JSON.stringify(context.identity),
    "Dependency producer/deployment/artifact changed",
  );
}
export async function baselineChain(source, route, identity, read, graph) {
  const cumulative = changedPaths(source, identity.sourceSha, route.sourceSha);
  if (route.kind !== "controller-bootstrap")
    must(
      cumulative.every(
        (x) =>
          readerDocuments.has(x.path) ||
          (route.kind === "development-dependencies"
            ? ["package.json", "package-lock.json"].includes(x.path)
            : publicPath(x.path)),
      ),
      "Unpublished protected/mixed changes cannot inherit deployment authority",
    );
  else
    must(
      identity.sourceSha === route.baselineSha,
      "Bootstrap must start at independently reconciled production",
    );
  return docsContinuity(
    source,
    identity.sourceSha,
    route.baselineSha,
    read,
    graph,
    (sha) => ordinaryCI(sha, read),
    { allowPublic: route.kind === "public-feature" },
  );
}
export async function routedProviderOperation(
  command,
  source,
  route,
  context,
  build,
  site,
  baselineDirectory,
  env,
  proofs = {},
  ports = { read: automaticRead, upload: execFileSync },
) {
  must(
    command === "preview" || command === "promote",
    "Unknown routed provider operation",
  );
  bindRoutedBuild(build, route, context, env);
  verifyCopiedPublicInputs(source, build);
  await revalidate(route, context, env, source, ports);
  const current = await cf(env, ports)(project);
  if (current.canonical_deployment?.id !== context.identity.deploymentId) {
    const error = Error("Production changed since accepted baseline; no write");
    error.code = "PUBLIC_BASELINE_CHANGED";
    throw error;
  }
  const liveIdentity = await baselineIdentity(
    current,
    gh(env, ports),
    route.kind === "development-dependencies",
    env.PUBLIC_CONTROL_SHA,
  );
  must(
    JSON.stringify(liveIdentity) === JSON.stringify(context.identity),
    "Live production identity differs from captured authority",
  );
  const liveChain = await baselineChain(
    source,
    route,
    liveIdentity,
    gh(env, ports),
    graphReader(env.GH_TOKEN, ports.fetch || globalThis.fetch),
  );
  must(
    JSON.stringify(liveChain) === JSON.stringify(context.documentChain),
    "Actual production-to-main chain differs from captured proof",
  );
  await revalidate(route, { documentChain: liveChain }, env, source, ports);
  await comparison(build, route, context, env, baselineDirectory, ports);
  const path =
    proofs.output ||
    resolve(
      "proof/" + (command === "preview" ? "preview" : "production") + ".json",
    );
  return automaticDeploy(
    command,
    site,
    build,
    path,
    env,
    proofs.preview || null,
    proofs.hosted || null,
    proofs.fixture || null,
    ports,
  );
}
async function main() {
  const [command, sourceArg, routeArg, contextArg, a, b, c] =
      process.argv.slice(2),
    env = process.env;
  autoGuard(env);
  must(
    git(root, ["rev-parse", "HEAD"]) === env.PUBLIC_CONTROL_SHA,
    "Pinned trusted routed controller required",
  );
  const source = resolve(sourceArg);
  if (command === "route") {
    const read = gh(env);
    await currentMain(env, read);
    const result = await routeAuthorization(
      source,
      await routedScope(source, env.PUBLIC_CONTROL_SHA, env.GITHUB_SHA),
      read,
      graphReader(env.GH_TOKEN),
    );
    await currentMain(env, read);
    const route = {
      ...result,
      runId: env.GITHUB_RUN_ID,
      workflowSha: env.GITHUB_SHA,
      attempt: 1,
    };
    await save(routeArg, route);
    if (env.GITHUB_OUTPUT)
      await appendFile(env.GITHUB_OUTPUT, "kind=" + route.kind + "\n");
    console.log(
      JSON.stringify({
        phase: "route",
        kind: route.kind,
        sourceSha: route.sourceSha,
        sourceTree: route.sourceTree,
      }),
    );
    return;
  }
  const route = await json(routeArg);
  must(
    route.sourceSha === env.GITHUB_SHA &&
      route.controlSha === env.PUBLIC_CONTROL_SHA &&
      route.runId === env.GITHUB_RUN_ID &&
      route.workflowSha === env.GITHUB_SHA &&
      route.attempt === 1,
    "Same-run trusted route required",
  );
  if (command === "docs") {
    must(route.kind === "reader-documentation", "Documentation route only");
    await ordinaryCI(env.GITHUB_SHA, gh(env), { wait: true });
    await revalidate(route, {}, env, source);
    await save(contextArg, {
      phase: "documentation-only",
      state: "verified-no-deployment",
      sourceSha: route.sourceSha,
      sourceTree: route.sourceTree,
      runId: env.GITHUB_RUN_ID,
      authorization: route.authorization,
    });
    return;
  }
  must(
    route.kind !== "reader-documentation",
    "Documentation has no provider or candidate route",
  );
  if (command === "baseline") {
    await revalidate(route, {}, env, source);
    const ports = { read: automaticRead };
    const deploymentId = await providerPreflight(route, env, ports);
    const identity = await baselineIdentity(
      await cf(env)(project),
      gh(env),
      route.kind === "development-dependencies",
      env.PUBLIC_CONTROL_SHA,
    );
    if (identity.deploymentId !== deploymentId) {
      const error = Error("Baseline changed during read-only capture");
      error.code = "PUBLIC_BASELINE_CHANGED";
      throw error;
    }
    if (identity.sourceSha === route.sourceSha) {
      await save(contextArg, {
        state: "confirmed-no-write",
        reason: "Exact source already production",
        runId: env.GITHUB_RUN_ID,
      });
      if (env.GITHUB_OUTPUT)
        await appendFile(env.GITHUB_OUTPUT, "ready=false\n");
      return;
    }
    const chain = await baselineChain(
      source,
      route,
      identity,
      gh(env),
      graphReader(env.GH_TOKEN),
    );
    await revalidate(route, { documentChain: chain }, env, source);
    await save(contextArg, {
      phase: "accepted-baseline",
      sourceSha: route.sourceSha,
      controlSha: route.controlSha,
      runId: env.GITHUB_RUN_ID,
      attempt: 1,
      identity,
      documentChain: chain,
    });
    if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, "ready=true\n");
    return;
  }
  const context = await json(contextArg);
  must(
    context.phase === "accepted-baseline" &&
      context.sourceSha === route.sourceSha &&
      context.controlSha === route.controlSha &&
      context.runId === env.GITHUB_RUN_ID &&
      context.attempt === 1,
    "Same-run accepted production context required",
  );
  if (command === "download-baseline") {
    if (route.kind !== "development-dependencies") return;
    for (const key of ["candidate", "production"]) {
      const metadata = context.identity[key],
        destination = resolve(a, key);
      const fresh = await gh(env)(repo + "/actions/artifacts/" + metadata.id);
      must(
        !fresh.expired &&
          fresh.name === metadata.name &&
          fresh.digest === "sha256:" + metadata.sha256 &&
          fresh.size_in_bytes === metadata.bytes &&
          fresh.workflow_run?.id === metadata.runId &&
          fresh.workflow_run?.head_sha === metadata.sourceSha,
        "Baseline download metadata changed",
      );
      const zip = destination + ".zip";
      await downloadVerifiedArtifact(metadata, env.GH_TOKEN, zip);
      extractVerifiedZip(zip, destination);
    }
    await baselineFiles(context.identity, resolve(a));
    return;
  }
  if (command === "manifest" || command === "tested") {
    await validateUncredentialedRoute(source, route, {
      syntaxTools: resolve(root, ".github/pages-release/analysis-tools"),
    });
    execFileSync(
      "git",
      [
        "diff",
        "--exit-code",
        "HEAD",
        "--",
        "src",
        "public",
        "build",
        "package.json",
        "package-lock.json",
        "index.html",
        "vite.config.ts",
        "tsconfig.json",
        "tsconfig.app.json",
        "scripts",
        ".github",
      ],
      { cwd: source, stdio: "pipe" },
    );
    const site = await inspectPublicArtifact(
      resolve(source, "dist"),
      await publicBuildInputs(source),
    );
    const baseline = await json(
      resolve(root, ".github/pages-release/public-baseline-cases.json"),
    );
    const e2e = containedEvidence(
      await json(resolve(source, "artifacts/fixture-e2e.json")),
      await json(resolve(source, "artifacts/fixture-e2e.json.tests.json")),
      route,
      baseline,
      "e2e",
      env,
    );
    containedEvidence(
      await json(resolve(source, "artifacts/fixture-app.json")),
      await json(resolve(source, "artifacts/fixture-app.json.tests.json")),
      route,
      baseline,
      "app",
      env,
    );
    if (command === "manifest") {
      const tested = await json(resolve(source, "artifacts/tested-build.json"));
      compareTestedArtifact(tested, site, route, context, env);
    }
    await save(a, {
      ...site,
      sourceSha: route.sourceSha,
      sourceTree: route.sourceTree,
      controlSha: route.controlSha,
      authorization: route.authorization,
      releaseKind: route.kind,
      routeDigest: hash(JSON.stringify(route)),
      baselineDigest: hash(JSON.stringify(context)),
      baselineIdentity: context.identity,
      runId: env.GITHUB_RUN_ID,
      attempt: 1,
      workflowSha: env.GITHUB_SHA,
      expectedHostedCases: e2e.hostedKeys,
    });
    return;
  }
  const build = await json(a);
  bindRoutedBuild(build, route, context, env);
  verifyCopiedPublicInputs(source, build);
  const site = resolve(b),
    baselineDirectory = resolve(c || "baseline");
  const inspected = await inspectPublicArtifact(site, build.inputInventory);
  must(
    inspected.manifestDigest === build.manifestDigest &&
      inspected.workerCacheVersion === build.workerCacheVersion,
    "Candidate bytes differ before credentials",
  );
  if (command === "prepare") {
    await validateUncredentialedRoute(source, route, {
      syntaxTools: resolve(root, ".github/pages-release/analysis-tools"),
    });
    if (route.kind === "development-dependencies")
      await validateDependencyComparison(build, baselineDirectory);
    return;
  }
  must(
    command === "preview" || command === "promote",
    "Unknown routed release operation",
  );
  await routedProviderOperation(
    command,
    source,
    route,
    context,
    build,
    site,
    baselineDirectory,
    env,
    command === "preview"
      ? {}
      : {
          preview: await json("proof/preview.json"),
          hosted: await json("proof/verified-preview.json"),
          fixture: await json("proof/fixture-hosted.json"),
        },
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(async (error) => {
    const command = process.argv[2],
      message = String(error.message);
    if (knownNoWrite(error)) {
      const disposition = noWriteDisposition(command, process.argv[5]);
      await save(disposition.path, {
        state: "confirmed-no-write",
        ...(command === "route" ? { kind: "superseded" } : {}),
        stage: command,
        reason: message,
        sourceSha: process.env.GITHUB_SHA,
        runId: process.env.GITHUB_RUN_ID,
      });
      if (process.env.GITHUB_OUTPUT)
        await appendFile(process.env.GITHUB_OUTPUT, disposition.outputs);
      console.log(message);
      return;
    }
    try {
      await save("proof/failure-" + command + ".json", {
        state: /HTTP (401|403)|not authorized/.test(message)
          ? "denied"
          : /uncertain|unconfirmed/.test(message)
            ? "uncertain"
            : "failed",
        stage: command,
        message,
        sourceSha: process.env.GITHUB_SHA,
        runId: process.env.GITHUB_RUN_ID,
      });
    } catch {
      /* Failed job remains the gate. */
    }
    console.error(message);
    process.exitCode = 1;
  });
