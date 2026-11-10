# Reviewed public-feature automatic publication

This candidate is not enabled yet. The existing narrow lane remains the deployed controller.

The intended trigger is an approved public-site change merged to `main`. The existing push workflow validates, builds, previews, checks served bytes/headers and public interactions, and promotes the same artifact. Routine releases do not require workflow dispatch, manual source selection, hash repinning, or a second user account.

## Review and authorization

Public feature code is not automatically business-approved merely because its path is allowed. Actual independent engineering review must inspect the exact PR head tree, sensitive capability changes, test quality, content authorization and public scope. A merge source must be the merged PR's actual `merge_commit_sha`, and its tree must equal the reviewed head tree. Unreviewed code cannot be laundered through a later typography change.

The selected owner-attestation policy uses the established `repformed` identity to record a real independent agent review in a commit-bound PR COMMENT. It deliberately does not pretend this is a GitHub non-author APPROVED review, a second human, or cryptographically authenticated reviewer independence. The independent reviewer must perform the review and submit its own actual conclusion; an implementation author must never manufacture acceptance. This avoids introducing an unauthorized second-account role or a recurring user approval chore.

The comment is JSON with protocol `repformed-public-review/v1`, repositoryId 1430113496, pullRequest number, exact commit and tree, decision `accept` or `withdraw`, reviewerKind `independent-agent`, and the actual native review task path. The reader binds REST owner identity to GraphQL owner node identity, requires an unedited/non-minimized submitted record, and rechecks the exact record before writes. There is no fallback to another review policy if owner evidence fails.

This is current authenticated GitHub evidence, not a durable historical audit ledger: GitHub's current review inventory cannot reveal a review deleted before the first build. Deletion after binding, replacement, editing, withdrawal or stale head fails that build's revalidation. The design does not defend against the authorized repository owner intentionally deleting all contrary evidence or replacing release controls; main is still unprotected. No repository protection/access changes are claimed or performed. An append-only external attestation service is not provisioned.

## Input and artifact boundary

Ordinary public UI modules, new `src/publicFeatures` modules, designated public styles/pages and new static assets/tests can change. Private/auth/account/billing/backend, entry points, dependencies, fixtures, workflow and build controls remain outside ordinary feature scope. Import checks are a bounded syntax guard, not a JavaScript sandbox or a semantic content classifier. Independent review remains responsible for network code, inline HTML/scripts and test assertions.

The locked compiler writes a fresh inventory outside the published site. The build step refuses preexisting compiler metadata. Copied public files bind to selected Git blobs; generated files bind to fresh compiler output; no undeclared output, reserved executable Pages path, symlink or changed deployment header metadata is accepted. Worker template, ordered precache, cache derivation and actual worker bytes are verified. A changing feature may legitimately create new hashed filenames, chunks and assets without editing an old golden manifest.

Mandatory release test identities are retained, and every collected case must pass once without retries/skips. New public feature cases are allowed. Hosted collection must match the public cases collected and passed in the source run, including new feature cases. Identity preservation alone cannot prove an assertion remains meaningful; that is part of actual review.

## Remaining enablement work

Finish combined controller acceptance, genuine public code/asset/browser regression and independent final review. Verify existing Actions token can read exact owner review metadata without expanded permissions. Publish reviewed inactive controller, record actual review against the exact candidate, reconcile fresh remote/main/production, then activate only through the established route. A successful live code-feature push, hosted preview and exact-artifact automatic promotion are required before calling the broader lane operational. No denied authentication work, hosted auth/payment acceptance, real forms, native acceptance or production HTTP 403 retry is included.
