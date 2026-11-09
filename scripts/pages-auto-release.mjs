import { execFileSync } from "node:child_process";
import {
  readFile,
  readdir,
  lstat,
  writeFile,
  mkdir,
  appendFile,
} from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { createHash } from "node:crypto";
import process from "node:process";
import console from "node:console";
import {
  api,
  target,
  projectGuard,
  guardedWrite,
  verifySite,
} from "./pages-release.mjs";
import { verifyBoundPreviewBytes } from "./verify-pages-preview-bytes.mjs";
import {
  eligibility,
  root,
  must,
  cssFiles,
  htmlFiles,
} from "./pages-auto-scope.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const readJSON = async (p) => JSON.parse(await readFile(p, "utf8"));
export const knownNoWrite = (error) =>
  ["PUBLIC_SUPERSEDED", "PUBLIC_BASELINE_CHANGED"].includes(error.code);
export function autoGuard(env) {
  must(
    env.GITHUB_ACTIONS === "true" &&
      env.GITHUB_REPOSITORY === target.repository &&
      env.GITHUB_EVENT_NAME === "push" &&
      env.GITHUB_REF === "refs/heads/main" &&
      env.GITHUB_WORKFLOW === "Repformed automatic public release",
    "Trusted main push required",
  );
  must(
    /^[a-f0-9]{40}$/.test(env.GITHUB_SHA || "") &&
      env.PUBLIC_AUTO_SOURCE_SHA === env.GITHUB_SHA &&
      /^[a-f0-9]{40}$/.test(env.PUBLIC_CONTROL_SHA || "") &&
      env.PUBLIC_CONTROL_SHA !== "0".repeat(40),
    "Exact automatic source/control required",
  );
  must(
    /^\d+$/.test(env.GITHUB_RUN_ID || "") && env.GITHUB_RUN_ATTEMPT === "1",
    "Automatic runs require first-attempt identity; do not blindly rerun",
  );
}
export function boundBuild(build, env) {
  autoGuard(env);
  must(
    build.sourceSha === env.GITHUB_SHA &&
      build.workflowSha === env.GITHUB_SHA &&
      build.controlSha === env.PUBLIC_CONTROL_SHA &&
      build.runId === env.GITHUB_RUN_ID &&
      build.attempt === 1 &&
      /^[a-f0-9]{40}$/.test(build.sourceTree || "") &&
      hash(JSON.stringify(build.manifest)) === build.manifestDigest,
    "Build identity/digest mismatch",
  );
}
const canonical = (n) =>
  n.replace(/-[A-Za-z0-9_-]{8}(\.(?:js|css|woff2?))$/, "-HASH$1");
