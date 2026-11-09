import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { TextDecoder } from "node:util";
import { target, dispatchGuard, validateWorker } from "./pages-release.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const must = (ok, message) => {
  if (!ok) throw Error(message);
};
export async function verifyPreviewBytes(
  build,
  preview,
  env,
  fetcher = globalThis.fetch,
  fixtures = {},
) {
  dispatchGuard(env);
  must(
    build.sourceSha === target.sourceSha &&
      preview.sourceSha === target.sourceSha &&
      preview.controlSha === env.GITHUB_SHA &&
      preview.runId === env.GITHUB_RUN_ID &&
      preview.phase === "preview" &&
      preview.baseline === env.EXPECTED_PRODUCTION_ID &&
      preview.branch === `review-${env.GITHUB_RUN_ID}` &&
      /^[a-f0-9-]{36}$/.test(preview.deploymentId || "") &&
      preview.manifestDigest === build.manifestDigest,
    "Preview/build identity mismatch",
  );
  must(
    sha(JSON.stringify(build.manifest)) === build.manifestDigest,
    "Invalid build manifest digest",
  );
  const origin = new URL(preview.url);
  must(
    origin.protocol === "https:" &&
      !origin.username &&
      !origin.password &&
      !origin.port &&
      /^[a-z0-9-]+\.repformed\.pages\.dev$/.test(origin.hostname) &&
      origin.pathname === "/" &&
      !origin.search &&
      !origin.hash &&
      env.DEMO_BASE_URL === origin.origin,
    "Unexpected preview origin",
  );
  const approved =
    fixtures.approved ||
    JSON.parse(
      await readFile(
        resolve(root, ".github/pages-release/approved-manifest.json"),
      ),
    );
  const names = Object.keys(build.manifest);
  must(
    JSON.stringify([...names].sort()) ===
      JSON.stringify(Object.keys(approved).sort()),
    "Unexpected preview file set",
  );
  for (const name of names) {
    must(
      !name.startsWith("/") &&
        !name.includes("\\") &&
        !name.includes("?") &&
        !name.includes("#") &&
        !name.split("/").includes(".."),
      "Unsafe artifact path",
    );
    if (name !== "sw.js")
      must(
        build.manifest[name].sha256 === approved[name].sha256 &&
          build.manifest[name].bytes === approved[name].bytes,
        "Unapproved build bytes",
      );
  }
  // Pages consumes _headers; it is deployment metadata, never a public asset.
  // Bind its exact approved local bytes, then check every effective header below.
  const headerRules = new Map(),
    consumedMetadata = [];
  if (names.includes("_headers")) {
    const metadata =
      fixtures.headers ?? (await readFile(resolve(root, "public/_headers")));
    must(
      metadata.byteLength === build.manifest._headers.bytes &&
        sha(metadata) === build.manifest._headers.sha256,
      "Unapproved consumed header metadata",
    );
    let path;
    for (const line of new TextDecoder().decode(metadata).split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!/^\s/.test(line)) {
        path = line.trim();
        must(
          path.startsWith("/") &&
            names.includes(path.slice(1)) &&
            !/[?*#:]/.test(path),
          "Unsupported header rule",
        );
        headerRules.set(path.slice(1), []);
      } else {
        const match = /^\s+([A-Za-z0-9-]+):\s*(.+)$/.exec(line);
        must(path && match, "Unsupported header declaration");
        headerRules.get(path.slice(1)).push([match[1].toLowerCase(), match[2]]);
      }
    }
    consumedMetadata.push({
      path: "_headers",
      ...build.manifest._headers,
      verification:
        "approved deployment metadata; effective headers checked on served targets",
    });
  }
  const bytes = new Map(),
    observed = [];
  for (const name of names) {
    if (name === "_headers") continue;
    let url = new URL(name, origin),
      response;
    for (let redirects = 0; ; redirects++) {
      response = await fetcher(url, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        signal: globalThis.AbortSignal.timeout(20000),
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      must(
        redirects < 2 && response.headers.get("location"),
        "Unexpected redirect",
      );
      const next = new URL(response.headers.get("location"), url);
      must(
        next.origin === origin.origin &&
          !next.username &&
          !next.password &&
          !next.search &&
          !next.hash,
        "Cross-origin or unexpected redirect",
      );
      url = next;
    }
    must(
      response.status === 200,
      `Preview static GET failed (${response.status}): ${name}`,
    );
    for (const [header, value] of headerRules.get(name) || [])
      must(
        response.headers.get(header) === value,
        `Hosted configured header differs: ${name}: ${header}`,
      );
    const body = new Uint8Array(await response.arrayBuffer()),
      expected = build.manifest[name];
    must(
      body.byteLength === expected.bytes && sha(body) === expected.sha256,
      `Hosted artifact differs: ${name}`,
    );
    bytes.set(name, body);
    observed.push({
      path: name,
      resolvedPath: url.pathname,
      bytes: body.byteLength,
      sha256: sha(body),
    });
  }
  const worker = new TextDecoder().decode(bytes.get("sw.js"));
  validateWorker(
    worker,
    fixtures.template ||
      (await readFile(resolve(root, "build/service-worker.txt"), "utf8")),
    fixtures.assets ||
      JSON.parse(
        await readFile(
          resolve(root, ".github/pages-release/approved-sw-assets.json"),
        ),
      ),
    bytes,
  );
  return {
    receipt: {
      phase: "verified-preview",
      runId: env.GITHUB_RUN_ID,
      controlSha: env.GITHUB_SHA,
      sourceSha: target.sourceSha,
      deploymentId: preview.deploymentId,
      url: origin.origin,
      manifestDigest: build.manifestDigest,
      verifiedFiles: observed.length,
      consumedMetadata,
      files: observed,
      workerSha256: sha(bytes.get("sw.js")),
      workerCacheVersion: /const CACHE = `\$\{PREFIX\}([a-f0-9]{16})`;/.exec(
        worker,
      )?.[1],
    },
    worker,
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [buildPath, previewPath, out] = process.argv.slice(2);
    must(
      buildPath && previewPath && out,
      "Build, preview receipt and output required",
    );
    const result = await verifyPreviewBytes(
      JSON.parse(await readFile(buildPath)),
      JSON.parse(await readFile(previewPath)),
      process.env,
    );
    await mkdir(dirname(resolve(out)), { recursive: true });
    await writeFile(out, JSON.stringify(result.receipt, null, 2) + "\n");
    await writeFile(resolve(dirname(out), "hosted-sw.js"), result.worker);
    console.log(
      JSON.stringify({
        verifiedFiles: result.receipt.verifiedFiles,
        manifestDigest: result.receipt.manifestDigest,
        deploymentId: result.receipt.deploymentId,
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
