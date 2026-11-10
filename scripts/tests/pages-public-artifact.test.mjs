import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  writeFile,
  mkdtemp,
  cp,
  rm,
  symlink,
} from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import process from "node:process";
import { Buffer } from "node:buffer";
import { root } from "../pages-auto-scope.mjs";
import {
  publicBuildInputs,
  inspectPublicArtifact,
} from "../pages-public-artifact.mjs";
const h = (b) => createHash("sha256").update(b).digest("hex");
const blob = (b) =>
  createHash("sha1")
    .update("blob " + b.length + "\0")
    .update(b)
    .digest("hex");
async function fixture() {
  const source = process.env.PUBLIC_TEST_SOURCE || root,
    inputs = await publicBuildInputs(source),
    dir = await mkdtemp(resolve(tmpdir(), "public-dynamic-artifact-"));
  await cp(resolve(process.env.PUBLIC_TEST_SITE || resolve(source, "dist")), resolve(dir, "site"), { recursive: true });
  return { inputs, dir, site: resolve(dir, "site") };
}
test("deterministic compiler/copied-source inventory verifies the actual build", async () => {
  const f = await fixture();
  try {
    const r = await inspectPublicArtifact(f.site, f.inputs);
    assert.equal(r.servedFileCount, Object.keys(r.manifest).length - 1);
    assert.equal(r.manifestDigest, h(JSON.stringify(r.manifest)));
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});
test("reviewed new static asset and compiler chunk change runtime hashes without golden repinning", async () => {
  const f = await fixture();
  try {
    const old = await inspectPublicArtifact(f.site, f.inputs),
      svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0L1 1"/></svg>',
      );
    const name = "features/dynamic-fixture.svg";
    await (
      await import("node:fs/promises")
    ).mkdir(resolve(f.site, "features"), { recursive: true });
    await writeFile(resolve(f.site, name), svg);
    f.inputs.publicFiles[name] = {
      bytes: svg.length,
      sha256: h(svg),
      gitBlobSha: blob(svg),
    };
    const chunk = "assets/DynamicFixture-abc12345.js",
      code = Buffer.from("export const publicFixture = true;");
    await writeFile(resolve(f.site, chunk), code);
    f.inputs.compiler.generated[chunk] = {
      bytes: code.length,
      sha256: h(code),
    };
    const template = await readFile(
        resolve(root, "build/service-worker.txt"),
        "utf8",
      ),
      assets = [...f.inputs.compiler.precache, chunk],
      digest = createHash("sha256").update(template);
    for (const n of assets)
      digest.update(n).update(await readFile(resolve(f.site, n)));
    const version = digest.digest("hex").slice(0, 16),
      worker = Buffer.from(
        template
          .replace("__VERSION__", version)
          .replace("__ASSETS__", JSON.stringify(assets)),
      );
    await writeFile(resolve(f.site, "sw.js"), worker);
    f.inputs.compiler.precache = assets;
    f.inputs.compiler.worker = { bytes: worker.length, sha256: h(worker) };
    const actual = await inspectPublicArtifact(f.site, f.inputs);
    assert.equal(
      Object.keys(actual.manifest).length,
      Object.keys(old.manifest).length + 2,
    );
    assert.notEqual(actual.manifestDigest, old.manifestDigest);
    assert.notEqual(
      actual.manifest["sw.js"].sha256,
      old.manifest["sw.js"].sha256,
    );
    assert.equal(actual.manifest[name].sha256, h(svg));
  } finally {
    await rm(f.dir, { recursive: true, force: true });
  }
});
test("server executables, undeclared files, mutated copied bytes and symlinks fail", async () => {
  for (const mode of ["worker", "extra", "mutated", "link"]) {
    const f = await fixture();
    try {
      if (mode === "worker")
        await writeFile(resolve(f.site, "_worker.js"), "not allowed");
      if (mode === "extra")
        await writeFile(resolve(f.site, "unexpected.js"), "not declared");
      if (mode === "mutated")
        await writeFile(
          resolve(f.site, "robots.txt"),
          "changed without source",
        );
      if (mode === "link")
        await symlink(
          resolve(f.site, "robots.txt"),
          resolve(f.site, "linked.txt"),
        );
      await assert.rejects(inspectPublicArtifact(f.site, f.inputs));
    } finally {
      await rm(f.dir, { recursive: true, force: true });
    }
  }
});
test("header metadata and worker code cannot be changed as a public feature", async () => {
  for (const file of ["_headers", "sw.js"]) {
    const f = await fixture();
    try {
      await writeFile(resolve(f.site, file), "changed");
      await assert.rejects(inspectPublicArtifact(f.site, f.inputs));
    } finally {
      await rm(f.dir, { recursive: true, force: true });
    }
  }
});