export async function inspectSite(site) {
  must(
    (await lstat(site)).isDirectory() && !(await lstat(site)).isSymbolicLink(),
    "Real static directory required",
  );
  const approved = await readJSON(
    resolve(root, ".github/pages-release/approved-manifest.json"),
  );
  const files = new Map();
  const walk = async (dir, prefix = "") => {
    for (const n of (await readdir(dir)).sort()) {
      const p = resolve(dir, n),
        s = await lstat(p);
      must(!s.isSymbolicLink(), "Static symlink forbidden");
      if (s.isDirectory()) await walk(p, prefix + n + "/");
      else {
        must(s.isFile(), "Regular static files required");
        files.set(prefix + n, await readFile(p));
      }
    }
  };
  await walk(site);
  must(files.size === 84, "Unexpected static file count");
  const actual = [...files.keys()].map(canonical).sort(),
    expected = Object.keys(approved).map(canonical).sort();
  must(
    JSON.stringify(actual) === JSON.stringify(expected),
    "Unexpected static output shape",
  );
  const variable = new Set([
    "index.html",
    "sw.js",
    ...cssFiles.filter((x) => x.startsWith("public/")).map((x) => x.slice(7)),
    ...htmlFiles.map((x) => x.slice(7)),
  ]);
  for (const [name, bytes] of files) {
    if (name.startsWith("assets/") || variable.has(name)) continue;
    must(
      approved[name] &&
        hash(bytes) === approved[name].sha256 &&
        bytes.length === approved[name].bytes,
      "Unapproved static bytes: " + name,
    );
  }
  const worker = files.get("sw.js").toString();
  const raw = /const ASSETS = (\[.*?\])\.map/.exec(worker)?.[1];
  must(raw, "Worker asset declaration missing");
  const assets = JSON.parse(raw);
  const old = await readJSON(
    resolve(root, ".github/pages-release/approved-sw-assets.json"),
  );
  must(
    JSON.stringify(assets.map(canonical).sort()) ===
      JSON.stringify(old.map(canonical).sort()),
    "Worker precache shape changed",
  );
  const manifest = Object.fromEntries(
    [...files]
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([name, b]) => [name, { bytes: b.length, sha256: hash(b) }]),
  );
  const result = await verifySite(site, manifest, {
    template: await readFile(resolve(root, "build/service-worker.txt"), "utf8"),
    assets: [...assets].sort(),
  });
  return {
    workerCacheVersion: /\$\{PREFIX\}([a-f0-9]{16})/.exec(worker)[1],
    manifest: result.manifest,
    manifestDigest: result.manifestDigest,
    assets: [...assets].sort(),
  };
}
export function priorWriterGuard(jobs) {
  for (const j of jobs) {
    const stepName = {
      "Preview exact public artifact":
        "Capture fresh baseline and upload verified public preview",
      "Promote exact public artifact":
        "Promote only exact successful preview bytes",
    }[j.name];
    if (!stepName || ["success", "skipped"].includes(j.conclusion)) continue;
    // Explicitly skipped credential step proves no provider request began.
    // A missing, running, cancelled or failed step remains unresolved.
    if (j.steps?.find((s) => s.name === stepName)?.conclusion === "skipped")
      continue;
    throw Error(
      "Prior provider operation unresolved or denied: " +
        j.name +
        " (" +
        (j.conclusion || j.status) +
        "); inspect before any new automatic provider request",
    );
  }
}
export function pendingGuard(deployments) {
  must(Array.isArray(deployments), "Deployment inventory missing");
  for (const d of deployments)
    must(
      ["success", "failure", "canceled", "cancelled"].includes(
        d.latest_stage?.status,
      ),
      "Provider deployment still pending; inspect before another write",
    );
}
export function proofGuard(proof, build, env) {
  boundBuild(build, env);
  must(
    proof.phase === "preview" &&
      proof.sourceSha === build.sourceSha &&
      proof.sourceTree === build.sourceTree &&
      proof.controlSha === build.controlSha &&
      proof.workflowSha === env.GITHUB_SHA &&
      proof.runId === env.GITHUB_RUN_ID &&
      proof.attempt === 1 &&
      proof.manifestDigest === build.manifestDigest &&
      proof.branch === "review-" + env.GITHUB_RUN_ID &&
      /^[a-f0-9-]{36}$/.test(proof.baseline || "") &&
      /^[a-f0-9-]{36}$/.test(proof.deploymentId || ""),
    "Same-run preview binding required",
  );
}
const gh = (path, env, ports) =>
  ports.read(
    "/repos/" + target.repository + path,
    env.GH_TOKEN,
    "https://api.github.com",
  );
