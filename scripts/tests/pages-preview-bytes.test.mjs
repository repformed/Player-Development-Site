import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { verifyPreviewBytes } from "../verify-pages-preview-bytes.mjs";
import { target } from "../pages-release.mjs";
const hash = (x) => createHash("sha256").update(x).digest("hex");
function fixture() {
  const template =
    "const CACHE = `${PREFIX}__VERSION__`;\nconst ASSETS = __ASSETS__.map((name) => name);\n";
  const html = Buffer.from("Public fixture HTML");
  const assets = ["index.html"];
  const version = createHash("sha256")
    .update(template)
    .update("index.html")
    .update(html)
    .digest("hex")
    .slice(0, 16);
  const worker = Buffer.from(
    template
      .replace("__VERSION__", version)
      .replace("__ASSETS__", JSON.stringify(assets)),
  );
  const files = new Map([
    ["index.html", html],
    ["sw.js", worker],
  ]);
  const manifest = Object.fromEntries(
    [...files].map(([n, b]) => [n, { bytes: b.length, sha256: hash(b) }]),
  );
  const digest = hash(JSON.stringify(manifest));
  const env = {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: target.repository,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: "a".repeat(40),
    GITHUB_RUN_ID: "42",
    CONFIRM_SOURCE_SHA: target.sourceSha,
    EXPECTED_PRODUCTION_ID: "00000000-0000-4000-8000-000000000002",
    DEMO_BASE_URL: "https://00000000.repformed.pages.dev",
  };
  const build = {
    sourceSha: target.sourceSha,
    manifest,
    manifestDigest: digest,
  };
  const preview = {
    sourceSha: target.sourceSha,
    controlSha: env.GITHUB_SHA,
    runId: "42",
    phase: "preview",
    baseline: env.EXPECTED_PRODUCTION_ID,
    manifestDigest: digest,
    branch: "review-42",
    deploymentId: "00000000-0000-4000-8000-000000000001",
    url: env.DEMO_BASE_URL,
  };
  const options = { approved: manifest, template, assets };
  let calls = 0;
  const fetcher = async (url, init) => {
    calls++;
    assert.equal(init.method, "GET");
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "manual");
    return new globalThis.Response(files.get(new URL(url).pathname.slice(1)), {
      status: 200,
    });
  };
  return { env, build, preview, options, fetcher, calls: () => calls, files };
}
test("in-memory hosted byte verification binds every file and valid worker to this run", async () => {
  const f = fixture();
  const r = await verifyPreviewBytes(
    f.build,
    f.preview,
    f.env,
    f.fetcher,
    f.options,
  );
  assert.equal(r.receipt.verifiedFiles, 2);
  assert.equal(r.receipt.manifestDigest, f.build.manifestDigest);
  assert.equal(f.calls(), 2);
});
test("changed hosted bytes fail rather than updating expected hashes", async () => {
  const f = fixture();
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return new globalThis.Response("changed bytes", { status: 200 });
  };
  await assert.rejects(
    verifyPreviewBytes(f.build, f.preview, f.env, fetcher, f.options),
    /Hosted artifact differs/,
  );
  assert.equal(calls, 1);
});
test("HTTP denial stops without retry or alternate host", async () => {
  const f = fixture();
  let calls = 0;
  await assert.rejects(
    verifyPreviewBytes(
      f.build,
      f.preview,
      f.env,
      async () => {
        calls++;
        return new globalThis.Response("", { status: 403 });
      },
      f.options,
    ),
    /403/,
  );
  assert.equal(calls, 1);
});
test("foreign redirect is never followed", async () => {
  const f = fixture();
  let calls = 0;
  await assert.rejects(
    verifyPreviewBytes(
      f.build,
      f.preview,
      f.env,
      async () => {
        calls++;
        return new globalThis.Response("", {
          status: 308,
          headers: { location: "https://foreign.invalid/" },
        });
      },
      f.options,
    ),
    /Cross-origin/,
  );
  assert.equal(calls, 1);
});
test("mismatched preview identity fails before any fetch", async () => {
  const f = fixture();
  await assert.rejects(
    verifyPreviewBytes(
      f.build,
      { ...f.preview, controlSha: "b".repeat(40) },
      f.env,
      f.fetcher,
      f.options,
    ),
    /identity/,
  );
  assert.equal(f.calls(), 0);
});
test("same-origin canonical HTML redirect keeps exact file hashing", async () => {
  const f = fixture();
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    const path = new URL(url).pathname;
    if (path === "/index.html")
      return new globalThis.Response("", {
        status: 308,
        headers: { location: "/" },
      });
    return new globalThis.Response(
      f.files.get(path === "/" ? "index.html" : path.slice(1)),
      { status: 200 },
    );
  };
  const result = await verifyPreviewBytes(
    f.build,
    f.preview,
    f.env,
    fetcher,
    f.options,
  );
  assert.equal(result.receipt.verifiedFiles, 2);
  assert.equal(calls, 3);
});
function headerFixture() {
  const f = fixture();
  const headers = Buffer.from(
    "/index.html\n  X-Content-Type-Options: nosniff\n",
  );
  f.build.manifest._headers = { bytes: headers.length, sha256: hash(headers) };
  f.build.manifestDigest = hash(JSON.stringify(f.build.manifest));
  f.preview.manifestDigest = f.build.manifestDigest;
  f.options.headers = headers;
  return f;
}
test("consumed _headers is locally bound and never fetched; effective target headers verified", async () => {
  const f = headerFixture();
  const paths = [];
  const result = await verifyPreviewBytes(
    f.build,
    f.preview,
    f.env,
    async (url) => {
      const path = new URL(url).pathname.slice(1);
      paths.push(path);
      assert.notEqual(path, "_headers");
      return new globalThis.Response(f.files.get(path), {
        status: 200,
        headers: { "X-Content-Type-Options": "nosniff" },
      });
    },
    f.options,
  );
  assert.equal(result.receipt.verifiedFiles, 2);
  assert.equal(result.receipt.consumedMetadata.length, 1);
  assert.equal(
    result.receipt.consumedMetadata[0].sha256,
    f.build.manifest._headers.sha256,
  );
  assert.deepEqual(paths, ["index.html", "sw.js"]);
});
test("missing configured response header blocks hosted acceptance", async () => {
  const f = headerFixture();
  await assert.rejects(
    verifyPreviewBytes(f.build, f.preview, f.env, f.fetcher, f.options),
    /Hosted configured header differs/,
  );
});
test("changed consumed metadata fails before fetching", async () => {
  const f = headerFixture();
  f.options.headers = Buffer.from("changed");
  await assert.rejects(
    verifyPreviewBytes(f.build, f.preview, f.env, f.fetcher, f.options),
    /Unapproved consumed header metadata/,
  );
  assert.equal(f.calls(), 0);
});
