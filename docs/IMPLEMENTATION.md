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
