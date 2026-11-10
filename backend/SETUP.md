# Player Development backend — private adult pilot

The dedicated project `iilbulpqbuknhdpmtrvm` is connected. Migrations `001-shared-content.sql`, `002-private-profiles.sql`, `003-account-levels.sql`, `004-family-athletes.sql` and `005-content-audiences.sql` were applied once and verified against the live project. Migration `006-assigned-training-and-video-review.sql` is now also installed; it adds private assigned workouts and optional coach video review without opening billing or junior access. Migration `007-training-assignment-cleanup.sql` is also installed. Migration `008-workout-builder.sql` is installed for private workout templates and snapshot assignments. Migration `009-content-review-and-practice-resume.sql` is installed for shared draft approval, private resume and MOV/40 MB shared attachments. Migration `010-account-invitations-and-closure.sql` is installed for private adult invitations and customer Auth/media erasure. Do not rerun migrations 001–010 against this installed schema.

The site URL and exact verification/recovery redirect URLs point to `https://repformed.com/`. Email confirmation is required and passwords require at least 12 characters. Management access is supplied securely by the owner; no administrative credential belongs in the repository, browser configuration, test fixtures or chat.

## Current enrollment scope

`enabled` and `membersEnabled` connect the member area. `membersSignupEnabled: false` closes the public signup interface, and Supabase Auth `disable_signup: true` closes the signup API after the initial owner activation request. Existing pilot accounts can sign in and recover their password. This is a private adult-profile pilot, not general public enrollment.

`profile_settings.under18_enabled` remains false in the live database. The database rejects under-18 profiles even if someone bypasses the interface. Appropriate verified parental consent, privacy/retention review and a support contact are still required before opening children's enrollment. Adult ownership is self-attested. Use fictional player nicknames while testing.

Supabase's built-in email sender is restricted and rate limited. The owner approved one activation-email test. A successful send request is not proof of inbox delivery or completed activation. Before public enrollment, configure an owner-controlled SMTP sender, verify delivery/recovery on physical devices and complete privacy/support review. No SMTP provider or paid plan has been purchased.

## Verification performed

- Live project identity and public Auth endpoint checked using the owner's supplied connection.
- All public application tables have row-level security enabled. Anonymous REST reads can access published training but receive permission-denied responses for member accounts and profiles.
- Live transaction tests create only fictional temporary adult Auth/profile fixtures, exercise owner create/read/edit/version checks and cross-household read/write/delete rejection, reject account-type escalation and under-18 creation, and roll back every fixture. The cleanup check confirms zero remaining test users.
- Browser tests intercept fictional backend responses and never use the owner's live project. They cover the actual SDK, email callbacks, private-profile CRUD and account switching. Local/hosted checks and actual public deployment must still be confirmed for each release.
- Provider-issued activation/invitation/recovery links may use an implicit email callback. The app removes tokens from the URL and validates the session through Supabase Auth before showing account controls. Browser-initiated signup/recovery continues to use PKCE and requires the same browser for the callback.

## Opening public registration later

1. Finish the live email, privacy/retention/support and physical-device checks below. Keep children's enrollment closed until a verified guardian-consent process is implemented.
2. Configure a permitted SMTP sender and provider abuse/rate controls. Review current free-plan limits, inactivity behavior and terms without enabling paid billing automatically.
3. Set Supabase Auth `disable_signup` to false and website `membersSignupEnabled` to true only when adult public enrollment is approved. This interface flag is not a security boundary; server Auth and database policies remain authoritative.
4. Review and deploy the configuration through this repository's existing Pages route. Confirm the actual live URL and a real verification/recovery journey before describing signup as launched.
5. Assign account levels through the Owner's **My account → Manage account access** screen after the target person verifies their email and finishes adult setup. The `coach_members` table is now a compatibility mirror maintained by role triggers; do not grant access by editing it directly. Never grant staff levels from signup metadata.

## Five account levels

| Level   | Implemented permissions                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner   | Assign levels to existing verified adult accounts; manage all shared resources and approve/request changes. Own access cannot be changed through the website.             |
| Manager | Manage shared content across coaches and approve/request changes. Cannot assign levels or read the account directory.                                                     |
| Coach   | Create, edit and submit their own shared drafts; cannot approve publication. Can read published content from other coaches but cannot edit their drafts/resources or remove their files. |
| Parent  | Add private family athletes, control self-recording and review practice. Real under-18 enrollment remains closed.                                      |
| Athlete | Use one individual profile, standalone or family-connected. Cannot approve their own family reports.                                                   |

