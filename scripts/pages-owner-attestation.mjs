// Authenticated owner record of a real independent-agent review.
// This is deliberately NOT GitHub non-author APPROVED review evidence.
import { createHash } from "node:crypto";
import { latestDecisiveReviews } from "./pages-public-review.mjs";
import { must } from "./pages-auto-scope.mjs";
export const protocol = "repformed-public-review/v1";
const digest = (x) => createHash("sha256").update(x).digest("hex");
const date = (x) => typeof x === "string" && Number.isFinite(Date.parse(x));
export function ownerAttestation({ repository, source, pr, head, graph }) {
  must(
    repository.id === 1430113496 &&
      repository.full_name === "repformed/Player-Development-Site",
    "Wrong attestation repository",
  );
  must(
    /^[1-9]\d*$/.test(String(repository.owner?.id ?? "")) &&
      /^[1-9]\d*$/.test(String(pr.user?.id ?? "")) &&
      Number.isInteger(pr.number) &&
      pr.number > 0 &&
      /^[a-f0-9]{40}$/.test(source.sha || "") &&
      /^[a-f0-9]{40}$/.test(head.sha || ""),
    "Immutable owner/author/source identities required",
  );
  must(
    pr.merged === true &&
      pr.draft === false &&
      pr.base?.repo?.id === repository.id &&
      pr.base.ref === "main" &&
      pr.merge_commit_sha === source.sha,
    "Exact merged PR/source association required",
  );
  must(
    head.sha === pr.head.sha &&
      head.tree?.sha === source.tree?.sha &&
      /^[a-f0-9]{40}$/.test(source.tree?.sha || ""),
    "Attested head tree differs from merged source",
  );
  must(
    graph.repository === "repformed/Player-Development-Site" &&
      graph.headSha === head.sha &&
      typeof graph.ownerId === "string" &&
      graph.ownerId.length > 0 &&
      graph.ownerId === repository.owner.node_id,
    "Graph review authority mismatch",
  );
  const records = graph.reviews.filter(
    (r) =>
      r.authorId === graph.ownerId &&
      typeof r.body === "string" &&
      r.body.includes(protocol),
  );
  must(records.length > 0, "No owner review attestation");
  for (const r of records)
    must(
      typeof r.id === "string" &&
        r.id.length > 0 &&
        date(r.submittedAt) &&
        date(r.updatedAt),
      "Complete owner review metadata required",
    );
  records.sort(
    (a, b) =>
      Math.max(Date.parse(b.updatedAt), Date.parse(b.submittedAt)) -
        Math.max(Date.parse(a.updatedAt), Date.parse(a.submittedAt)) ||
      b.id.localeCompare(a.id),
  );
  const record = records[0];
  must(
    record.state === "COMMENTED" &&
      record.commitSha === head.sha &&
      record.lastEditedAt === null &&
      record.includesCreatedEdit === false &&
      !record.isMinimized,
    "Unedited submitted COMMENT attestation of exact head required",
  );
  let body;
  try {
    body = JSON.parse(record.body);
  } catch {
    throw Error("Malformed owner review attestation");
  }
  must(
    body.protocol === protocol &&
      body.repositoryId === repository.id &&
      body.pullRequest === pr.number &&
      body.commit === head.sha &&
      body.tree === head.tree.sha &&
      body.reviewerKind === "independent-agent" &&
      /^\/root\/[a-z0-9_/-]+$/.test(body.reviewTask || ""),
    "Owner attestation subject/protocol mismatch",
  );
  must(body.decision === "accept", "Owner review withdrawn or not accepted");
  const decisive = latestDecisiveReviews(
    graph.reviews
      .filter(
        (r) =>
          r.authorId === graph.ownerId &&
          ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state),
      )
      .map((r, i) => ({
        id: i + 1,
        user: { id: r.authorId === graph.ownerId ? repository.owner.id : 1 },
        submitted_at: r.submittedAt,
        state: r.state,
      })),
  );
  must(
    decisive.get(String(repository.owner.id))?.state !== "CHANGES_REQUESTED",
    "Outstanding owner changes request",
  );
  return {
    kind: "owner-attested-independent-agent",
    repositoryId: repository.id,
    prNumber: pr.number,
    sourceSha: source.sha,
    sourceTree: source.tree.sha,
    reviewedHead: head.sha,
    reviewedTree: head.tree.sha,
    reviewNodeId: record.id,
    ownerNodeId: graph.ownerId,
    ownerId: String(repository.owner.id),
    bodySha256: digest(record.body),
    reviewSubmittedAt: record.submittedAt,
    reviewUpdatedAt: record.updatedAt,
    reviewTask: body.reviewTask,
    meaning:
      "Owner-authenticated record of actual independent agent review; not GitHub non-author approval or cryptographic proof of reviewer independence.",
  };
}
export function sameAttestation(before, after) {
  must(
    before.kind === after.kind &&
      before.reviewNodeId === after.reviewNodeId &&
      before.bodySha256 === after.bodySha256 &&
      before.reviewSubmittedAt === after.reviewSubmittedAt &&
      before.reviewUpdatedAt === after.reviewUpdatedAt &&
      before.ownerNodeId === after.ownerNodeId &&
      before.reviewedHead === after.reviewedHead &&
      before.reviewedTree === after.reviewedTree,
    "Review record changed, deleted, withdrawn or replaced after build",
  );
}
export async function readOwnerReviews(
  prNumber,
  token,
  fetcher = globalThis.fetch,
) {
  must(
    Number.isInteger(prNumber) && prNumber > 0 && token,
    "Existing authenticated public-review read context required",
  );
  const query = `query($number:Int!,$after:String){repository(owner:"repformed",name:"Player-Development-Site"){nameWithOwner owner{... on User{id} ... on Organization{id}} pullRequest(number:$number){headRefOid reviews(first:100,after:$after){nodes{id state body submittedAt updatedAt lastEditedAt includesCreatedEdit isMinimized author{... on User{id}} commit{oid}} pageInfo{hasNextPage endCursor}}}}}`;
  const rows = [];
  let after = null,
    ownerId,
    headSha;
  const cursors = new Set();
  for (let page = 0; page < 20; page++) {
    const response = await fetcher("https://api.github.com/graphql", {
      method: "POST",
      redirect: "error",
      signal: globalThis.AbortSignal.timeout(30000),
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { number: prNumber, after } }),
    });
    must(
      response.ok,
      "GitHub review read failed HTTP " +
        response.status +
        "; no identity or unauthenticated fallback",
    );
    const result = await response.json();
    must(
      !result.errors?.length && result.data?.repository,
      "Complete GraphQL review evidence required",
    );
    const repo = result.data.repository,
      pr = repo.pullRequest;
    must(
      repo.nameWithOwner === "repformed/Player-Development-Site" &&
        pr?.reviews &&
        repo.owner?.id,
      "Wrong/missing review repository",
    );
    ownerId ??= repo.owner.id;
    headSha ??= pr.headRefOid;
    must(
      ownerId === repo.owner.id && headSha === pr.headRefOid,
      "Review subject changed during pagination",
    );
    for (const r of pr.reviews.nodes)
      rows.push({ ...r, authorId: r.author?.id, commitSha: r.commit?.oid });
    const info = pr.reviews.pageInfo;
    must(
      typeof info?.hasNextPage === "boolean",
      "Review pagination metadata missing",
    );
    if (!info.hasNextPage)
      return {
        repository: repo.nameWithOwner,
        ownerId,
        headSha,
        reviews: rows,
      };
    must(
      typeof info.endCursor === "string" && !cursors.has(info.endCursor),
      "Ambiguous review cursor",
    );
    cursors.add(info.endCursor);
    after = info.endCursor;
  }
  throw Error("Owner review inventory exceeds bounded evidence");
}
