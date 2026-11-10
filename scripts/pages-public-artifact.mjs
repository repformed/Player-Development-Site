import { readFile, readdir, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { must, root } from "./pages-auto-scope.mjs";
import { treeInventory } from "./pages-public-inputs.mjs";
import { validateWorker } from "./pages-release.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const blobHash = (b) =>
  createHash("sha1")
    .update("blob " + b.length + "\0")
    .update(b)
    .digest("hex");
export const safeOutputName = (name) =>
  typeof name === "string" &&
  !name.startsWith("/") &&
  !/[\\?#]/.test(name) &&
  ![...name].some((c) => c.charCodeAt(0) < 32) &&
  !name
    .split("/")
    .some(
      (p) =>
        p === ".." ||
        p.startsWith(".") ||
        /^_(?:worker|routes|middleware|headers|redirects)(?:[._-]|$)/i.test(p),
    ) &&
  !/(?:^|\/)(?:functions|node_modules)\//i.test(name);
export async function publicBuildInputs(source) {
  const inventory = treeInventory(source, "HEAD");
  const publicFiles = {};
  for (const [path, row] of inventory) {
    if (!path.startsWith("public/")) continue;
    must(
      row.mode === "100644" && row.type === "blob",
      "Public copied files must be regular non-executable blobs",
    );
    const name = path.slice(7),
      bytes = await readFile(resolve(source, path));
    must(blobHash(bytes) === row.sha, "Git source blob mismatch");
    const current = await readFile(resolve(source, path));
    must(
      current.equals(bytes),
      "Public build input changed after source selection",
    );
    publicFiles[name] = {
      bytes: bytes.length,
      sha256: hash(bytes),
      gitBlobSha: row.sha,
    };
  }
  const observed = [];
  const walk = async (dir, prefix = "") => {
    for (const n of await readdir(dir)) {
      const full = resolve(dir, n),
        s = await lstat(full);
      must(!s.isSymbolicLink(), "Public input symlink forbidden");
      if (s.isDirectory()) await walk(full, prefix + n + "/");
      else {
        must(s.isFile(), "Regular public input required");
        observed.push(prefix + n);
      }
    }
  };
  await walk(resolve(source, "public"));
  must(
    JSON.stringify(observed.sort()) ===
      JSON.stringify(Object.keys(publicFiles).sort()),
    "Unexpected untracked public build input",
  );
  const compiler = JSON.parse(
    await readFile(
      resolve(source, "artifacts/public-compiler-inventory.json"),
      "utf8",
    ),
  );
  return { publicFiles, compiler };
}
export async function inspectPublicArtifact(site, inputs) {
  must(
    inputs?.compiler?.version === 1 && inputs.publicFiles,
    "Trusted compiler/source inventory required",
  );
  const stat = await lstat(site);
  must(
    stat.isDirectory() && !stat.isSymbolicLink(),
    "Real static directory required",
  );
  const files = new Map();
  const walk = async (dir, prefix = "") => {
    for (const n of (await readdir(dir)).sort()) {
      const p = resolve(dir, n),
        s = await lstat(p);
      must(!s.isSymbolicLink(), "Artifact symlink forbidden");
      if (s.isDirectory()) await walk(p, prefix + n + "/");
      else {
        must(s.isFile(), "Regular static output required");
        files.set(prefix + n, await readFile(p));
      }
    }
  };
  await walk(site);
  const generated = inputs.compiler.generated;
  must(new Set([...files.keys()].map(n=>n.toLowerCase())).size === files.size, "Case-normalized artifact path collision");
  must(
    generated && typeof generated === "object" && !Array.isArray(generated),
    "Compiler file inventory missing",
  );
  for (const name of Object.keys(generated))
    must(
      safeOutputName(name) &&
        (name === "index.html" ||
          /^assets\/[A-Za-z0-9_./-]+\.(?:js|css|woff2?|svg|png|jpe?g|webp|avif|gif)$/.test(
            name,
          )),
      "Unexpected compiler output path",
    );
  const expected = new Set([
    ...Object.keys(inputs.publicFiles),
    ...Object.keys(generated),
    "sw.js",
  ]);
  must(
    files.size === expected.size &&
      [...files.keys()].every((n) => expected.has(n)),
    "Static output does not equal reviewed public inputs plus compiler outputs",
  );
  for (const [name, bytes] of files) {
    if (name !== "_headers")
      must(
        safeOutputName(name),
        "Executable/reserved deployment output forbidden",
      );
    if (name === "sw.js") continue;
    const fromSource = inputs.publicFiles[name],
      fromCompiler = generated[name];
    must(!(fromSource && fromCompiler), "Public/compiler output collision");
    const record = fromSource || fromCompiler;
    must(
      record && record.bytes === bytes.length && record.sha256 === hash(bytes),
      "Static byte inventory differs: " + name,
    );
    if (fromSource)
      must(
        blobHash(bytes) === fromSource.gitBlobSha,
        "Copied public file differs from reviewed Git blob",
      );
  }
  const header = await readFile(resolve(root, "public/_headers"));
  must(
    files.get("_headers")?.equals(header),
    "Deployment header metadata changed",
  );
  const template = await readFile(
    resolve(root, "build/service-worker.txt"),
    "utf8",
  );
  must(
    hash(template) === inputs.compiler.templateSha256,
    "Worker template binding differs",
  );
  const oldAssets = JSON.parse(
    await readFile(
      resolve(root, ".github/pages-release/approved-sw-assets.json"),
      "utf8",
    ),
  );
  const fixedPublic = oldAssets.filter(
    (x) => x !== "index.html" && !x.startsWith("assets/"),
  );
  const precache = [
    ...Object.keys(generated).filter((n) =>
      /\.(?:html|js|css|woff2?)$/.test(n),
    ),
    ...fixedPublic,
  ].sort();
  const worker = files.get("sw.js");
  must(
    worker &&
      worker.length === inputs.compiler.worker.bytes &&
      hash(worker) === inputs.compiler.worker.sha256,
    "Worker compiler receipt differs",
  );
  validateWorker(worker.toString(), template, precache, files);
  const actual = JSON.parse(
    /const ASSETS = (\[.*?\])\.map/.exec(worker.toString())[1],
  );
  must(
    JSON.stringify(actual) === JSON.stringify(inputs.compiler.precache),
    "Worker ordered compiler evidence differs",
  );
  const manifest = Object.fromEntries(
    [...files]
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([name, b]) => [name, { bytes: b.length, sha256: hash(b) }]),
  );
  return {
    manifest,
    manifestDigest: hash(JSON.stringify(manifest)),
    assets: precache,
    workerCacheVersion: /\$\{PREFIX\}([a-f0-9]{16})/.exec(worker.toString())[1],
    servedFileCount: files.size - 1,
    inputInventory: inputs,
  };
}
