# Codeedge Growth Starter — Phase 2.3 controlled handoff

**Date:** 2026-10-08. **PR:** #2, `engineering/phase2-core-security` (DRAFT, no merge).  
**Starting reviewed SHA:** `586be5f46e21610a1a8e3589b4d0573db79a1863`  
**Latest implementation SHA before documentation:** `1d2e936cab5c14f6011bb4999bc51224e5e203c1`  
**Final exact head and CI:** inspect live GitHub PR #2 after this documentation commit and add the exact-head results in the PR conversation.  
**Main before change:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.

## Executive verdict

**REVIEWABLE PHASE 2.3 INCREMENT / PILOT ACCEPTANCE STILL BLOCKED.** The isolated, empty hosted PostgreSQL now has default-deny RLS, a separately prepared but intentionally NOLOGIN runtime principal, and a restricted session-status function. A new Supabase Auth provider-specific adapter plus TLS-requiring, read-only, separately runnable Node service exist as **unmerged source only**. Hosted authenticated client/agency collaboration is **not** enabled, and no actual two-user hosted API test was performed.

## Infrastructure facts

- Isolated Supabase project `codeedge-growth-starter-staging` / `dbppeymhsemvghbvuvof` in Mumbai (`ap-south-1`), ACTIVE_HEALTHY at verification.
- Hosted migrations applied:
  - `20261008141834_growth_starter_initial_private_schema` (0001)
  - `20261008141846_growth_starter_restricted_staging_reader` (0002)
  - `20261008143234_growth_starter_staging_default_deny_rls` (0003)
  - `20261008145300_growth_starter_prepare_restricted_runtime` (0004)
  - `20261008145917_growth_starter_live_auth_session_probe` (0005)
- All seven base tables have `relrowsecurity=true` with no policies. `anon`/`authenticated` have no schema/table grants. `growth_starter_reader` remains NOLOGIN and can execute only approved functions, not read base tables.
- `growth_starter_runtime` is **NOLOGIN, NOINHERIT, non-superuser, NOBYPASSRLS**. It has SET privilege to reader but no inherited/direct table privileges. The Supabase SQL-admin `postgres` remains unable to SET to reader: do not bypass this by granting additional privileges to admin.
- `staging_session_active` is a narrow SECURITY DEFINER boolean probe of `auth.sessions` and `auth.users`: grants reader only, denies anon/auth; unknown session returns false. Supabase Auth origin must authenticate tokens before calling.
- No synthetic or real user/workspace/media persists in this project.

## Code changes in PR #2

- `db/migrations/0004_prepare_runtime_role.sql` — prepare least-privilege NOLOGIN runtime principal, no password.
- `db/migrations/0005_staging_auth_session_probe.sql` — live session/verified email probe, no public execute grant.
- `backend/supabase-staging-identity.mjs` — explicit HTTPS Supabase Auth /user adapter, asymmetric ES256/RS256 token policy, subject/issuer/audience/email/session checks, fail-closed online DB session check.
- `backend/staging-restricted-runtime.mjs` — whitelist narrowly scoped session query along with existing tenant-list queries.
- `backend/staging-supabase-gateway.mjs` — compose trusted Auth and restricted SQL pool.
- `staging/config.mjs`, `staging/server.mjs`, `staging/package.json`, `staging/README.md` — separately deployable Node entrypoint requiring exact project, strict TLS CA validation and server secrets; **not started or hosted**.
- `tests/supabase-staging-identity.test.mjs`, `tests/staging-config.test.mjs`, `tests/postgres/runtime-role.pg.test.mjs`, `tests/postgres/auth-session.pg.test.mjs`, `tests/hosted/synthetic-read-rollback.sql` — test identity and privilege denials, revoked/expired sessions, source/config startup and rollback-only hosted table-function isolation.
- `docs/PHASE2-3-RUNTIME-ROLE.md`, `docs/PHASE2-3-AUTH-BOUNDARY.md` — role/auth trust models.

No original Business OS, Finance Suite, CIGO, CIGO X or MVP repository changed. No client data migrated or deleted. No background automation, posting or production deployment.

## Hosted SQL acceptance (real project, not an actual logged-in HTTP user)

- Run `tests/hosted/synthetic-read-rollback.sql` on the newly provisioned **isolated staging** project only.
- Inserts two fictional workspace owners and one fictional request in each **inside one transaction**, asserts own-workspace/own-request counts 1 each, foreign/unknown reads 0, then **ROLLBACK**.
- The SQL execution completed without error. A separate readback showed workspaces=0, work_requests=0, memberships=0, invitations=0, media=0, auth.users=0, auth.sessions=0 and RLS enabled on seven tables.
- This is **hosted function-level tenant-filter evidence through a privileged management connection**. It does NOT prove the restricted runtime login, two authenticated sessions, deployed staging gateway or client SDK.