These are primary access levels, independent of subscription packages. Owner/Manager/Coach accounts open staff settings directly without choosing a Parent/Athlete purpose. A combined staff/family persona remains a separate product decision. No staff level, including Owner, automatically grants access to someone else's private player details. Family sharing is a specific, consent-controlled connection to one individual. Explicit pilot workout/review assignments are implemented by migration 006. Private adult staff/customer invitations are implemented by migration 010; dedicated SMTP delivery still needs setup. General staff sharing of private profiles, messaging and paid subscriptions remain unavailable.

The existing approved owner was bootstrapped as Owner through privileged administration. Other legacy coaches retain Coach access. Existing personal parent/adult purposes migrate to Parent/Athlete respectively. Guardian-managed family athletes can connect without making an adult declaration. No profiles are removed. A person cannot be switched to standalone Athlete while multiple personal or under-18 profiles exist. Family-linked athletes keep Athlete access and cannot be promoted to staff. Only Owners can call `assign_account_role`; the RPC checks verification, adult setup and the expected server version, protects self/last-owner access and records one audit event per change. Direct browser writes to levels/audit are forbidden. Access is read from the database, never user metadata or a browser selector.

Role changes affect backend permissions immediately. Open screens recheck levels on focus; users can refresh their page to update controls. Creating/resetting personal profile data cannot promote staff or change an assigned Parent/Athlete level. Under-18 independent athlete logins remain unavailable. If a manager replaces a coach's attachment, later cleanup of a file owned by that manager can require Manager/Owner access; cleanup failures are reported and never expand coach file permissions.

## Family connections and reviewed practice

Migration 004 adds per-profile controls, one active family profile per athlete identity, one-time invites stored only as SHA-256 hashes, private practice reports and parent-only reviews. Codes expire after one hour, are single-use and are revoked by new codes or permission removal. Parent-managed recording is the default. Pausing recording immediately prevents submissions while preserving history; removing a connection also removes profile/history access. An adult can accept or leave their own family connection. Existing personal profiles are not auto-merged; a profile already connected to an athlete cannot be silently reassigned.

Both `under18_enabled` and `child_self_access_enabled` remain false. Real child access requires those gates plus a trusted `guardian_access_reviews` entry for that profile. These records and gates have no browser write policy. No such review is created for a real child by this release. Guardian-managed identity markers survive link/profile deletion; a persistent minor-profile marker prevents an age-band edit from bypassing child-access gates. A qualified, verified age-transition process is required before clearing these restrictions. The old adult-setup/role RPCs were moved behind private wrappers so they cannot bypass guardian restrictions.

Reports are created only through `report_athlete_workout`; the current migration 006 implementation derives eligible titles and planned minutes from assigned published resources. Repeated submission IDs do not create duplicate practice. Family athlete reports become `pending_parent`; the parent may approve or request another practice with version checks. Parent-recorded family practice is parent-confirmed. Independent adult practice is `self_reported`. No status proves actual elapsed time, athletic improvement or video completion. Direct browser inserts/updates of records, controls or consent reviews are denied.

Real private history is fetched online and never copied to demo storage or the service-worker cache. Unfinished practice can be saved privately and resumed after refreshing without reporting completion. Parent profile-data deletion also removes owned workout history/invites/links. Separate athlete Auth identities may remain, with guardian restrictions retained; customer Auth erasure is available through verified account closure; staff/guardian-managed erasure and final retention policies need review. The family demo uses fixed fictional profiles and browser-local state only.

The live acceptance check uses only fictional adult family identities inside a rolled-back transaction. Real children are never enrolled or used as live fixtures. Offline PostgreSQL/browser fixtures exercise child paths with explicitly simulated review/gates. Public signup remains closed and no new invitation emails are sent by this feature.

## What is implemented

