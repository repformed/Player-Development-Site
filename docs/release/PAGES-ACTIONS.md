# Repformed Pages release preparation

The initial workflow was installed on GitHub at 6aed246; its first preview run stopped on validation before upload. This correction is prepared for the next acceptance run. It targets only account `7d7af2c3863a2d09d830f52bd459d5ba`, existing Pages project `repformed`, production branch `main`, and public source `3a08dab3cc03038a1e50424c6bbe05b63ebf2210` descended from `5e86084e30c871c3ae79c1f4d3000f9c6dfadb16`. It does not include the private launch branch. Initial independently reported production deployment is `c330a2cc-6c09-4494-a35d-fc362b639ef0`; verify it again before use.

## Prerequisites and installation boundary

An authorized repository-secret manager must securely configure `REPFORMED_PAGES_API_TOKEN` with approved Pages editing access to the target account. No credential belongs in source, artifacts or chat. Existing CLI secret-list and repository-public-key reads each returned HTTP 403, Resource not accessible by integration. No secret names, public key or key ID were obtained; no inference that secrets are absent is valid. Environment metadata listed `github-pages`; its secrets are unknown. Cloudflare dashboard token existence does not establish GitHub secret storage.

Before putting this controller on remote main, independently inspect and coordinate existing Cloudflare Git integration/automatic deployment settings. A main push could otherwise publish before this workflow's preview gate. No push, secret creation, environment creation, workflow dispatch or deployment was performed during preparation. The workflow declares no GitHub environment or environment approval protection. Separate manual preview and promotion are explicit operator gates, not a claim of protected-environment approval.

## Operation after authorized installation

1. Freeze or coordinate other Pages publishers and confirm the current production deployment ID. Workflow concurrency serializes only this workflow, not dashboard or external deployments.
2. Dispatch `Repformed Pages release` on main with stage `preview`, exact source SHA above and confirmed production ID. The credential-free build checks ancestry, lint, types, unit/build/browser/app suites and a strict approved file manifest. All Actions are commit-pinned; Wrangler 4.153.0 and dependencies are lock-pinned. CLI installation runs without deployment credentials. Existing legacy `deploy:pages` is not used; no Wrangler configuration or hosting migration is introduced.
3. Review the unique public preview and receipts. Deployed-preview browser checks intercept backend calls with fictional fixtures: they do not prove real authentication, payments, consent or hosted data behavior. Only already-public candidate assets are uploaded.
4. After the entire preview run succeeds, dispatch `promote` with that run ID, unchanged production baseline and exact manifest digest. Promotion requires the same controller commit, workflow path, manual main run and successful preview deployment identity. It downloads the tested artifact; it never rebuilds it. Read-only GitHub Actions/contents permissions suffice for this workflow, apart from the separately stored Cloudflare secret.
5. Inspect production identity and public rendering after a confirmed upload. Saved receipts identify source, controller, manifest and deployment without credentials.

## Artifact identity and failure handling

The preserved original ZIP remains unchanged. Fresh builds of the same source have shown service-worker asset ordering differences from the legacy generator. Every non-worker file must match the approved 84-file manifest byte-for-byte. The worker must exactly match the existing template, approved unique asset set and recomputed cache digest; arbitrary worker changes fail. The fresh artifact receives its own complete manifest digest. Do not claim it is byte-identical to the old ZIP. Promotion preserves the preview bytes exactly.

Project/domain/production-baseline checks occur before upload and immediately before the CLI write. Pages provides no atomic compare-and-swap in this controller; an external publisher can still race the final check. Coordinate all publishers. Baseline drift or authorization errors stop before writing. A CLI failure or unconfirmed reconciliation means the write outcome is uncertain: inspect existing deployments before any retry. There is no automatic reupload or rollback. CLI output is captured rather than exposed; GitHub tokens are removed from its child environment; deployment secrets are scoped only to deployment steps and excluded from artifacts.

## Acceptance limits

