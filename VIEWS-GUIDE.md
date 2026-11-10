# The website, one customer demo, private workspaces

The main website is https://repformed.com/. It presents one football training platform with personalized workouts, guided practice and account support. Parents manage family athletes; adult athletes manage their own training. These are account setup choices, not separate products or membership tiers. The header shows **Log in** for visitors and **My workspace** for signed-in members. The homepage keeps its main **Try the demo** button; every public demo button leads to the same customer experience at `#demo`.

The photographic theme uses black, warm white and orange, with an edge-to-edge training film, large type and photo-led family/solo sections. It uses licensed adult-training footage, separate family/solo football photographs and an empty-football-field still; credits are linked on the page. The silent hero footage loops without Replay, Pause or motion controls; a real still appears automatically for device reduced-motion preferences or unavailable playback. These are promotional stock images, not coaching lessons or actual members. Visual changes do not enable public signup, child access, paid content or checkout.

## One guided demo

The demo asks **Who are you setting up training for?** Visitors choose **Parent & family** or **Solo athlete** as account-management options within that same training platform. There is no public staff-role gallery or separate Owner/Manager/Coach demonstration.

- Parent & family: choose or add a fixed fictional athlete, decide who records practice, try that athlete's screen within the same journey, and return to approve the report or ask for another practice.
- Solo athlete: meet fictional Morgan, follow a guided sample workout, and see self-reported practice history without parent approval.
- Exit demo returns to the public website. Sample data stays in this browser under `pd-family-demo-v1` and is never imported into real accounts. No real child accounts, real users or payments are created.

The older guided-training, sample-drill and demo-history routes remain internal sample activities. They are not a paid training library. Old family/consumer preview links resolve to the single `#demo` entry. Old staff preview links resolve to `#workspace`, which requires real sign-in.

## Real signed-in workspaces

| Account        | Route        | Working experience                                                                                                                                     |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owner          | `#workspace` | Account-level management, all accessible staff content, upload entry and launch readiness.                                                             |
| Manager        | `#workspace` | Content overview and editing across coaches; no account directory or level grants.                                                                     |
| Coach          | `#workspace` | Own-content overview, publishing and editing; no private household access.                                                                             |
| Parent         | `#workspace` | Private family roster, profiles, per-athlete training, permission and review controls.                                                                 |
| Adult Athlete  | `#workspace` | One profile and its private illustrative practice/history, standalone or family-linked.                                                                |
| Junior Athlete | `#workspace` | Simpler individual training when an eligible junior connection exists. Real junior enrollment/access remains closed pending verified guardian consent. |

Workspace selection uses the authenticated, server-assigned level. Junior presentation uses the private athlete age/context. `#access` requires Owner access. `#account` keeps setup, recovery, privacy and sign-out. Staff do not automatically gain private family data. Staff publishing requires a real authorized login; the optional browser-local practice editor is available only within the authenticated staff studio.

## Protected content

Migrations 001–008 are already applied to the dedicated project; do not rerun them. Shared uploads default to `member_only`. Owners/Managers review across coaches; Coaches review their own protected resources. Anonymous/unpaid Parent/Athlete accounts cannot read protected metadata or request signed media. The bucket stays private. Explicit **Public demo sample** is the only free shared-content choice.

Protected uploads can be explicitly assigned to verified pilot accounts, with age/position/level checks. Paid subscriptions, automated package entitlements and checkout are not active. Real plans use only assigned eligible uploads, never imported sample catalog drills. Signed media URLs expire after five minutes; previously issued bearer links last until expiry. Resource state is isolated by authenticated identity and role and cleared on sign-out, and private data does not enter demo storage or service-worker cache.

## Before general launch

Define packages and recurring billing, failed-payment and cancellation entitlements; complete reviewed real training and media rights; verify live email/recovery, physical-phone video playback and actual staff access; finish verified parental consent, age transition, retention and support. Public registration and real child enrollment remain closed. No athletic, scholarship or recruiting outcome is guaranteed.

## Complete workout templates

Staff open Content → Build a complete workout (`#workout-builder`). Owners/Managers manage templates across staff; Coaches manage their own. Owner-only account assignment supplements existing manual loose-drill grants without changing video permissions. See [WORKOUT-GUIDE.md](WORKOUT-GUIDE.md).
