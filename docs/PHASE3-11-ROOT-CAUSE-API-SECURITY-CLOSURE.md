# CODEEDGE GROWTH STARTER — PHASE 3.11 ROOT-CAUSE API SECURITY CLOSURE

## Baseline and scope

Started at \`9a92d3adeb4be5f342550f7be97ea4791e5040e2\`, existing \`engineering/phase2-core-security\`, PR #2 DRAFT. Starting exact-SHA CI succeeded: core 171 (run 38088257294), PostgreSQL 17 43 (38088257342), SEO/UI 39 (38088257321), supply-chain 16 (38088257376); 269 successful executions across workflows.

**Source-only controlled single writer.** No staging/production changes, Auth test users, secrets, grants, host, Data API settings or deploys are authorized by this phase's instruction. Final SHA and exact-commit CI must be verified independently after committing.

## Selected trust architecture

Preserve Supabase Auth. Required flow: original bearer validated by provider -> compare verified bearer subject to JWT session id -> server-only revocation-aware provider session record -> current membership -> independently bound database tenant principal -> PostgreSQL RLS/column-scoped read -> validated response. The current provider \`/auth/v1/user\` identity check alone does not establish provider-session existence. Source: https://supabase.com/docs/guides/auth/sessions . RLS GUC identity is not independently authenticated in ordinary direct PostgreSQL.

**Chosen prospective DB model:** restricted tenant-scoped principals, with audited bound principal-to-tenant resolution, role credential management and compartmentalized backend execution. PG17 tenant-role feasibility is shown in Phase 3.9, but the hosted binding and shared-process compromise boundary are **not** accepted. A single backend holding all tenant credentials is not a full containment mechanism against that backend's compromise. No hosted tenant database role or credential is provisioned.

## Actual Phase 3.11 implementation

1. \`backend/authenticated-read-gateway.mjs\`: **permanently fail-closed old hosted factory**, which previously could create a PostgREST reader after a session-authority preflight. The old factory was insufficient to prevent a direct managed \`/rest/v1\` bypass using an unexpired signed-out JWT. A future hosted factory must be implemented through a newly accepted private SQL path after all externally evidenced prerequisites; no environment flag resurrects the old path.
2. \`backend/private-read-adapter.mjs\`: synthetic contract now receives a private WeakSet identity brand, not a caller-supplied flag on an arbitrary plain object. Its separate \`createHostedPrivateReadAdapter\` remains disabled.
3. \`backend/authenticated-read-gateway.mjs\`: a separate \`createSyntheticPrivateSqlReadGateway\` routes the existing fixed-SQL, session-checked private contract through the actual read-only HTTP routing, validation, CORS, no-store and error-redaction boundary, **without any PostgREST dependency**. This constructor remains explicitly fictional-test-only.
4. \`tests/phase311-private-gateway.test.mjs\`: actual loopback HTTP integration tests of A/B/C fictional identity, ownership/membership, cross-tenant denial, forged inputs, pagination/method constraints, CORS, session/membership revocation before SQL, and provider/SQL fail-closed behavior. They also require rejection of the previously constructible hosted PostgREST factory.
5. Updated existing \`tests/hosted-authenticated-gateway.test.mjs\` to encode the new deny-by-default invariant even after a mock catalog-verified session authority.

Preserved Phase 3.5 immutable policy snapshot, Phase 3.9 PG17 SQL tenant-role regressions, Phase 3.10 two-connection MVCC revocation evidence, old source-only synthetic REST tests, and permanent Demo/Sandbox behavior. No unrelated repository changes.

## Root cause closure matrix

| Root | Verdict | Implemented correction and remaining requirement |
|---|---|---|
| R1 Provider live-session authority | **BLOCKED** | Supabase documents \`session_id\` lookup in \`auth.sessions\`; dedicated checker remains NOLOGIN and lacks managed \`auth\` USAGE; needs vendor-supported minimal readback and owner-approved narrowly scoped permissions, real signed sign-out replay |
| R2 Database identity and tenant isolation | **PARTIAL** | PG17 disposable tenant principal enforcement already demonstrated; secure runtime identity-to-principal binding/rotation and multi-tenant process compromise isolation not proven |
| R3 Direct Data API bypass | **PARTIAL / UNVERIFIED** | Old hosted PostgREST gateway construction now blocked; actual Exposed Schemas dashboard configuration and signed-out replay remain unverified. The SQL session \`pgrst.db_schemas\` GUC NULL proves nothing |
| R4 Legacy privileges | **FAIL / OPEN** | Three legacy privileged functions still EXECUTE by \`growth_starter_reader\`, runtime still can SET ROLE; review-only cutover drafts remain unapplied |
| R5 Secure hosted integration | **PARTIAL / BLOCKED** | Real HTTP routing and private SQL contract now joined for fictional testing; hosted private SQL adapter, accepted reverse proxy/credentials, real Auth A/B/C and deployment remain blocked |

## Hosted read-only observation

On 2026-10-11, isolated Supabase project \`dbppeymhsemvghbvuvof\` ACTIVE_HEALTHY, PostgreSQL 17.11, zero Edge Functions. Checker LOGIN FALSE; \`auth\` schema USAGE FALSE. \`growth_starter_runtime\` SET ROLE old reader TRUE. Old reader retains EXECUTE on all three legacy functions. Direct Data API Exposed Schemas **UNVERIFIED**. No hosted write was performed.

## Gates and operator decision

Gate A **PARTIAL** (architectural dependency defined, not accepted); Gate B requires the new exact-SHA GitHub CI; Gate C **BLOCKED** (hosted permission and real Auth evidence absent); Gate D **BLOCKED** (production authorization absent).

**Single next operator action:** obtain provider documentation or explicit Supabase support confirmation permitting minimum managed-\`auth\` schema USAGE plus column-level SELECT on \`auth.sessions(id,user_id,not_after)\` and \`auth.users(id,deleted_at,banned_until)\` for a dedicated server-only checker without broad grants, and confirming immediate sign-out row deletion and upgrade stability. Only then request separate owner approval for exact checker credential/grant activation, Data API exposure readback, and fictional signed JWT A/B/C sign-out/replay acceptance. Do not reuse the unsafe hosted PostgREST factory.

**Rollback:** ordinary revert of this source commit; do not force push. Hosted state unchanged, so there is no hosted rollback. A code revert must not be used as a reason to enable the old hosted path.

**Acceptance honesty:** if final exact-commit CI passes, this phase is **source engineering PASS** with live API activation **BLOCKED**. No disposable or fictional evidence is a substitute for genuine provider-issued acceptance.
