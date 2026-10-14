# Codeedge Growth Starter — Phase 2.4 independent evidence handoff

**Date:** 2026-10-08  
**Existing PR:** #2, `engineering/phase2-core-security` — DRAFT, unmerged.  
**Start SHA:** `13aacac098a1b7279429e854054395118dc5e3e5`  
**Source implementation SHA before handoff:** `e6cc1abd4dae3355e07a9d2dbae7f008fc2bfcd3`  
**Final SHA:** Read directly from PR #2 after this documentation commit; exact-head CI must be checked again.
**Base main:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.

## Summary verdict

**REVIEWABLE SOURCE/SUPPLY-CHAIN INCREMENT; PHASE 2.4 HOSTED ACCEPTANCE BLOCKED.** No standalone Node staging gateway deployed, no two real authenticated staging users, no restricted LOGIN credential, no external secret-manager binding. Existing Phase 2.3 components preserved unchanged. Neither production AppDeploy nor the independent staging QA sandbox was redeployed.

## Actual implementation (this block)
1. `staging/hosted-acceptance.mjs` — manual, fail-closed real hosted HTTP acceptance CLI. Requires two distinct bearer token subjects and session IDs, two specific workspaces and fictional request IDs. Checks authenticated own records, both directions cross-tenant denial, JWT tampering, wrong-origin 403, read-only method 405, unavailable media route 404; no token or response-body logging. **Not executed against a live staging gateway, because none is deployed.**
2. `tests/hosted-acceptance.test.mjs` — mock tests prove the runner refuses invalid HTTPS/session fixtures and fails hard if the API returns 200 to foreign-tenant access. Mock network evidence only.
3. `staging/package-lock.json` — generated on GitHub Actions runner from the pinned `pg@8.13.3`, then committed. No private credentials. Reproducible `npm ci` supported.
4. `.github/workflows/staging-supply-chain.yml` — Node 22 staging build; locked dependency installation; `npm audit --omit=dev --audit-level=high`; syntax/config and hosted-test-runner mock regressions. Never supplies real API credentials.
5. `staging/README.md` — lockfile/secret-handling and manual hosted acceptance protocol.

## Current hosted Supabase evidence

Project `codeedge-growth-starter-staging` (`dbppeymhsemvghbvuvof`), `ap-south-1`, PostgreSQL 17, **ACTIVE_HEALTHY** on readback. Existing migrations 0001–0005 remain applied, no new migration this block. Seven private tables have RLS enabled and **zero policies**, all empty. `auth.users` and `auth.sessions` counts remain zero. Roles `growth_starter_reader` and `growth_starter_runtime` are both **NOLOGIN** and non-superuser/NOBYPASSRLS. `postgres` is admin/BYPASSRLS and cannot SET to restricted reader. The three `SECURITY DEFINER` functions are owned by `postgres`; anonymous/authenticated EXECUTE denied, reader EXECUTE permitted.

**Critical residual function trust risk:** `staging_list_workspaces(p_actor)`, `staging_list_requests(p_actor,...)`, `staging_session_active(p_user,p_session,p_email)` do not cryptographically bind a database actor to the verified request. A compromised gateway holding the function-capable reader session could pass another actor's identifiers. Since the functions run as the privileged owner, default-deny RLS does not itself prove complete authorization. Leave privileged agency mutations blocked. An independently reviewed gateway/DB security design is needed before elevated privileges.

## CI evidence before final docs commit

At `e6cc1abd4dae3355e07a9d2dbae7f008fc2bfcd3`:
- [Core source and safety 37804996192](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37804996192): **54/54 PASS, 0 FAIL**.
- [Disposable PostgreSQL security 37804996280](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37804996280): **31/31 PASS, 0 FAIL**.
- [Staging supply-chain 37804996242](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37804996242): **13/13 PASS, 0 FAIL**, `npm audit` reported **0 vulnerabilities** at audit time.

Note that core and staging supply-chain suites overlap; never report their combined count as unique test cases. The PG suite is disposable with synthetic sessions. **No hosted two-user acceptance passed.** Update evidence to final exact head after any additional commit.

## R1–R7 verdicts

| ID | Verdict | Evidence or limitation |
|---|---|---|
| R1 — invitation and role lifecycle | **PASS synthetic/disposable / BLOCKED hosted** | Existing atomic contract, but no hosted sessions, invited users or enabled write endpoints |
| R2 — persistence and database authorization | **PASS schema/RLS metadata / BLOCKED hosted runtime** | Hosted private seven-table schema and role metadata verified; no restricted LOGIN+TLS connection proof |
| R3 — identity and two-user isolation | **PASS mocked/disposable / BLOCKED hosted** | Supabase /user and session function adapter exists; zero users, zero sessions, no deployed HTTPS gateway |
| R4 — media/rights/deletion | **PARTIAL / BLOCKED pilot** | Upload URL restriction preserved, scan/consent/revocation/storage deletion acceptance missing |
| R5 — video and publishing | **DEFERRED** | Remains disabled |
| R6 — client/agency experience | **PARTIAL / BLOCKED collaborative writes** | Read-only Agency desk remains, no trusted client invitations/assignments enabled |
| R7 — release, mobile and operations | **PARTIAL / BLOCKED real pilot** | Source build/supply chain passes; existing AppDeploy QA sandbox ready but does not host this gateway; mobile/a11y and hosted performance not measured |

## Deployment and privacy
- Existing Phase 2 AppDeploy QA sandbox: `growth-starter-phase-2-qa-sandbox-gve53p`, **ready**, historical recorded snapshot `1791455061355` (latest API did not return a new version). No connection to new hosted Supabase gateway.
- Staging Node service: **NOT DEPLOYED**, so no service URL, TLS certificate or deployed SHA available.
- Source does not auto-create users, emit credentials, run background jobs, send messages, or publish content.
- No production data, real client imagery or other Codeedge repo changed. No merge/self-approval.

## Blocking external prerequisites / next smallest phase
1. Choose an approved staging Node hosting target with HTTPS ingress, isolated secret store and a bounded Node 22 process; **avoid paid resources without fresh explicit cost approval**.
2. Through an approved secret-entry channel, create/activate a strongly random, rotation-ready **non-owner** `growth_starter_runtime` LOGIN. Verify real external TLS hostname/CA, limited SQL and password rotation. Never commit or paste credentials.
3. Inspect the actual Supabase project's signing-key settings; this adapter requires an asymmetric ES256/RS256 signer and verified email. Set up real test account sessions and prove online revocation/logout.
4. Seed two fictional accounts/workspaces/requests using an auditable isolated staging fixture with cleanup and no patient data. Run `staging/hosted-acceptance.mjs` with securely supplied env vars and verify own/foreign HTTP status plus DB denial and cleanup. Document deployed SHA.
5. Resolve or explicitly accept with restrictions the privileged definer-function impersonation threat before permitting elevated roles. Then prepare transactional agency operations and true client pilot.

**Estimated secure pilot readiness:** roughly **45–50%** (judgmental; not a measured scope percentage). The blocking path is real restricted hosted connectivity and independent identities, not merely more interface work.

**NO MERGE. NO PRODUCTION DEPLOYMENT. NO HOSTED TWO-USER PASS CLAIM.**
