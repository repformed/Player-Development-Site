import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { createHash } from "node:crypto";
import {
  readProtectedContext,
  authenticateArtifact,
} from "../pages-protected-context.mjs";
import {
  developmentDependencyDelta,
  runtimeGraph,
  readerLinkDelta,
  protectedScope,
} from "../pages-protected-scope.mjs";
import {
  unchangedRuntimeOutput,
  boundContainedProof,
  remainingGates,
} from "../pages-protected-preparation.mjs";
const copy = (x) => globalThis.structuredClone(x);
const row = (version, dev = true) => ({
  version,
  dev,
  resolved: "https://registry.npmjs.org/tool/-/tool-" + version + ".tgz",
  integrity: "sha512-Ynl0ZXM=",
});
const pkg = {
  name: "fixture",
  scripts: { build: "fixed" },
  dependencies: { runtime: "1" },
  devDependencies: { tool: "1.0.0" },
};
const lock = {
  name: "fixture",
  lockfileVersion: 3,
  packages: {
    "": { ...pkg },
    "node_modules/runtime": {
      ...row("1", false),
      dependencies: { shared: "1" },
    },
    "node_modules/shared": row("1", false),
    "node_modules/tool": row("1"),
  },
};
function change() {
  const p = copy(pkg),
    l = copy(lock);
  p.devDependencies.tool = "2.0.0";
  l.packages[""].devDependencies.tool = "2.0.0";
  l.packages["node_modules/tool"] = row("2");
  return [p, l];
}
test("development-only registry update keeps both production graphs frozen", () => {
  const [p, l] = change();
  assert.equal(
    developmentDependencyDelta(pkg, p, lock, l).changedNodes.length,
    1,
  );
  assert.equal(Object.keys(runtimeGraph(l)).length, 2);
});
for (const field of [
  "scripts",
  "dependencies",
  "engines",
  "overrides",
  "workspaces",
  "config",
])
  test("root " + field + " cannot enter dependency lane", () => {
    const [p, l] = change();
    p[field] = { injected: "changed" };
    assert.throws(() => developmentDependencyDelta(pkg, p, lock, l));
  });
test("forged dev flag cannot disguise a runtime graph mutation", () => {
  const [p, l] = change();
  l.packages["node_modules/shared"] = row("2", true);
  assert.throws(() => developmentDependencyDelta(pkg, p, lock, l), /Runtime/);
});
for (const type of ["optionalDependencies", "peerDependencies"])
  test(type + " resolutions are frozen on both sides", () => {
    const a = copy(lock),
      [p, b] = change();
    a.packages["node_modules/runtime"][type] = { shared: "1" };
    b.packages["node_modules/runtime"][type] = { shared: "2" };
    assert.throws(() => developmentDependencyDelta(pkg, p, a, b), /Runtime/);
  });
for (const resolved of [
  "git+https://example.invalid/tool",
  "file:../tool",
  "https://example.invalid/tool.tgz",
  "https://registry.npmjs.org/tool.tgz?token=fictional",
  "http://registry.npmjs.org/tool.tgz",
  "https://registry.npmjs.org:8443/tool.tgz",
])
  test("reject package source " + resolved.split(":")[0], () => {
    const [p, l] = change();
    l.packages["node_modules/tool"].resolved = resolved;
    assert.throws(() => developmentDependencyDelta(pkg, p, lock, l));
  });
test("missing integrity, link, install hook and package/lock mismatch fail closed", () => {
  for (const mutation of [
    (r) => delete r.integrity,
    (r) => (r.link = true),
    (r) => (r.hasInstallScript = true),
  ]) {
    const [p, l] = change();
    mutation(l.packages["node_modules/tool"]);
    assert.throws(() => developmentDependencyDelta(pkg, p, lock, l));
  }
  const [p, l] = change();
  l.packages[""].devDependencies.tool = "different";
  assert.throws(() => developmentDependencyDelta(pkg, p, lock, l));
});
test("URL, alias and workspace root development declarations are rejected before install", () => {
  for (const value of [
    "file:../tool",
    "git+https://example.invalid/tool",
    "npm:other@1.0.0",
    "workspace:*",
  ]) {
    const [p, l] = change();
    p.devDependencies.tool = value;
    l.packages[""].devDependencies.tool = value;
    assert.throws(() => developmentDependencyDelta(pkg, p, lock, l), /semver/);
  }
});
const old = "https://coachbilliott.github.io/Player-Development-Site/",
  next = "https://repformed.com/";