## CI evidence (source commit before this handoff)
- At `f89da34cb424d99fb48f0a5df3dd30f11c025221`: [Core safety 37797257366](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37797257366) **51/51 PASS** and [disposable PostgreSQL 37797257740](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37797257740) **31/31 PASS**, total **82/82**. Source-only and disposable signed synthetic sessions, **not actual hosted acceptance**.
- Earlier intermediate failing workflows were fixed without weakening guards: CI `gs_test` does not contain Supabase's `postgres` role, and PostgreSQL's PUBLIC is not a named login for `has_function_privilege`. The tests now verify real unprivileged roles.
- Re-verify **exact final head** CI and record links/counts in PR #2.

## Hosted application identity and status

- Existing Phase 2 AppDeploy QA sandbox `growth-starter-phase-2-qa-sandbox-gve53p`, source snapshot `1791455061355`, state READY, QA snapshot frontend/network errors reported 0 at status check. **It does not contain Phase 2.3 Node/Supabase code.**
- Original app `codeedge-growth-starter-5jhvfk` remains unchanged.
- Standalone staging server: **not deployed** (no deploy app ID, URL or version).
- AppDeploy's current SDK has no documented transactional PostgreSQL or verified email guarantees; do not install the new API in the production app. The standalone Node gateway exists for a supported staging host once credentials are provisioned.

## Independent R1–R7 verdicts

| Finding | Verdict | Evidence / blocker |
| --- | --- | --- |
| R1 invitation/role lifecycle | **BLOCKED hosted** | Atomic PostgreSQL invite/revoke tests remain in CI; no real verified staging accounts or live invitation API |
| R2 database isolation | **PASS: hosted metadata & rollback-only functions; BLOCKED: restricted hosted login** | RLS 7/7, NOLOGIN + grant membership verified, hosted function tenant reads pass; no actual server connection with runtime credentials |
| R3 identity and cross-workspace | **PASS: synthetic unit/PG; BLOCKED: authenticated hosted HTTP** | Online Auth adapter and session probe exist; zero real hosted sessions and no two-user HTTP tests |
| R4 media consent/deletion | **PARTIAL, BLOCKED pilot** | Existing inspector and deletion outbox tested; no real scanning, consent rights, signed-link revocation or hosted media safety |
| R5 video/social publishing | **DEFERRED** | Beyond first secure pilot; no auto publishing |
| R6 client/agency operations | **PARTIAL UI, BLOCKED shared writes** | Existing Website/Enquiries/Work Progress and read-only Agency desk; no trusted multi-user hosted selector, role-gated approval or assignment |
| R7 hosted deployment, accessibility, speed | **BLOCKED** | Existing demo QA ready, but Phase 2.3 server not deployed, no real two-user login and no measured Lighthouse/keyboard/screen-reader acceptance |

## Next smallest safe block (requires secure configuration)

1. Have the owner configure a strong unique secret for `growth_starter_runtime` using an approved secret channel; enable the dedicated LOGIN role only after secret management and ACL/role inspection are ready. NEVER enter the password into GitHub or a conversation. Do not use `postgres` or service_role to run the app.
2. Obtain Supabase project CA certificate, exact restricted DB connection details, a supported Node staging host with server-only environment secrets, and externally trusted HTTPS ingress. Complete TLS hostname/CA verification. The repo's `staging` directory is ready but needs a vetted/pinned lockfile before release.
3. Verify that the isolated Supabase Auth project uses asymmetric JWT signing, verified email, short expiration and actual session revocation; create **two independently authenticated synthetic** staging accounts with verified emails. Do not weaken HS256 denial.
4. Deploy the stand-alone restricted API to **staging only**; validate that the role-preflight passes under the actual runtime login, then test 401/403/405, foreign workspace/ID denial and logout/revoked sessions.
5. Only after the above: selectively build transactional invitation/writes, client progress and agency desk integration, consent-scanned media, accessibility and measured performance. Commission independent acceptance, and do not merge or production deploy before sign-off.

**Practical readiness:** approximately 50–55% of a secure **two-user pilot**, a subjective engineering estimate, not measured completion. The real hosted identity/database connection and multi-user acceptance still determine the critical path.

**Release verdict: NO PRODUCTION DEPLOYMENT / NO MERGE / NO REAL PATIENTS.**
