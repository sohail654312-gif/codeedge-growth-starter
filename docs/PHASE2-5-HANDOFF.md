# Codeedge Growth Starter — Phase 2.5 controlled evidence handoff

**Date:** 2026-10-08. **Repo:** `sohail654312-gif/codeedge-growth-starter`.
**PR #2:** existing `engineering/phase2-core-security`, **draft / unmerged**.
**Starting exact HEAD:** `d2292ffb4958e2306282b984729231ed1225702b`
**Last source commit before handoff:** `d209ae8ceff989f2fc27800897d18eaec98c5ea0`.
**Final exact HEAD:** verify GitHub immediately after this documentation commit; only exact-head CI is acceptance evidence.
**Base `main`:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.

## Verdict
**PHASE 2.5 PARTIAL / REVIEWABLE SECURITY SOURCE INCREMENT; LIVE HOSTED ACCEPTANCE BLOCKED.**
This block does not create a duplicate project/PR, activate a PostgreSQL LOGIN, set any password, create Auth users, introduce patient data, migrate records, deploy a gateway or change production. No new Supabase migrations; no other Codeedge repositories modified.

## Live verification completed first
- Existing isolated Supabase `codeedge-growth-starter-staging` project `dbppeymhsemvghbvuvof`: `ACTIVE_HEALTHY`, PostgreSQL 17, Mumbai.
- Migrations 0001–0005 already applied; all seven Growth Starter base tables RLS enabled with zero policies, zero workspace records, no test `auth.users` or `auth.sessions`.
- Roles `growth_starter_reader` and `growth_starter_runtime` remain NOLOGIN, non-superuser/non-BYPASSRLS; the runtime has SET membership but not inherited grants.
- Independent hosted read-only catalog queries: reader direct table privilege count **0**, extra callable `growth_starter` function signatures **0**, schema CREATE **false**. No authenticated HTTP/real TLS-runtime login test exists.
- All three `SECURITY DEFINER` functions are still `postgres`-owned, with explicit search paths; `anon` and `authenticated` cannot EXECUTE. `postgres` is a BYPASSRLS management role. **HIGH residual:** trusted-server-supplied actor/session arguments can be substituted if the gateway is compromised; private schema and RLS are not independent proof of actor binding.
- Existing AppDeploy Phase 2 QA sandbox `growth-starter-phase-2-qa-sandbox-gve53p` reports READY, but was not redeployed with this Node gateway. No matching Growth Starter Vercel project appeared in connected project search. No approved host/secret store was selected for live activation.

## Changes in this increment
1. `backend/staging-gateway.mjs`: strict browser CORS preflight (exact HTTPS origin, GET, Authorization only, no credentials, unknown paths/headers/methods denied). Actual GET still requires verified identity and membership; write methods remain 405.
2. `tests/staging-cors.test.mjs`: real local ephemeral HTTP regression tests for allowed preflight, denied origin/custom header/POST and fail-closed unauthenticated GET.
3. `backend/staging-restricted-runtime.mjs`: startup preflight now additionally checks reader role flags, prohibited direct base-table privileges and any unapproved EXECUTE-capable routine. The catalog-only function matcher intentionally does **not** resolve private functions through the nonprivileged login, preserving zero direct schema access.
4. `tests/postgres/restricted-runtime.pg.test.mjs`: in **disposable PostgreSQL only**, temporarily grants base-table SELECT and an extra routine to the reader role, confirms gateway startup denies each permission drift, removes both and verifies recovery. No such grants were applied in the real Supabase project.
5. `docs/PHASE2-5-CORS-BOUNDARY.md`, `docs/PHASE2-5-READER-DRIFT.md`, `docs/PHASE2-5-HANDOFF.md` and `staging/README.md`: acceptance/security record and operator gates.

An intermediate CI failure was investigated and corrected: resolving a private-schema function with `to_regprocedure` from a deliberately non-schema-privileged login returned PostgreSQL 42501. The final query instead inspects trusted PostgreSQL system catalogs. A temporary diagnostic was removed. Previous source security controls and tests were not weakened.

## Verified CI on source commit before docs
- [Core safety run 37807921737](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37807921737): **57/57 PASS**.
- [Disposable PostgreSQL run 37807921727](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37807921727): **33/33 PASS** (includes two new permission-drift regressions).
- [Staging supply-chain run 37807921775](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37807921775): **13/13 PASS**, npm audit zero vulnerabilities at verification.
- Some tests overlap, so summing suites does not represent unique test cases. Follow up with final documentation HEAD CI before independent signoff.

## R1–R7 explicit verdicts
| Risk | Verdict | Rationale |
|---|---|---|
| R1 Invitation and membership | **PASS disposable contract / BLOCKED hosted** | No authorized live invitation or multiuser role issuing |
| R2 PG security/persistence | **PASS live metadata; PASS disposable role drift / BLOCKED actual runtime login** | Both roles NOLOGIN; no secret-managed external TLS connection |
| R3 Trusted identity/tenant isolation | **PASS synthetic / BLOCKED hosted** | No real Auth user/session or hosted two-user HTTPS |
| R4 Media consent/storage | **PARTIAL / BLOCKED pilot** | Unreviewed URLs restricted; no live scan, revoked links, retention/export/deletion acceptance |
| R5 Social publishing/video | **DEFERRED** | Disabled by scope |
| R6 Client + agency collaboration | **PARTIAL / BLOCKED writes** | Existing UI preserved, read-only staged boundary only |
| R7 Deployment/mobile/operations | **PASS CI/config checks / BLOCKED live pilot** | No new hosted Node API; no actual mobile/a11y/latency/backup acceptance |

## Independent host/auth evidence classification
- **Actual hosted Supabase SQL metadata:** RLS, roles, grants, no stored test users/data; PASS limited inspection.
- **Disposable PostgreSQL:** real restricted network login + synthetic signed HTTP; PASS, **not the hosted Supabase project**.
- **Unit/source + local HTTP:** CORS and fail-closed session/identity tests; PASS, **not real deployed HTTPS**.
- **Actual hosted restricted PostgreSQL LOGIN + TLS:** BLOCKED.
- **Actual two authenticated users and HTTPS API:** BLOCKED.
- **Actual privileged function independent actor binding:** OPEN HIGH.
- **Production deployment/merge/patient records:** none, intentionally.

## Exact smallest next block
**External owner gate:** approve a specific secrets-capable HTTPS Node 22 staging host and its actual price; provide the credentials **only through that host's approved secure entry flow**. Then explicitly authorize activating `growth_starter_runtime` with a strong unique password, use a trusted CA/hostname-validated TLS PostgreSQL pool, configure asymmetric Supabase Auth with two independent fictional verified users, deploy the **existing** Node read-only service and execute `staging/hosted-acceptance.mjs` plus separate revoked/expired session and hosted role-denial checks. Record exact deployed SHA and rollback/cleanup evidence.

**Pilot-readiness estimate:** approximately **45–50%**, engineering judgment only; Phase 2.5 Definition of Done **NOT MET** due to external service, real login and hosted identity blockers.
