import { test } from "node:test";
import assert from "node:assert/strict";
import { symlink } from "node:fs/promises";
import { resolve } from "node:path";
import {
  routedScope,
  frozenControls,
  routeAuthorization,
  revalidateAuthorization,
  validateUncredentialedRoute,
  docsContinuity,
  changedPaths,
} from "../pages-release-routing.mjs";
import { fixture } from "./routed-fixture.mjs";
test("public routing uses first-parent delta while all controls remain frozen", async () => {
  const f = await fixture();
  try {
    await f.put(
      "src/publicFeatures/Small.tsx",
      "export const Small=()=> <p>Example</p>;",
    );
    const selected = f.commit(),
      scope = await routedScope(f.dir, f.control, selected);
    assert.equal(scope.kind, "public-feature");
    assert.equal(scope.baselineSha, f.base);
    assert.equal(frozenControls(f.dir, f.control, selected).length, 2);
    await validateUncredentialedRoute(f.dir, {
      ...scope,
      authorization: { chain: [] },
      runId: "99",
      attempt: 1,
      workflowSha: selected,
    });
  } finally {
    await f.cleanup();
  }
});
test("dependency and documentation have distinct non-mixed routes", async () => {
  const f = await fixture();
  try {
    f.p.devDependencies.tool = "2.0.0";
    f.lock.packages[""].devDependencies.tool = "2.0.0";
    f.lock.packages["node_modules/tool"].version = "2.0.0";
    await f.put("package.json", JSON.stringify(f.p));
    await f.put("package-lock.json", JSON.stringify(f.lock));
    assert.equal(
      (await routedScope(f.dir, f.control, f.commit())).kind,
      "development-dependencies",
    );
    f.git(["reset", "--hard", f.base]);
    await f.put(
      "README.md",
      "Visit https://repformed.com/#contact\n## Published demo and deployment\nUnchanged deployment guidance\n",
    );
    assert.equal(
      (await routedScope(f.dir, f.control, f.commit())).kind,
      "reader-documentation",
    );
    f.git(["reset", "--hard", f.base]);
    await f.put(
      "README.md",
      "Visit https://repformed.com/#contact\n## Published demo and deployment\nUnchanged deployment guidance\n",
    );
    await f.put("src/Home.tsx", "export const Home=()=> <p>Changed</p>;");
    await assert.rejects(routedScope(f.dir, f.control, f.commit()), /Mixed/);
  } finally {
    await f.cleanup();
  }
});
test("intervening docs require immutable merge/head review and successful CI, including withdrawal", async () => {
  const f = await fixture();
  try {
    await f.put(
      "README.md",
      "Visit https://repformed.com/#contact\n## Published demo and deployment\nUnchanged deployment guidance\n",
    );
    const head = f.commit(),
      tree = f.git(["rev-parse", "HEAD^{tree}"]);
    f.git(["checkout", "-b", "main-fixture", f.base]);
    f.git([
      "-c",
      "user.name=Fictional local fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "merge",
      "--no-ff",
      "--no-edit",
      head,
    ]);
    const sourceSha = f.git(["rev-parse", "HEAD"]),
      repository = {
        id: 1430113496,
        full_name: "repformed/Player-Development-Site",
        owner: { id: 1, node_id: "owner-node" },
      };
    const pr = {
      number: 7,
      merged: true,
      merged_at: "2026-11-10T01:00:00Z",
      draft: false,
      merge_commit_sha: sourceSha,
      user: { id: 1 },
      base: { ref: "main", sha: f.base, repo: { id: repository.id } },
      head: {
        sha: head,
        repo: { full_name: repository.full_name, private: false },
      },
    };
    const record = {
      id: "review-node",
      state: "COMMENTED",
      authorId: "owner-node",
      commitSha: head,
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
        decision: "accept",
        reviewerKind: "independent-agent",
        reviewTask: "/root/reviewer",
      }),
    };
    const rest = async (p) =>
      p.endsWith("/pulls?per_page=100")
        ? [pr]
        : p.endsWith("/pulls/7")
          ? pr
          : p.includes("/reviews?")
            ? []
            : p.includes("/git/commits/")
              ? {
                  sha: p.split("/").at(-1),
                  tree: { sha: tree },
                  parents: [{ sha: f.base }, { sha: head }],
                }
              : repository;
    const graph = async () => ({
      repository: repository.full_name,
      ownerId: "owner-node",
      headSha: head,
      reviews: [record],
    });
    let checked = 0;
    const chain = await docsContinuity(
      f.dir,
      f.base,
      sourceSha,
      rest,
      graph,
      async (s) => {
        assert.equal(s, sourceSha);
        checked++;
      },
    );
    assert.equal(chain.length, 1);
    assert.equal(checked, 1);
    const scope = await routedScope(f.dir, f.control, sourceSha);
    const route = await routeAuthorization(f.dir, scope, rest, graph);
    await revalidateAuthorization(f.dir, route, rest, graph);
    await assert.rejects(
      revalidateAuthorization(
        f.dir,
        {
          ...route,
          authorization: {
            kind: "verified-bootstrap",
            sourceSha,
            sourceTree: tree,
          },
        },
        rest,
        graph,
      ),
      /authorization|anchor|subject/i,
    );
    pr.base.sha = "f".repeat(40);
    await assert.rejects(
      routeAuthorization(f.dir, scope, rest, graph),
      /parents/,
    );
    pr.base.sha = f.base;
    record.body = record.body.replace('"accept"', '"withdraw"');
    await assert.rejects(
      docsContinuity(f.dir, f.base, sourceSha, rest, graph, async () => {}),
      /withdrawn/,
    );
    record.body = record.body.replace('"withdraw"', '"accept"');
    await assert.rejects(
      docsContinuity(f.dir, f.base, sourceSha, rest, graph, async () => {
        throw Error("Required CI failed");
      }),
      /CI failed/,
    );
  } finally {
    await f.cleanup();
  }
});
for (const path of [
  "src/App.tsx",
  "src/auth/new.ts",
  "backend/new.sql",
  ".npmrc",
  "build/new.mjs",
  ".github/workflows/extra.yml",
  "scripts/extra.mjs",
  "public/_headers",
])
  test("cumulative protected change cannot be laundered: " + path, async () => {
    const f = await fixture();
    try {
      await f.put(path, "unpublished protected change");
      f.commit();
      await f.put("src/Home.tsx", "export const Home=()=> <p>Later words</p>;");
      await assert.rejects(
        routedScope(f.dir, f.control, f.commit()),
        /protected/,
      );
    } finally {
      await f.cleanup();
    }
  });
