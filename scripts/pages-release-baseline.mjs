// Authenticated baseline/CI reads; no source node_modules are imported here.
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, lstat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import process from "node:process";
import { setTimeout } from "node:timers";
import { must } from "./pages-auto-scope.mjs";
const repo = "/repos/repformed/Player-Development-Site";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const acceptedPreviousControllers = new Set([
  "490c4a801e2fe62d859a1d2ab7aab6e635173554",
  "9b275fa415ab787802494419877b8e1a554c10e1",
]);
export async function ordinaryCI(
  sourceSha,
  read,
  {
    wait = false,
    pause = (ms) => new Promise((r) => setTimeout(r, ms)),
    attempts = 60,
  } = {},
) {
  for (let n = 0; n < (wait ? attempts : 1); n++) {
    const response = await read(
      repo +
        "/actions/workflows/checks.yml/runs?head_sha=" +
        sourceSha +
        "&event=push&per_page=100",
    );
    must(
      Array.isArray(response.workflow_runs) &&
        response.workflow_runs.length < 100,
      "Complete ordinary CI inventory required",
    );
    const runs = response.workflow_runs.filter(
      (r) => r.head_sha === sourceSha && r.event === "push",
    );
    must(runs.length <= 1, "Ambiguous ordinary source CI");
    const run = runs[0];
    if (run?.status === "completed") {
      must(
        run.conclusion === "success" &&
          run.run_attempt === 1 &&
          run.path === ".github/workflows/checks.yml" &&
          run.repository.id === 1430113496,
        "Required first-attempt ordinary CI failed or was rerun",
      );
      return { runId: run.id, sourceSha, attempt: 1, conclusion: "success" };
    }
    must(wait && n + 1 < attempts, "Ordinary CI is not successfully complete");
    await pause(15000);
  }
  throw Error("Ordinary CI wait ended without acceptance");
}
export async function baselineIdentity(
  project,
  read,
  requireArtifacts,
  currentControlSha = null,
) {
  const d = project.canonical_deployment,
    metadata = d?.deployment_trigger?.metadata;
  must(
    project.name === "repformed" &&
      project.production_branch === "main" &&
      !project.source &&
      project.domains?.includes("repformed.com") &&
      d?.environment === "production" &&
      d.latest_stage?.status === "success" &&
      /^[a-f0-9-]{36}$/.test(d.id || ""),
    "Healthy fixed-target production required",
  );
  must(
    /^[a-f0-9]{40}$/.test(metadata?.commit_hash || "") &&
      metadata.branch === "main" &&
      metadata.commit_dirty === false,
    "Production source binding missing",
  );
  const identity = { deploymentId: d.id, sourceSha: metadata.commit_hash };
  if (!requireArtifacts) return identity;
  const match = /^Automatic verified public ([a-f0-9]{40}) run (\d+)$/.exec(
    metadata.commit_message || "",
  );
  must(
    match && match[1] === identity.sourceSha,
    "Dependency baseline must be a confirmed guarded automatic producer",
  );
  const runId = Number(match[2]);
  const run = await read(repo + "/actions/runs/" + runId);
  must(
    run.repository?.id === 1430113496 &&
      run.head_sha === identity.sourceSha &&
      run.head_branch === "main" &&
      run.event === "push" &&
      run.path === ".github/workflows/repformed-auto-pages.yml" &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.run_attempt === 1,
    "Baseline producer is not an exact successful first-attempt release",
  );
  const workflow = await read(
    repo +
      "/contents/.github/workflows/repformed-auto-pages.yml?ref=" +
      identity.sourceSha,
  );
  must(
    workflow.encoding === "base64" && typeof workflow.content === "string",
    "Immutable producer workflow content required",
  );
  const producerControlSha = /PUBLIC_CONTROL_SHA:\s*"([a-f0-9]{40})"/.exec(
    globalThis.Buffer.from(workflow.content, "base64").toString("utf8"),
  )?.[1];
  must(
    producerControlSha && producerControlSha !== "0".repeat(40),
    "Producer controller pin missing",
  );
  must(
    acceptedPreviousControllers.has(producerControlSha) ||
      producerControlSha === currentControlSha,
    "Producer controller has no accepted transition authority",
  );
  const controllerWorkflow = await read(
    repo +
      "/contents/.github/workflows/repformed-auto-pages.yml?ref=" +
      producerControlSha,
  );
  must(
    controllerWorkflow.encoding === "base64" &&
      typeof controllerWorkflow.content === "string" &&
      globalThis.Buffer.from(workflow.content, "base64").toString("utf8") ===
        globalThis.Buffer.from(controllerWorkflow.content, "base64")
          .toString("utf8")
          .replaceAll("0".repeat(40), producerControlSha),
    "Producer workflow differs from accepted immutable controller",
  );
  const result = await read(
    repo + "/actions/runs/" + runId + "/artifacts?per_page=100",
  );
  must(
    result.total_count < 100 && Array.isArray(result.artifacts),
    "Complete baseline artifact inventory required",
  );
  const pick = (name) => {
    const rows = result.artifacts.filter((a) => a.name === name);
    must(
      rows.length === 1 &&
        !rows[0].expired &&
        /^sha256:[a-f0-9]{64}$/.test(rows[0].digest || "") &&
        rows[0].workflow_run?.id === runId &&
        rows[0].workflow_run?.head_sha === identity.sourceSha,
      "Missing/expired/unbound baseline artifact: " + name,
    );
    return {
      id: rows[0].id,
      name,
      bytes: rows[0].size_in_bytes,
      sha256: rows[0].digest.slice(7),
      runId,
      sourceSha: identity.sourceSha,
    };
  };
  return {
    ...identity,
    runId,
    producerControlSha,
    candidate: pick("repformed-auto-candidate"),
    production: pick("repformed-auto-production-proof"),
  };
}
export async function downloadVerifiedArtifact(
  artifact,
  token,
  destination,
  fetcher = globalThis.fetch,
) {
  must(
    token &&
      Number.isInteger(artifact.id) &&
      artifact.id > 0 &&
      artifact.bytes > 0 &&
      artifact.bytes <= 100 * 1024 * 1024 &&
      /^[a-f0-9]{64}$/.test(artifact.sha256 || ""),
    "Bound artifact metadata required",
  );
  const response = await fetcher(
    "https://api.github.com" +
      repo +
      "/actions/artifacts/" +
      artifact.id +
      "/zip",
    {
      redirect: "manual",
      signal: globalThis.AbortSignal.timeout(30000),
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
      },
    },
  );
  must(
    response.status === 302,
    "Artifact redirect not authorized; no fallback",
  );
  const url = new globalThis.URL(response.headers.get("location"));
  must(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname.endsWith(".blob.core.windows.net") ||
        url.hostname.endsWith(".actions.githubusercontent.com")),
    "Unexpected artifact redirect target",
  );
  // Explicitly no Authorization header, cookies, or redirects to a further host.
  const file = await fetcher(url.href, {
    redirect: "error",
    signal: globalThis.AbortSignal.timeout(180000),
  });
  must(file.ok, "Artifact download failed; no retry");
  const chunks = [];
  let size = 0;
  for await (const chunk of file.body) {
    size += chunk.length;
    must(size <= artifact.bytes, "Artifact exceeds bound");
    chunks.push(chunk);
  }
  const bytes = globalThis.Buffer.concat(chunks);
  must(
    size === artifact.bytes && digest(bytes) === artifact.sha256,
    "Artifact byte/digest mismatch",
  );
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
  return { bytes: size, sha256: digest(bytes) };
}
export function extractVerifiedZip(zip, destination) {
  const env = { ...process.env };
  for (const key of [
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "CLOUDFLARE_API_TOKEN",
    "SUPABASE_ACCESS_TOKEN",
  ])
    delete env[key];
  execFileSync(
    "python3",
    [
      "-c",
      String.raw`import zipfile,pathlib,stat,sys
archive,destination=map(pathlib.Path,sys.argv[1:])
assert not destination.exists(), 'Fresh extraction directory required'
with zipfile.ZipFile(archive) as z:
 rows=z.infolist();assert len(rows)<=2000 and sum(r.file_size for r in rows)<=250*1024*1024, 'Archive bounds exceeded'
 names=set()
 for r in rows:
  name=r.filename;p=pathlib.PurePosixPath(name);mode=r.external_attr>>16;kind=stat.S_IFMT(mode)
  assert name and not p.is_absolute() and chr(92) not in name and ':' not in name and not any(ord(c)<32 for c in name) and all(s not in ('.','..') for s in name.rstrip('/').split('/')), 'Unsafe archive path'
  assert kind in (0,stat.S_IFREG,stat.S_IFDIR), 'Link or special archive file'
  key=str(p).casefold();assert key not in names, 'Duplicate/normalization collision';names.add(key)
  assert r.file_size<=100*1024*1024 and (r.file_size==0 or r.compress_size>0 and r.file_size/r.compress_size<=1000), 'Archive compression bound'
 destination.mkdir(parents=True)
 for r in rows:
  target=destination/pathlib.PurePosixPath(r.filename)
  if r.is_dir():target.mkdir(parents=True,exist_ok=True)
  else:
   target.parent.mkdir(parents=True,exist_ok=True)
   with target.open('xb') as f:f.write(z.read(r))
`,
      zip,
      destination,
    ],
    { env, stdio: "pipe" },
  );
}
export async function baselineFiles(identity, directory) {
  const candidate = resolve(directory, "candidate"),
    proof = resolve(directory, "production");
  const build = JSON.parse(
    await readFile(resolve(candidate, "build.json"), "utf8"),
  );
  const production = JSON.parse(
    await readFile(resolve(proof, "production.json"), "utf8"),
  );
  must(
    build.sourceSha === identity.sourceSha &&
      build.workflowSha === identity.sourceSha &&
      /^[a-f0-9]{40}$/.test(build.sourceTree || "") &&
      build.runId === String(identity.runId) &&
      build.attempt === 1 &&
      build.controlSha === identity.producerControlSha &&
      production.sourceSha === build.sourceSha &&
      production.sourceTree === build.sourceTree &&
      production.workflowSha === identity.sourceSha &&
      production.controlSha === build.controlSha &&
      production.runId === build.runId &&
      production.attempt === 1 &&
      production.phase === "promote" &&
      production.deploymentId === identity.deploymentId &&
      production.manifestDigest === build.manifestDigest &&
      production.workerCacheVersion === build.workerCacheVersion &&
      !production.sourceSuperseded,
    "Accepted baseline candidate/production proof mismatch",
  );
  must(
    (await lstat(resolve(candidate, "site"))).isDirectory(),
    "Baseline site directory missing",
  );
  return { build, site: resolve(candidate, "site") };
}
