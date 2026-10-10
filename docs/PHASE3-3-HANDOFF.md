# Codeedge Growth Starter — Phase 3.3B controlled handoff

**Date:** 2026-10-10. **Repository:** `sohail654312-gif/codeedge-growth-starter`.
**Existing PR:** #2 remains **OPEN/DRAFT**, branch `engineering/phase2-core-security`.
**Verified base main SHA:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.
**Starting Phase 3.3B PR HEAD:** `7ac8e5c5c11db05da85a5a48812ba582eb38466b`.
**Engineering commits in order:**
- `651ef9022d98421028945650cfc69eb3db31dfc5` — integrated source-only gateway and synthetic HTTP tests.
- `6668bfb57658141c8252bdc44a3e1b6cb654045b` — cursor-bounded page offsets and permanently sealed legacy staging entrypoint.
- `19eeeb1e620b81568fece15ff4843095cc8dd460` — disposable PostgreSQL full role matrix and staging operation gates.
- `993ae98fc27cfed440d0695893649fa1dfa7aaab` — opt-in client read adapter and error-boundary tests.
**Final PR HEAD:** fetch after committing this file; report final SHA and exact workflow runs in the existing PR conversation. A commit cannot contain its own resulting SHA.

## Actual source changes (this Phase 3.3B only)

1. `backend/authenticated-read-gateway.mjs` (new): a separate HTTP GET-only gateway connecting `createTrustedSessionGate` with the original-token `createPostgrestReadBoundary`. It has explicit disabled-by-default constructor, strict CORS, input/path/query validation, no secrets in errors, 401/403/405/503 handling, no actor-argument or direct SQL legacy fallback. Bounded 20 pages of at most 50 requests.
2. `tests/authenticated-read-gateway.test.mjs` (new): HTTP-bound mocked-provider owner A/B/staff/client allowed operations, cross-tenant denials both directions, forged/expired/anonymous/malformed bearer, revoked session, removed membership, suspended workspace, failed upstream, CORS/preflight, read-only and no legacy SQL.
3. `backend/postgrest-read-boundary.mjs` (modified): validates and passes bounded offset to the authenticated PostgREST REST query; limits response fields and string sizes. Actual verified user token is forwarded and never translated into caller-supplied actor SQL.
4. `tests/postgrest-read-boundary.test.mjs` (modified): page offset and invalid pagination checks.
5. `staging/server.mjs` (modified): **legacy direct-PG staging entrypoint now deterministically fails with exit code 1; it cannot listen**. It was not the AppDeploy demo server; existing demo continues untouched.
6. `tests/legacy-entrypoint.test.mjs` (new): process-level proof of disabled old entrypoint.
7. `tests/postgres/authenticated-role-matrix.pg.test.mjs` (new): real disposable PostgreSQL role matrix, verified RLS visibility, unauthorized writes, foreign owner denial, revoked client and suspended workspace. Mock `auth.uid()` GUC is strictly **synthetic**; no real JWT signing is proven.
8. `docs/PHASE3-3-OPERATIONS.md` (new): HTTPS host, Auth+session provider, RLS/grants, independent tests, cutover sequencing, monitoring and fail-closed maintenance rollback prerequisites.
9. `src/secure-workspace-reader.mjs` (new): disabled-by-default (not imported) client-facing adapter with workspace role allowlist, per-request workspace recheck, bounded paging, 401 session-expired UI signal, fail-closed suspicious data handling. No dashboard redesign.
10. `tests/secure-workspace-reader.test.mjs` (new): client contract validation and revocation/error regressions.
11. `docs/PHASE3-3-HANDOFF.md` (this document).

Existing DB migration/SQL review drafts `0007`, `0008`, `0009` and the Phase 3.2 session gate are retained intact; the live Supabase project was not changed.

## Executable verification

```bash
node --test tests/*.test.mjs
node --test tests/authenticated-read-gateway.test.mjs tests/secure-workspace-reader.test.mjs tests/legacy-entrypoint.test.mjs
node --check backend/authenticated-read-gateway.mjs
node --check backend/postgrest-read-boundary.mjs
node --check src/secure-workspace-reader.mjs
# ONLY disposable PostgreSQL 16, with synthetic fixtures:
TEST_DATABASE_URL='postgres://gs_test:...@localhost:5432/gs_test' node --test --test-concurrency=1 tests/postgres/*.test.mjs
```

Four existing CI workflows must be confirmed for the **exact final SHA** before declaring source-test acceptance: core source/domain, disposable PostgreSQL, isolated SEO UI TypeScript tests, and staging supply chain. These suites have overlapping coverage. The full AppDeploy SDK production build and actual browser performance/accessibility QA are not supplied by GitHub CI.

