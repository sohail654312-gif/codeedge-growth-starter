# Security and privacy boundaries

Status: controlled preview; **NOT approved for production patient or confidential customer information**.

- AppDeploy authentication middleware protects all non-healthcheck backend endpoints. User data is partitioned by the verified AppDeploy user ID, but proper workspace/agency tenancy is **not implemented**.
- Demo profiles and performance charts are illustrative; Google Analytics, GBP and actual growth tracking are not yet connected.
- Photos may be sensitive. Do not upload patient images, medical documents or nonconsensual media to the preview.
- Image endpoint currently restricts type and nominal size but has not passed independent binary-signature, malware or data-retention tests.
- Database reads are bounded. Comprehensive pagination, deletion, export, quotas and operator actions are incomplete.
- Missing production gates include admin role isolation, abuse prevention, legal documents, audit logs, formal cross-tenant tests and secure integration credential lifecycle.
- Business OS, CIGO and third-party integrations are inactive. Future adapters must enforce tenant-scope and explicit human approval of consequential effects.
- This repository was observed **public** on 2026-10-08, notwithstanding an earlier private recommendation. Only source without credentials is mirrored.

## Phase 2 engineered safeguards — unmerged, runtime unverified
1. All private API routes use SDK `requireAuth()`, then domain `resolveWorkspace` with explicit role policy.
2. A missing workspace ID resolves only to the authenticated user's own workspace. Foreign workspace access requires an active, exact, per-user server-side grant in `gs_memberships_<verifiedUserId>`. No exposed write endpoint can mint a grant in this PR. Requests with invalid/foreign IDs return 400/403.
3. Every data route derives the physical partition from the authorized workspace owner; arbitrary record IDs do not cross that partition.
4. Input length/type checks and HTTPS-only public website links; bounded 1..50 pagination with opaque cursor; explicit valid status transitions for client review.
5. Image base64 is checked for canonical form, a compatible extension, and format magic bytes; uploads remain bounded to 3 MiB with an advisory 25-image workspace quota. Storage prefixes use trusted owner IDs.
6. Protected media deletion checks role, record workspace partition and path owner prefix. Partial storage/database failure remains non-transactional.
7. Sample data is intentionally fictional. There is no real social publishing and no verified Google ranking, appointment or campaign analytics.

## Open severe risks
- **R1 (HIGH) no trusted membership issuance/invitation lifecycle.** The grant resolver is not a complete workspace membership service; registration, verified email, revocation and replay-resistant acceptance need a transactional server-side backing store.
- **R2 (HIGH) non-transactional AppDeploy database.** Multiple simultaneous profile writes, quota checks, approvals or deletes can race. No true unique constraints, locks or RLS assurance were verified. Do not use for sensitive shared clinic workloads until this is resolved.
- **R3 (HIGH) mock-only security evidence.** CI uses stubbed backend SDK; running tenant-isolation tests with real authenticated users and the real AppDeploy data/storage services is still mandatory.
- **R4 (HIGH) incomplete media safety.** Magic bytes do not prove full decoder correctness. No malicious-file scanning, client media rights/consent, image processing hardening, durable retention/export, or lifecycle audit is in place.
- **R5 (MEDIUM) video is not implemented.** Large media cannot safely be sent through JSON/base64; require scoped direct-to-storage multipart/chunk uploads with an upload-complete validator, virus scanning and per-tenant lifecycle.
- **R6 (MEDIUM) UI/realtime gap.** No trustworthy connected external analytics, automated Google/WhatsApp content publishing or agency/client collaboration UX.
- **R7 (MEDIUM) repository currently public.** Source includes no secrets but the owner should review proprietary visibility and GitHub branch protection.

## Continuation updates
The engineering branch now DENIES foreign workspace access from legacy grant rows, disables non-atomic approval and deletion, and refuses to sign unapproved or foreign-owned media. Transactional membership and approval adapters are mock-tested but **not bound to AppDeploy**. See [Phase 2 continuation evidence](PHASE2-CONTINUATION-EVIDENCE.md). Production remains blocked.

## Phase 2.1 evidence
See [Phase 2.1 review handoff](PHASE2-1-REVIEW-HANDOFF.md). Real disposable PostgreSQL/cryptographically signed synthetic HTTP tests now exist. **Hosted AppDeploy cross-client security remains BLOCKED**: no external verified IdP binding, PostgreSQL runtime connection, production RLS/privilege proof, media scanner, production retention or real hosted two-user tests. Never auto-enable permissions due to CI results.

