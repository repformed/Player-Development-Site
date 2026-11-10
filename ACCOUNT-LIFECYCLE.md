# Adult pilot invitations and account closure

The website and native app add Owner-controlled adult invitations, verified recipient acceptance, full customer account erasure, and assisted review for staff/guardian-managed accounts. Public signup, junior gates, payments and existing roles stay closed/unchanged. [Account help](https://repformed.com/account-help.html) explains the controls.

## Invitation workflow

Owners choose Parent, Athlete, Coach or Manager and confirm the exact email before the server requests an Auth invitation. The server verifies the current session and the database checks the actual Owner role; user metadata cannot grant staff access. New Owner invitations are deliberately excluded. Existing access management can grant Owner after verified adult setup.

Private invitation rows bind the intended email/role, inviting Owner and provider-created recipient ID. Only the verified matching recipient can accept, with explicit adult/pilot privacy acknowledgements. Cancelled/expired invitations and invitations from a demoted Owner cannot activate. New post-migration identities cannot fall through to the legacy setup RPC. Already verified identities without an account level can receive a new setup approval without another email; configured accounts use existing role management.

Stable request IDs suppress repeated sends. Failed sends wait 60 seconds before an explicit retry, with five attempts per request and ten new invitations per Owner/hour. Ambiguous/preparing delivery is not success: refresh before cancelling/reissuing. A queued provider email may arrive after cancellation, but cannot activate its cancelled invitation. Pending invitations expire after seven days; the actual email token follows the provider's shorter expiry (currently one hour). There is no automatic deletion of expired Auth stubs or invitation records yet.

The dedicated project currently has **no custom SMTP sender**. Default-provider restrictions/rate limits can block invitations to new customers. UI states distinguish delivery setup failure, unconfirmed delivery and recipient acceptance. No real recipient emails are sent by development tests. Connecting a dedicated sender requires an Owner-selected sending address/provider and its supported secure configuration; no SMTP password or service key belongs in chat, source or public files.

## Full customer erasure

Customers review counts, re-enter their current password and type DELETE. The client checks the reauthenticated identity matches the displayed account and pins the function call to that exact access token. The server validates that token through Supabase Auth, then checks its verified password AMR timestamp is within five minutes. A freshly refreshed token alone is insufficient. The deletion target is the verified caller, never an arbitrary client-supplied user ID.

The checked service RPC protects Owners, staff/content owners and guardian-managed identities. Eligible adult customer requests freeze profile/role writes and private training/review access. Storage insert/update guards share a transaction lock with closure initiation so in-flight reservations cannot create new authorized objects after cleanup starts. The server enumerates only this household's private review paths and this person's submitted clips, removes them through the Storage API, verifies metadata cleanup, clears their owned account records and deletes the Auth login through the Admin API. It does not directly delete real Storage metadata with SQL.

Failures stop before later stages and retain a frozen request for retry. The app rechecks private account state and shows a deletion-only screen after reopening an unfinished request. Auth erasure is definitive even if saving the final operational receipt fails; such a response reports `deleted: true, receiptSaved: false` rather than asking an erased user to sign back in. Another household's independent profiles/history/login remain; reporter IDs are cleared by the existing Auth foreign keys. No real customer deletion occurs during acceptance tests.

Staff and guardian-managed accounts create assisted review requests. Owners can mark a request reviewed without claiming deletion. Ownership transfer, trusted guardian review and any staff-content reassignment/erasure require the documented operator process; this release does not automate arbitrary staff or minor erasure. The last Owner cannot be removed by these customer controls.

## Verified backend status

Migration 010 is installed once and the protected function is active. A rolled-back database rehearsal confirmed invitation activation, frozen access and erasure isolation. A separate real API acceptance created two temporary fictional adult customers, uploaded original test clips and deleted each through its password-authenticated account endpoint. The first erasure preserved the second household; the deleted login and old token were rejected. All synthetic Auth/profile/media fixtures were removed and the original Owner/user/profile/media counts were preserved. No real invitation emails or customer deletions occurred.

## Deployment and authentication boundary

Migration `010-account-invitations-and-closure.sql` follows 009 and must be applied once only after tests and the rolled-back live rehearsal pass. No existing signup, email, payment or child-access settings are altered. `public/content-config.json` uses `accountLifecycleEnabled` to expose the new controls after the backend is installed.

Deploy `backend/functions/account-lifecycle/index.ts` and `handler.ts` together as the dedicated project's `account-lifecycle` Edge Function. The function uses Supabase's built-in server environment (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`). Never copy these into the frontend or request them in chat. The new function has gateway `verify_jwt: false` for compatibility with current publishable keys/asymmetric user tokens, and **every privileged request independently validates its exact bearer token with Auth `getUser` before doing anything**. Anonymous, deleted, unverified or invalid sessions are rejected; OPTIONS only handles CORS. This replaces no existing function's protection and changes no global Auth settings. Database service RPC execution is denied even to authenticated Owners and granted only to `service_role`.

Only the project website and known native/development origins receive CORS permission. Requests are bounded to 4 KB; unknown fields, arbitrary targets and Owner invitation roles are rejected. Responses are no-store and do not expose provider credentials/raw service errors. Real media cleanup uses the private review bucket only; staff training-media ownership is an assisted path.

Use `npx deno check backend/functions/account-lifecycle/index.ts` to check the deployed runtime code. Unit tests exercise the pure server handler; PostgreSQL policy tests cover migration isolation/guards, and Playwright covers the actual SDK, forms, failures, cancelled/repeated actions, refresh, account activation, erasure and phone accessibility. Browser fixtures intercept fictional services and never send emails or remove real accounts.

## Remaining launch decisions

Choose the dedicated sender/support address and verify real delivery after configuring it. Define invitation/expired-account cleanup, operational-receipt retention, backup/security-record retention and the final privacy/support terms. Provider backups and already-downloaded copies are not erased by this action. Real juniors remain blocked pending verified consent and age-transition work. Physical iPhone email handoff and the new account controls still need pilot acceptance. Billing, external TestFlight invitations and public App Store review remain separate work.
