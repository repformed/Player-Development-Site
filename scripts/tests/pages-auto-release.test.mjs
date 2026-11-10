import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  symlink,
  rm,
  cp,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import process from "node:process";
import {
  autoGuard,
  boundBuild,
  priorWriterGuard,
  pendingGuard,
  proofGuard,
  automaticDeploy,
  automaticRead,
  knownNoWrite,
} from "../pages-auto-release.mjs";
import {
  root,
  textOnlyJsx,
  publicCss,
  eligibility,
  workflowPath,
  templatePin,
} from "../pages-auto-scope.mjs";
import {
  publicBuildInputs,
  inspectPublicArtifact,
} from "../pages-public-artifact.mjs";
const require = createRequire(resolve(root, "package.json")),
  ts = require("typescript"),
  postcss = require("postcss");
const hash = (b) => createHash("sha256").update(b).digest("hex");
const env = () => ({
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "repformed/Player-Development-Site",
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF: "refs/heads/main",
  GITHUB_WORKFLOW: "Repformed automatic public release",
  GITHUB_SHA: "a".repeat(40),
  PUBLIC_AUTO_SOURCE_SHA: "a".repeat(40),
  PUBLIC_CONTROL_SHA: "b".repeat(40),
  GITHUB_RUN_ID: "99",
  GITHUB_RUN_ATTEMPT: "1",
});
const build = (e) => ({
  sourceSha: e.GITHUB_SHA,
  workflowSha: e.GITHUB_SHA,
  sourceTree: "c".repeat(40),
  controlSha: e.PUBLIC_CONTROL_SHA,
  runId: e.GITHUB_RUN_ID,
  attempt: 1,
  manifest: {},
  manifestDigest: hash("{}"),
});
test("only exact first-attempt main push context is automatic", () => {
  const e = env();
  assert.doesNotThrow(() => autoGuard(e));
  for (const x of [
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_REF: "refs/heads/private" },
    { GITHUB_REPOSITORY: "other/repo" },
    { PUBLIC_AUTO_SOURCE_SHA: "d".repeat(40) },
    { PUBLIC_CONTROL_SHA: templatePin },
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_WORKFLOW: "Other" },
  ])
    assert.throws(() => autoGuard({ ...e, ...x }));
});
test("new manifest binds actual source, tree, control, run and digest", () => {
  const e = env(),
    b = build(e);
  assert.doesNotThrow(() => boundBuild(b, e));
  for (const x of [
    { sourceSha: "d".repeat(40) },
    { sourceTree: "unknown" },
    { controlSha: "d".repeat(40) },
    { runId: "100" },
    { manifest: { extra: { bytes: 1 } } },
    { attempt: 2 },
  ])
    assert.throws(() => boundBuild({ ...b, ...x }, e));
});
test("prior failed or cancelled provider jobs stop later commits; build failures do not", () => {
  assert.doesNotThrow(() =>
    priorWriterGuard([
      { name: "Validate exact public source", conclusion: "failure" },
      { name: "Preview exact public artifact", conclusion: "skipped" },
    ]),
  );
  for (const conclusion of ["failure", "cancelled", "timed_out", null])
    assert.throws(() =>
      priorWriterGuard([
        {
          name: "Preview exact public artifact",
          conclusion,
          status: "completed",
        },
      ]),
    );
  assert.doesNotThrow(() =>
    priorWriterGuard([
      { name: "Preview exact public artifact", conclusion: "success" },
      { name: "Promote exact public artifact", conclusion: "success" },
    ]),
  );
});
test("pending or unknown provider status blocks writes", () => {
  for (const status of ["pending", "queued", "active", undefined])
    assert.throws(() => pendingGuard([{ latest_stage: { status } }]));
  assert.doesNotThrow(() =>
    pendingGuard([
      { latest_stage: { status: "success" } },
      { latest_stage: { status: "failure" } },
    ]),
  );
});
test("preview promotion needs exact same run/source/control/tree/manifest", () => {
  const e = env(),
    b = build(e),
    p = {
      phase: "preview",
      sourceSha: b.sourceSha,
      sourceTree: b.sourceTree,
      controlSha: b.controlSha,
      workflowSha: e.GITHUB_SHA,
      runId: e.GITHUB_RUN_ID,
      attempt: 1,
      manifestDigest: b.manifestDigest,
      branch: "review-99",
      baseline: "00000000-0000-4000-8000-000000000001",
      deploymentId: "00000000-0000-4000-8000-000000000002",
    };
  assert.doesNotThrow(() => proofGuard(p, b, e));
  for (const x of [
    { runId: "98" },
    { controlSha: "d".repeat(40) },
    { sourceTree: "d".repeat(40) },
    { branch: "main" },
    { attempt: 2 },
    { manifestDigest: "f".repeat(64) },
  ])
    assert.throws(() => proofGuard({ ...p, ...x }, b, e));
});
test("Home permits plain JSX text only, not code/attributes/expressions/imports/scripts", () => {
  const a =
    'export const Home=()=> <section id="public"><h1>Existing words</h1><p>{known}</p></section>;';
  assert.doesNotThrow(() =>
    textOnlyJsx(a, a.replace("Existing words", "Clearer words"), ts),
  );
  for (const b of [
    a.replace('id="public"', 'id="private"'),
    a.replace("{known}", "{other}"),
    a + 'fetch("/account");',
    a.replace("<h1>", "<h1 onClick={action}>"),
    a.replace("Existing words", "<script>change()</script>"),
  ])
    assert.throws(() => textOnlyJsx(a, b, ts));
  assert.throws(() =>
    textOnlyJsx(
      "const x=<script>old()</script>;",
      "const x=<script>new()</script>;",
      ts,
    ),
  );
});
test("public-scoped CSS permits bounded literal spacing but preserves selectors, visibility and URLs", () => {
  const a = ".proposed-memberships { padding-bottom:64px; display:block; }";
  assert.doesNotThrow(() => publicCss(a, a.replace("64px", "64.0px"), postcss));
  assert.doesNotThrow(() => publicCss(a, a.replace("64px", "72px"), postcss));
  for (const b of [
    a.replace("64px", "9999px"),
    a.replace("64px", "-99px"),
    a.replace("display:block", "display:none"),
    a.replace(".proposed-memberships", "body"),
    a.replace("64px", "var(--hidden)"),
    a.replace("64px", 'url("https://example.invalid")'),
    a + '@import "external";',
    a.replace("64px", "expression(action())"),
    a.replace("64px", "64px!important"),
  ])
    assert.throws(() => publicCss(a, b, postcss));
  assert.throws(() =>
    publicCss("body { padding:4px; }", "body { padding:5px; }", postcss),
  );
  assert.throws(() =>
    publicCss(
      ".help-document h1 {font-size:20px;}",
      ".help-document h1 {font-size:0px;}",
      postcss,
    ),
  );
});
test("HTML permits plain text only, preserving links, attributes, scripts/styles and comments", () => {
  const a =
    '<html><head><script>unchanged()</script><style>.x{display:block}</style></head><body><!-- fixed --><a href="/same">Old label</a><p>Useful words</p></body></html>';
  const check = (b) =>
    execFileSync("python3", [resolve(root, "scripts/pages-public-text.py")], {
      input: JSON.stringify({ old: a, new: b }),
      stdio: "pipe",
    });
  assert.doesNotThrow(() => check(a.replace("Useful words", "Clear words")));
  for (const b of [
    a.replace("/same", "/account"),
    a.replace("unchanged()", "changed()"),
    a.replace("display:block", "display:none"),
    a.replace("fixed", "changed"),
    a.replace("Useful words", '<img src="/track">'),
    a.replace("Useful words", "&#60;script&#62;"),
  ])
    assert.throws(() => check(b));
});
test("repository gate accepts actual pushed public edit but rejects auth/private files and changed workflow", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-scope-"));
  const git = (args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const commit = () => {
    git(["add", "."]);
    git([
      "-c",
      "user.name=Fictional local test",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-m",
      "local fixture",
    ]);
    return git(["rev-parse", "HEAD"]);
  };
  try {
    git(["init"]);
    await mkdir(resolve(dir, ".github/workflows"), { recursive: true });
    await mkdir(resolve(dir, "src"));
    await writeFile(resolve(dir, ".gitignore"), "node_modules\n");
    await writeFile(resolve(dir, "package.json"), "{}");
    await symlink(resolve(root, "node_modules"), resolve(dir, "node_modules"));
    const template = await readFile(resolve(root, workflowPath), "utf8");
    await writeFile(resolve(dir, workflowPath), template);
    await writeFile(
      resolve(dir, "src/memberships.css"),
      ".proposed-memberships {padding-bottom:64px;}",
    );
    await writeFile(
      resolve(dir, "src/auth-untouched.txt"),
      "unchanged fixture",
    );
    const t = commit();
    await writeFile(
      resolve(dir, workflowPath),
      template.replaceAll(templatePin, t),
    );
    await writeFile(
      resolve(dir, "src/memberships.css"),
      ".proposed-memberships {padding-bottom:64.0px;}",
    );
    const s = commit();
    const result = await eligibility(dir, t, s);
    assert.equal(result.sourceSha, s);
    assert.deepEqual(
      result.changed.sort(),
      [workflowPath, "src/memberships.css"].sort(),
    );
    await writeFile(resolve(dir, "src/auth-untouched.txt"), "changed fixture");
    const bad = commit();
    await assert.rejects(
      eligibility(dir, t, bad),
      /Outside automatic public scope/,
    );
    git(["reset", "--hard", s]);
    await writeFile(
      resolve(dir, workflowPath),
      template.replaceAll(templatePin, t) + "# changed workflow\n",
    );
    const c = commit();
    await assert.rejects(eligibility(dir, t, c), /differs from reviewed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("dynamic artifact accepts exact known public shape; unexpected function or changed locked bytes fail", async () => {
  const source = resolve(process.env.PUBLIC_TEST_SITE || resolve(root, "dist"));
  // Installed local acceptance uses an existing synthetic/public build, never a provider.
  const inputs = await publicBuildInputs(
    process.env.PUBLIC_TEST_SOURCE || root,
  );
  const original = await inspectPublicArtifact(source, inputs);
  assert.equal(
    original.servedFileCount,
    Object.keys(original.manifest).length - 1,
  );
  const dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-output-"));
  try {
    await cp(source, resolve(dir, "site"), { recursive: true });
    await writeFile(resolve(dir, "site/_worker.js"), "unexpected");
    await assert.rejects(
      inspectPublicArtifact(resolve(dir, "site"), inputs),
      /Static output/,
    );
    await rm(resolve(dir, "site/_worker.js"));
    await writeFile(resolve(dir, "site/robots.txt"), "changed");
    await assert.rejects(
      inspectPublicArtifact(resolve(dir, "site"), inputs),
      /Static byte inventory/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
async function orchestrationFixture() {
  const e = {
    ...env(),
    RUNNER_TEMP: tmpdir(),
    PAGES_CLI: "/fictional/local-cli",
  };
  const site = resolve(process.env.PUBLIC_TEST_SITE || resolve(root, "dist")),
    b = {
      ...build(e),
      ...(await inspectPublicArtifact(
        site,
        await publicBuildInputs(process.env.PUBLIC_TEST_SOURCE || root),
      )),
    };
  b.expectedHostedCases = JSON.parse(
    await readFile(
      resolve(root, ".github/pages-release/public-baseline-cases.json"),
    ),
  ).hosted;
  b.authorization = {
    kind: "merged-public-pr",
    sourceSha: b.sourceSha,
    sourceTree: b.sourceTree,
    reviewId: 1,
    reviewerId: "2",
    reviewedHead: b.sourceSha,
    reviewedTree: b.sourceTree,
    reviewSubmittedAt: "2026-11-10T00:00:00Z",
  };
  const baseline = "00000000-0000-4000-8000-000000000001";
  let canonical = baseline,
    uploadCount = 0,
    source = e.GITHUB_SHA,
    projectReads = 0;
  const deployments = [];
  const project = () => ({
    name: "repformed",
    production_branch: "main",
    domains: ["repformed.com", "repformed.pages.dev"],
    canonical_deployment: {
      id: canonical,
      latest_stage: { status: "success" },
      deployment_trigger: { metadata: { commit_hash: "d".repeat(40) } },
    },
  });
  const state = {
    get count() {
      return uploadCount;
    },
    get reads() {
      return projectReads;
    },
    baseline,
    setCanonical: (x) => (canonical = x),
    setSource: (x) => (source = x),
  };
  const ports = {
    review: async () => b.authorization,
    read: async (path, _token, host) => {
      if (host === "https://api.github.com") {
        if (path.includes("/actions/workflows/")) return { workflow_runs: [] };
        if (path.endsWith("/git/ref/heads/main"))
          return { object: { sha: source } };
        if (path.includes("/git/commits/"))
          return { tree: { sha: b.sourceTree } };
        if (path.includes("/compare/")) return { status: "ahead" };
        throw Error("Unexpected local GitHub read");
      }
      if (path.includes("/deployments?")) return deployments;
      if (path.includes("/deployments/"))
        return deployments.find((x) => path.endsWith("/" + x.id));
      projectReads++;
      return project();
    },
    upload: (_exe, args, options) => {
      assert.equal(options.env.GH_TOKEN, undefined);
      assert.equal(options.env.GITHUB_TOKEN, undefined);
      uploadCount++;
      const branch = args.find((x) => x.startsWith("--branch=")).slice(9),
        id =
          "00000000-0000-4000-8000-" +
          String(uploadCount + 1).padStart(12, "0");
      const message = args
        .find((x) => x.startsWith("--commit-message="))
        .slice("--commit-message=".length);
      deployments.push({
        id,
        url: "https://fixture-" + uploadCount + ".repformed.pages.dev",
        environment: branch === "main" ? "production" : "preview",
        latest_stage: { status: "success" },
        deployment_trigger: {
          metadata: {
            branch,
            commit_hash: b.sourceSha,
            commit_message: message,
          },
        },
      });
      if (branch === "main") canonical = id;
    },
  };
  return { e, b, site, ports, state };
}
function hostedEvidence(f, preview) {
  const h = {
    phase: "verified-preview",
    sourceSha: f.b.sourceSha,
    sourceTree: f.b.sourceTree,
    controlSha: f.b.controlSha,
    workflowSha: f.e.GITHUB_SHA,
    runId: f.e.GITHUB_RUN_ID,
    attempt: 1,
    deploymentId: preview.deploymentId,
    manifestDigest: f.b.manifestDigest,
    verifiedFiles: f.b.servedFileCount,
    workerSha256: f.b.manifest["sw.js"].sha256,
    workerCacheVersion: f.b.workerCacheVersion,
    files: Object.entries(f.b.manifest)
      .filter(([p]) => p !== "_headers")
      .map(([path, m]) => ({ path, ...m })),
    consumedMetadata: [{ path: "_headers", ...f.b.manifest._headers }],
  };
  const fixture = {
    sourceSha: f.b.sourceSha,
    sourceTree: f.b.sourceTree,
    controlSha: f.b.controlSha,
    runId: f.e.GITHUB_RUN_ID,
    attempt: 1,
    suite: "hosted",
    caseKeys: f.b.expectedHostedCases,
    cases: f.b.expectedHostedCases.length,
    passed: f.b.expectedHostedCases.length,
    failed: 0,
    skipped: 0,
    retries: 0,
    forwarded_upstream: 0,
  };
  return { h, fixture };
}
test("local orchestration previews and promotes exact artifact without rebuild or manual dispatch", async () => {
  const f = await orchestrationFixture(),
    dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-success-"));
  try {
    const p = resolve(dir, "preview.json");
    await automaticDeploy(
      "preview",
      f.site,
      f.b,
      p,
      f.e,
      null,
      null,
      null,
      f.ports,
    );
    const preview = JSON.parse(await readFile(p));
    const { h, fixture } = hostedEvidence(f, preview);
    await automaticDeploy(
      "promote",
      f.site,
      f.b,
      resolve(dir, "production.json"),
      f.e,
      preview,
      h,
      fixture,
      f.ports,
    );
    const production = JSON.parse(
      await readFile(resolve(dir, "production.json")),
    );
    assert.equal(production.sourceSha, f.e.GITHUB_SHA);
    assert.equal(production.manifestDigest, f.b.manifestDigest);
    assert.equal(production.phase, "promote");
    assert.equal(f.state.count, 2);
    assert.equal(
      (await readFile(resolve(dir, "operation-promote.json"), "utf8")).includes(
        "confirmed",
      ),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("source change or final production drift blocks write; no automatic retry", async () => {
  for (const mode of ["source", "baseline"]) {
    const f = await orchestrationFixture(),
      dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-drift-"));
    try {
      if (mode === "source") f.state.setSource("e".repeat(40));
      else {
        const read = f.ports.read;
        f.ports.read = async (...a) => {
          const r = await read(...a);
          if (!a[2] && !a[0].includes("/deployments") && f.state.reads >= 2)
            r.canonical_deployment.id = "00000000-0000-4000-8000-000000000009";
          return r;
        };
      }
      await assert.rejects(
        automaticDeploy(
          "preview",
          f.site,
          f.b,
          resolve(dir, "preview.json"),
          f.e,
          null,
          null,
          null,
          f.ports,
        ),
      );
      assert.equal(f.state.count, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
test("provider denial or uncertain upload stops once and produces no success proof", async () => {
  for (const mode of ["denied", "uncertain"]) {
    const f = await orchestrationFixture(),
      dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-failure-"));
    let attempted = 0;
    try {
      if (mode === "denied") {
        const read = f.ports.read;
        f.ports.read = async (...a) => {
          if (!a[2])
            throw Error("Provider read failed HTTP 403; do not blindly retry");
          return read(...a);
        };
      } else
        f.ports.upload = () => {
          attempted++;
          throw Error("Synthetic lost upload response");
        };
      await assert.rejects(
        automaticDeploy(
          "preview",
          f.site,
          f.b,
          resolve(dir, "preview.json"),
          f.e,
          null,
          null,
          null,
          f.ports,
        ),
        mode === "denied" ? /403/ : /uncertain/,
      );
      assert.equal(attempted, mode === "denied" ? 0 : 1);
      await assert.rejects(readFile(resolve(dir, "preview.json")));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
test("prior unresolved provider job blocks before any new provider read", async () => {
  const f = await orchestrationFixture(),
    dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-prior-"));
  let providerReads = 0;
  const read = f.ports.read;
  f.ports.read = async (...a) => {
    if (!a[2]) providerReads++;
    if (a[0].includes("repformed-auto-pages.yml/runs"))
      return { workflow_runs: [{ id: 98, run_attempt: 1 }] };
    if (a[0].includes("/attempts/1/jobs"))
      return {
        total_count: 1,
        jobs: [
          { name: "Preview exact public artifact", conclusion: "failure" },
        ],
      };
    return read(...a);
  };
  try {
    await assert.rejects(
      automaticDeploy(
        "preview",
        f.site,
        f.b,
        resolve(dir, "preview.json"),
        f.e,
        null,
        null,
        null,
        f.ports,
      ),
      /unresolved or denied/,
    );
    assert.equal(providerReads, 0);
    assert.equal(f.state.count, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("missing hosted file/header or stale result blocks promotion before writes", async () => {
  for (const mode of ["file", "headers", "run"]) {
    const f = await orchestrationFixture(),
      dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-hosted-"));
    try {
      const p = resolve(dir, "preview.json");
      await automaticDeploy(
        "preview",
        f.site,
        f.b,
        p,
        f.e,
        null,
        null,
        null,
        f.ports,
      );
      const preview = JSON.parse(await readFile(p));
      const { h, fixture } = hostedEvidence(f, preview);
      if (mode === "file") h.files.pop();
      if (mode === "headers") h.consumedMetadata = [];
      if (mode === "run") fixture.runId = "98";
      await assert.rejects(
        automaticDeploy(
          "promote",
          f.site,
          f.b,
          resolve(dir, "production.json"),
          f.e,
          preview,
          h,
          fixture,
          f.ports,
        ),
      );
      assert.equal(f.state.count, 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
test("overlapping A then B: superseded A has known no-write outcome; B can publish", async () => {
  const a = await orchestrationFixture(),
    dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-overlap-"));
  try {
    a.state.setSource("e".repeat(40));
    let error;
    try {
      await automaticDeploy(
        "preview",
        a.site,
        a.b,
        resolve(dir, "a.json"),
        a.e,
        null,
        null,
        null,
        a.ports,
      );
    } catch (e) {
      error = e;
    }
    assert.equal(knownNoWrite(error), true);
    assert.equal(a.state.count, 0);
    priorWriterGuard([
      { name: "Preview exact public artifact", conclusion: "success" },
    ]);
    priorWriterGuard([
      {
        name: "Preview exact public artifact",
        conclusion: "failure",
        steps: [
          {
            name: "Capture fresh baseline and upload verified public preview",
            conclusion: "skipped",
          },
        ],
      },
    ]);
    const b = await orchestrationFixture();
    b.e.GITHUB_SHA = "e".repeat(40);
    b.e.PUBLIC_AUTO_SOURCE_SHA = b.e.GITHUB_SHA;
    b.b.sourceSha = b.e.GITHUB_SHA;
    b.b.authorization = {
      ...b.b.authorization,
      sourceSha: b.e.GITHUB_SHA,
      reviewedHead: b.e.GITHUB_SHA,
    };
    b.b.workflowSha = b.e.GITHUB_SHA;
    b.state.setSource(b.e.GITHUB_SHA);
    await automaticDeploy(
      "preview",
      b.site,
      b.b,
      resolve(dir, "b.json"),
      b.e,
      null,
      null,
      null,
      b.ports,
    );
    assert.equal(b.state.count, 1);
    assert.equal(
      JSON.parse(await readFile(resolve(dir, "b.json"))).sourceSha,
      b.e.GITHUB_SHA,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("new main during upload records confirmed superseded preview and suppresses promotion readiness", async () => {
  const f = await orchestrationFixture(),
    dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-during-"));
  try {
    const upload = f.ports.upload;
    f.ports.upload = (...args) => {
      upload(...args);
      f.state.setSource("e".repeat(40));
    };
    f.e.GITHUB_OUTPUT = resolve(dir, "outputs");
    await automaticDeploy(
      "preview",
      f.site,
      f.b,
      resolve(dir, "preview.json"),
      f.e,
      null,
      null,
      null,
      f.ports,
    );
    const p = JSON.parse(await readFile(resolve(dir, "preview.json")));
    assert.equal(p.sourceSuperseded, true);
    assert.equal(f.state.count, 1);
    assert.match(await readFile(f.e.GITHUB_OUTPUT, "utf8"), /ready=false/);
    assert.equal(
      JSON.parse(await readFile(resolve(dir, "operation-preview.json"))).state,
      "confirmed",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("known-no-write classification never includes denial, cancellation or uncertain upload", () => {
  for (const error of [
    Error("HTTP403"),
    Error("Upload outcome uncertain"),
    { code: "CANCELLED" },
    {},
  ])
    assert.equal(knownNoWrite(error), false);
});
test("actual provider pagination metadata handles a full final page without probing an invalid extra page", async () => {
  const calls = [];
  const list = await automaticRead(
    "/accounts/fictional/pages/projects/repformed/deployments?per_page=20&page=2",
    "local-fictional-placeholder",
    "https://api.cloudflare.com/client/v4",
    async (url) => {
      calls.push(String(url));
      return new globalThis.Response(
        JSON.stringify({
          success: true,
          result: Array.from({ length: 20 }, (_, i) => ({
            id: String(i),
            latest_stage: { status: "success" },
          })),
          result_info: {
            page: 2,
            per_page: 20,
            total_count: 40,
            total_pages: 2,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(list.length, 20);
  assert.equal(list.pageInfo.page, list.pageInfo.total_pages);
  assert.equal(JSON.stringify(list).includes("pageInfo"), false);
  await assert.rejects(
    automaticRead(
      "/accounts/fictional/pages/projects/repformed/deployments?per_page=20&page=1",
      "local-fictional-placeholder",
      "https://api.cloudflare.com/client/v4",
      async () =>
        new globalThis.Response(JSON.stringify({ success: true, result: [] }), {
          status: 200,
        }),
    ),
    /pagination metadata missing/,
  );
});
test("preflight consumes full final deployment page using metadata, with no invalid next request", async () => {
  const f = await orchestrationFixture(),
    dir = await mkdtemp(resolve(tmpdir(), "repformed-auto-pages-")),
    seen = [];
  const read = f.ports.read;
  f.ports.read = async (...args) => {
    const match = /\/deployments\?per_page=20&page=(\d+)$/.exec(args[0]);
    if (match) {
      const page = Number(match[1]);
      seen.push(page);
      assert.ok(page <= 2);
      const rows = Array.from({ length: 20 }, () => ({
        latest_stage: { status: "success" },
      }));
      Object.defineProperty(rows, "pageInfo", {
        value: { page, total_pages: 2 },
      });
      return rows;
    }
    return read(...args);
  };
  try {
    await automaticDeploy(
      "preview",
      f.site,
      f.b,
      resolve(dir, "preview.json"),
      f.e,
      null,
      null,
      null,
      f.ports,
    );
    assert.deepEqual(seen, [1, 2]);
    assert.equal(f.state.count, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("main advancement while review is being revalidated prevents provider write", async () => {
  const f = await orchestrationFixture(),
    dir = await mkdtemp(resolve(tmpdir(), "auto-review-main-race-"));
  const original = f.ports.review;
  f.ports.review = async (...args) => {
    const review = await original(...args);
    f.state.setSource("e".repeat(40));
    return review;
  };
  try {
    await assert.rejects(
      automaticDeploy(
        "preview",
        f.site,
        f.b,
        resolve(dir, "preview.json"),
        f.e,
        null,
        null,
        null,
        f.ports,
      ),
      (e) => knownNoWrite(e),
    );
    assert.equal(f.state.count, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