test("reader repair preserves suffixes and excludes auth/deployment prose", () => {
  const text =
    "Reader " +
    old +
    "?source=app#app\n## Published demo and deployment\nDeploy " +
    old;
  const after = text.replace(old, next);
  assert.equal(
    readerLinkDelta("README.md", text, after, () => true, '["app"]')
      .replacements,
    1,
  );
  assert.throws(
    () =>
      readerLinkDelta(
        "README.md",
        text,
        text.replaceAll(old, next),
        () => true,
        '["app"]',
      ),
    /Deployment/,
  );
  assert.throws(() =>
    readerLinkDelta("backend/SETUP.md", old, next, () => true, ""),
  );
  assert.throws(() =>
    readerLinkDelta(
      "APP-TESTING.md",
      old + "#app",
      next + "#other",
      () => true,
      '["app"]',
    ),
  );
  assert.throws(() =>
    readerLinkDelta(
      "APP-TESTING.md",
      old + "missing.html",
      next + "missing.html",
      () => false,
      "",
    ),
  );
});
test("ordinary prose and added promises cannot hitchhike on reader repair", () => {
  assert.throws(() =>
    readerLinkDelta(
      "APP-TESTING.md",
      old + "#app",
      next + "#app extra",
      () => true,
      '["app"]',
    ),
  );
});
test("only separately validated worker differences are possible in dependency output", () => {
  const a = {
    manifest: {
      "a.js": { bytes: 1, sha256: "same" },
      "sw.js": { bytes: 1, sha256: "old" },
    },
  };
  const b = copy(a);
  b.manifest["sw.js"].sha256 = "new";
  assert.equal(unchangedRuntimeOutput(a, b).unchangedFiles, 1);
  b.manifest["a.js"].sha256 = "changed";
  assert.throws(() => unchangedRuntimeOutput(a, b));
  b.manifest["extra.js"] = { bytes: 0, sha256: "extra" };
  assert.throws(() => unchangedRuntimeOutput(a, b));
});
test("prepared evidence is never publication authority and sensitive categories stay gated", () => {
  for (const kind of [
    "authentication",
    "billing",
    "backend",
    "release-controls",
  ])
    assert.match(remainingGates(kind).join(" "), /action-time/);
  assert.match(
    remainingGates("development-dependencies").join(" "),
    /bootstrap/,
  );
  assert.match(
    remainingGates("reader-documentation").join(" "),
    /no provider deployment/,
  );
  assert.throws(() => boundContainedProof({}, { suites: [] }, {}, {}, "e2e"));
});
const base = process.env.PROTECTED_TEST_BASE;
test("authenticated preparation context rejects stale main, wrong PR/run, reruns and incomplete CI", async () => {
  const sourceSha = "a".repeat(40),
    baselineSha = "b".repeat(40),
    tree = "c".repeat(40);
  const repo = {
    id: 1430113496,
    full_name: "repformed/Player-Development-Site",
  };
  const pr = {
    number: 38,
    state: "open",
    merged: false,
    head: { sha: sourceSha, repo },
    base: { sha: baselineSha, ref: "main", repo },
  };
  const run = {
    id: 99,
    repository: repo,
    head_sha: sourceSha,
    event: "pull_request",
    path: ".github/workflows/checks.yml",
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
    pull_requests: [
      { number: 38, head: { sha: sourceSha }, base: { sha: baselineSha } },
    ],
  };
  const rows = new Map([
    ["", repo],
    ["/git/ref/heads/main", { object: { sha: baselineSha } }],
    ["/git/commits/" + sourceSha, { sha: sourceSha, tree: { sha: tree } }],
    ["/git/commits/" + baselineSha, { sha: baselineSha, tree: { sha: tree } }],
    ["/pulls/38", pr],
    ["/actions/runs/99", run],
  ]);
  const read = async (p) =>
    copy(rows.get(p.replace("/repos/repformed/Player-Development-Site", "")));
  const args = { sourceSha, baselineSha, pullRequest: 38, runId: 99 };
  assert.equal(
    (await readProtectedContext(args, read)).grantsDeploymentAuthority,
    false,
  );
  for (const change of [
    { run_attempt: 2 },
    { conclusion: "failure" },
    { head_sha: baselineSha },
    { path: ".github/workflows/other.yml" },
  ]) {
    rows.set("/actions/runs/99", { ...run, ...change });
    await assert.rejects(readProtectedContext(args, read));
  }
  rows.set("/actions/runs/99", run);
  rows.set("/git/ref/heads/main", { object: { sha: sourceSha } });
  await assert.rejects(readProtectedContext(args, read));
});
test("artifact hashes alone do not replace authenticated run/source/size provenance", async () => {
  const bytes = new globalThis.TextEncoder().encode("fictional archive bytes"),
    sourceSha = "a".repeat(40);
  const context = { runId: 99, sourceSha };
  const metadata = {
    id: 7,
    name: "browser-test-report",
    expired: false,
    size_in_bytes: bytes.length,
    digest: "sha256:" + createHash("sha256").update(bytes).digest("hex"),
    workflow_run: { id: 99, head_sha: sourceSha },
  };
  assert.equal(
    (await authenticateArtifact(context, 7, bytes, async () => metadata))
      .grantsDeploymentAuthority,
    false,
  );
  for (const mutation of [
    { name: "unrelated-artifact" },
    { expired: true },
    { size_in_bytes: 0 },
    { workflow_run: { id: 100, head_sha: sourceSha } },
    { digest: "sha256:wrong" },
  ])
    await assert.rejects(
      authenticateArtifact(context, 7, bytes, async () => ({
        ...metadata,
        ...mutation,
      })),
    );
});
if (base)
  test("actual integrated dependency and documentation trees classify without combining scope", async () => {
    const dep = process.env.PROTECTED_TEST_DEP,
      docs = process.env.PROTECTED_TEST_DOCS;
    const head = (p) =>
      execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: p,
        encoding: "utf8",
      }).trim();
    const a = protectedScope(dep, base, head(dep)),
      b = protectedScope(docs, base, head(docs));
    assert.equal(a.kind, "development-dependencies");
    assert.equal(a.details.changedNodes.length, 33);
    assert.equal(a.grantsDeploymentAuthority, false);
    assert.equal(b.kind, "reader-documentation");
    assert.equal(
      b.details.reduce((n, x) => n + x.replacements, 0),
      21,
    );
    assert.equal(new Set(b.details.flatMap((x) => x.targets)).size, 12);
    for (const p of ["package.json", "package-lock.json"])
      assert.equal(
        await readFile(dep + "/" + p, "utf8"),
        execFileSync("git", ["show", "d4fa40f:" + p], {
          cwd: dep,
          encoding: "utf8",
        }),
      );
  });