async function currentSource(build, env, ports, allowSuperseded = false) {
  const ref = await gh("/git/ref/heads/main", env, ports);
  if (ref.object?.sha !== env.GITHUB_SHA) {
    if (allowSuperseded) return false;
    const error = Error("Source is no longer main; superseded without write");
    error.code = "PUBLIC_SUPERSEDED";
    throw error;
  }
  const commit = await gh("/git/commits/" + env.GITHUB_SHA, env, ports);
  must(commit.tree?.sha === build.sourceTree, "Source tree changed");
  return true;
}
async function priorRuns(env, ports) {
  // Audit automatic writers. A failed/cancelled credential job is a hard stop,
  // even on a later commit: it is not treated as a new automatic retry.
  for (let page = 1; page <= 100; page++) {
    const r = await gh(
      "/actions/workflows/repformed-auto-pages.yml/runs?event=push&branch=main&per_page=100&page=" +
        page,
      env,
      ports,
    );
    must(Array.isArray(r.workflow_runs), "Prior workflow inventory missing");
    for (const run of r.workflow_runs) {
      if (String(run.id) === env.GITHUB_RUN_ID) continue;
      must(
        run.run_attempt <= 10,
        "Prior attempts require explicit reconciliation",
      );
      for (let a = 1; a <= run.run_attempt; a++) {
        const j = await gh(
          "/actions/runs/" + run.id + "/attempts/" + a + "/jobs?per_page=100",
          env,
          ports,
        );
        must(j.total_count <= 100, "Unexpected provider-job inventory");
        priorWriterGuard(j.jobs);
      }
    }
    if (r.workflow_runs.length < 100) return;
  }
  throw Error(
    "Prior-run audit exceeds bounded inventory; explicit review required",
  );
}
async function ensureManualIdle(env, ports) {
  const r = await gh(
    "/actions/workflows/repformed-pages.yml/runs?per_page=100",
    env,
    ports,
  );
  must(
    Array.isArray(r.workflow_runs) && r.workflow_runs.length < 100,
    "Manual operation inventory exceeds bounded reconciliation; review required",
  );
  for (const run of r.workflow_runs) {
    if (run.status !== "completed")
      throw Error(
        "Manual Pages operation not terminal; inspect before automatic writes",
      );
    // New manual provider failures after automation bootstrap are not auto-retried.
    if (
      run.created_at > "2026-11-09T17:06:35Z" &&
      !["success", "skipped"].includes(run.conclusion)
    ) {
      const jobs = await gh(
        "/actions/runs/" + run.id + "/jobs?per_page=100",
        env,
        ports,
      );
      must(jobs.total_count <= 100, "Unexpected manual job inventory");
      for (const j of jobs.jobs)
        if (["preview", "promote"].includes(j.name))
          must(
            ["success", "skipped"].includes(j.conclusion),
            "Manual provider outcome unresolved/denied; explicit reconciliation required",
          );
    }
  }
}
async function providerPreflight(build, env, ports) {
  await priorRuns(env, ports);
  await ensureManualIdle(env, ports);
  await currentSource(build, env, ports);
  const p =
    "/accounts/" + target.accountId + "/pages/projects/" + target.project;
  const project = await ports.read(p, env.CLOUDFLARE_API_TOKEN);
  projectGuard(project, project.canonical_deployment?.id);
  for (let page = 1; page <= 100; page++) {
    const list = await ports.read(
      p + "/deployments?per_page=20&page=" + page,
      env.CLOUDFLARE_API_TOKEN,
    );
    pendingGuard(list);
    if (list.length < 20) break;
    must(
      page < 100,
      "Provider inventory exceeds bounded reconciliation; review required",
    );
  }
  const prior =
    project.canonical_deployment?.deployment_trigger?.metadata?.commit_hash;
  must(
    /^[a-f0-9]{40}$/.test(prior || ""),
    "Production source identity missing",
  );
  const ancestry = await gh(
    "/compare/" + prior + "..." + env.GITHUB_SHA,
    env,
    ports,
  );
  must(
    ["ahead", "identical"].includes(ancestry.status),
    "Production source is not an ancestor of selected main",
  );
  return project.canonical_deployment.id;
}
async function writeProof(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}
export async function automaticDeploy(
  phase,
  site,
  build,
  proofPath,
  env,
  preview = null,
  hosted = null,
  fixture = null,
  ports = { read: api, upload: execFileSync },
) {
  boundBuild(build, env);
  const inspected = await inspectSite(site);
  must(
    inspected.workerCacheVersion === build.workerCacheVersion &&
      inspected.manifestDigest === build.manifestDigest &&
      JSON.stringify(inspected.assets) === JSON.stringify(build.assets),
    "Downloaded static artifact differs",
  );
  let baseline;
  if (phase === "preview")
    baseline = await providerPreflight(build, env, ports);
  else {
    proofGuard(preview, build, env);
    must(
      hosted.phase === "verified-preview" &&
        hosted.controlSha === build.controlSha &&
        hosted.sourceSha === build.sourceSha &&
        hosted.runId === env.GITHUB_RUN_ID &&
        hosted.deploymentId === preview.deploymentId &&
        hosted.manifestDigest === build.manifestDigest &&
        hosted.verifiedFiles === 83 &&
        hosted.sourceTree === build.sourceTree &&
        hosted.workflowSha === env.GITHUB_SHA &&
        hosted.attempt === 1 &&
        hosted.workerSha256 === build.manifest["sw.js"].sha256,
      "Hosted byte/header acceptance missing",
    );
    must(
      fixture.sourceSha === build.sourceSha &&
        fixture.controlSha === build.controlSha &&
        fixture.sourceTree === build.sourceTree &&
        fixture.runId === env.GITHUB_RUN_ID &&
        fixture.attempt === 1 &&
        fixture.suite === "hosted" &&
        fixture.cases === 86 &&
        fixture.passed === 86 &&
        fixture.failed === 0 &&
        fixture.skipped === 0 &&
        fixture.retries === 0 &&
        fixture.forwarded_upstream === 0,
      "Hosted public acceptance missing",
    );
    const served = Object.keys(build.manifest)
      .filter((x) => x !== "_headers")
      .sort();
    must(
      Array.isArray(hosted.files) &&
        hosted.files.length === 83 &&
        JSON.stringify(hosted.files.map((x) => x.path).sort()) ===
          JSON.stringify(served),
      "Hosted file inventory mismatch",
    );
    for (const row of hosted.files)
      must(
        row.sha256 === build.manifest[row.path].sha256 &&
          row.bytes === build.manifest[row.path].bytes,
        "Hosted file proof differs",
      );
    const metadata = hosted.consumedMetadata;
    must(
      metadata?.length === 1 &&
        metadata[0].path === "_headers" &&
        metadata[0].sha256 === build.manifest._headers.sha256 &&
        metadata[0].bytes === build.manifest._headers.bytes &&
        hosted.workerCacheVersion === build.workerCacheVersion,
      "Consumed header/worker evidence mismatch",
    );
    baseline = await providerPreflight(build, env, ports);
    if (baseline !== preview.baseline) {
      const error = Error(
        "Production changed since preview; no promotion write",
      );
      error.code = "PUBLIC_BASELINE_CHANGED";
      throw error;
    }
  }
  const p =
    "/accounts/" + target.accountId + "/pages/projects/" + target.project;
  if (preview) {
    const d = await ports.read(
      p + "/deployments/" + preview.deploymentId,
      env.CLOUDFLARE_API_TOKEN,
    );
    must(
      d.id === preview.deploymentId &&
        d.environment === "preview" &&
        d.latest_stage?.status === "success" &&
        d.deployment_trigger?.metadata?.commit_hash === build.sourceSha &&
        d.deployment_trigger?.metadata?.branch === preview.branch,
      "Preview provider binding changed",
    );
  }
  const branch =
    phase === "preview"
      ? "review-" + env.GITHUB_RUN_ID
      : target.productionBranch;
  const message =
    "Automatic verified public " +
    build.sourceSha +
    " run " +
    env.GITHUB_RUN_ID;
  await writeProof(
    resolve(dirname(proofPath), "operation-" + phase + ".json"),
    {
      phase,
      runId: env.GITHUB_RUN_ID,
      sourceSha: build.sourceSha,
      controlSha: build.controlSha,
      state: "write-intent",
      baseline,
    },
  );
  await currentSource(build, env, ports);
  await guardedWrite(
    async () => {
      const current = await ports.read(p, env.CLOUDFLARE_API_TOKEN);
      projectGuard(current, current.canonical_deployment?.id);
      if (current.canonical_deployment.id !== baseline) {
        const error = Error("Healthy production baseline changed before write");
        error.code = "PUBLIC_BASELINE_CHANGED";
        throw error;
      }
      return current;
    },
    baseline,
    () => {
      const child = {
        ...env,
        CLOUDFLARE_ACCOUNT_ID: target.accountId,
        CI: "true",
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_LOG_PATH: resolve(env.RUNNER_TEMP, "pages-auto-cli-logs"),
      };
      delete child.GH_TOKEN;
      delete child.GITHUB_TOKEN;
      try {
        ports.upload(
          process.execPath,
          [
            resolve(env.PAGES_CLI, "node_modules/wrangler/bin/wrangler.js"),
            "pages",
            "deploy",
            resolve(site),
            "--project-name=" + target.project,
            "--branch=" + branch,
            "--commit-hash=" + build.sourceSha,
            "--commit-message=" + message,
            "--commit-dirty=false",
          ],
          { env: child, stdio: "pipe" },
        );
      } catch {
        throw Error(
          "Upload outcome uncertain; inspect existing deployments before any retry",
        );
      }
    },
  );
  const list = await ports.read(
    p + "/deployments?per_page=20",
    env.CLOUDFLARE_API_TOKEN,
  );
  const matches = list.filter(
    (d) =>
      d.deployment_trigger?.metadata?.branch === branch &&
      d.deployment_trigger?.metadata?.commit_hash === build.sourceSha &&
      d.deployment_trigger?.metadata?.commit_message === message,
  );
  must(matches.length === 1, "Deployment outcome unconfirmed; do not retry");
  const d = matches[0];
  must(
    d.environment === (phase === "preview" ? "preview" : "production") &&
      d.latest_stage?.status === "success",
    "Deployment not confirmed successful",
  );
  const url = new URL(d.url);
  must(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^[a-z0-9-]+\.repformed\.pages\.dev$/.test(url.hostname) &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "Unexpected deployment URL",
  );
  if (phase === "promote")
    must(
      (await ports.read(p, env.CLOUDFLARE_API_TOKEN)).canonical_deployment
        ?.id === d.id,
      "Production pointer collision/unconfirmed; do not rollback",
    );
  const sourceCurrent = await currentSource(build, env, ports, true);
  const receipt = {
    sourceSuperseded: !sourceCurrent,
    phase,
    runId: env.GITHUB_RUN_ID,
    attempt: 1,
    workflowSha: env.GITHUB_SHA,
    controlSha: build.controlSha,
    sourceSha: build.sourceSha,
    sourceTree: build.sourceTree,
    manifestDigest: build.manifestDigest,
    workerCacheVersion: build.workerCacheVersion,
    baseline,
    deploymentId: d.id,
    branch,
    url: url.origin,
  };
  await writeProof(proofPath, receipt);
  await writeProof(
    resolve(dirname(proofPath), "operation-" + phase + ".json"),
    { ...receipt, state: "confirmed" },
  );
  if (env.GITHUB_OUTPUT)
    await appendFile(
      env.GITHUB_OUTPUT,
      "url=" +
        url.origin +
        "\nready=" +
        String(sourceCurrent) +
        "\nmanifest_digest=" +
        build.manifestDigest +
        "\n",
    );
  console.log(JSON.stringify(receipt));
}
async function main() {
  const [command, a, b, c, d, e] = process.argv.slice(2),
    env = process.env;
  autoGuard(env);
  must(
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim() === env.PUBLIC_CONTROL_SHA,
    "Pinned trusted controller checkout required",
  );
  if (command === "precheck" || command === "scope") {
    const result = await eligibility(
      resolve(a),
      env.PUBLIC_CONTROL_SHA,
      env.GITHUB_SHA,
      { syntax: command === "scope" },
    );
    if (b)
      await writeProof(b, {
        ...result,
        workflowSha: env.GITHUB_SHA,
        runId: env.GITHUB_RUN_ID,
        attempt: 1,
      });
    return;
  }
  if (command === "manifest") {
    const source = resolve(a);
    const scope = await eligibility(
      source,
      env.PUBLIC_CONTROL_SHA,
      env.GITHUB_SHA,
    );
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
      ],
      { cwd: source, stdio: "pipe" },
    );
    const result = await inspectSite(resolve(source, "dist"));
    await writeProof(b, {
      ...result,
      ...scope,
      workflowSha: env.GITHUB_SHA,
      runId: env.GITHUB_RUN_ID,
      attempt: 1,
    });
    return;
  }
  const build = await readJSON(a);
  boundBuild(build, env);
  if (command === "prepare") {
    const site = await inspectSite(resolve(b));
    must(
      site.manifestDigest === build.manifestDigest &&
        JSON.stringify(site.assets) === JSON.stringify(build.assets) &&
        site.workerCacheVersion === build.workerCacheVersion,
      "Downloaded artifact differs before credential step",
    );
    return;
  }
  if (command === "hosted") {
    const proof = await readJSON(b);
    proofGuard(proof, build, env);
    const result = await verifyBoundPreviewBytes(
      build,
      proof,
      { ...env, EXPECTED_PRODUCTION_ID: proof.baseline },
      globalThis.fetch,
      {
        sourceSha: build.sourceSha,
        controlSha: build.controlSha,
        guard: autoGuard,
        approved: build.manifest,
        template: await readFile(
          resolve(root, "build/service-worker.txt"),
          "utf8",
        ),
        assets: build.assets,
      },
    );
    await writeProof(c, {
      ...result.receipt,
      sourceTree: build.sourceTree,
      workflowSha: env.GITHUB_SHA,
      attempt: 1,
    });
    await writeFile(resolve(dirname(c), "hosted-sw.js"), result.worker);
    return;
  }
  if (command === "preview")
    await automaticDeploy("preview", resolve(b), build, resolve(c), env);
  else if (command === "promote")
    await automaticDeploy(
      "promote",
      resolve(b),
      build,
      resolve(c),
      env,
      await readJSON(d),
      await readJSON(e),
      await readJSON(resolve(dirname(e), "fixture-hosted.json")),
    );
  else throw Error("Unknown automatic stage");
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(async (error) => {
    const [command] = process.argv.slice(2);
    const message = String(error.message);
    if (knownNoWrite(error)) {
      await writeProof(resolve("proof", "no-write-" + command + ".json"), {
        stage: command,
        runId: process.env.GITHUB_RUN_ID,
        sourceSha: process.env.GITHUB_SHA,
        controlSha: process.env.PUBLIC_CONTROL_SHA,
        state: "confirmed-no-write",
        reason: message,
      });
      await writeProof(resolve("proof", "operation-" + command + ".json"), {
        stage: command,
        runId: process.env.GITHUB_RUN_ID,
        sourceSha: process.env.GITHUB_SHA,
        state: "confirmed-no-write",
        reason: message,
      });
      if (process.env.GITHUB_OUTPUT)
        await appendFile(process.env.GITHUB_OUTPUT, "ready=false\n");
      console.log(message);
      return;
    }
    try {
      await writeProof(resolve("proof", "failure-" + command + ".json"), {
        stage: command,
        runId: process.env.GITHUB_RUN_ID,
        sourceSha: process.env.GITHUB_SHA,
        state: /HTTP (401|403)/.test(message)
          ? "denied"
          : /uncertain|unconfirmed/.test(message)
            ? "uncertain"
            : "failed",
        message,
      });
    } catch {
      /* Job conclusion remains fail-closed evidence if artifact writing also fails. */
    }
    console.error(message);
    process.exitCode = 1;
  });