test("changed workflow pin, inherited runtime package or symlink fails closed", async () => {
  const f = await fixture();
  try {
    await f.put(
      ".github/workflows/repformed-auto-pages.yml",
      'env:\n  PUBLIC_CONTROL_SHA: "' + "f".repeat(40) + '"\n',
    );
    await assert.rejects(routedScope(f.dir, f.control, f.commit()), /pin/);
    f.git(["reset", "--hard", f.base]);
    f.p.dependencies.app = "2.0.0";
    await f.put("package.json", JSON.stringify(f.p));
    await assert.rejects(routedScope(f.dir, f.control, f.commit()), /runtime/);
    f.git(["reset", "--hard", f.base]);
    await symlink("Home.tsx", resolve(f.dir, "src/publicFeatures-link"));
    assert.throws(() => changedPaths(f.dir, f.base, f.commit()), /link/);
  } finally {
    await f.cleanup();
  }
});
test("unreviewed merge/code is rejected before any source parser or provider port", async () => {
  const f = await fixture();
  try {
    await f.put(
      "src/Home.tsx",
      "export const Home=()=> <p onClick={()=>0}>Changed</p>;",
    );
    const selected = f.commit(),
      scope = await routedScope(f.dir, f.control, selected);
    let provider = 0;
    const read = async (path) => {
      if (path.endsWith("/pulls?per_page=100")) return [];
      if (path.includes("/git/commits/"))
        return { sha: selected, tree: { sha: scope.sourceTree } };
      return { id: 1430113496, full_name: "repformed/Player-Development-Site" };
    };
    await assert.rejects(
      routeAuthorization(f.dir, scope, read, async () => {
        provider++;
        throw Error("must not reach provider");
      }),
      /authority/,
    );
    const route = {
      ...scope,
      authorization: {
        chain: [
          { parent: f.base, sourceSha: selected, changes: ["src/Home.tsx"] },
        ],
      },
    };
    await assert.rejects(
      validateUncredentialedRoute(f.dir, {
        ...route,
        runId: "1",
        attempt: 1,
        workflowSha: selected,
      }),
      /code|expressions|attributes/i,
    );
    assert.equal(provider, 0);
  } finally {
    await f.cleanup();
  }
});
test("overlapping public ancestors remain covered while unpublished dependencies cannot hitchhike", async () => {
  const f = await fixture();
  try {
    await f.put("src/Home.tsx", "export const Home=()=> <p>First words</p>;");
    const a = f.commit();
    const chain = await docsContinuity(
      f.dir,
      f.base,
      a,
      async () => {
        throw Error("No extra review port for covered public ancestor");
      },
      async () => {},
      async () => {},
      { allowPublic: true },
    );
    assert.equal(chain.length, 1);
    assert.equal(chain[0].coveredPublicAncestor, true);
    f.git(["reset", "--hard", f.base]);
    f.p.devDependencies.tool = "2.0.0";
    f.lock.packages[""].devDependencies.tool = "2.0.0";
    f.lock.packages["node_modules/tool"].version = "2.0.0";
    await f.put("package.json", JSON.stringify(f.p));
    await f.put("package-lock.json", JSON.stringify(f.lock));
    await assert.rejects(
      docsContinuity(
        f.dir,
        f.base,
        f.commit(),
        async () => {},
        async () => {},
        async () => {},
        { allowPublic: true },
      ),
      /documentation/,
    );
  } finally {
    await f.cleanup();
  }
});