## Security verdict — scope matters

| Requirement | Result | Scope |
|---|---|---|
| Cohesive authenticated gateway | PASS (source/mock HTTP) | Factory integration tested; unhosted, disabled by default |
| Original user-token identity verification | PARTIAL | Provider endpoint mocked in CI; no real IdP user acceptance |
| Server-authoritative active session/revocation | PARTIAL / BLOCKED hosted | Mandatory signed-subject/session gate composed, no approved real authoritative provider adapter |
| PostgreSQL least-privilege RLS | PASS disposable / BLOCKED hosted | Existing review-only RLS tests and full owner/admin/staff/client matrix; no hosted policies applied |
| Workspace isolation and role writes denial | PASS synthetic/disposable | No independent signed hosted sessions or browser audit |
| Legacy actor-ID staging process lockout | PASS (source) | Node entrypoint returns code 1 |
| Legacy postgres-owned SECURITY DEFINER attack | **FAIL / HIGH OPEN** | Privileged function grants remain in hosted staging; revocation drafts unapplied |
| Legacy cutover and rollback | PARTIAL | Disposable SQL revocation/permission tests and runbook only |
| Secure client dashboard read contract | PASS source / not wired | Existing Demo/Sandbox and navy UI unchanged; no production Auth connection |
| Hosted staging, pilot and production acceptance | BLOCKED | Real trusted session provider, schema/RLS + secrets host and 2-user external review absent |

**Source-only mode has a synthetic activation option used by tests. It is NOT deployable proof. No production entrypoint exists for the new gateway, and turning on that option is not equivalent to owner approval or a trusted revocation source.**

## Supabase readback / approvals

Latest authorized read-only inspection of isolated Growth Starter staging `dbppeymhsemvghbvuvof`: ACTIVE_HEALTHY PostgreSQL 17, seven RLS-enabled tables, zero policies, zero Auth users/sessions/workspaces, three vulnerable privileged functions, and NOLOGIN restricted roles. No commands were issued to change any hosted schemas, functions, grants, sessions or credentials.

Explicit owner approval is genuinely required for protected staging host/secret manager and associated costs (if any), creation and cleanup of two independent fictional Supabase Auth users, exposure of the private Data API schema plus review-only SQL RLS/grant activation, real isolated active-session verification, independently verified direct SQL attack probes, and any eventual privileged-function revocation. No real clinic/patient data.

## Completion percentages: engineering estimates, not a formal external audit

Carry forward Phase 3.2's same seven categories and weights to preserve comparability. Source-level readiness reflects what is implemented and covered; a PASS in CI is not counted as real-hosted acceptance.

| Area | Weight | Phase 3.2 source estimate | Phase 3.3B source estimate |
|---|---:|---:|---:|
| Core app functionality | 20% | 64% | 64% |
| Auth and sessions | 20% | 35% | 48% |
| Tenant isolation / RLS | 20% | 48% | 58% |
| Agency/client access | 10% | 35% | 44% |
| SEO/GEO/AEO/SCO and reports | 15% | 78% | 78% |
| Automated testing and security QA | 10% | 82% | 87% |
| Staging and pilot readiness | 5% | 12% | 14% |

Weighted **source-engineering readiness**: 20%×64% + 20%×48% + 20%×58% + 10%×44% + 15%×78% + 10%×87% + 5%×14% = **59.5% (~60%)**. This is a subjective evidence-based estimate, not a measurable percentage of delivered commercial capabilities. Hosted and production acceptance remain BLOCKED.

**Phase 3.3B source task estimate:** approximately **73%**, with equal-weight scored blocks: gateway 90, trusted session source 50, RLS and roles 90, legacy cutover 80, synthetic tests 90, staging activation readiness 55, client contracts 50, CI 100 (only if exact-final-head green), independent external acceptance 20, and handoff 100. Score: 72.5%. Real-hosted/independent acceptance is not included in a "pass" claim.

## Next risk-ranked milestone

**Phase 3.3C — approved staging-only Auth + authoritative session provider + PostgREST RLS hosted validation.** Stop further simulated identity improvements after these source additions; obtain owner-governed, secret-managed staging access, connect a provider-backed session checker, run two independent real synthetic-user HTTPS acceptance tests and SQL attacker probes, then obtain separate independent security approval before retiring privileged SQL functions. After cutover, only then consider SEO-report persistence, agency-approved client corrections, opt-in Google read adapters, external publishing, social automation and Business OS upgrades.

**No merge, production or staging deployment, real client onboarding, LLM/OAuth live call, new automation, paid infrastructure, design change or other Codeedge repository modification occurred.**
