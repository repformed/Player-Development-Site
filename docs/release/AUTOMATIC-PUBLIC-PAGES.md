# Automatic public publishing

This lane publishes an eligible exact push to `main` through build, contained local tests, a hosted preview, exact hosted byte/header verification and public browser tests, then promotion of the same downloaded bytes. There is no routine Run workflow click, source SHA selection or expected-manifest entry. The selected source is the pushed commit, not the older pinned public release.

## Eligible changes and approval meaning

The trigger treats trusted main-branch publication as approval of eligible public presentation changes. It is not an independent business-content reviewer and is not protection against a malicious repository writer. Main remains unprotected; an authorized writer can replace a workflow. No repository or environment protection was added.

The initial automatic lane permits existing plain-text spans in `src/Home.tsx` and the four public learning/service guide HTML files, and bounded literal spacing/typography values on existing public-scoped selectors in `src/memberships.css`, `public/help.css` and `public/learn/guides.css`. It preserves bytes outside those text/value spans. Tags, attributes, links, comments, scripts, styles, JSX expressions, imports, selector/at-rule structure, visibility and network references cannot change through this lane. Unsupported edits fail before provider access.

This deliberately does **not** cover general UI/component code changes. Those, plus package benefits/prices, service policies, account/help processing, authentication, billing, private-product source, backend, dependencies, build configuration, tests and release controls require separate review and a reviewed new controller baseline. This is a limited but reusable copy/presentation publishing lane, not arbitrary-main auto-deployment. Some eligible wording changes may still fail existing product assertions and need separate review; assertions are not automatically rewritten.

## Trust and exact artifacts

The workflow checks out a separately reviewed, exact controller commit `T`. Source `S` is the push SHA. Every tracked difference from `T` must pass the scope gate; the automatic workflow must exactly match the reviewed template with `T` substituted for the bootstrap placeholder. New files, deletions, renames, modes and all other changes fail closed. Before enabling, the controller baseline integrates the actual published public fixes; it does not publish the older controller application tree.

Build, scope checks, lint/types, unit tests, 610 browser cases and 12 app cases run without provider credentials. The pinned controller derives a fresh manifest from that validated source build using a restricted static output shape, unchanged locked files, exact worker template and content-derived cache version. It does not refresh a stale golden manifest to excuse mismatches. The new manifest is bound to source/tree/controller/workflow/run/attempt. The hosted stage checks 83 served files plus consumed `_headers` metadata and effective headers, and 86 public browser cases. All browser traffic is contained by the existing deny-only proxy, except the selected public preview origin. Promotion downloads these exact artifacts and never rebuilds.

## Provider operations and failures

Only preview and promotion steps receive the existing Pages credential. Fresh current production is read after the unprivileged build passes. Main/source/tree, production-source ancestry and the healthy production baseline are checked before writes, then main and resulting deployment/pointer are verified afterward. Old manual form defaults are not used by automatic runs.

Automatic and manual Pages workflows share `repformed-pages-release` concurrency. This serializes participating GitHub workflows, not outside Cloudflare writers. GitHub and Pages do not offer a joint atomic compare-and-swap; the final pre-write checks leave a race during upload. A collision, failed verification or uncertain outcome stops and produces failure-stage evidence. There is no automatic rollback or redeploy.

A previous failed/cancelled automatic credential job blocks later automatic provider requests, even for a new commit. Prior attempts are audited. Active manual runs and new unresolved manual provider failures also block. Pending provider deployments must be reconciled first. An operator must inspect a denied or uncertain action and obtain any required authorization before a reviewed reconciliation; a new push is not permission to retry it. Automatic run-attempt reruns are rejected. Failed unprivileged builds with skipped provider jobs do not themselves create a provider-operation block.

Artifact retention is seven days for candidates/previews and thirty days for production proof. Durable handoff archives preserve evidence separately. Bounded inventories fail closed if incomplete; they are not silently treated as safe.

## Acceptance status

Source implementation, independent review, remote configuration, enabled trigger, successful first automatic run, and independent production reconciliation are separate milestones. A local simulated success does not prove automatic publication is enabled. Record the real event, `T`, `S`, tree, run, test counts, manifest, preview and production identities before checking that off.

The prior authentication-specific denial remains in force. This work does not enable private authentication, billing, minors, deletion, notifications or paid launch. The previous production HTTP 403 is not retried; hosted CI checks of its newly created preview and read-only provider/artifact continuity remain distinct from a new full custom-domain byte check. No new credential, environment, token scope or access permission is needed by this lane.

### Overlapping pushes

A source superseded before upload is recorded as **confirmed no write**, with `ready=false`; it is not a failed/uncertain provider operation and does not block the newer queued source. A healthy production-baseline change detected before write is likewise a no-write outcome, not permission to retry the old operation. If main changes during an upload whose provider result is subsequently confirmed, the receipt records the confirmed write and `sourceSuperseded=true`; a superseded preview is not promoted. It is never labeled a no-write outcome or rolled back. Denied, cancelled-after-start, missing/uncertain write outcomes still block.

A credential job that failed in checkout/install/artifact preparation is distinguishable only when its exact provider step is explicitly recorded as skipped. Missing or started provider steps are not assumed safe. Provider-list pagination uses the existing supported twenty-record page size and fails closed if bounded reconciliation cannot complete.