- Adult email/password signup, email-verification callback, sign-in, password recovery/change and browser sign-out, using one shared Supabase Auth client with PKCE.
- Empty, private member accounts with a parent/legal-guardian or adult-player type. The server requires verified email and explicit adult/privacy acknowledgements; browser users cannot alter account types or consent timestamps.
- Private player create/edit/delete, parent-managed under-18 profiles after server enrollment opens, age-band/position/experience/goal preferences, stable creation IDs, server version checks and lost-response confirmation.
- Adult-player accounts can only create adult profiles. Real child logins remain gated; there are no public profiles, messaging or implicit coach access to player data.
- Profiles are fetched online into memory. Only the authentication session persists locally; member profiles are not placed in demo localStorage, IndexedDB, the service worker cache or offline pages. Identity changes clear the member view, including cross-tab sign-out.
- Individual profile deletion affects that profile only. Full customer account deletion in 010 removes its Auth login and scoped private media/data after password confirmation; staff/guardian-managed accounts request assisted closure. Provider backup and final retention terms still need review. No payment relationship is created.
- Shared staff media drafts/review/approval/edit/replace/delete, verified staff roles, explicit public sample reads, protected staff-only content and a private media bucket with five-minute signed links, 40 MB/type limits (including MOV) and optimistic versions.
- The existing fictional profiles, local uploads and demo practice history remain separate and never import into member accounts.

## Live acceptance before activation

Use fictional adult test identities only. Do not enter real children's information during this pilot.

- Verify that signup sends a usable confirmation email, unverified users cannot complete member setup, wrong credentials fail, and expired/cross-browser callback links show a recoverable error. Verify fresh recovery emails, password changes, sign-out, token expiry and provider rate limits. A simulated API test cannot prove delivery.
- Create parent and adult-player test accounts. Create, edit, refresh and delete fictional adult profiles across two devices. Check a cancelled edit/delete, rapid save taps, a dropped response, stale edit versions and failure recovery. Switch accounts and sign out in another tab; no prior household profile may remain visible or be returned by REST.
- With the public key and unrelated authenticated account, explicitly attempt to read a known other household ID, change ownership, rewrite consent/type, grant coach access or open under-18 enrollment. All must fail. Verify under-18 create/update is rejected while the server setting is false. Under-18 positive tests require fictional fixtures in a controlled environment only.
- Delete one account's member data and confirm its player rows disappear while the second household and Auth login remain. Complete full Auth erasure through the provider dashboard when requested; define support, retention, backup and restore procedures.
- For shared publishing, an approved staff member uploads original sample media, submits a private draft and an Owner/Manager approves it; the staff member edits/replaces/removes it; a separate visitor sees published changes after refresh. Anonymous and non-coach requests cannot write, access drafts or upload storage objects. Check file size/type enforcement and stale versions. Audit orphan-file cleanup. Malware scanning/content inspection and moderation are not implemented.
- On real iPhone Safari and Android Chrome, check signup keyboard/layout, email-link handoff to the same browser, recovery, file uploads/playback, installed-app sign-in, refresh, offline status and updates. Automated Chromium phone emulation does not replace these checks.

## Still outside this activation

Live payments, package definitions, recurring billing, unpaid-access suspension, paid entitlement automation, verified guardian identity and reviewed real training prescriptions are not implemented. Manual pilot training/review assignments and the native iPhone TestFlight app are implemented; public App Store/Play Store release remains outstanding. The current training remains illustrative and pending qualified review. No pricing, player allowance, scholarship or recruiting outcome is promised.

## Separate workspaces and protected content

Migration 005 is applied. Existing and new shared resources default to protected staff review (`member_only`). Only explicitly selected `public_sample` resources can be read by visitors. Parent/Athlete sign-in alone grants no protected training entitlement. RLS restricts metadata and media-signing selection; Owners/Managers review all protected resources and Coaches review their own. Existing private-profile policies remain in force. Signed media URLs last five minutes and already issued bearer URLs remain valid until expiry. There are no package grants, payment checkout or active subscriptions. See [VIEWS-GUIDE.md](../VIEWS-GUIDE.md) for routes, the single customer demo, tests and remaining launch requirements. Live verification used only temporary fictional adult identities in a rolled-back transaction and confirmed zero remaining fixtures; no emails or child accounts were created.

## Assigned workouts and private video review

See [VIDEO-REVIEW-GUIDE.md](../VIDEO-REVIEW-GUIDE.md) for the Owner assignment workflow, adult pilot recording/upload, parent approval, coach feedback, quotas and explicit deletion. Migration 006 adds RLS-protected entitlements/reviews and a private 40 MB video bucket. No browser can self-grant access; Owner/Manager status alone does not reveal clips. Real accounts use only assigned matching uploads. The public illustrative catalog remains for the separate website demo. Do not rerun migration 006 on the installed schema.