## Phase 2.2 — additional restricted boundary (unmerged)
- Standalone staging gateway added with rotating-key RS256 verifier, an **online revocation dependency** and a read-only PostgreSQL role. No real hosted session or isolated Growth Starter database is configured; do not infer hosted assurance from CI.
- The unreviewed upload POST response no longer returns a signed storage URL or an internal storage key. Previously issued links still require expiry/revocation review.
- PostgreSQL SECURITY DEFINER functions execute as their trusted owner and accept actor IDs from a server verifier. The restricted role has no arbitrary table read/write privileges, but gateway runtime compromise remains a risk; evaluate DB-bound identity to strengthen this before production.
- See [Phase 2.2 handoff](PHASE2-2-HANDOFF.md) for R1–R7 release blockers.

## Verified isolated staging RLS (2026-10-08)
Owner-approved `db/migrations/0003_staging_default_deny_rls.sql` has been applied to Growth Starter staging only. All seven private tables have RLS enabled with zero policies, so direct unprivileged reads/writes are denied even if table grants later drift (also tested synthetically in disposable PostgreSQL). No anon/auth schema usage exists. Restricted `growth_starter_reader` role has no direct table SELECT; it can invoke narrowly-scoped `SECURITY DEFINER` functions when reached through a trusted staging gateway. Those functions do **not** themselves authenticate a subject, so a compromised privileged gateway could pass another actor ID. A dedicated non-owner runtime login with secret management, trusted IdP and hosted two-account validation remain blocked. The SQL admin session cannot `SET ROLE growth_starter_reader` (42501), and this is not a pilot acceptance failure to bypass with superuser access.

## Phase 2.3 isolated hosted state
Owner-approved Supabase staging now has migrations 0001–0005, RLS 7/7 default deny with no policies, restricted runtime role NOLOGIN and boolean session probe granted to the reader only. A rollback-only hosted tenant-filter test succeeds with NO persisted records. The Node API and provider identity adapter are **unmerged source only**, not live. A default-deny RLS schema does not alone prove owner/clinic separation because existing SECURITY DEFINER routines still trust the server-provided actor identity. Private CA/DB credentials and independently authenticated hosted negative acceptance are required before pilot. See [Phase 2.3 handoff](PHASE2-3-HANDOFF.md).

## Phase 2.4 — hosted identity/SECURITY DEFINER threat review
- Existing Supabase-hosted `growth_starter` functions are owned by the `postgres` management role (BYPASSRLS), and their SQL arguments are **not independently bound to an authenticated actor at the database layer**. A compromised runtime that may invoke them could supply another actor ID. This remains a **HIGH residual authorization threat**, not cured by RLS metadata or mocked auth.
- Both restricted roles remain NOLOGIN. No dedicated TLS/CA-verified hosted PostgreSQL client with secret-managed credentials has been established, and no real test users/sessions exist. Do not enable agency mutation or patient media.
- The manual `staging/hosted-acceptance.mjs` runner prevents synthetic-only verification being mistaken for a real hosted HTTP pass; there is no runnable hosted gateway yet.
- Staging dependencies have a committed lockfile, cloud CI `npm ci`, an audit gate and mock gateway-config safety tests. See [Phase 2.4 handoff](PHASE2-4-HANDOFF.md).

## Phase 2.7 imported Search Console evidence
- Browser-only import: no token, Google OAuth, upload, remote crawl, automatic SEO edit or storage. All imported measurements are **unverified user supplied** and may be partial GSC row subsets. Never label as live Google-verified results.
- The import validates explicit business workspace/property, dimensional consistency, bounded UTF-8 CSV/JSON sizes, numeric clicks/impressions/CTR/position and dates; CSV formula-like output is quoted/neutralized. This does not authenticate local businesses or prove ownership—consent checkbox is an assertion only.
- A `sc-domain` property may cover subdomains, while URL-prefix properties require matching origin/path. Individual page rows must remain in the declared property. Query and page reports cannot be summed or joined as equivalent property totals.
- Existing Phase 2.5 HIGH privileged `SECURITY DEFINER` identity-substitution vulnerability and hosted NoLogin remain OPEN; no OAuth token storage, real-client report persistence or agency writes approved. See [Phase 2.7 guide](PHASE2-7-SEARCH-ANALYTICS.md).
