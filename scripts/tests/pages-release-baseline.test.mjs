import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  ordinaryCI,
  baselineIdentity,
  downloadVerifiedArtifact,
  extractVerifiedZip,
  baselineFiles,
} from "../pages-release-baseline.mjs";
const source = "a".repeat(40),
  control = "9b275fa415ab787802494419877b8e1a554c10e1",
  hash = (b) => createHash("sha256").update(b).digest("hex");
const id = "12345678-1234-1234-1234-123456789012";
const clone = (x) => globalThis.structuredClone(x);
const run = {
  id: 99,
  repository: { id: 1430113496 },
  head_sha: source,
  head_branch: "main",
  event: "push",
  path: ".github/workflows/repformed-auto-pages.yml",
  status: "completed",
  conclusion: "success",
  run_attempt: 1,
};
const project = {
  name: "repformed",
  production_branch: "main",
  domains: ["repformed.com"],
  canonical_deployment: {
    id,
    environment: "production",
    latest_stage: { status: "success" },
    deployment_trigger: {
      metadata: {
        commit_hash: source,
        branch: "main",
        commit_dirty: false,
        commit_message: "Automatic verified public " + source + " run 99",
      },
    },
  },
};
const artifact = (name, id) => ({
  id,
  name,
  expired: false,
  size_in_bytes: 10,
  digest: "sha256:" + "d".repeat(64),
  workflow_run: { id: 99, head_sha: source },
});
const inventory = {
  total_count: 2,
  artifacts: [
    artifact("repformed-auto-candidate", 1),
    artifact("repformed-auto-production-proof", 2),
  ],
};
const workflow = {
  encoding: "base64",
  content: globalThis.Buffer.from(
    'env:\n PUBLIC_CONTROL_SHA: "' + control + '"\n',
  ).toString("base64"),
};
function reader(overrides = {}) {
  return async (p) =>
    p.endsWith("?ref=" + control)
      ? clone(
          overrides.controllerWorkflow || {
            encoding: "base64",
            content: globalThis.Buffer.from(
              'env:\n PUBLIC_CONTROL_SHA: "' + "0".repeat(40) + '"\n',
            ).toString("base64"),
          },
        )
      : p.includes("/contents/")
        ? clone(overrides.workflow || workflow)
        : p.includes("/artifacts?")
          ? clone(overrides.inventory || inventory)
          : clone(overrides.run || run);
}
test("dependency baseline binds provider source to successful producer/controller/artifacts", async () => {
  const result = await baselineIdentity(project, reader(), true);
  assert.equal(result.deploymentId, id);
  assert.equal(result.runId, 99);
  assert.equal(result.producerControlSha, control);
  assert.equal(result.candidate.id, 1);
  assert.equal(result.production.id, 2);
});
test("unaccepted producer pin and altered historical workflow do not confer authority", async () => {
  const changed = {
    encoding: "base64",
    content: globalThis.Buffer.from(
      'env:\n PUBLIC_CONTROL_SHA: "' + "f".repeat(40) + '"\n',
    ).toString("base64"),
  };
  await assert.rejects(
    baselineIdentity(project, reader({ workflow: changed }), true),
    /transition/,
  );
  await assert.rejects(
    baselineIdentity(
      project,
      reader({
        controllerWorkflow: {
          encoding: "base64",
          content: globalThis.Buffer.from("different implementation").toString(
            "base64",
          ),
        },
      }),
      true,
    ),
    /workflow differs/,
  );
});
for (const change of [
  { conclusion: "failure" },
  { run_attempt: 2 },
  { head_sha: control },
  { path: ".github/workflows/other.yml" },
  { event: "workflow_dispatch" },
])
  test(
    "wrong producer evidence rejects: " + Object.keys(change)[0],
    async () => {
      await assert.rejects(
        baselineIdentity(project, reader({ run: { ...run, ...change } }), true),
      );
    },
  );
