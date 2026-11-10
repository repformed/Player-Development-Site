import { execFileSync } from "node:child_process";
import console from "node:console";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assertDeploymentIdentity,
  assertPublishingRepository,
} from "./deployment-identity.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (args, extraEnv = {}) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
const releaseDir = mkdtempSync(join(tmpdir(), "player-development-pages-"));
try {
  if (git(["status", "--porcelain"]).trim())
    throw new Error("Commit source changes before publishing.");
  assertPublishingRepository(git(["remote", "get-url", "origin"]).trim());
  const dist = join(root, "dist");
  assertDeploymentIdentity(readFileSync(join(dist, "index.html"), "utf8"));
  writeFileSync(join(dist, ".nojekyll"), "");
  // Use an isolated index; never switch branches or change the source checkout.
  const indexEnv = { GIT_INDEX_FILE: join(releaseDir, "index") };
  git(["fetch", "origin", "gh-pages"]);
  const parent = git(["rev-parse", "FETCH_HEAD"]).trim();
  git(["read-tree", "--empty"], indexEnv);
  git([`--work-tree=${dist}`, "add", "--all"], indexEnv);
  const tree = git(["write-tree"], indexEnv).trim();
  const commit = git([
    "commit-tree",
    tree,
    "-p",
    parent,
    "-m",
    "Publish Player Development demo",
  ]).trim();
  // A normal push rejects concurrent remote changes; never force a deployment.
  git(["push", "origin", `${commit}:refs/heads/gh-pages`]);
  const remote = git(["ls-remote", "origin", "refs/heads/gh-pages"]).split(
    /\s+/,
  )[0];
  if (remote !== commit)
    throw new Error("Remote publishing branch could not be verified.");
  console.log(`Static publishing branch updated to ${commit}.`);
  console.log(
    "Check GitHub Pages deployment status and verify the public URL before reporting it live.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Pages publishing failed.",
  );
  process.exitCode = 1;
} finally {
  rmSync(releaseDir, { recursive: true, force: true });
}
