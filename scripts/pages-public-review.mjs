// Publishing review evidence, not a business-content classifier.
import { must } from "./pages-auto-scope.mjs";
const id = (value) => String(value ?? "");
const validId = (value) => /^[1-9]\d*$/.test(id(value));
const sha = (value) => /^[a-f0-9]{40}$/.test(value || "");
export function latestDecisiveReviews(reviews) {
  const latest = new Map();
  for (const review of reviews) {
    must(
      validId(review.id) &&
        validId(review.user?.id) &&
        review.submitted_at &&
        Number.isFinite(Date.parse(review.submitted_at)),
      "Complete immutable review identity/time evidence required",
    );
    if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state)) {
      const prior = latest.get(id(review.user.id));
      if (
        !prior ||
        Date.parse(review.submitted_at) >= Date.parse(prior.submitted_at)
      )
        latest.set(id(review.user.id), review);
    }
  }
  return latest;
}
export function exactReviewedTree({
  repository,
  source,
  pr,
  head,
  reviews,
  permissions,
}) {
  must(
    repository.id === 1430113496 &&
      repository.full_name === "repformed/Player-Development-Site",
    "Wrong repository review authority",
  );
  must(
    sha(source.sha) && sha(source.tree?.sha),
    "Immutable source tree required",
  );
  must(
    pr.merged === true &&
      pr.draft === false &&
      pr.base?.ref === "main" &&
      pr.base.repo?.id === repository.id &&
      pr.merge_commit_sha === source.sha,
    "Exact merged PR/source association required",
  );
  must(
    sha(pr.head?.sha) &&
      head.sha === pr.head.sha &&
      head.tree?.sha === source.tree.sha,
    "Reviewed head tree must equal merged source tree",
  );
  must(
    validId(repository.owner?.id) && validId(pr.user?.id),
    "Immutable owner/author IDs required",
  );
  const latest = latestDecisiveReviews(reviews);
  const authorized = (review) => {
    if (id(review.user.id) === id(repository.owner.id)) return true;
    const permission = permissions.get(id(review.user.id));
    return (
      permission &&
      id(permission.user?.id) === id(review.user.id) &&
      ["admin", "write", "maintain"].includes(permission.permission)
    );
  };
  for (const review of latest.values())
    must(
      !(authorized(review) && review.state === "CHANGES_REQUESTED"),
      "Outstanding authorized changes-requested review",
    );
  const approved = [...latest.values()].filter(
    (r) =>
      r.state === "APPROVED" &&
      r.commit_id === pr.head.sha &&
      id(r.user.id) !== id(pr.user.id) &&
      authorized(r),
  );
  must(
    approved.length > 0,
    "Current independent authorized approval of exact head required",
  );
  const review = approved.sort(
    (a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at),
  )[0];
  return {
    kind: "merged-public-pr",
    repositoryId: repository.id,
    prNumber: pr.number,
    sourceSha: source.sha,
    sourceTree: source.tree.sha,
    reviewedHead: head.sha,
    reviewedTree: head.tree.sha,
    reviewId: review.id,
    reviewerId: id(review.user.id),
    authorId: id(pr.user.id),
    reviewSubmittedAt: review.submitted_at,
    meaning:
      "Independent engineering review evidence for this exact tree; not automatic semantic/business approval.",
  };
}
// Reader is an authenticated GitHub API port; no unauthenticated fallback on denial.
export async function readReviewSubject(sourceSha, read) {
  must(sha(sourceSha), "Exact source SHA required");
  const prefix = "/repos/repformed/Player-Development-Site";
  const [repository, source, prs] = await Promise.all([
    read(prefix),
    read(prefix + "/git/commits/" + sourceSha),
    read(prefix + "/commits/" + sourceSha + "/pulls?per_page=100"),
  ]);
  must(
    Array.isArray(prs) && prs.length < 100,
    "Complete unambiguous PR association required",
  );
  const associated = prs.filter(
    (p) => p.merged_at && p.merge_commit_sha === sourceSha,
  );
  if (associated.length === 0) return null;
  must(associated.length === 1, "Ambiguous merged source review");
  const pr = await read(prefix + "/pulls/" + associated[0].number);
  const headRepo = pr.head?.repo?.full_name;
  must(
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(headRepo || "") &&
      pr.head.repo.private === false,
    "Public review head repository required",
  );
  const head = await read("/repos/" + headRepo + "/git/commits/" + pr.head.sha);
  const reviews = [];
  for (let page = 1; page <= 20; page++) {
    const part = await read(
      prefix + "/pulls/" + pr.number + "/reviews?per_page=100&page=" + page,
    );
    must(Array.isArray(part), "Review inventory missing");
    reviews.push(...part);
    if (part.length < 100) break;
    must(page < 20, "Review inventory exceeds bounded evidence");
  }
  const permissions = new Map();
  for (const review of reviews) {
    if (
      !["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(review.state) ||
      !review.user ||
      id(review.user.id) === id(repository.owner.id)
    )
      continue;
    if (!permissions.has(id(review.user.id))) {
      must(
        /^[A-Za-z0-9-]+$/.test(review.user.login || ""),
        "Invalid reviewer login",
      );
      permissions.set(
        id(review.user.id),
        await read(
          prefix + "/collaborators/" + review.user.login + "/permission",
        ),
      );
    }
  }
  return { repository, source, pr, head, reviews, permissions };
}

export async function readExactReview(sourceSha, read) {
  const subject = await readReviewSubject(sourceSha, read);
  return subject ? exactReviewedTree(subject) : null;
}
