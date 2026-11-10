import { execFileSync } from "node:child_process";
import { must } from "./pages-auto-scope.mjs";
import {
  readReviewSubject,
  latestDecisiveReviews,
} from "./pages-public-review.mjs";
import {
  ownerAttestation,
  readOwnerReviews,
  sameAttestation,
} from "./pages-owner-attestation.mjs";
import { narrowPublicDelta } from "./pages-public-inputs.mjs";
export const bootstrap = {
  sha: "ca78ea5de4af893973cfe10d3dee84cc2ab9ae38",
  tree: "4de90e11a726fbcb178cb8160c96cf21358f2f4f",
};
export async function publicReviewEvidence(sourceSha, read, graphRead) {
  const subject = await readReviewSubject(sourceSha, read);
  if (!subject) return null;
  const ownerId = String(subject.repository.owner.id);
  {
    // An owner withdrawal or malformed attestation must not fall back to another policy.
    const latest = latestDecisiveReviews(subject.reviews);
    for (const review of latest.values()) {
      const permission = subject.permissions.get(String(review.user.id));
      const authorized =
        String(review.user.id) === ownerId ||
        (permission &&
          String(permission.user?.id) === String(review.user.id) &&
          ["write", "admin", "maintain"].includes(permission.permission));
      must(
        !(authorized && review.state === "CHANGES_REQUESTED"),
        "Outstanding authorized changes-requested review",
      );
    }
    return ownerAttestation({
      ...subject,
      graph: await graphRead(subject.pr.number),
    });
  }
  // The selected owner-attestation policy has no approval-policy fallback.
}
export async function sourceAuthorization(
  source,
  sourceSha,
  read,
  graphRead,
  {
    maxDepth = 64,
    review = publicReviewEvidence,
    delta = narrowPublicDelta,
  } = {},
) {
  const git = (args) =>
    execFileSync("git", args, { cwd: source, encoding: "utf8" }).trim();
  let current = sourceSha;
  const chain = [];
  for (let depth = 0; depth <= maxDepth; depth++) {
    const tree = git(["rev-parse", current + "^{tree}"]);
    if (current === bootstrap.sha) {
      must(tree === bootstrap.tree, "Bootstrap source tree differs");
      return {
        kind: chain.length ? "narrow-on-accepted-source" : "verified-bootstrap",
        sourceSha,
        sourceTree: git(["rev-parse", sourceSha + "^{tree}"]),
        chain,
        anchor: {
          kind: "verified-bootstrap",
          sourceSha: current,
          sourceTree: tree,
        },
      };
    }
    const evidence = await review(current, read, graphRead);
    if (evidence)
      return chain.length
        ? {
            kind: "narrow-on-accepted-source",
            sourceSha,
            sourceTree: git(["rev-parse", sourceSha + "^{tree}"]),
            chain,
            anchor: evidence,
          }
        : evidence;
    const parents = git(["show", "-s", "--format=%P", current])
      .split(" ")
      .filter(Boolean);
    must(parents.length === 1, "Unreviewed merge or ambiguous source parent");
    must(
      depth < maxDepth,
      "Narrow source chain exceeds bounded proof; exact-tree review required",
    );
    const changes = await delta(source, parents[0], current);
    chain.push({ sourceSha: current, parent: parents[0], changes });
    current = parents[0];
  }
  throw Error("Source authorization incomplete");
}
export function sameSourceAuthorization(before, after) {
  must(
    before.kind === after.kind &&
      before.sourceSha === after.sourceSha &&
      before.sourceTree === after.sourceTree,
    "Source authorization subject changed",
  );
  const a = before.anchor || before,
    b = after.anchor || after;
  must(
    a.kind === b.kind &&
      a.sourceSha === b.sourceSha &&
      a.sourceTree === b.sourceTree,
    "Accepted-source anchor changed",
  );
  if (a.kind === "owner-attested-independent-agent") sameAttestation(a, b);
  else if (a.kind === "merged-public-pr")
    must(
      a.reviewId === b.reviewId &&
        a.reviewedHead === b.reviewedHead &&
        a.reviewedTree === b.reviewedTree &&
        a.reviewerId === b.reviewerId &&
        a.reviewSubmittedAt === b.reviewSubmittedAt,
      "Exact approved review changed",
    );
  must(
    JSON.stringify(before.chain || []) === JSON.stringify(after.chain || []),
    "Narrow accepted-source chain changed",
  );
}
export const graphReader = (token, fetcher) => (number) =>
  readOwnerReviews(number, token, fetcher);
