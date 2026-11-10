# Repformed — football training platform

Production is the existing Cloudflare Pages project **repformed**, at **https://repformed.com/**. Deployment is manual and only happens when the Owner requests it; source pushes do not deploy production. The saved Repformed cloud environment includes the scoped Cloudflare credential and pinned Wrangler tool. Verify its account/project and the tested source revision, then use `wrangler pages deploy dist --project-name=repformed --branch=main` through that environment. Verify the returned deployment and actual production content before calling a release live. `npm run deploy:pages` remains the GitHub Pages fallback only.

The integrated Repformed identity retains Contact, approved-answer Quick Help and the single fictional customer demo. Five verified social profiles share `public/social-links.json` across the site, app help, online guides and illustrated PDF. Native name/icon/splash assets are prepared in source; installed iPhone apps still require a separately tested TestFlight update. [Release review and validation](docs/brand-review/RELEASE.md).

A standalone, responsive player-development platform with a sport-neutral brand and American football as its only current training program. Future sports have not been chosen or announced. This project is independent of Coach Workroom and Spawnative; it uses neither their code, brands, accounts, nor hosting.

## Show a partner how it works

The public [Contact page](https://repformed.com/#contact) links to the Owner-approved business inbox, **Repformed@gmail.com**, and offers searchable, authored answers about training, accounts, app access and reviews. The email button opens the visitor's email app; it does not claim a message was sent. See [contact and public help](CONTACT-HELP.md) for updates and the separate automatic-email setup.

[Open the illustrated website and app walkthrough](https://repformed.com/partner-guide.html), or [download the PDF](https://repformed.com/partner-guide.pdf). The public guide uses fictional screenshots and walks through login, staff tools, uploads, approval, assignment, customer practice and optional video review. See [PARTNER-GUIDE.md](PARTNER-GUIDE.md) for updates and scope.

## Latest connected training workflow

Native TestFlight build **0.1.0 (12)** and the verified website include iPhone MOV/HEVC preparation, actual transfer progress, shared private drafts with Owner/Manager approval, approved drill-to-workout handoff and private unfinished-workout resume. [Shared review-service workflow](SERVICE-FULFILLMENT.md) · [Release checks and limits](APP-TESTING.md) · [Upload guide](UPLOAD-GUIDE.md) · [15–20 minute two-phone test](PHONE-ACCEPTANCE.md). Physical phone acceptance and original reviewed training content are still required; public enrollment, payments and real junior access remain closed.

## Private member accounts — connected for an adult pilot

Open [Member access](https://repformed.com/#account). The dedicated backend is connected for an invite-only adult pilot. Public registration remains closed; existing pilot accounts can sign in and reset their password. The repository now includes adult signup, email verification/recovery, private parent/adult account setup, private player create/edit/delete, identity isolation and server row-level security. Real under-18 enrollment and child self-access remain closed at the database until verified consent/privacy setup is complete. Parents can explore the complete family flow using fictional sample athletes. No demo records are imported. No payment package or price is needed for profile setup.

See [backend setup and current pilot status](backend/SETUP.md). Migrations 001–011 have been applied to the dedicated owner-controlled project; do not rerun them. Live database privacy checks pass and the existing Owner is verified; broader physical-device/email acceptance remains required. Do not add real child information in the pilot. Full customer account deletion now removes the Auth login and owned media/data after password confirmation. Staff and guardian-managed closure use assisted review. Private reports for assigned matching uploads and parent reviews sync through the backend. Payments and advanced progress measurement remain future work.

## Private invitations and account closure

Owners can prepare adult Parent/Athlete/Coach/Manager invitations and review activation/cancellation. Recipients accept their intended level after verification and adult privacy acknowledgements. Customer deletion rechecks their password, cleans private clips/data and removes the login; Owners/staff/guardian-managed identities use review. The dedicated project still needs a custom SMTP sender for reliable new-customer email delivery. Public signup, payments and juniors stay closed. See [ACCOUNT-LIFECYCLE.md](ACCOUNT-LIFECYCLE.md) and [account help](https://repformed.com/account-help.html).

## Account levels

The five access levels are **Owner, Manager, Coach, Parent and Athlete**. Owners manage levels for existing verified adult accounts; Managers manage all shared training content; Coaches manage their own resources; Parents add family athletes, choose self-recording permission per athlete and review reported workouts; Athletes use one individual profile, standalone or connected to a family. Your own Owner access is protected. Staff do not automatically receive private player access. Level changes are enforced and audited in PostgreSQL, with version checks and protection against signup-metadata escalation. Use **My account → Manage account access** as an Owner. These levels do not activate payments or open children's enrollment.

## Family athletes and workout review

Try [the guided customer demo](https://repformed.com/#demo) without signing in. A parent can add a sample athlete, allow or pause self-recording for each individual, then review their reported practice. Switch to that athlete's view to try a guided sample session, and back to Parent view to approve it or request another practice. The Solo athlete journey keeps self-reported history without parent approval. The optional athlete screen is a step within the parent journey, not a separate public role preview. Its fixed fictional profiles/history stay in this browser under `pd-family-demo-v1` and never import into real accounts.

For real private pilot profiles, open **My account → Workouts & permissions**. Parents may generate a one-time private connection code for an eligible athlete's separate verified account. Each athlete accesses only that individual profile, not siblings or parent controls. Family reports are pending until parent review; standalone adult practice is labeled self-reported. Server metadata derives titles/minutes from assigned, eligible published uploads. Parent review is not evidence of improved athletic ability. Unfinished practice can be saved privately with Save & leave workout and resumed after reopening/refresh. Current access and content/assignment versions are rechecked; submitted reports and reviews are saved remotely.

The live child gates remain closed. Child self-access additionally requires a trusted consent-review record; parents cannot self-certify it or bypass it by editing age bands. A known guardian-managed account cannot reset itself into an adult/parent account after revocation. Adult family connections require the adult athlete to accept; existing independent profiles are never silently merged or discarded. Private adult account invitations are implemented; dedicated email delivery, reviewed curriculum and the full verified-consent/age-transition/support process remain launch requirements.

## The website and one customer demo

Open [the website](https://repformed.com/). It presents one football training platform; parent-managed and individual accounts are setup options, not separate products or membership tiers. **Try the demo** opens one [guided customer demo](https://repformed.com/#demo), with Parent & family and Solo athlete options under **Who are you setting up training for?** There are no public Owner/Manager/Coach previews. Real signed-in accounts open their assigned [private workspace](https://repformed.com/#workspace); old staff-preview links now require sign-in. See [the workspace and demo guide](VIEWS-GUIDE.md).

## Easy workout uploads

Open [Coach studio](https://repformed.com/#coach) and sign in with an authorized staff account. Shared website is the default; browser-local practice publishing is also limited to signed-in staff. Choose a file, add purpose, equipment, practice steps, coaching cue and audience, preview and save a private shared draft for review. An Owner/Manager approves publication; Coaches submit their own drafts. New shared uploads can be explicitly saved as a device draft and restored after refresh; they are not cross-device drafts and are cleared on sign-out. Shared uploads default to protected staff review. See the [phone upload guide](UPLOAD-GUIDE.md) for steps, visibility and draft limits.

## Complete workout builder

Staff can combine approved protected uploaded drills into a named ordered workout, preview and save it, and an Owner can assign it to an eligible account. Assignment preserves the saved version and order; history retains its name. See [the workout builder guide](WORKOUT-GUIDE.md) for the one-current-workout-per-account scope, eligibility, revisions and removal. No billing or junior enrollment is activated.

## Run locally

Use Node.js 24 (see `.nvmrc`) and npm. No account, API key, database, or application environment variables are needed to run the fictional demo. Real member profiles and shared publishing require backend activation.

```sh
npm ci
npm run dev
```

Open the address printed by Vite on your own computer. To test a production build:

```sh
npm run build
npm run preview
```

The `dist/` folder is a static website with relative asset paths and hash navigation, suitable for a subdirectory on GitHub Pages or another static host. Serve it over HTTP(S); opening `index.html` as a file is not supported by ES modules or browser storage.

## Connected experiences

- Professional homepage and immediate demo entry without sign-in.
- Four fictional sample players plus adjustable age, football position, experience, and primary goal. No name or contact information inputs in the fictional demo. Every minor profile is parent-managed.
- Today's Training: deterministic matching, age-eligible drills, suggested duration/equipment, explanation, and resumable sessions.
- Ten original illustrative, noncontact practice resources. The youngest group has separate, short, parent-led activities. All age/position/level/goal combinations have a foundational plan; position-specific resources appear when available.
- Guided lessons, ordered practice steps, coaching cues, breaks, next drill, optional reflection, and explicit confirmation of practice. Watching media alone never creates a practice record.
- Combined library filters for search, age, position, experience, and skill; drill detail and age/level/position eligibility checks.
- Per-profile practice history, estimated planned minutes, reflections, reset confirmation, and idempotent recording. Participation is self-reported, not evidence of athletic improvement.
- Staff content studio: select a file, write instructions, set audience and primary goal, preview matching fictional profiles, and publish once to the local library; edit instructions/audience, keep or replace media, and remove resources with confirmation. Shared attachments support MP4/MOV/WebM video, PNG/JPEG/WebP, PDF and plain text, up to 40 MB. Native iPhone preparation converts supported recordings into a smaller H.264 MP4; browser MOV playback depends on the codec. Video and images preview; PDFs/text download. No embedded executable HTML/SVG uploads.
- Future package concepts without prices, payments, signup, or promised scholarships/recruiting results. Other sports are future offerings only.

## Athlete-first design and real footage

The public website uses an original high-contrast sports identity: an edge-to-edge training film, oversized condensed type, black and warm white chapters, orange accents and large photographic family/solo sections. `src/Home.tsx` owns the public marketing composition and `src/editorial.css` carries the identity into navigation, memberships, forms and the single customer demo. Football is the only current program; future sports stay inactive. The homepage’s visible demo buttons all lead to `#demo`, with Parent & family and Solo athlete choices inside that one experience. There are no fabricated testimonials, affiliations or results. D1 Training was reviewed as a visual reference; none of its media, copy, design assets or branding are included.

The homepage uses a locally hosted, licensed eight-second montage of real adult training: sprint preparation by Airam Dato-on and agility footwork by KoolShooters, via Pexels. The video is silent, autoplaying, inline and continuously looped, with MP4/WebM formats and a real still poster. There are no Replay, Pause, reduced-motion or theme-selection widgets. Device reduced-motion preferences are respected automatically with the still poster. Footage is decorative stock material, not coaching instruction, testimonials or actual members. Source/license details and edits are recorded in [media credits](public/media/credits.txt).

The family and solo sections use distinct licensed football photographs by Bruno Felix and Thomas Ronveaux, independent of the hero footage. The football-program section uses an empty-field still by Creative Ruckus. These images are promotional stock material with source/license credits, not actual members, families or coaching instruction.

Playback automatically stops while offscreen or in a hidden tab and resumes when visible. If autoplay or a codec/network fails, the real poster remains visible and the website/demo still work. The still poster, editorial images and credits are part of the offline app shell; the promotional videos are not precached. These media states never record a workout. Football remains the only current program, future sports stay inactive, and the single Parent & family / Solo athlete demo is unchanged.

## Installable phone app

The member app now centers on **Today, Workouts, Progress and Account**. Parents can switch athletes, follow the selected plan, review reports and manage recording permissions under Account. Athlete accounts see only their authorized individual profile. Staff keep their authorized content tools. The website remains the public explanation, programs/packages and joining experience; both clients share the private account service. Practice history records participation, never a verified ability score.

The native iOS project is in `ios/` with a repeatable Mac simulator build/test workflow. `npm run build:ios` bundles the shared client and synchronizes native plugins; `npm run open:ios` opens Xcode on a Mac. Native sessions use the iOS Keychain. Native build 0.1.0 (12) is verified available in the existing Owner Testing TestFlight group. Unsigned archives and simulator builds remain development artifacts. See [phone app testing](APP-TESTING.md).

The mobile welcome and persistent navigation are also available at https://repformed.com/?source=app#app for immediate Safari/home-screen testing. The website continues to use its public homepage. Both clients use the same real account permissions. The single fictional customer demo stays on the public website and is blocked in the native app; demo history never becomes a real profile.

The `#install` screen explains iPhone/Android home-screen installation. The production build includes an app manifest, original local icons and a scoped service worker. After initial online setup, built-in fictional sessions and local progress can reopen offline. Shared resources, sign-in, uploads and updates require a connection; media may not work offline. Updates require a confirmed reload rather than interrupting training. Installing does not sync browser data. This is an installable web app, not an App Store or Google Play release. See [APP-TESTING.md](APP-TESTING.md) for device steps, update behavior and tests.

## Storage and prototype limits

The separate fictional demo stores profiles, history, active sessions and resource metadata in versioned `localStorage`, validated with Zod; local demo files use IndexedDB. Real private accounts, shared drafts/approval, assignments, history and saved practice use the connected backend. Explicit staff device-upload drafts use account-keyed IndexedDB and do not sync. Blob URLs are temporary playback/download references, created when needed and revoked when views close.

Data stays in the current browser and origin. Your partner will see the same built-in samples, **not** your local progress or published resources. Clearing browser site data removes saved content. Private browsing and quota/storage restrictions may prevent persistence; visible error messages explain when changes are temporary or publication fails. Unsaved editor changes are temporary; explicitly saved device drafts can be restored until sign-out/account switching or storage removal. Sample profile histories are isolated from one another.

Shared publishing uses the connected backend with verified staff roles and server-enforced content approval. Its Supabase client, migration and activation checks are described in [backend/SETUP.md](backend/SETUP.md); the owner-supplied Supabase connection is configured and the database privacy checks pass. Real adult pilot accounts are separate from the fictional public demo. Public enrollment and children’s enrollment remain closed pending the documented launch requirements. There are no actual training assessments, AI coaching, public player profiles, messaging, medical advice, checkout, or real child records. The content studio requires authenticated staff access; its optional local practice editor stays on the signed-in staff device. All training content is illustrative and pending qualified coaching review.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium # only if a compatible Chromium is not already installed
npm run test:e2e
npm run test:app # builds and checks the production service worker
```

Playwright uses its installed, managed Chromium on CI. Locally it prefers `/usr/bin/chromium` when present. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select another installed Chromium. The test suite starts Vite automatically. Desktop and phone projects cover onboarding, guardian acknowledgment, every selection control, session steps, pause/resume, refresh persistence, repeated completion, profile isolation, filters, upload cancellation/rejection, matches, publish/retry behavior, media playback, storage errors, destructive-action cancellation, memberships, multiple viewport widths, route focus, native video looping and fallback, automatic reduced-motion behavior, and automated WCAG A/AA checks. Additional tests exercise real service-worker caching/offline completion/update confirmation, intercepted shared-service publishing across two visitor contexts, and actual PostgreSQL RLS with Auth/Storage schema fixtures. Those fixtures do not replace live-provider acceptance checks after setup. Axe checks do not replace a human accessibility audit.

To test the production server or a deployed website with the same journeys:

```sh
DEMO_BASE_URL=https://your-verified-demo.example npm run test:e2e
npm run test:app # builds and checks the production service worker
```

Tests use fresh isolated browser contexts, original test media, local browser storage, embedded PostgreSQL and intercepted fictional service responses. They do not contact third-party services. Screenshots are generated under `artifacts/`; the HTML report is in `playwright-report/`.

## Production hosting and optional fallback

The primary website is https://repformed.com/ (also https://repformed.pages.dev/), served by the existing Cloudflare Pages **Direct Upload** project `repformed` in the Repformed account. Source lives in [repformed/Player-Development-Site](https://github.com/repformed/Player-Development-Site). Production publishes only when explicitly requested; source pushes and checks do not publish it.

Before an approved production release, refresh and review the intended source, run its relevant checks and build a fresh `dist/` for that exact commit. Use the existing secure Cloudflare connection and installed Wrangler to upload to project `repformed`, production branch `main`. Never reuse a fictional-preview artifact for production. Record the deployed commit/deployment ID and verify the actual public site; a build or upload alone is not live-site acceptance. Report network verification limits without bypassing access restrictions.

`npm run deploy:pages` publishes **only the optional GitHub Pages fallback**, not Repformed production. Its configured project address after the repository transfer is `https://repformed.github.io/Player-Development-Site/`; that address needs separate Pages deployment/public verification before it can be called available. The account-lifecycle function still allows the legacy GitHub Pages origin, not this new origin; fallback account flows need a separate origin/callback review before use. Do not change security settings as part of publishing or reference cleanup. GitHub does not redirect the old owner's Pages website. Only run this command when a fallback release is explicitly requested:

```sh
npm run deploy:pages
```

The fallback script builds `dist/`, requires the canonical `repformed/Player-Development-Site` GitHub origin and a clean committed source checkout, then uses an isolated temporary Git index to push a new commit on top of `gh-pages`. It preserves the source checkout, checks build identity and the remote ref, and never force-pushes. It does not configure Cloudflare, DNS, credentials or repository settings.

Check the fallback's Pages workflow and actual deployment URL after publication. `checks.yml` validates source pull requests and `main` pushes; it does not deploy Cloudflare. The manually dispatched `pages.yml` is an alternative only for repositories already configured with GitHub Actions as their Pages source; do not change the current branch-publishing configuration as part of reference cleanup. Keep this project separate from unrelated projects and do not change visibility or buy hosting to publish.

## Architecture and future sports

`src/model.ts` contains typed profiles/resources, matching, filtering, session records, and persisted-state validation. `src/data.ts` holds original football sample content. `src/storage.ts` isolates persistence and media. `src/accounts.ts` and `src/MemberAccount.tsx` implement private member workflows; `backend/002-private-profiles.sql` enforces member privacy and enrollment rules. `src/Admin.tsx` implements content publishing; `src/components.tsx` contains shared UI/illustrations; `src/App.tsx` connects the user journeys.

The sports registry lists football as the only current offering, and resources carry a sport discriminator. Future-sport marketing stays generic until the next offering is chosen. Football is the only accepted content sport today. Adding a sport requires a new typed position/skill taxonomy, sport-aware profiles/matching, qualified age-appropriate content, and coverage; it is not falsely advertised as already usable.

## Before a real launch

Qualified review and replacement/approval of all instructional material; validated age and position curricula; licensed coaching media; real parental consent and age handling; privacy/legal and safeguarding review; live authentication/role activation and acceptance; moderated server-backed content/file validation, limits and deletion; live email recovery and cross-device storage validation; human accessibility/device testing; content governance and support; deployment ownership and monitoring. Recruiting/scholarship concepts need separate research and must never guarantee outcomes. Membership scope and pricing remain undecided.

## Originality and dependencies

Copy, field diagrams, layouts, and practice examples were authored for this prototype. Barlow Condensed and DM Sans are served locally with the site under the SIL Open Font License; their notices are bundled with the project. No external font service is contacted. The homepage contains licensed, locally served Pexels training footage and derived stills, including a field image by Creative Ruckus; see public/media/credits.txt. No competitor coaching videos, child images, analytics, or third-party video embeds are used. React, Vite, Zod and other open-source dependencies retain their own licenses; Lucide icons are ISC-licensed. The distributed notices are included in `THIRD_PARTY_NOTICES.md` and `public/third-party-notices.txt`; development tools retain additional notices in their installed packages. No claim of trademark registration is made for the temporary product name.
