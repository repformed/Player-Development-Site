// Dependency-free authenticated-read ports. No source package imports or provider writes.
import { createHash } from "node:crypto";
const must = (ok, message) => {
  if (!ok) throw Error(message);
};
const prefix = "/repos/repformed/Player-Development-Site";
export async function readProtectedContext(
  { sourceSha, baselineSha, pullRequest, runId },
  read,
) {
  must(
    /^[a-f0-9]{40}$/.test(sourceSha || "") &&
      /^[a-f0-9]{40}$/.test(baselineSha || "") &&
      Number.isInteger(pullRequest) &&
      pullRequest > 0 &&
      Number.isInteger(runId) &&
      runId > 0,
    "Exact preparation identities required",
  );
  const [repo, main, source, baseline, pr, run] = await Promise.all([
    read(prefix),
    read(prefix + "/git/ref/heads/main"),
    read(prefix + "/git/commits/" + sourceSha),
    read(prefix + "/git/commits/" + baselineSha),
    read(prefix + "/pulls/" + pullRequest),
    read(prefix + "/actions/runs/" + runId),
  ]);
  must(
    repo.id === 1430113496 &&
      repo.full_name === "repformed/Player-Development-Site",
    "Wrong authenticated repository",
  );
  must(
    main.object?.sha === baselineSha &&
      baseline.sha === baselineSha &&
      source.sha === sourceSha &&
      /^[a-f0-9]{40}$/.test(source.tree?.sha || "") &&
      /^[a-f0-9]{40}$/.test(baseline.tree?.sha || ""),
    "Fresh accepted main/source identities differ",
  );
  must(
    pr.number === pullRequest &&
      pr.state === "open" &&
      pr.merged === false &&
      pr.head?.sha === sourceSha &&
      pr.head.repo?.id === repo.id &&
      pr.base?.ref === "main" &&
      pr.base.repo?.id === repo.id &&
      pr.base.sha === baselineSha,
    "Exact open PR/head/current-main binding required",
  );
  must(
    run.repository?.id === repo.id &&
      run.head_sha === sourceSha &&
      run.event === "pull_request" &&
      run.path === ".github/workflows/checks.yml" &&
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.run_attempt === 1 &&
      run.pull_requests?.some(
        (p) =>
          p.number === pullRequest &&
          p.head.sha === sourceSha &&
          p.base.sha === baselineSha,
      ),
    "Successful first-attempt ordinary CI bound to exact PR source required",
  );
  return {
    version: 1,
    repositoryId: repo.id,
    pullRequest,
    sourceSha,
    sourceTree: source.tree.sha,
    baselineSha,
    baselineTree: baseline.tree.sha,
    runId,
    runAttempt: 1,
    workflowPath: run.path,
    status: "authenticated-preparation-context-not-release-approval",
    grantsDeploymentAuthority: false,
  };
}
export async function authenticateArtifact(context, artifactId, bytes, read) {
  const artifact = await read(prefix + "/actions/artifacts/" + artifactId);
  const hash = createHash("sha256").update(bytes).digest("hex");
  must(
    artifact.id === artifactId &&
      artifact.name === "browser-test-report" &&
      !artifact.expired &&
      artifact.workflow_run?.id === context.runId &&
      artifact.workflow_run?.head_sha === context.sourceSha &&
      artifact.digest === "sha256:" + hash &&
      artifact.size_in_bytes === bytes.length,
    "Downloaded artifact differs from authenticated run inventory",
  );
  return {
    artifactId,
    purpose:
      "ordinary-CI-browser-report; not candidate or production authority",
    runId: context.runId,
    sourceSha: context.sourceSha,
    bytes: bytes.length,
    sha256: hash,
    grantsDeploymentAuthority: false,
  };
}