Local controller tests, manifest checks, YAML inspection, lint and typecheck do not prove GitHub runner execution, token permissions or Cloudflare upload acceptance. These remain pending authorized setup and an actual preview run. No production, private product activation, real account/data, app-store or device acceptance follows from this work.

Reference: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/

## First Actions acceptance correction

Initial preview run 42286535990 stopped before upload: 383 unit cases and 526 browser cases passed; 14 browser cases failed. Generated guide/policy routes were served through the development-server fallback, and the startup test still expected the previous heading. The candidate now tests a fresh compiled server on a strict localhost port without server reuse and asserts the approved current fallback heading. No application/static asset source changed; the existing approved artifact manifest remains enforced. No cases were skipped, retries enabled or assertions relaxed. The new source descends from the original 4e71045 candidate and its reviewed controller. A new successful full preview is still required.

## Deterministic review fixture clock

Second preview run 42292267312 stopped before upload with 539 browser cases passing and one failing: the fictional review fixture read the wall clock separately for ready and due timestamps, yielding 48 hours plus one millisecond. Actual SQL already derives due from the same ready timestamp. The fixture now captures one injected clock reading; regression assertions retain the exact 48-hour difference and check immutable timestamps after completed reload. All 48 affected fixture-consumer browser cases, 20 SQL/unit cases, lint and typecheck passed locally; independent review found no remaining concrete issue. No application asset or business-policy source changed. A new complete preview is required; the failed run is not acceptance.

## Canonical account-help route acceptance

Preview run 42295078207 completed the build and public preview upload, but two of 16 hosted checks expected the .html URL after browser Back. Cloudflare canonicalizes that page to the extensionless path. The test now accepts only the intended page forms, captures the server-selected URL, and requires exact return to that URL plus the deletion-help heading. Content, keyboard, accessibility, recovery and mailto checks remain. Four ordinary local checks and all 16 checks against a local canonicalizing server passed. Direct executor requests to the hosted preview failed certificate validation before assertions; certificate checks were not disabled or retried. Independent review approved the test correction. Hosted acceptance remains pending a successful new GitHub preview run; no production promotion follows from the local result.

## Public usability release preparation (2026-11-09)

Public source `253e6b72d6c996d0d3b92b31776d794baea7959a` (tree `979ce9d86833cc60a38ce7b26d278d4a9e26525e`) preserves runtime candidate `633c2de` and only adjusts its two read-only test guards for the selected Repformed deployment origin. The allowlist itself does not establish URL immutability. The trusted controller binds deployment identity, source/control/run IDs and the downloaded build; hosted verification checks every publicly served artifact byte before promotion. Cloudflare consumes `_headers` instead of serving it: its approved local bytes are bound separately and each configured response header is checked on its served target.

The original 610-case local pass remains separate from 58 later investigative executions. Fourteen historical synthetic-host CONNECT attempts remain individually unattributed. Later tracing reproduced an OPTIONS preflight for `training_resources` near the privacy-popup case's end, distinct from intentional interest-POST aborts. A worker-blocked control also reproduced it, so worker/teardown causality is unproved. No application or authentication networking code was repaired. The same deny-only proxy contains unhandled browser traffic in CI; original suites, assertions, workers and timeouts remain. Complete first-attempt acceptance requires zero skips or retries and exact 610/12/86 release-source case counts.

The reviewed runtime manifest digest is `f8abc0abd36e5a551ed6902eeb3d13c62b0c50b675f5a9bfa94200338143485c`. Old `d929` preflight raw worker bytes were absent. A fresh comparison with actual retained production `3a08dab3` proves unchanged worker logic; generated asset names and the content-derived cache version differ. Do not change expected hashes to excuse a CI mismatch. Independently review any permitted worker-order variation before promotion.

Production was freshly verified as `46157695-dd12-4522-b25e-abcdce6e4fa9`; `initialProductionId` retains the historical `c330` identity. Reverify before writes. Pages remains manual. Credentials remain confined to upload/promote jobs. Promotion still requires a successful same-controller preview and the identical downloaded bytes. No signing, account, payment, youth or retention settings are activated.
