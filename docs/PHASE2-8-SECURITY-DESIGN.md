# Phase 2.8 — Independent actor binding, staging activation and report-storage gates

**Mode: controlled manual, source-only until the explicit owner gates are satisfied.**
**Starting commit:** `5f39529bddef7f02fe4a9188d2647459e38bb0e9`.
**Live Supabase staging:** `codeedge-growth-starter-staging` / `dbppeymhsemvghbvuvof` / Mumbai PostgreSQL 17.

## Verified actual hosted-state readback (2026-10-10)

- Supabase API reports `ACTIVE_HEALTHY`; exactly five historical staging migrations (0001–0005).
- Seven existing private relations remain RLS-enabled with **zero policies** and zero rows.
- No `auth.users`, `auth.sessions`, or business workspaces exist in staging.
- `growth_starter_runtime` and `growth_starter_reader` remain **NOLOGIN**, non-superuser, non-BYPASSRLS.
- Three callable `postgres`-owned `SECURITY DEFINER` routines remain: `staging_list_workspaces(text)`, `staging_list_requests(text,text,integer)`, `staging_session_active(text,text,text)`.
- The connected Vercel project search returned no existing matching Growth Starter staging gateway. No approved secret-backed host has been selected or deployed.

## Independent attack proof (disposable PostgreSQL only)

`tests/postgres/restricted-runtime.pg.test.mjs` now verifies a **negative security finding**:
a restricted reader that substitutes synthetic User B's actor ID in the approved workspace/request SQL functions retrieves User B's workspace and request. Direct base-table queries remain denied, and User A's signed HTTP session is still denied access to Workspace B.

**Result: unresolved HIGH — server-side actor checks are not an independent database principal boundary.** This test must never be described as successful tenant isolation *against a compromised gateway*. No real-user or production data was accessed.

## Security alternatives and smallest acceptable boundary

1. **Preferred design to investigate:** a distinct, JWT-verifying gateway boundary with signed user bearer-token handling **outside** the direct restricted DB actor-input path. Supabase's managed JWT-verifying API can supply identity context to RLS where calls are authenticated, with narrow `auth.uid()` policies and per-session revocation checks. Policies must never trust arbitrary browser-supplied actor/role/workspace IDs. Supabase documents that JWTs are verified before its data products apply roles and RLS: https://supabase.com/docs/guides/auth/jwts and https://supabase.com/docs/guides/database/postgres/row-level-security .
2. **Direct PostgreSQL warning:** `auth.uid()` or `current_setting('request.jwt.claims')` is **not** independently trustworthy if a compromised direct PostgreSQL runtime can execute arbitrary `SET` operations. Merely replacing arguments with a session GUC is not remediation.
3. **SECURITY INVOKER/RLS design:** functions would need the caller's authenticated, least-privilege data access; existing zero-policy RLS would intentionally return zero rows. A future independently verified API-mediated per-user route must have specific policies, session checks, minimal grants, unit + disposable DB regressions, and real hosted two-user attacker tests before enabling it. None of those policies have been enabled.
4. **Do not implement a fake crypto proof:** a symmetric signing key accessible to the same compromised gateway does not independently prevent actor forgery. PostgreSQL 17 cannot be presumed to verify the project's asymmetric Supabase Auth signatures without approved, audited crypto support.
5. Keep the `growth_starter_reader` SECURITY DEFINER path limited to synthetic/read-only testing, with **no** live client/customer workloads, direct browser SQL access, report mutations or agency privilege activation. The residual risk remains OPEN/HIGH.

## Source-only report persistence preparation

- `backend/seo-report-draft.mjs` checks workspace consistency, requires exact evidence input and digest, preserves source classification, records staleness and prepares immutable optimistic versioned revisions. This is *preparation*, not trusted authentication, an audit event or saved history.
- `createDisabledSeoReportRepository()` denies every read, save, review, assignment or publish operation. There is no registered HTTP route or active DB store.
- `db/drafts/0006_seo_reports_REVIEW_ONLY.sql` is **not a migration and was not applied**. It proposes the minimum separate SEO-report, revision and event tables, composite tenant consistency FKs and default-deny RLS with no policies or runtime grants. It does not duplicate Business OS CRM data.
- The draft does not solve independent `created_by_verified_subject` identity or mutating-actor authorization. Never apply it or activate writes before these issues are addressed.
- Synthetic reports and imported Search Console exports remain local/user-supplied. No Google OAuth, patient information, real analytics or external publication.

## Exact owner gates to progress

1. Explicitly approve an existing compatible HTTPS **Node 22** staging host and confirm any cost and rollback terms. The old AppDeploy QA sandbox is *not* this service.
2. Approve secure host-side entry of a unique 32+ character DB password via the host's protected secret channel. **Do not send passwords in chat or GitHub.** Independently authorize changing the existing `growth_starter_runtime` role to LOGIN and test trusted-CA/hostname TLS, allowed origin, 3-connection bounded pool and fail-closed startup.
3. Approve creation of **two independent fictional email-confirmed Supabase staging Auth accounts**, with two separate synthetic workspaces and strictly bounded test records, plus an auditable cleanup procedure.
4. Independently review/fix the privileged actor substitution boundary **before real-client data, report persistence or privilege elevation**. Execute the existing `staging/hosted-acceptance.mjs` over a genuinely deployed HTTPS gateway, plus opposite-actor direct-role attack probes and session revocation.
5. Capture actual deployed SHA, real Auth HTTP statuses, credential-free SQL grant evidence, TLS, row cleanup, no production changes and rollback before any controlled pilot. Only then introduce an independently reviewed read/write authorization path, persist SEO reports and connect user-consented Google OAuth.

## Security/verdict terminology

- **SOURCE**: functions and disabled contracts are in GitHub.
- **UNIT TEST**: deterministic offline/pure tests, not logged-in users.
- **DISPOSABLE DB**: real SQL with synthetic data on GitHub runner; demonstrates the above HIGH vulnerability.
- **LIVE STAGING METADATA**: PostgreSQL catalog and row counts only, not live Auth/TLS.
- **REAL HOSTED HTTPS**: NOT PERFORMED and BLOCKED.
- **Actual accessibility/latency/backup/rollback**: NOT MEASURED in this block.