Migration `007-training-assignment-cleanup.sql` is also installed. Withdrawing/deleting protected content prunes its member assignments and increments their access version; existing submitted video feedback remains. No client permissions or child/payment gates are expanded by this cleanup.

## Complete ordered workout templates

Migration 008 preserves existing account roles, private household boundaries, review settings and closed enrollment gates. Staff save protected templates; only Owners preview coarse account eligibility and assign snapshot sessions. Matching athletes receive all assigned drills in order; reports are bound to the opened template/version. New tables are RLS-protected and browser writes use guarded RPCs. See [WORKOUT-GUIDE.md](../WORKOUT-GUIDE.md). No real assignments or fixture records were created by migration installation.

## Content approval and private saved practice (009)

Installed and verified once. New shared resources start private in Draft; staff submit them for review. Owner/Manager alone can approve publication or request changes. Coaches manage/submit only their own drafts. Clients cannot forge publication, review status or reviewer identity through direct table updates. Edits to approved instructions/media/audience restore Draft and withdraw affected assignments. Internal notes/reviewer fields are excluded by safe-column grants and sanitized from athlete-plan responses; the full staff view uses a checked RPC. Private review audit rows are RLS-protected.

Practice resumes have no direct browser table grants. Checked load/save/discard RPCs scope them to the acting user and authorized profile, revalidate current content/assignment/permission versions, reject stale concurrent writes and expire saved places after seven days. Expired/invalid entries are removed when checked. Stable session IDs and an atomic report trigger prevent an unfinished place from remaining after recorded completion. Pausing/watching is never completion.

Live acceptance used temporary fictional adults in a rolled-back transaction. Migration installation created no real resources, assignments, profiles, media or emails. Anonymous resume/review REST calls returned 401; direct approval writes and direct access to internal notes/old private plan helper are denied. Training-media is still private, now with MOV and 40 MiB limits. The optional athlete-review bucket/quota is unchanged. Under-18 enrollment, child self-access and payments remain closed. See [APP-TESTING.md](../APP-TESTING.md) and [the phone guide](../PHONE-ACCEPTANCE.md).

## Private account lifecycle (010)

Installed once after a successful rolled-back live rehearsal. The protected `account-lifecycle` Edge Function validates each exact bearer token through Auth and uses only its built-in server credentials. Owners reserve intended adult access; verified recipients explicitly accept it. Cancelled/expired invitations cannot bypass setup through legacy RPCs. Existing legacy adult access remains available. No real invitation emails were sent by acceptance tests. The actual project has no custom SMTP sender, so new-customer delivery remains a named setup requirement.

Actual Auth/Storage acceptance used two temporary fictional adult customers and an original black-frame test clip each. After the first customer's complete erasure, the other account/profile/clip remained intact. The deleted password could not sign in and its formerly valid token was rejected. Both fixtures and the synthetic coach were cleaned; real users/profiles/Owner/media counts matched the baseline. Auth/profile/media cleanup was confirmed without real customer deletion or email delivery. See [ACCOUNT-LIFECYCLE.md](../ACCOUNT-LIFECYCLE.md) for authentication, failure states, operator review, retention limits and the remaining SMTP work.

## Shared review-service fulfillment (011)

Installed once after the rolled-back live transaction rehearsal. Customers request one review without a charge; complete uploads automatically attach to that request or create their own service record. The database sets a fixed 48-hour target only after a complete approved submission. Owners/Managers manage per-review coach assignments and follow-up flags in the shared service desk; role alone does not reveal clips or private player profiles. Actual saved coaching feedback is the only delivery transition. Browser roles cannot directly read/write the service or audit tables. Existing account-closing freezes, private Storage policies and adult-only uploads remain in force. Account/profile erasure cascades service records and their audit events.

Live API acceptance used five temporary fictional adult identities, an original black-frame test video, real private Storage upload, duplicate request retries, per-clip reassignment and feedback delivery. All fixtures were removed and the pre-test account/profile/clip/service counts restored. No email, payment or real customer record was changed. No automatic staff/customer notification or background reminder is implemented. See [SERVICE-FULFILLMENT.md](../SERVICE-FULFILLMENT.md) for the exact customer/staff workflow, elapsed-hour rule, daily operating checklist and required future payment integration. Do not rerun 011.


## Per-athlete workout assignments (012 — review draft, NOT installed)

