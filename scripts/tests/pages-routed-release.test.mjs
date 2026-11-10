import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  bindRoutedBuild,
  compareTestedArtifact,
  verifyCopiedPublicInputs,
  routedProviderOperation,
  containedEvidence,
  currentMain,
  noWriteDisposition,
} from "../pages-routed-release.mjs";
import { reportCases } from "../pages-public-cases.mjs";
import { knownNoWrite, priorWriterGuard } from "../pages-auto-release.mjs";
import { root } from "../pages-auto-scope.mjs";
import { fixture } from "./routed-fixture.mjs";
const hash = (x) => createHash("sha256").update(x).digest("hex");
const copy = (x) => globalThis.structuredClone(x);
const env = {
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF: "refs/heads/main",
  GITHUB_REPOSITORY: "repformed/Player-Development-Site",
  GITHUB_WORKFLOW: "Repformed automatic public release",
  GITHUB_SHA: "a".repeat(40),
  PUBLIC_AUTO_SOURCE_SHA: "a".repeat(40),
  PUBLIC_CONTROL_SHA: "b".repeat(40),
  GITHUB_RUN_ID: "99",
  GITHUB_RUN_ATTEMPT: "1",
};
const route = {
  kind: "development-dependencies",
  sourceSha: env.GITHUB_SHA,
  sourceTree: "c".repeat(40),
  controlSha: env.PUBLIC_CONTROL_SHA,
  workflowSha: env.GITHUB_SHA,
  runId: "99",
  attempt: 1,
  authorization: {
    kind: "owner-attested-independent-agent",
    sourceSha: env.GITHUB_SHA,
    sourceTree: "c".repeat(40),
  },
};
const context = {
  identity: {
    deploymentId: "12345678-1234-1234-1234-123456789012",
    sourceSha: "d".repeat(40),
  },
};
const build = {
  ...route,
  releaseKind: route.kind,
  baselineIdentity: context.identity,
  manifest: {},
  manifestDigest: hash("{}"),
  workflowSha: env.GITHUB_SHA,
  routeDigest: hash(JSON.stringify(route)),
  baselineDigest: hash(JSON.stringify(context)),
};
test("routed build binds category, immutable source/review and captured baseline", () => {
  assert.doesNotThrow(() => bindRoutedBuild(build, route, context, env));
  for (const mutation of [
    { releaseKind: "public-feature" },
    { authorization: { kind: "verified-bootstrap" } },
    { baselineIdentity: {} },
    { routeDigest: "forged" },
    { baselineDigest: "forged" },
  ])
    assert.throws(() =>
      bindRoutedBuild({ ...build, ...mutation }, route, context, env),
    );
  assert.throws(() =>
    bindRoutedBuild(
      build,
      { ...route, kind: "reader-documentation" },
      context,
      env,
    ),
  );
});
test("fresh compilation must match every tested byte including worker and cache version", () => {
  const tested = {
    ...build,
    manifest: { "index.html": "page", "sw.js": "worker" },
    workerCacheVersion: "cache",
  };
  tested.manifestDigest = hash(JSON.stringify(tested.manifest));
  const site = {
    manifest: tested.manifest,
    manifestDigest: tested.manifestDigest,
    workerCacheVersion: "cache",
  };
  assert.doesNotThrow(() =>
    compareTestedArtifact(tested, site, route, context, env),
  );
  for (const mutation of [
    { manifest: { ...site.manifest, "sw.js": "different" } },
    { manifest: { "index.html": "page" } },
    { manifest: { ...site.manifest, "extra.js": "extra" } },
    { manifestDigest: "different" },
    { workerCacheVersion: "different" },
  ])
    assert.throws(() =>
      compareTestedArtifact(
        tested,
        { ...site, ...mutation },
        route,
        context,
        env,
      ),
    );
});
test("provider composition rejects copied-input forgery before any authenticated or upload port", async () => {
  const f = await fixture();
  try {
    await f.put("public/example.txt", "Fictional public input\n");
    const sourceSha = f.commit();
    const bytes = Buffer.from("Fictional public input\n");
    const publicFiles = {
      "example.txt": {
        bytes: bytes.length,
        sha256: hash(bytes),
        gitBlobSha: f.git(["rev-parse", sourceSha + ":public/example.txt"]),
      },
    };
    assert.doesNotThrow(() =>
      verifyCopiedPublicInputs(f.dir, {
        sourceSha,
        inputInventory: { publicFiles },
      }),
    );
    let reads = 0,
      uploads = 0;
    const ports = {
      read: async () => {
        reads++;
        throw Error("Unexpected authenticated read");
      },
      upload: () => {
        uploads++;
        throw Error("Unexpected upload");
      },
    };
    const localEnv = {
      ...env,
      GITHUB_SHA: sourceSha,
      PUBLIC_AUTO_SOURCE_SHA: sourceSha,
    };
    const localRoute = { ...route, sourceSha, workflowSha: sourceSha };
    const localBuild = {
      ...build,
      sourceSha,
      workflowSha: sourceSha,
      routeDigest: hash(JSON.stringify(localRoute)),
      inputInventory: { publicFiles: {} },
    };
    await assert.rejects(
      routedProviderOperation(
        "preview",
        f.dir,
        localRoute,
        context,
        localBuild,
        "unused",
        "unused",
        localEnv,
        {},
        ports,
      ),
      /Copied artifact inventory/,
    );
    assert.equal(reads, 0);
    assert.equal(uploads, 0);
    for (const mutation of [
      { ...publicFiles, "extra.txt": publicFiles["example.txt"] },
      {
        "example.txt": {
          ...publicFiles["example.txt"],
          gitBlobSha: "f".repeat(40),
        },
      },
      {
        "example.txt": {
          ...publicFiles["example.txt"],
          sha256: "f".repeat(64),
        },
      },
    ])
      assert.throws(() =>
        verifyCopiedPublicInputs(f.dir, {
          sourceSha,
          inputInventory: { publicFiles: mutation },
        }),
      );
  } finally {
    await f.cleanup();
  }
});
test("final manifest requires containment/source/run receipts, not only passing case JSON", () => {
  const report = {
    errors: [],
    stats: { unexpected: 0, skipped: 0, flaky: 0 },
    suites: [
      {
        file: "fixture.spec.ts",
        specs: [
          {
            file: "fixture.spec.ts",
            title: "existing assertion",
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
  };
  const keys = reportCases(report)
      .map((x) => x.key)
      .sort(),
    baseline = { e2e: keys };
  const proof = {
    guard: "deny-only loopback proxy",
    forwarded_upstream: 0,
    suite: "e2e",
    sourceSha: route.sourceSha,
    sourceTree: route.sourceTree,
    controlSha: route.controlSha,
    workflowSha: env.GITHUB_SHA,
    runId: "99",
    attempt: 1,
    cases: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    retries: 0,
    caseKeys: keys,
  };
  assert.equal(
    containedEvidence(proof, report, route, baseline, "e2e", env).cases,
    1,
  );
  for (const mutation of [
    { guard: "none" },
    { forwarded_upstream: 1 },
    { sourceSha: "f".repeat(40) },
    { sourceTree: "f".repeat(40) },
    { controlSha: "f".repeat(40) },
    { runId: "100" },
    { attempt: 2 },
    { caseKeys: [] },
    { failed: 1 },
    { retries: 1 },
  ])
    assert.throws(() =>
      containedEvidence(
        { ...proof, ...mutation },
        report,
        route,
        baseline,
        "e2e",
        env,
      ),
    );
  const bad = copy(report);
  bad.suites[0].specs[0].tests[0].results.push({ status: "passed", retry: 1 });
  assert.throws(() =>
    containedEvidence(proof, bad, route, baseline, "e2e", env),
  );
});
test("superseded route/baseline reads are confirmed no-write, not failed prior provider jobs", async () => {
  await assert.rejects(
    currentMain(env, async () => ({ object: { sha: "f".repeat(40) } })),
    (error) => error.code === "PUBLIC_SUPERSEDED" && knownNoWrite(error),
  );
  await currentMain(env, async () => ({ object: { sha: env.GITHUB_SHA } }));
  assert.deepEqual(noWriteDisposition("route", "unused"), {
    path: "route/route.json",
    outputs: "kind=superseded\n",
  });
  assert.deepEqual(
    noWriteDisposition("baseline", "baseline-context/baseline.json"),
    { path: "baseline-context/baseline.json", outputs: "ready=false\n" },
  );
  assert.equal(
    noWriteDisposition("preview", "unused").outputs,
    "ready=false\n",
  );
  assert.doesNotThrow(() =>
    priorWriterGuard([
      { name: "Capture accepted production baseline", conclusion: "success" },
    ]),
  );
  assert.throws(() =>
    priorWriterGuard([
      {
        name: "Capture accepted production baseline",
        conclusion: "failure",
        steps: [
          { name: "Read and bind accepted production", conclusion: "failure" },
        ],
      },
    ]),
  );
});
test("workflow separates credentials, preserves hosted hook policy and terminates docs", async () => {
  const workflow = await readFile(
    resolve(root, ".github/workflows/repformed-auto-pages.yml"),
    "utf8",
  );
  const buildJob = workflow.slice(
    workflow.indexOf("\n  build:\n"),
    workflow.indexOf("\n  preview:\n"),
  );
  assert.doesNotMatch(buildJob, /GH_TOKEN:|CLOUDFLARE_API_TOKEN:/);
  assert.match(buildJob, /--ignore-scripts/);
  const hosted = workflow.slice(
    workflow.indexOf("\n  verify_preview:\n"),
    workflow.indexOf("\n  promote:\n"),
  );
  assert.match(hosted, /RELEASE_KIND/);
  assert.match(hosted, /--ignore-scripts/);
  const docs = workflow.slice(
    workflow.indexOf("\n  documents:\n"),
    workflow.indexOf("\n  baseline:\n"),
  );
  assert.doesNotMatch(docs, /CLOUDFLARE|secrets\.|pages deploy/);
  assert.match(docs, /docs source route\/route\.json/);
  const preview = workflow.slice(
    workflow.indexOf("\n  preview:\n"),
    workflow.indexOf("\n  verify_preview:\n"),
  );
  assert(
    preview.indexOf("prepare source") <
      preview.indexOf("CLOUDFLARE_API_TOKEN:"),
  );
  assert.match(preview, /analysis-tools/);
  assert.match(workflow, /contains\(fromJSON/);
});
