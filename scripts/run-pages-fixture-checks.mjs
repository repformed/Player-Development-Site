import { execFileSync } from "node:child_process";
import { readFile, writeFile, unlink, mkdir, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";

import { completeCaseEvidence } from "./pages-public-cases.mjs";
const control = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [sourceArg, mode, proofArg, ...rest] = process.argv.slice(2);
const listOnly = rest.includes("--list"),
  extra = rest.filter((x) => x !== "--list"),
  previewArg = extra[0];
const suites = {
  e2e: { config: "playwright.config.ts", port: 5299 },
  app: { config: "playwright.app.config.ts", port: 5300 },
  hosted: { config: "playwright.config.ts", port: 5299 },
};
if (
  !sourceArg ||
  !proofArg ||
  !Object.hasOwn(suites, mode) ||
  extra.length > 1 ||
  (mode !== "hosted" && extra.length > 0)
)
  throw Error("Explicit source, known suite and proof path required");
const source = resolve(sourceArg),
  proof = resolve(proofArg),
  suite = suites[mode];
const target = JSON.parse(
  await readFile(resolve(control, ".github/pages-release/target.json")),
);
const env = { ...process.env };
const automatic = !!env.PUBLIC_AUTO_SOURCE_SHA;
if (automatic) {
  if (
    env.GITHUB_EVENT_NAME !== "push" ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_REPOSITORY !== target.repository ||
    env.GITHUB_WORKFLOW !== "Repformed automatic public release" ||
    env.PUBLIC_AUTO_SOURCE_SHA !== env.GITHUB_SHA ||
    !/^[a-f0-9]{40}$/.test(env.PUBLIC_CONTROL_SHA || "")
  )
    throw Error("Trusted automatic fixture context required");
  target.sourceSha = env.PUBLIC_AUTO_SOURCE_SHA;
}
const expectedControl = automatic ? env.PUBLIC_CONTROL_SHA : env.GITHUB_SHA;
let permittedHost = "";
if (mode === "hosted") {
  if (!previewArg) throw Error("Verified preview receipt required");
  const receipt = JSON.parse(await readFile(resolve(previewArg)));
  const url = new URL(receipt.url);
  if (
    receipt.phase !== "preview" ||
    receipt.sourceSha !== target.sourceSha ||
    receipt.controlSha !== expectedControl ||
    receipt.runId !== env.GITHUB_RUN_ID ||
    receipt.baseline !== env.EXPECTED_PRODUCTION_ID ||
    !/^[a-f0-9-]{36}$/.test(receipt.deploymentId || "")
  )
    throw Error("Preview identity mismatch");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !/^[a-z0-9-]+\.repformed\.pages\.dev$/.test(url.hostname) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    env.DEMO_BASE_URL !== url.origin
  )
    throw Error("Unexpected preview origin");
  permittedHost = url.hostname;
} else if (env.DEMO_BASE_URL)
  throw Error("Local suites cannot inherit a remote base URL");
