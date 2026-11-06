# Repformed Pages release preparation

This workflow is prepared locally, not installed or executed on GitHub. It targets only account `7d7af2c3863a2d09d830f52bd459d5ba`, existing Pages project `repformed`, production branch `main`, and public source `4e71045c6e6928442819e184228d9eb48b64ae0a` descended from `5e86084e30c871c3ae79c1f4d3000f9c6dfadb16`. It does not include the private launch branch. Initial independently reported production deployment is `c330a2cc-6c09-4494-a35d-fc362b639ef0`; verify it again before use.

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
