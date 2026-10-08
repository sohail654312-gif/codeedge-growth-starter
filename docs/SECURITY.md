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
