# Growth Starter — Phased Implementation & Acceptance

Project: `sohail654312-gif/codeedge-growth-starter`
AppDeploy ID: `codeedge-growth-starter-5jhvfk`
Baseline: 2026-10-08

## Phase 1 — Foundation (deployed, pending independent acceptance)
- [x] Standalone app created; deployed AppDeploy source mirrored into GitHub
- [x] Read-only synthetic clinic demo, responsive Codeedge dashboard
- [x] Authenticated, owner-scoped business onboarding and profile
- [x] Enquiry tracking with status updates and bounded reads
- [x] Content requests and private image upload UX
- [x] SEO/AEO/website planning UI
- [ ] Repeat authenticated CRUD, media and cross-user denial tests against deployed backend
- [ ] Reproducible full build/test outside AppDeploy SDK runtime

## Phase 2 — Agency operations and security (next, open)
- [ ] Workspace IDs, tenant memberships, server-enforced owner/admin/staff/client permissions
- [ ] Denial tests for tenant isolation on all read/write/upload routes
- [ ] Real admin-managed onboarding, invitation and task approval queues
- [ ] Audit events with actor, workspace ID, request ID and immutable event timestamp
- [ ] File MIME signature verification, abuse controls, quotas, retention and deletion
- [ ] Privacy policy, data minimization and suitable consent before real pilots
- [ ] Production-grade CI, typecheck, full backend and auth integration tests

## Phase 3 — Provider-neutral integration (not started)
- [ ] Authorized Google GBP/Search Console/Analytics read-only adapters
- [ ] Versioned read boundaries to Business OS and CIGO with evidence/authorization
- [ ] Consent and tenant-token isolation; secret rotation; disconnect/kill switch

## Phase 4 — Reviewed AI growth workflows (not started)
- [ ] Media requests and approvals, AI-assisted content drafts
- [ ] Provider-neutral posting adapters, explicit publishing approval
- [ ] Opt-in scheduling, cost controls and audit trails (no unapproved external effects)

## Phase 5 — Commercial and acceptance (not started)
- [ ] Subscription operations, billing gates, monitoring, backups and rollback
- [ ] Security, reliability and accessibility audit
- [ ] Pilot sign-off then measured production release

## Non-negotiable rules
Single-writer, manual execution. No background AI agents without explicit instruction.
No changes to existing MVP, Business OS or CIGO repositories.
No self-certified phase closure: exact-SHA, independent acceptance evidence required.

## Incremental Phase 2 proof (engineering branch; do not merge without independent review)
- [x] Domain rules for owner, agency_admin, staff, client and permission checks
- [x] Server-verified owner workspace selector and deny-by-default grants
- [x] Existing Phase 1 `gs_<type>_<authUserId>` records reused without copying (see MIGRATION.md)
- [x] Client-proof request approval state machine; no direct public posting
- [x] Strict profile/enquiry/request inputs and paginated list endpoints
- [x] Image base64 format/signature checks, storage owner prefix, quota guard and protected delete
- [x] 19 mock-adapter integration/source tests on GitHub CI (NOT hosted AppDeploy tests)
- [ ] Verify actual TypeScript/AppDeploy bundler imports and SDK type contract
- [ ] Implement transactional invitation acceptance and revocation; currently no minting API
- [ ] Build client/agency role-specific screens and preserve simple client navigation
- [ ] Demonstrate cross-tenant denial against deployed staging with independent reviewer accounts
- [ ] Run full live-browser CRUD/accessibility and robust upload/retention QA

**Deployment boundary:** `main` and the applied AppDeploy preview remain unchanged by this PR. No production deployment, merge or independent acceptance is claimed.

## Continuation acceptance
See [Phase 2 continuation evidence](PHASE2-CONTINUATION-EVIDENCE.md) for R1–R7 status, staging limitations, runtime API evidence and next gates. Real-clinic pilot remains blocked.

## Phase 2.1 continuation
See [Phase 2.1 review handoff](PHASE2-1-REVIEW-HANDOFF.md) for exact test separation and R1–R7. Client Website and role-gated Agency desk are built, while invitations, verified approval, signing/publishing, multi-user staging acceptance and real-media release remain blocked.

## Phase 2.2 read-only staging security increment
See [Phase 2.2 handoff](PHASE2-2-HANDOFF.md) and [staging adapter](PHASE2-2-STAGING-BOUNDARY.md). A rotating-key short-session verifier, restricted PostgreSQL **read-only** role and synthetic two-user HTTP/PG tests are in PR #2. Hosted staging, invitation activation, agency edits and media release **remain BLOCKED**. The upload response no longer signs unapproved media. None of this was deployed to production.

## Phase 2.2 restricted-login and private-workspace loading safeguard
The unmerged engineering branch includes a real NOINHERIT PostgreSQL login test and a fail-closed runtime adapter. A signed-in client now clears synthetic demo data during loading instead of showing fake clinic performance in private mode. See [restricted runtime acceptance](RESTRICTED-RUNTIME-ACCEPTANCE.md) and [Phase 2.2 handoff](PHASE2-2-HANDOFF.md). This is **disposable database and source-level evidence**, not hosted staging acceptance or pilot approval.

## Hosted isolated Supabase staging and RLS gate
Separate project `codeedge-growth-starter-staging` (`dbppeymhsemvghbvuvof`) created with owner approval; migrations 0001–0003 applied only there. Default-deny RLS is active on all seven empty tables with **no policies**. The restricted read role remains NOLOGIN. Runtime account, IdP sessions and two-user hosted access are not configured. See [provisioning evidence](STAGING-PROVISIONING-EVIDENCE.md) and [RLS acceptance](STAGING-RLS-ACCEPTANCE.md). PR stays draft, production unchanged.

## Phase 2.3 hosted foundation (unmerged)
See [Phase 2.3 handoff](PHASE2-3-HANDOFF.md). Restricted NOLOGIN runtime role and narrow auth session probe are installed in a separate empty Supabase staging project; a TLS-required Node staging runner and explicit Supabase Auth adapter have been implemented with synthetic security tests. Hosted real identity, actual restricted database LOGIN and real two-user HTTP acceptance remain BLOCKED. This does not replace the existing Codeedge navy/white client portal or enable the agency desk.

## Phase 2.4 manual hosted-test and supply-chain increment
Implemented a token-redacting two-user acceptance runner and seeded-fixture requirements, added its negative mock regressions, pinned the standalone Node staging dependencies into `staging/package-lock.json`, and added the Node 22 npm-ci/audit workflow. **Neither standalone gateway nor actual two-user sessions are hosted yet.** No live agency writes or production app changes. See [Phase 2.4 handoff](PHASE2-4-HANDOFF.md).

## Phase 2.6 offline SEO/AEO Growth Manager
Replaced static Google/SEO marketing content with a deterministic, provider-neutral offline keyword/HTML/AEO planning engine, two fictional UK/Pakistan fixtures, reviewable tasks and local report exports. Added a targeted TypeScript UI CI check. Does not crawl public networks, connect real analytics, save client reports or publish anything. See [Phase 2.6 handoff](PHASE2-6-HANDOFF.md) and [research/security notes](PHASE2-6-SEO-GROWTH-MANAGER.md).

## Phase 2.7 user-supplied Search Console reporting
Added offline GSC CSV/JSON import, weighted metrics, measured-query recommendations, optional restricted period comparison, local responsive reporting and permission-scoped synthetic provider adapter. **No real Google API authentication or live application data sharing.** See [Phase 2.7 handoff](PHASE2-7-HANDOFF.md).
