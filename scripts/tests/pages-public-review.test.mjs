import { test } from "node:test";
import assert from "node:assert/strict";
import { exactReviewedTree, readExactReview } from "../pages-public-review.mjs";
function fixture() {
  const h = "a".repeat(40),
    s = "b".repeat(40),
    tree = "c".repeat(40);
  return {
    repository: {
      id: 1430113496,
      full_name: "repformed/Player-Development-Site",
      owner: { id: 10 },
    },
    source: { sha: s, tree: { sha: tree } },
    head: { sha: h, tree: { sha: tree } },
    pr: {
      number: 1,
      merged: true,
      draft: false,
      merge_commit_sha: s,
      user: { id: 20 },
      base: { ref: "main", repo: { id: 1430113496 } },
      head: { sha: h },
    },
    reviews: [
      {
        id: 30,
        user: { id: 10 },
        state: "APPROVED",
        commit_id: h,
        submitted_at: "2026-11-10T00:00:00Z",
      },
    ],
    permissions: new Map(),
  };
}
test("current independent owner approval binds exact merged source/tree, not merely same names", () => {
  const f = fixture();
  const p = exactReviewedTree(f);
  assert.equal(p.reviewedTree, f.source.tree.sha);
  assert.notEqual(p.reviewerId, p.authorId);
  assert.equal(p.sourceSha, f.source.sha);
});
test("self, stale, dismissed, pending or changed head approval cannot authorize", () => {
  for (const change of ["self", "stale", "dismissed", "pending", "head"]) {
    const f = fixture();
    if (change === "self") f.pr.user.id = 10;
    if (change === "stale") f.reviews[0].commit_id = "d".repeat(40);
    if (change === "dismissed") f.reviews[0].state = "DISMISSED";
    if (change === "pending") f.reviews[0].state = "PENDING";
    if (change === "head") f.head.tree.sha = "d".repeat(40);
    assert.throws(() => exactReviewedTree(f));
  }
});
test("changed merge context or unrelated matching-tree PR is rejected", () => {
  for (const change of ["tree", "source", "repo", "draft", "open"]) {
    const f = fixture();
    if (change === "tree") f.source.tree.sha = "d".repeat(40);
    if (change === "source") f.pr.merge_commit_sha = "d".repeat(40);
    if (change === "repo") f.pr.base.repo.id = 1;
    if (change === "draft") f.pr.draft = true;
    if (change === "open") f.pr.merged = false;
    assert.throws(() => exactReviewedTree(f));
  }
});
test("current write collaborator can review; revoked role, reused login and read-only cannot", () => {
  const f = fixture();
  f.reviews[0].user = { id: 40 };
  f.permissions.set("40", { permission: "write", user: { id: 40 } });
  assert.doesNotThrow(() => exactReviewedTree(f));
  for (const permission of [
    { permission: "read", user: { id: 40 } },
    { permission: "write", user: { id: 41 } },
    { permission: "none", user: { id: 40 } },
  ]) {
    f.permissions.set("40", permission);
    assert.throws(() => exactReviewedTree(f));
  }
});
test("later decisive changes request/dismissal revokes approval; comments do not synthesize it", () => {
  for (const state of ["CHANGES_REQUESTED", "DISMISSED"]) {
    const f = fixture();
    f.reviews.push({
      ...f.reviews[0],
      id: 31,
      state,
      submitted_at: "2026-11-10T00:01:00Z",
    });
    assert.throws(() => exactReviewedTree(f));
  }
  const f = fixture();
  f.reviews.push({
    ...f.reviews[0],
    id: 31,
    state: "COMMENTED",
    submitted_at: "2026-11-10T00:01:00Z",
  });
  assert.doesNotThrow(() => exactReviewedTree(f));
});
test("an outstanding authorized changes request blocks a second approval", () => {
  const f = fixture();
  f.reviews.push({
    id: 31,
    user: { id: 40 },
    state: "CHANGES_REQUESTED",
    commit_id: "d".repeat(40),
    submitted_at: "2026-11-10T00:00:01Z",
  });
  f.permissions.set("40", { permission: "write", user: { id: 40 } });
  assert.throws(() => exactReviewedTree(f), /Outstanding/);
});
test("review API denial stops immediately without identity or unauthenticated fallback", async () => {
  let calls = 0;
  await assert.rejects(
    readExactReview("b".repeat(40), async () => {
      calls++;
      throw Error("Synthetic HTTP403");
    }),
    /403/,
  );
  assert.equal(calls, 3);
});
test("missing immutable identity or invalid review time cannot authorize", () => {
  for (const change of ["author", "owner", "review", "reviewer", "time"]) {
    const f = fixture();
    if (change === "author") delete f.pr.user.id;
    if (change === "owner") delete f.repository.owner.id;
    if (change === "review") delete f.reviews[0].id;
    if (change === "reviewer") delete f.reviews[0].user.id;
    if (change === "time") f.reviews[0].submitted_at = "invalid";
    assert.throws(() => exactReviewedTree(f));
  }
});
test("reader assembles current exact approved tree and paginates reviews without replay", async () => {
  const f = fixture(),
    calls = [];
  f.pr.head.repo = {
    full_name: "repformed/Player-Development-Site",
    private: false,
  };
  const read = async (path) => {
    calls.push(path);
    if (path.endsWith("/commits/" + f.source.sha + "/pulls?per_page=100"))
      return [
        {
          number: 1,
          merged_at: "2026-11-10T00:01:00Z",
          merge_commit_sha: f.source.sha,
        },
      ];
    if (path.endsWith("/git/commits/" + f.source.sha)) return f.source;
    if (path.endsWith("/git/commits/" + f.head.sha)) return f.head;
    if (path.endsWith("/pulls/1")) return f.pr;
    if (path.includes("/reviews?") && path.endsWith("page=1"))
      return Array.from({ length: 100 }, (_, i) => ({
        id: 1000 + i,
        user: { id: 10 },
        state: "COMMENTED",
        commit_id: f.head.sha,
        submitted_at: "2026-11-10T00:00:00Z",
      }));
    if (path.includes("/reviews?") && path.endsWith("page=2")) return f.reviews;
    if (path === "/repos/repformed/Player-Development-Site")
      return f.repository;
    throw Error("Unexpected local reader path");
  };
  const result = await readExactReview(f.source.sha, read);
  assert.equal(result.reviewId, 30);
  assert.equal(calls.filter((x) => x.includes("/reviews?")).length, 2);
  assert.equal(new Set(calls).size, calls.length);
});
test("no merged association returns no review and an ambiguous one is rejected", async () => {
  const f = fixture();
  const reader = (rows) => async (path) =>
    path.includes("/pulls?")
      ? rows
      : path.endsWith("/git/commits/" + f.source.sha)
        ? f.source
        : f.repository;
  assert.equal(await readExactReview(f.source.sha, reader([])), null);
  await assert.rejects(
    readExactReview(
      f.source.sha,
      reader(
        [1, 2].map((number) => ({
          number,
          merged_at: "now",
          merge_commit_sha: f.source.sha,
        })),
      ),
    ),
    /Ambiguous/,
  );
});