`012-per-athlete-workout-assignments.sql` is an unpublished migration candidate.
Do not apply it during environment setup or rerun migrations 001–011. Release
review must cover the SQL diff, synthetic tests, existing data/backups, rollout
and recovery before a separate production migration is authorized.

The new table stores athlete-specific snapshots; a removal tombstone prevents a
legacy account default from reappearing. No automatic backfill or grant occurs.
Existing account assignments remain defaults for profiles without an override;
old clients can still change those defaults, so staff must understand which
athletes have explicit plans. The updated Owner picker requires the new RPCs.
Existing customer API signatures remain unchanged, and the content-review
redaction wrapper, consent gates, parent controls and erasure guards remain in
force. Owner lookup exposes only nickname and audience fields needed to select
an athlete. No Manager/Coach assignment permission is added.

Before any release, validate independent sibling plans, stale/idempotent writes,
wrong-household/profile substitution, linked-athlete isolation, parent pause and
revocation, withdrawn content, save/resume invalidation and erasure. Review the
web/native rollout together. This draft creates no weekly scheduler, billing
credits, SMTP configuration or junior access.

If rollout needs recovery, preserve the new athlete snapshots and stop new staff
assignments while reviewing a forward fix or frontend rollback. Do not drop the
new table, overwrite sibling plans with an account-wide plan, or blindly restore
older function definitions. Migration/backup and recovery approval is separate
from approval to edit this source branch.

## Grouped-review preflight (013 — review draft, NOT installed)

`013-preview-review-groups.sql` is read-only planning validation after 012, tested
only against local synthetic data. It does not create durable groups, file
reservations, review services, paid credits or deadlines. Its capability marker
is explicitly false. Applying it alone would not enable multi-clip submissions.

Durable grouped requests require a subsequent coordinated schema/trigger/RPC and
website/native workflow change described in [REVIEW-GROUPING-DRAFT.md](../REVIEW-GROUPING-DRAFT.md).
Keep the existing per-clip, account-count and shared private-media safeguards;
storage capacity is not the monthly review allowance. Neither retention nor
storage quotas are expanded by this draft. Do not apply 012 or 013 during
environment setup or without the separate migration/release approval.

## Grouped fulfillment and client-service roster (014–015 — NOT installed)

`014-grouped-review-fulfillment.sql` adds grouped reservations/submission and
private assigned-coach feedback. Creation defaults to disabled; applying the SQL
alone does not activate grouped customer uploads. Storage limits stay unchanged.
See [REVIEW-GROUPING-DRAFT.md](../REVIEW-GROUPING-DRAFT.md).

`015-staff-client-service-dashboard.sql` adds narrow service projections and
per-athlete service-coach responsibility. Owners/Managers see basic metadata for
this dedicated deployment; Coaches see only assigned athletes and limited
client context. Owners and Managers can change responsibility. This does not expand
raw-profile, family-control, private-video or feedback access, nor billing/role
authority. Review the broader Owner/Manager metadata scope before production.

The website/app `staffRosterEnabled` flag defaults to false. Follow the
[dashboard review and rollout checklist](../docs/staff-service-preview/README.md)
before enabling it. Migrations 012–015 have only synthetic local validation;
none is an environment startup step. Do not rerun installed 001–011, deploy new
policies, enable flags or grant real accounts without coordinated approval.
Retain new assignment/review records during recovery; prefer a reviewed forward
fix or frontend disablement over dropping tables or restoring old functions.

## Manual delivery checks and private inbox (016 — NOT installed)

`016-delivery-monitoring-and-inbox.sql` requires 012 and 015. Grouped-review
migrations 013–014 are optional and excluded from this release. It adds draft package,
client and athlete delivery rules, exact-version expectations, scoped staff alerts
and verified adult/guardian in-app notices. Owner-only configuration does not
change paid access or consent. Monitoring defaults off; the separate frontend
`deliveryMonitoringEnabled` also defaults false. No scheduler, recurring check
creation, SMTP, external send, device push or active submission reminder exists.
Paused/cancelled monitoring suppresses alerts/notices, not actual training access.

Do not apply or enable this during environment setup. Read the
[migration/permission review](PILOT-MIGRATION-REVIEW.md) and
[notification screenshots and boundaries](../docs/delivery-preview/README.md)
before requesting coordinated production review. Tests use local synthetic data;
they do not establish hosted permissions, real email delivery or phone acceptance.
