import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ownerAttestation,
  sameAttestation,
  readOwnerReviews,
  protocol,
} from "../pages-owner-attestation.mjs";
function fixture() {
  const h = "a".repeat(40),
    s = "b".repeat(40),
    tree = "c".repeat(40);
  const body = {
    protocol,
    repositoryId: 1430113496,
    pullRequest: 1,
    commit: h,
    tree,
    decision: "accept",
    reviewerKind: "independent-agent",
    reviewTask: "/root/independent_review",
  };
  const record = {
    id: "PRR_fixture",
    authorId: "OWNER_node",
    state: "COMMENTED",
    commitSha: h,
    body: JSON.stringify(body),
    submittedAt: "2026-11-10T00:00:00Z",
    updatedAt: "2026-11-10T00:00:00Z",
    lastEditedAt: null,
    includesCreatedEdit: false,
    isMinimized: false,
  };
  return {
    repository: {
      id: 1430113496,
      full_name: "repformed/Player-Development-Site",
      owner: { id: 10, node_id: "OWNER_node" },
    },
    source: { sha: s, tree: { sha: tree } },
    pr: {
      number: 1,
      user: { id: 10 },
      merged: true,
      draft: false,
      merge_commit_sha: s,
      base: { ref: "main", repo: { id: 1430113496 } },
      head: { sha: h },
    },
    head: { sha: h, tree: { sha: tree } },
    graph: {
      repository: "repformed/Player-Development-Site",
      ownerId: "OWNER_node",
      headSha: h,
      reviews: [record],
    },
    body,
  };
}
test("same intended owner account can record real independent agent review without claiming GitHub approval", () => {
  const f = fixture();
  const p = ownerAttestation(f);
  assert.equal(p.kind, "owner-attested-independent-agent");
  assert.match(p.meaning, /not GitHub non-author/);
});
test("unrelated author, edited, minimized, stale, malformed or synthetic subject records fail", () => {
  for (const mode of [
    "author",
    "edited",
    "minimized",
    "stale",
    "malformed",
    "tree",
    "kind",
  ]) {
    const f = fixture(),
      r = f.graph.reviews[0];
    if (mode === "author") r.authorId = "OTHER";
    if (mode === "edited") r.lastEditedAt = "2026-11-10T00:01:00Z";
    if (mode === "minimized") r.isMinimized = true;
    if (mode === "stale") r.commitSha = "d".repeat(40);
    if (mode === "malformed") r.body = "{" + protocol;
    if (mode === "tree") f.source.tree.sha = "d".repeat(40);
    if (mode === "kind") {
      f.body.reviewerKind = "self";
      r.body = JSON.stringify(f.body);
    }
    assert.throws(() => ownerAttestation(f));
  }
});
test("latest owner withdrawal wins, including over an earlier valid acceptance", () => {
  const f = fixture();
  f.graph.reviews.push({
    ...f.graph.reviews[0],
    id: "PRR_later",
    body: JSON.stringify({ ...f.body, decision: "withdraw" }),
    submittedAt: "2026-11-10T00:01:00Z",
    updatedAt: "2026-11-10T00:01:00Z",
  });
  assert.throws(() => ownerAttestation(f), /withdrawn/);
});
test("exact record revalidation rejects replacement or deletion fallback", () => {
  const f = fixture(),
    p = ownerAttestation(f);
  assert.doesNotThrow(() => sameAttestation(p, { ...p }));
  for (const x of [
    { reviewNodeId: "different" },
    { bodySha256: "changed" },
    { ownerNodeId: "other" },
    { reviewedTree: "d".repeat(40) },
  ])
    assert.throws(() => sameAttestation(p, { ...p, ...x }));
});
test("GraphQL reader uses one authenticated read and exposes no mutation or fallback", async () => {
  let calls = 0;
  const result = await readOwnerReviews(
    1,
    "fictional-local-only",
    async (url, init) => {
      calls++;
      assert.equal(url, "https://api.github.com/graphql");
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "error");
      assert.doesNotMatch(JSON.parse(init.body).query, /mutation/);
      return new globalThis.Response(
        JSON.stringify({
          data: {
            repository: {
              nameWithOwner: "repformed/Player-Development-Site",
              owner: { id: "OWNER_node" },
              pullRequest: {
                headRefOid: "a".repeat(40),
                reviews: {
                  nodes: [],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          },
        }),
        { status: 200 },
      );
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.ownerId, "OWNER_node");
  let denied = 0;
  await assert.rejects(
    readOwnerReviews(1, "fictional-local-only", async () => {
      denied++;
      return new globalThis.Response("", { status: 403 });
    }),
    /403/,
  );
  assert.equal(denied, 1);
});
