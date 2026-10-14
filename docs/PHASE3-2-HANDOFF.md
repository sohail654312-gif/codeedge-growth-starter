# Growth Starter — Phase 3.2 controlled implementation and verification handoff

**Date:** 2026-10-10. **Repository:** `sohail654312-gif/codeedge-growth-starter`.
**Existing PR:** #2 OPEN/DRAFT, `engineering/phase2-core-security`; **main HEAD:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.
**Starting PR HEAD:** `e06f9852092d5e94b5bf9a4ddc1e925213989a89`.
**Phase 3.2 first engineering commit:** `6b1513d3499ec9dccff349df52ae3a4ebabd5baa`.
**Final HEAD:** read current PR HEAD after this handoff commit, and use exact-final-head GitHub Actions evidence recorded in PR #2 comments. A Git commit cannot embed its own resulting SHA.

## Implemented source changes

- `db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql`: least-privilege column SELECT and nonrecursive, ACTIVE-only owner/member/work-request PostgreSQL RLS; **unapplied**.
- `tests/postgres/authenticated-read-rls.pg.test.mjs`: disposable PostgreSQL two-owner and third staff/outsider tests; role, revocation, suspension, cross-tenant and writes-denied checks. Test-only mock `auth.uid()` is a GUC simulator; NOT cryptographic proof.
- `backend/trusted-session-gate.mjs`: requires upstream real Supabase Auth /user success, exact token user/sub/session/issuer/audience/expiry/role matching and authoritative live session record binding. **There is no deployed provider or credential.**
- `tests/trusted-session-gate.test.mjs`: synthetic session revoked/expired/corrupted/forged/registry-outage tests and mock HTTP integration with the Phase 3.1 PostgREST reader. It does not verify JWT signatures itself.
- `db/drafts/0009_cutover_assertions_REVIEW_ONLY.sql` and extended `tests/postgres/actor-cutover.pg.test.mjs`: independent cutover assertion after existing draft function REVOKEs, negative pre-cutover confirmation, privileges denied after, disposable transaction ROLLBACK.
- `docs/PHASE3-2-CUTOVER-RUNBOOK.md` and this handoff: ordered identity, RLS, external acceptance and fail-closed legacy-retirement gates.

No AppDeploy/Vercel/Supabase host mutation, migration application, login activation, secret access, OAuth, real patient data, production rollout, PR merge or other repository changes.

## Verification commands and evidence

- `node --test tests/*.test.mjs`
- `TEST_DATABASE_URL=postgres://gs_test:...@localhost:5432/gs_test node --test --test-concurrency=1 tests/postgres/*.test.mjs` (**disposable PostgreSQL only**).
- `node --test tests/trusted-session-gate.test.mjs tests/postgrest-read-boundary.test.mjs`
- `npm run build` is not portable outside AppDeploy SDK yet; the dedicated SEO TypeScript workflow checks the supported UI subset.
- Four exact-head CI workflows must pass; publish counts/URLs using the final PR head. Do not sum overlapping suite counts.

## Security verdict by verification boundary

| Requirement | Verdict | Verified scope / blocker |
|---|---|---|
| Supabase authenticated RLS policies | PARTIAL | Read-only source, disposable PostgreSQL tests; **zero hosted policies** |
| Owner/agency/staff/client read isolation | PARTIAL | Current membership model and disposable tests; no real hosted users |
| Role elevation and client/agency writes | BLOCKED | No write grants, intended deny, no activated role workflows |
| Trusted session verifier | PARTIAL/BLOCKED | Provider-neutral strict source hook and mock; no approved independent live session-registry binding |
| Legacy actor substitution | FAIL / HIGH OPEN | Prior disposable exploit, live insecure functions still executable by reader before cutover; draft revocation not applied |
| Cutover/rollback proof | PARTIAL | Transactional disposable SQL only; no hosted dry run |
| Real authenticated HTTPS 2-user acceptance | BLOCKED | No approved credentials, trusted session source, hosted gateway or users |
| SEO/GEO/AEO/SCO offline content | PASS source-only | Prior Phase 2.9/3.0 tests preserved; no Google/LLM/citation evidence |
| Production and pilot readiness | BLOCKED | Independent security acceptance, live privacy/QA, provider and ops missing |

## Completion methodology — ESTIMATE, not test pass %

Weighted engineering readiness across seven requested categories. Weights reflect dependency and risk; percent is approximate current source completeness, **not** independent acceptance or deployability:

| Area | Weight | Assessed source % | Why |
|---|---:|---:|---|
| Core application functionality | 20% | 64% | Working demo/client profile/enquiry UI, hosted features incomplete |
| Authentication & sessions | 20% | 35% | Contracts and strict mock gates, no active hosted verified boundary |
| Tenant isolation & RLS | 20% | 48% | Disposable RLS and tenancy checks, no hosted activation |
| Agency/client access | 10% | 35% | Protected read prototypes, approvals/invitations unavailable |
| SEO intelligence & reporting | 15% | 78% | Tested offline SEO/GEO/AEO/SCO, no real data/persistence |
| Automated testing | 10% | 82% | Strong CI and disposable tests, limited real-hosted adversarial QA |
| Staging & pilot readiness | 5% | 12% | Empty isolated project, no real clients/verified user sessions |

**Weighted estimate:** (20×64+20×35+20×48+10×35+15×78+10×82+5×12) / 100 = **53.4% (~53%) source engineering readiness**.
**Hosted security acceptance:** BLOCKED. **Production-ready percentage:** not asserted. This metric uses a changed seven-module weighting and is not directly comparable to earlier broader estimates (~47% or historical ~62%).

## Verified isolated hosted Supabase staging readback

Project `dbppeymhsemvghbvuvof`, ACTIVE_HEALTHY PostgreSQL 17.11, exactly seven tables with RLS enabled and **zero RLS policies**, zero Auth users, sessions or workspaces, and three SECURITY DEFINER routines. `growth_starter_reader`/`growth_starter_runtime` remain NOLOGIN/non-BYPASSRLS. These facts were verified using read-only project/SQL tools, not inferred from old docs. No hosted changes.

## Approvals truly required

Owner approval for secret-managed isolated HTTPS Node staging host (costs), secure storage of credentials, independent signed synthetic Supabase users/cleanup, *separate* hosted Data API schema exposure and RLS application, and retiring legacy functions **only after** independently accepted replacement. No real patients.

## Next smallest milestone — Phase 3.3

Integrate an independently trusted, provider-supported real session check and owner-approved, **staging-only** PostgREST RLS route; then execute two authenticated, fictional user acceptance and direct SQL attacker probes. Only after that retire privileged legacy actor functions and consider durable client report/agency correction writes with human approval. Preserve the navy Codeedge UI and all offline demos.