test("missing, expired, ambiguous and wrong-source artifacts reject without fallback", async () => {
  for (const rows of [
    [],
    [inventory.artifacts[0]],
    [...inventory.artifacts, inventory.artifacts[0]],
    inventory.artifacts.map((a) => ({ ...a, expired: true })),
    inventory.artifacts.map((a) => ({
      ...a,
      workflow_run: { id: 100, head_sha: source },
    })),
  ])
    await assert.rejects(
      baselineIdentity(
        project,
        reader({ inventory: { total_count: rows.length, artifacts: rows } }),
        true,
      ),
    );
  await assert.rejects(
    baselineIdentity(
      project,
      reader({
        workflow: {
          encoding: "base64",
          content: globalThis.Buffer.from(
            'PUBLIC_CONTROL_SHA: "' + "0".repeat(40) + '"',
          ).toString("base64"),
        },
      }),
      true,
    ),
  );
});
test("unhealthy/wrong target and unbound producer cannot be baseline", async () => {
  for (const p of [
    { ...project, name: "other" },
    { ...project, source: {} },
    {
      ...project,
      canonical_deployment: {
        ...project.canonical_deployment,
        latest_stage: { status: "active" },
      },
    },
    {
      ...project,
      canonical_deployment: {
        ...project.canonical_deployment,
        deployment_trigger: {
          metadata: {
            ...project.canonical_deployment.deployment_trigger.metadata,
            commit_message: "Unverified outside writer",
          },
        },
      },
    },
  ])
    await assert.rejects(baselineIdentity(p, reader(), true));
});
test("docs/public baseline identity does not require irrelevant dependency archives", async () => {
  assert.deepEqual(
    await baselineIdentity(
      project,
      async () => {
        throw Error("No artifact query for public baseline");
      },
      false,
    ),
    { deploymentId: id, sourceSha: source },
  );
});
test("ordinary CI waits only for first-attempt exact source success; failures stop", async () => {
  const ready = { ...run, path: ".github/workflows/checks.yml" };
  assert.equal(
    (await ordinaryCI(source, async () => ({ workflow_runs: [ready] }))).runId,
    99,
  );
  for (const patch of [
    { conclusion: "failure" },
    { run_attempt: 2 },
    { path: "wrong" },
  ])
    await assert.rejects(
      ordinaryCI(source, async () => ({
        workflow_runs: [{ ...ready, ...patch }],
      })),
    );
  let calls = 0,
    pauses = 0;
  await ordinaryCI(
    source,
    async () => ({
      workflow_runs: [
        ++calls === 1 ? { ...ready, status: "in_progress" } : ready,
      ],
    }),
    {
      wait: true,
      pause: async () => {
        pauses++;
      },
    },
  );
  assert.equal(pauses, 1);
});
test("archive download authenticates API then strips authorization on restricted redirect", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "repformed-download-"));
  try {
    const bytes = globalThis.Buffer.from("fictional archive bytes"),
      calls = [];
    const a = { id: 1, bytes: bytes.length, sha256: hash(bytes) };
    const fetch = async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? {
            status: 302,
            headers: {
              get: () =>
                "https://fixture.blob.core.windows.net/path?signature=fictional",
            },
          }
        : {
            ok: true,
            body: (async function* () {
              yield bytes;
            })(),
          };
    };
    await downloadVerifiedArtifact(
      a,
      "fictional-test-binding",
      resolve(dir, "archive.zip"),
      fetch,
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.redirect, "manual");
    assert.equal(calls[1].options.headers, undefined);
    assert.equal(calls[1].options.redirect, "error");
    assert.equal(hash(await readFile(resolve(dir, "archive.zip"))), a.sha256);
    await assert.rejects(
      downloadVerifiedArtifact(
        a,
        "fictional-test-binding",
        resolve(dir, "bad.zip"),
        async () => ({
          status: 302,
          headers: { get: () => "https://unapproved.invalid/archive" },
        }),
      ),
      /redirect/,
    );
    await assert.rejects(
      downloadVerifiedArtifact(
        { ...a, bytes: 1 },
        "fictional-test-binding",
        resolve(dir, "large.zip"),
        fetch,
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("safe extraction rejects paths, case collisions, links, special files, bombs and existing output", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "repformed-zip-"));
  try {
    for (const [n, mode] of [
      "valid",
      "traversal",
      "absolute",
      "backslash",
      "single-backslash",
      "duplicate",
      "case",
      "link",
      "special",
      "bomb",
    ].entries()) {
      const archive = resolve(dir, n + ".zip"),
        output = resolve(dir, n + "-out");
      execFileSync(
        "python3",
        [
          "-c",
          String.raw`import zipfile,sys,stat
p,mode=sys.argv[1:]
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:
 if mode=='valid':z.writestr('build.json','{}')
 elif mode=='traversal':z.writestr('../escape','x')
 elif mode=='absolute':z.writestr('/escape','x')
 elif mode=='backslash':z.writestr('a\\b','x')
 elif mode=='duplicate':z.writestr('a','x');z.writestr('a','y')
 elif mode=='single-backslash':z.writestr('a'+chr(92)+'b','x')
 elif mode=='case':z.writestr('A','x');z.writestr('a','y')
 elif mode in ('link','special'):
  r=zipfile.ZipInfo('object');r.external_attr=((stat.S_IFLNK if mode=='link' else stat.S_IFIFO)|0o777)<<16;z.writestr(r,'target')
 elif mode=='bomb':z.writestr('large',b'0'*2000000)
`,
          archive,
          mode,
        ],
        { stdio: "pipe" },
      );
      if (mode === "valid") {
        extractVerifiedZip(archive, output);
        assert.equal(
          await readFile(resolve(output, "build.json"), "utf8"),
          "{}",
        );
        assert.throws(() => extractVerifiedZip(archive, output));
      } else assert.throws(() => extractVerifiedZip(archive, output), mode);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("baseline files bind source/tree/controller/run/deployment and production outcome", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "repformed-baseline-files-"));
  try {
    await mkdir(resolve(dir, "candidate/site"), { recursive: true });
    await mkdir(resolve(dir, "production"));
    const build = {
      sourceSha: source,
      workflowSha: source,
      sourceTree: "c".repeat(40),
      runId: "99",
      attempt: 1,
      controlSha: control,
      manifestDigest: "d".repeat(64),
      workerCacheVersion: "e".repeat(16),
    };
    const production = {
      ...build,
      phase: "promote",
      deploymentId: id,
      sourceSuperseded: false,
    };
    await writeFile(
      resolve(dir, "candidate/build.json"),
      JSON.stringify(build),
    );
    const identity = {
      sourceSha: source,
      deploymentId: id,
      runId: 99,
      producerControlSha: control,
    };
    await writeFile(
      resolve(dir, "production/production.json"),
      JSON.stringify(production),
    );
    assert.equal((await baselineFiles(identity, dir)).build.sourceSha, source);
    for (const mutation of [
      { controlSha: source },
      { sourceTree: source },
      { sourceSuperseded: true },
      { deploymentId: "other" },
      { attempt: 2 },
      { manifestDigest: "wrong" },
    ]) {
      await writeFile(
        resolve(dir, "production/production.json"),
        JSON.stringify({ ...production, ...mutation }),
      );
      await assert.rejects(baselineFiles(identity, dir));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
