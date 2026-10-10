# Phase 2.1 — Transactional Collaboration & Client UX Review Handoff
**Review date:** 2026-10-08. **Operating mode:** manual, single writer, PR #2 stays DRAFT.
**Repository:** `sohail654312-gif/codeedge-growth-starter`
**Base main:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`
**Previous PR HEAD:** `0ccf9d3e0d60af7f2c6754561ae09613c0d5464e`
**Phase 2.1 implementation SHA before review-documentation commit:** `14149bd777dc334212c4b593c7bd987dba8a15ba`
**Exact final PR SHA:** verify current GitHub PR head after documentation commit; do not reuse this historical implementation SHA as final.

## Independent evidence — distinguish real and simulated
- Existing source-and-mocked-SDK tests: **35 PASS, 0 FAIL** on commit `14149bd...` — [GitHub run 37763200425](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37763200425).
- **Actual PostgreSQL 16** ephemeral GitHub Actions service: **13 PASS, 0 FAIL** on commit `14149bd...` — [GitHub run 37763200417](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37763200417). This test suite creates real tables and checks unique membership, SERIALIZABLE invitation acceptance, replay denial, role revocation, optimistic request version conflicts, rollback/audit preservation, media ownership, outbox leases/retries and full image decode via sharp.
- The same real-Postgres job also opens a temporary HTTP test server and accepts **two independently signed synthetic RS256 bearer sessions** (two distinct users); own workspace read 200/200, foreign read 403/403, missing token 401, unverified email 403 and expired token 401. These are **synthetic harness identities, not AppDeploy-hosted sessions or an external real IdP**.
- The **owner-gated deletion service** was added after the above named passing runs; inspect the latest CI on the final PR HEAD to verify it too. Avoid conflating the older run with the later fix.

## PostgreSQL adapter and operational limits
- `db/migrations/0001_growth_starter.sql` creates isolated workspace, membership, invitation, request, media, deletion outbox and append-only audit tables with unique keys and constraints. It was run only in disposable GitHub Actions PostgreSQL; **no connected Supabase project was changed**.
- `backend/postgres-store.mjs` implements serializable client-scoped `BEGIN/COMMIT/ROLLBACK`, row locks, unique membership, invitation consumption, audit, request version compare-and-swap and durable outbox with lease/retry/ack. Handles 40001/40P01 retries with bounded re-execution.
- `backend/verified-identity.mjs` verifies issuer/audience/time/signature and `email_verified` of separately configured RS256 tokens. GitHub synthetic signing keys are test-only; no AppDeploy IdP key binding, email-verified claim, token revocation/rotation or production secrets are provided.
- `backend/transactional.mjs` is the provider-neutral domain service; `backend/media-gate.mjs` is an owner/member check for approved clean media, plus owner-only delete request. `backend/media-delete-worker.mjs` is an **explicit one-shot function**, not a scheduled/background automation. `backend/image-inspector.mjs` decodes and normalises via an injected sharp decoder and strips metadata; does not prove antivirus or complete malware safety.
- **No PostgreSQL provider is connected to AppDeploy.** The sandbox's `backend/routes.mjs` continues to deny cross-workspace membership, invitation issuance, role grants and unsafe approval/deletion by default (403/503). Database RLS in a production role and end-to-end auth revocation are unverified. Cross-workspace access in a live clinic remains OFF.

## Simple client and agency UI
- Existing `WorkProgress` lets signed-in owners see real saved request statuses and submit a **separate** correction request. Approval remains visibly unavailable.
- Added `Website` page: saved business website link, persisted Website update requests, simple profile/edit/request actions.
- Added role-gated `Agency desk` panel showing persisted requests/assets from the **currently authorized workspace** only; assignment, invitations, publishing and media approval remain disabled. It is intentionally hidden from anonymous and client roles, and no fabricated client list is displayed.
- Existing Enquiries, Content studio, Local SEO/AEO, Media and Business settings remain. No live Google/GBP/ads results claimed. Dr Ikram Wazir data remains expressly illustrative.
- Backend requires `rightsDeclared:true` and stores `rightsDeclaredAt` for small business uploads; `consentStatus:'not_verified'` prevents all automatic signed preview links. Files without approved signed URLs are represented by locked placeholders. This is **not** a clinical photography consent system.

## AppDeploy sandbox and main separation
- **Sandbox ID:** `growth-starter-phase-2-qa-sandbox-gve53p`.
- **Sandbox applied snapshot:** `1791455061355` from the AppDeploy deployment response.
- Sandbox reported READY with **0 frontend errors, 0 backend errors, 0 network errors** in initial QA on updated Website/agency/UI/API source. `src/App.tsx`, `src/main.tsx`, `src/ServicePages.tsx`, `src/service-pages.css`, `src/work-progress.css`, and `backend/routes.mjs` compared byte-for-byte with branch source after the last sandbox update. The DB-only adapter and tests remain GitHub-only and intentionally unbound.
- **Production Phase 1:** `codeedge-growth-starter-5jhvfk`, unchanged, status READY. Do not confuse production and sandbox URLs.
- **Hosted API tests BLOCKED:** this run had no separate AppDeploy authenticated test sessions and the external HTTP reader could not resolve the AppDeploy hostname. Initial AppDeploy screenshot/error telemetry is not evidence of hosted per-route 401/403 or user isolation.
- **Mobile/accessibility:** responsive React/CSS with visible focus and reduced-motion rules; AppDeploy produced desktop/mobile QA snapshots. **No independent keyboard traversal, screen-reader/axe, offline throttling, Lighthouse LCP/INP, production device or slow network measurement completed.** Claim these as unverified.

## Migration and rollback
- No live Phase 1 record has been copied/deleted. Legacy owner partition keys remain `gs_<type>_<verified AppDeploy userId>`.
- PG schema created only in disposable CI, automatically removed with job container. No production data migration to Postgres; no production rollback performed.
- SQL transaction rollback was tested for invalid state transitions and durable audit changes in temporary DB; it is not a deployment rollback exercise.
- To undo source increment, revert the unmerged PR. Staging app is separate; production unchanged.

## R1–R7 risk verdict after Phase 2.1
| Risk | Verdict | Explanation |
|---|---|---|
| R1 — Verified invitation/role lifecycle | **BLOCKED hosted** | Working PostgreSQL domain adapter & CI, no live verified AppDeploy identity or provider wiring |
| R2 — Atomic persistence and isolation | **PASS disposable PG only / BLOCKED production** | PostgreSQL transactions/unique constraints tested; no live adapter, RLS, credential/role isolation or end-to-end revocation guarantees |
| R3 — Multi-user security | **PASS synthetic signed HTTP+PG / BLOCKED AppDeploy** | Two distinct signed tokens against real database, but not actual AppDeploy users/endpoints |
| R4 — Media protection & lifecycle | **PARTIAL / BLOCKED real pilot** | Decode, rights validation, approved-only lookup, outbox tested; no hosted scan, retention/export/delete processing or signed-link TTL proof |
| R5 — Video and scheduled publishing | **OPEN** | No JSON/base64 video uploads, no publishing integrations or auto posting |
| R6 — Agency operations and connected growth evidence | **PARTIAL** | Role-gated agency read-only panel and persisted work progress; no trusted invitation-selected client list, assignment/publish workflow or live marketing metrics |
| R7 — Deployment, mobile/accessibility and policy | **OPEN** | Separate sandbox smoke only; branch visibility, policy, Web Vitals, offline accessibility, monitoring/backup remain unaccepted |

## Independent reviewer — mandatory before merging
1. Fetch exact latest PR head; run 35+ mock tests and 13+ disposable PG/image tests at that SHA; revalidate owner deletion after final commit.
2. Run two **actual AppDeploy authenticated** synthetic sessions (separate accounts), not synthetic keys only. Exercise all routes, object ID spoofing, membership/approval bypass, and real media URL access. Record sanitized HTTP status and record ownership proof.
3. Provision a production-like PostgreSQL role with restrictive grants/RLS if used; verify privilege boundaries, concurrent transactions, revocations and unique constraints against server-held credentials.
4. Verify external verified-email claim source/rotation, invitation delivery without token leakage, replay/expiry/revocation across real sessions.
5. Verify real scan/consent acceptance, retention/export, short-lived storage signing and idempotent deletion outbox worker through shutdown and retry.
6. Run responsive mobile, keyboard, screen reader/axe, offline/slow connection, and performance acceptance; capture actual measurements.
7. Verify AppDeploy bundler/SDK integration at the **final** SHA in isolated staging, then migration/rollback rehearsal before permitting any real-client pilot.
8. Author an independent PASS/FAIL/BLOCKED finding-by-finding verdict; no self-approval.

**Release verdict:** REVIEWABLE INCREMENT ONLY. **NO REAL-CLINIC PILOT. NO MERGE. NO PRODUCTION REDEPLOY. NO BACKGROUND WORKERS.**
