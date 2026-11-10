import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  sourceAuthorization,
  sameSourceAuthorization,
} from "../pages-public-evidence.mjs";
async function history(fn) {
  const dir = await mkdtemp(join(tmpdir(), "public-reviewed-history-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  try {
    git("init", "-q");
    const commits = [];
    for (let i = 0; i < 3; i++) {
      await writeFile(join(dir, "public.txt"), String(i));
      git("add", "public.txt");
      git(
        "-c",
        "user.name=Local Fixture",
        "-c",
        "user.email=fixture@invalid.example",
        "commit",
        "-qm",
        "Synthetic local change",
      );
      commits.push(git("rev-parse", "HEAD"));
    }
    await fn(dir, commits, git);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const accepted = (sha, tree) => ({
  kind: "merged-public-pr",
  sourceSha: sha,
  sourceTree: tree,
  reviewId: 1,
  reviewedHead: sha,
  reviewedTree: tree,
  reviewerId: "2",
  reviewSubmittedAt: "2026-11-10T00:00:00Z",
});
test("later narrow changes anchor to exact reviewed feature source, without controller repinning", () =>
  history(async (dir, [a, b, c], git) => {
    const traversed = [];
    const p = await sourceAuthorization(dir, c, null, null, {
      review: async (s) =>
        s === b ? accepted(b, git("rev-parse", b + "^{tree}")) : null,
      delta: async (_, before, after) => {
        traversed.push([before, after]);
        return ["public.txt"];
      },
    });
    assert.equal(p.sourceSha, c);
    assert.equal(p.anchor.sourceSha, b);
    assert.deepEqual(traversed, [[b, c]]);
    assert.equal(p.chain.length, 1);
    assert.notEqual(a, b);
  }));
test("unreviewed code cannot be laundered by later narrow changes", () =>
  history(async (dir, [a, , c]) => {
    await assert.rejects(
      sourceAuthorization(dir, c, null, null, {
        review: async () => null,
        delta: async (_, before) => {
          if (before === a) throw Error("Code change needs exact review");
          return [];
        },
      }),
      /Code change/,
    );
  }));
test("review read denial stops traversal rather than falling back to narrow trust", () =>
  history(async (dir, [, , c]) => {
    let deltas = 0;
    await assert.rejects(
      sourceAuthorization(dir, c, null, null, {
        review: async () => {
          throw Error("HTTP 403");
        },
        delta: async () => {
          deltas++;
          return [];
        },
      }),
      /403/,
    );
    assert.equal(deltas, 0);
  }));
test("bounded trust chain fails closed and review replacement/revocation fails revalidation", () =>
  history(async (dir, [, , c]) => {
    await assert.rejects(
      sourceAuthorization(dir, c, null, null, {
        maxDepth: 0,
        review: async () => null,
        delta: async () => [],
      }),
      /bounded/,
    );
    const a = accepted(c, "c".repeat(40));
    assert.doesNotThrow(() => sameSourceAuthorization(a, { ...a }));
    assert.throws(
      () => sameSourceAuthorization(a, { ...a, reviewId: 2 }),
      /review changed/,
    );
  }));