await access(resolve(source, suite.config));
await mkdir(dirname(proof), { recursive: true });
try {
  await access(proof);
  throw Error("Refuse to overwrite an existing fixture proof");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const config = resolve(source, `.pages-fixture-${mode}.config.ts`);
const quote = (x) => "'" + x.replaceAll("'", "'\\''") + "'";
const proxyCommand = [
  "python3",
  resolve(control, "scripts/pages-fixture-deny-proxy.py"),
  proof,
  String(suite.port),
]
  .map(quote)
  .join(" ");
const bypass = [
  "127.0.0.1",
  "localhost",
  ...(permittedHost ? [permittedHost] : []),
];
const generated = `import {defineConfig} from '@playwright/test';\nimport base from ${JSON.stringify("./" + suite.config)};\nconst inherited=base.webServer ? (Array.isArray(base.webServer)?base.webServer:[base.webServer]) : [];\nconst reporters=Array.isArray(base.reporter)?base.reporter:[[base.reporter||'list']];\nexport default defineConfig({...base,reporter:[...reporters,['json',{outputFile:${JSON.stringify(proof + ".tests.json")}}]],use:{...base.use,proxy:{server:'http://127.0.0.1:${suite.port}',bypass:${JSON.stringify(bypass.join(","))}},launchOptions:{...base.use?.launchOptions,args:[...(base.use?.launchOptions?.args||[]),${JSON.stringify("--proxy-server=http://127.0.0.1:" + suite.port)},${JSON.stringify("--proxy-bypass-list=" + bypass.join(";"))}]}},webServer:[{command:${JSON.stringify(proxyCommand)},port:${suite.port},reuseExistingServer:false},...inherited.map(server=>({...server,reuseExistingServer:false}))]});\n`;
let created = false;
try {
  await writeFile(config, generated, { flag: "wx" });
  created = true;
  if (mode === "app" && !listOnly)
    execFileSync("npm", ["run", "build"], {
      cwd: source,
      env,
      stdio: "inherit",
    });
  const args = ["test", "--config", config];
  if (mode === "hosted")
    args.push(
      "tests/search-metadata.spec.ts",
      "tests/deletion-request-help.spec.ts",
      "tests/service-policies.spec.ts",
      "tests/public-home-focus.spec.ts",
      "tests/public-usability.spec.ts",
      "tests/public-features/",
    );
  if (listOnly) args.push("--list");
  execFileSync(resolve(source, "node_modules/.bin/playwright"), args, {
    cwd: source,
    env,
    stdio: "inherit",
  });
  if (!listOnly) {
    const result = JSON.parse(await readFile(proof)),
      report = JSON.parse(await readFile(proof + ".tests.json"));
    const cases = [];
    const walk = (s) => {
      for (const spec of s.specs || [])
        for (const test of spec.tests || []) cases.push(test);
      for (const child of s.suites || []) walk(child);
    };
    for (const suite of report.suites || []) walk(suite);
    if (
      result.forwarded_upstream !== 0 ||
      result.guard !== "deny-only loopback proxy" ||
      report.errors?.length ||
      report.stats.unexpected ||
      report.stats.skipped ||
      report.stats.flaky ||
      cases.some(
        (t) =>
          t.results.length !== 1 ||
          t.results[0].status !== "passed" ||
          t.results[0].retry !== 0,
      )
    )
      throw Error(
        "Fixture isolation or complete first-attempt acceptance missing",
      );
    const actualHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: source,
      encoding: "utf8",
    }).trim();
    let caseKeys;
    if (automatic) {
      const baseline = JSON.parse(
        await readFile(
          resolve(control, ".github/pages-release/public-baseline-cases.json"),
        ),
      );
      let expected = null;
      if (mode === "hosted") {
        const candidate = JSON.parse(
          await readFile(
            resolve(dirname(previewArg), "../candidate/build.json"),
          ),
        );
        expected = candidate.expectedHostedCases;
      }
      caseKeys = completeCaseEvidence(report, baseline, mode, expected).keys;
    } else if (
      actualHead === target.sourceSha &&
      !({ e2e: 610, app: 12, hosted: 86 }[mode] === cases.length)
    )
      throw Error("Required manual release case count changed");
    const receipt = {
      ...result,
      suite: mode,
      runId: env.GITHUB_RUN_ID,
      attempt: env.GITHUB_RUN_ATTEMPT
        ? Number(env.GITHUB_RUN_ATTEMPT)
        : undefined,
      controlSha: expectedControl,
      workflowSha: env.GITHUB_SHA,
      sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
        cwd: source,
        encoding: "utf8",
      }).trim(),
      sourceSha: actualHead,
      caseKeys,
      cases: cases.length,
      passed: cases.length,
      failed: 0,
      skipped: 0,
      retries: 0,
      permitted_public_origin: permittedHost || "loopback only",
    };
    await writeFile(proof, JSON.stringify(receipt, null, 2) + "\n");
    console.log(JSON.stringify(receipt));
  }
} finally {
  if (created) await unlink(config);
}
