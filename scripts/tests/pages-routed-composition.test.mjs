import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fixture } from "./routed-fixture.mjs";
import { root } from "../pages-auto-scope.mjs";
import { routedScope, routeAuthorization } from "../pages-release-routing.mjs";
import { routedProviderOperation } from "../pages-routed-release.mjs";
import { baselineIdentity } from "../pages-release-baseline.mjs";
import {
  publicBuildInputs,
  inspectPublicArtifact,
} from "../pages-public-artifact.mjs";
const hash = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
async function composition() {
  const f = await fixture(true);
  await f.put(
    "src/publicFeatures/Example.tsx",
    "export const Example=()=> <p>Fictional example</p>;",
  );
  const head = f.commit(),
    tree = f.git(["rev-parse", "HEAD^{tree}"]);
  f.git(["checkout", "-b", "main-fixture", f.base]);
  f.git([
    "-c",
    "user.name=Fictional fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "merge",
    "--no-ff",
    "--no-edit",
    head,
  ]);
  const sha = f.git(["rev-parse", "HEAD"]);
  const repository = {
    id: 1430113496,
    full_name: "repformed/Player-Development-Site",
    owner: { id: 1, node_id: "owner-node" },
  };
  const pr = {
    number: 7,
    merged: true,
    merged_at: "2026-11-10T01:00:00Z",
    draft: false,
    merge_commit_sha: sha,
    user: { id: 1 },
    base: { ref: "main", sha: f.base, repo: { id: repository.id } },
    head: {
      sha: head,
      repo: { full_name: repository.full_name, private: false },
    },
  };
  let withdrawn = false,
    currentMain = sha,
    canonical = "00000000-0000-4000-8000-000000000001",
    uploads = 0;
  const baseline = canonical,
    deployments = [];
  const record = () => ({
    id: "review-node",
    state: "COMMENTED",
    author: { id: "owner-node" },
    commit: { oid: head },
    submittedAt: "2026-11-10T01:00:00Z",
    updatedAt: "2026-11-10T01:00:00Z",
    lastEditedAt: null,
    includesCreatedEdit: false,
    isMinimized: false,
    body: JSON.stringify({
      protocol: "repformed-public-review/v1",
      repositoryId: repository.id,
      pullRequest: 7,
      commit: head,
      tree,
      decision: withdrawn ? "reject" : "accept",
      reviewerKind: "independent-agent",
      reviewTask: "/root/fictional_reviewer",
    }),
  });
  const project = () => ({
    name: "repformed",
    production_branch: "main",
    domains: ["repformed.com", "repformed.pages.dev"],
    canonical_deployment: {
      id: canonical,
      environment: "production",
      latest_stage: { status: "success" },
      deployment_trigger: {
        metadata: { commit_hash: f.base, branch: "main", commit_dirty: false },
      },
    },
  });
  const read = async (p) => {
    if (p.includes("/actions/workflows/")) return { workflow_runs: [] };
    if (p.endsWith("/git/ref/heads/main"))
      return { object: { sha: currentMain } };
    if (p.includes("/compare/")) return { status: "ahead" };
    if (p.includes("/git/commits/"))
      return {
        sha: p.split("/").at(-1),
        tree: { sha: tree },
        parents: [{ sha: f.base }, { sha: head }],
      };
    if (p.endsWith("/pulls?per_page=100")) return [pr];
    if (p.endsWith("/pulls/7")) return pr;
    if (p.includes("/reviews?")) return [];
    if (p.includes("/deployments?")) return deployments;
    if (p.includes("/deployments/"))
      return deployments.find((x) => p.endsWith("/" + x.id));
    if (p.includes("/pages/projects/")) return project();
    if (p === "/repos/repformed/Player-Development-Site") return repository;
    throw Error("Unexpected fictional read " + p);
  };
  const fetch = async (url) => {
    assert.equal(url, "https://api.github.com/graphql");
    return {
      ok: true,
      json: async () => ({
        data: {
          repository: {
            nameWithOwner: repository.full_name,
            owner: { id: "owner-node" },
            pullRequest: {
              headRefOid: head,
              reviews: {
                nodes: [record()],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      }),
    };
  };
  const graph = async () => ({
    repository: repository.full_name,
    ownerId: "owner-node",
    headSha: head,
    reviews: [{ ...record(), authorId: "owner-node", commitSha: head }],
  });
  const route = {
    ...(await routeAuthorization(
      f.dir,
      await routedScope(f.dir, f.control, sha),
      read,
      graph,
    )),
    runId: "99",
    attempt: 1,
    workflowSha: sha,
  };
  const env = {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: repository.full_name,
    GITHUB_WORKFLOW: "Repformed automatic public release",
    GITHUB_SHA: sha,
    PUBLIC_AUTO_SOURCE_SHA: sha,
    PUBLIC_CONTROL_SHA: f.control,
    GITHUB_RUN_ID: "99",
    GITHUB_RUN_ATTEMPT: "1",
    GH_TOKEN: "fictional-local-only",
    RUNNER_TEMP: f.dir,
    PAGES_CLI: "/fictional/never-executed",
  };
  const context = {
    identity: await baselineIdentity(project(), read, false),
    documentChain: [],
  };
  const site = resolve(process.env.PUBLIC_TEST_SITE || resolve(root, "dist"));
  const compiled = await inspectPublicArtifact(
    site,
    await publicBuildInputs(process.env.PUBLIC_TEST_SOURCE || root),
  );
  const build = {
    ...compiled,
    ...route,
    releaseKind: route.kind,
    baselineIdentity: context.identity,
    routeDigest: hash(route),
    baselineDigest: hash(context),
    expectedHostedCases: JSON.parse(
      await readFile(
        resolve(root, ".github/pages-release/public-baseline-cases.json"),
      ),
    ).hosted,
  };
  const ports = {
    read,
    fetch,
    upload: (_exe, args, options) => {
      assert.equal(options.env.GH_TOKEN, undefined);
      uploads++;
      const branch = args.find((x) => x.startsWith("--branch=")).slice(9),
        id = "00000000-0000-4000-8000-" + String(uploads + 1).padStart(12, "0");
      deployments.push({
        id,
        url: "https://fixture-" + uploads + ".repformed.pages.dev",
        environment: branch === "main" ? "production" : "preview",
        latest_stage: { status: "success" },
        deployment_trigger: {
          metadata: {
            branch,
            commit_hash: sha,
            commit_message: args
              .find((x) => x.startsWith("--commit-message="))
              .slice(17),
          },
        },
      });
      if (branch === "main") canonical = id;
    },
  };
  return {
    f,
    route,
    context,
    build,
    site,
    env,
    ports,
    baseline,
    get uploads() {
      return uploads;
    },
    withdraw: () => (withdrawn = true),
    supersede: () => (currentMain = "f".repeat(40)),
    drift: () => (canonical = "00000000-0000-4000-8000-000000000099"),
  };
}
test("complete routed wrapper previews then promotes identical bytes through fictional ports", async () => {
  const c = await composition();
  try {
    const previewPath = resolve(c.f.dir, "proof/preview.json");
    await routedProviderOperation(
      "preview",
      c.f.dir,
      c.route,
      c.context,
      c.build,
      c.site,
      "unused",
      c.env,
      { output: previewPath },
      c.ports,
    );
    assert.equal(c.uploads, 1);
    const preview = JSON.parse(await readFile(previewPath));
    const hosted = {
      phase: "verified-preview",
      sourceSha: c.build.sourceSha,
      sourceTree: c.build.sourceTree,
      controlSha: c.build.controlSha,
      workflowSha: c.env.GITHUB_SHA,
      runId: "99",
      attempt: 1,
      deploymentId: preview.deploymentId,
      manifestDigest: c.build.manifestDigest,
      verifiedFiles: c.build.servedFileCount,
      workerSha256: c.build.manifest["sw.js"].sha256,
      workerCacheVersion: c.build.workerCacheVersion,
      files: Object.entries(c.build.manifest)
        .filter(([p]) => p !== "_headers")
        .map(([path, m]) => ({ path, ...m })),
      consumedMetadata: [{ path: "_headers", ...c.build.manifest._headers }],
    };
    const fixtureProof = {
      sourceSha: c.build.sourceSha,
      sourceTree: c.build.sourceTree,
      controlSha: c.build.controlSha,
      runId: "99",
      attempt: 1,
      suite: "hosted",
      caseKeys: c.build.expectedHostedCases,
      cases: c.build.expectedHostedCases.length,
      passed: c.build.expectedHostedCases.length,
      failed: 0,
      skipped: 0,
      retries: 0,
      forwarded_upstream: 0,
    };
    await routedProviderOperation(
      "promote",
      c.f.dir,
      c.route,
      c.context,
      c.build,
      c.site,
      "unused",
      c.env,
      {
        output: resolve(c.f.dir, "proof/production.json"),
        preview,
        hosted,
        fixture: fixtureProof,
      },
      c.ports,
    );
    assert.equal(c.uploads, 2);
  } finally {
    await c.f.cleanup();
  }
});
for (const mode of ["withdraw", "supersede", "drift"])
  test("routed composition rejects " + mode + " before upload", async () => {
    const c = await composition();
    try {
      c[mode]();
      await assert.rejects(
        routedProviderOperation(
          "preview",
          c.f.dir,
          c.route,
          c.context,
          c.build,
          c.site,
          "unused",
          c.env,
          { output: resolve(c.f.dir, "proof/rejected.json") },
          c.ports,
        ),
        mode === "withdraw"
          ? /withdrawn or not accepted/
          : (error) =>
              error.code ===
              (mode === "supersede"
                ? "PUBLIC_SUPERSEDED"
                : "PUBLIC_BASELINE_CHANGED"),
      );
      assert.equal(c.uploads, 0);
    } finally {
      await c.f.cleanup();
    }
  });
