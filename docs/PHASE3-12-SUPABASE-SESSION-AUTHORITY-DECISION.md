# CODEEDGE GROWTH STARTER — PHASE 3.12 SESSION-AUTHORITY DECISION

**Provider decision: UNVERIFIED — PROVIDER DECISION PENDING.** No hosted activation is accepted. All work is source-only plus disposable PostgreSQL 17 testing and read-only staging metadata.

## A. Baseline
Existing repo \`sohail654312-gif/codeedge-growth-starter\`, branch \`engineering/phase2-core-security\`, PR #2 DRAFT. Starting SHA \`bee27bee36d228257408c68a89ab4cf0066af8b0\`; starting exact-SHA PASS runs: Core 174 (38090363380), PostgreSQL 17 43 (38090363396), SEO/UI 39 (38090363436), Supply Chain 16 (38090363426), 272 test executions. This is **not** Phase 3.12 final-SHA evidence.

## B. Official guidance and decision
- Supabase session semantics: https://supabase.com/docs/guides/auth/sessions . A verified but unexpired JWT does not prove its \`session_id\` is still present; Supabase says affected session rows are removed on sign-out. A separate authenticated session-row lookup is needed for immediate logout rejection. Sessions exceeding inactivity/time-box policy may remain until cleanup, so row presence alone is not all session-policy enforcement.
- Supabase managed-schema permissions: https://supabase.com/docs/guides/platform/permissions . Auth objects are managed by \`supabase_auth_admin\`. Changing managed-schema ownership or platform assumptions can break future migrations; do not modify them.
- Supabase role guidance: https://supabase.com/docs/guides/database/postgres/roles and https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c . Custom database roles are a mechanism, but PUBLIC grants (including TEMP and some optional extensions) can cause unexpected effective privileges. A general custom-role guide is **not** authorization for this exact managed Auth schema integration.
- User data / Auth schema: https://supabase.com/docs/guides/auth/managing-user-data . Auth schema is not a public Data API.
- Support: https://supabase.com/support and https://supabase.com/dashboard/support/new . Access and response times depend on plan. No ticket submitted and no vendor answer fabricated.

**Formal provider verdict: UNVERIFIED**, not UNSUPPORTED. An official, upgrade-stable contract for a dedicated custom LOGIN querying managed \`auth.sessions(id,user_id,not_after)\` + \`auth.users(id,deleted_at,banned_until)\` could not be confirmed. No mutually authenticated private introspection endpoint with identical revocation semantics could be confirmed. Support/vendor approval is the external dependency.

## C. Precise read-only staging findings (2026-10-11)
Project \`codeedge-growth-starter-staging\` ref \`dbppeymhsemvghbvuvof\`, PostgreSQL 17.11, ACTIVE_HEALTHY.
\`growth_starter_session_checker\`: LOGIN FALSE, INHERIT FALSE, \`auth\` schema USAGE FALSE.
All six required Auth columns exist and have effective SELECT **TRUE** for this role:
- \`auth.sessions\`: id, user_id, not_after.
- \`auth.users\`: id, deleted_at, banned_until.
Full-table SELECT is FALSE on each Auth table. **No additional columns** are effectively readable on either Auth table based on live \`pg_attribute\` plus \`has_column_privilege\` enumeration. \`pg_has_role\` SET for \`postgres\` and the old reader is FALSE.
Database CONNECT and TEMP privileges are TRUE, so do not describe the checker as having zero effective PUBLIC capabilities. An optional \`net\` schema and queue/response tables were absent at inspection; future extension installation must trigger renewed privilege audit.

No Auth user/session rows, passwords, keys, service secrets or customer records were read or changed. No GRANT, LOGIN, role, user, migration, deploy or live endpoint was created.

**The shortest possible host grant proposal, *only if vendor confirms support and owner separately approves*, is**:
\`GRANT USAGE ON SCHEMA auth TO growth_starter_session_checker\`.
The role's existing six column SELECT grants are already present; do not duplicate them gratuitously. Separately arrange server-only credential management and carefully enable LOGIN, after additional PUBLIC privilege/capability review. No secrets in GitHub or chat.

## D. Source-level security improvement
Existing \`backend/pg-session-authority.mjs\` already enforced dedicated role, no full-table SELECT, and six named Auth columns. It **did not** prohibit *other* column-scoped SELECT privileges. Phase 3.12 adds effective privilege allowlist enumeration of every \`pg_attribute\` in \`auth.sessions\` and \`auth.users\` and prevents the checker from starting when extra SELECT rights exist. This catches direct grants, inherited privileges, and PUBLIC/table grants (the latter was previously separately caught).
- \`tests/pg-session-authority.test.mjs\`: deny mocked extra columns or missing effective privilege catalogue.
- \`tests/hosted-authenticated-gateway.test.mjs\`: preserve fixture compatibility; unsafe hosted PostgREST factory remains disabled.
- \`tests/postgres/session-checker-privileges.pg.test.mjs\`: real disposable PG17 GRANT and REVOKE for an extra \`auth.users.email\` SELECT, confirming enumeration detects privilege drift. Uses transaction rollback.
- Existing immutable Phase 3.5 PG17 RLS catalogue, Phase 3.9 tenant roles, Phase 3.10 concurrency, Phase 3.11 private SQL HTTP test, disabled real hosted private reader, and permanent Demo/Sandbox remain unchanged.

## E. Provider support request — READY, NOT SUBMITTED
**Subject:** Least-privilege managed Auth session lookup for immediate sign-out revocation — dbppeymhsemvghbvuvof (PG 17.11)

We are building a secure multi-tenant private Node.js API with Supabase Auth. We need to reject a JWT after the *exact original* Auth session is signed out, without waiting for token expiry. Supabase documentation recommends confirming its \`session_id\` still exists in \`auth.sessions\`.

Our dedicated role \`growth_starter_session_checker\` already has only SELECT on six columns: \`auth.sessions(id,user_id,not_after)\` and \`auth.users(id,deleted_at,banned_until)\`. It has NOLOGIN, NOINHERIT, NOBYPASSRLS; effective Auth schema USAGE is missing. No other Auth columns are readable; full-table SELECT is denied.

1. Is granting the role \`USAGE\` on managed \`auth\` and enabling it as a dedicated **private server-only LOGIN** an officially supported, upgrade-stable Supabase integration? Does it interfere with \`supabase_auth_admin\` ownership or managed migrations?
2. Are those six columns and their types/semantics supported for security-critical queries across Auth upgrades? Is \`not_after\` sufficient for the configured session policies, especially inactivity/time-box rules?
3. What precise sign-out semantics are guaranteed for local/global/other-devices sign-outs, admin suspension/deletion, password changes and session expiration? Does a missing row guarantee revocation; what additional checks are mandatory?
4. Is there a supported private endpoint to introspect the **exact JWT \`session_id\`** with immediate revocation semantics without reading managed tables?
5. Which PUBLIC-inherited PostgreSQL privileges (TEMP, optional \`pg_net\`, functions) must be audited/limited for this checker, without breaking platform services?
6. What is the recommended secret management, TLS/pooling, credential rotation, error handling and least-privilege deployment pattern? Any plan or cost restrictions?
7. If this is unsupported, what first-party recommended architecture allows sensitive API requests to reject an unexpired signed-out Supabase JWT immediately?

We specifically reject superuser, service-role/BYPASSRLS, public Auth APIs, broad managed-schema SELECT, privileged SECURITY DEFINER loopholes and browser-derived SQL identity. Please give an explicit yes/no for this grant model and controlling official documentation.

**User submission:** open https://supabase.com/dashboard/support/new after signing into the relevant Supabase account, choose the Growth Starter project if prompted, paste the above, submit. Alternatively follow https://supabase.com/support -> Open support ticket. Availability/response depends on account plan; if ticket unavailable, use the platform community channel for a documented technical answer and do not treat forum advice as a provider guarantee. No ticket reference exists yet.

## F. Subsequent owner approval package — NOT YET AUTHORIZED
**Scope:** only \`dbppeymhsemvghbvuvof\`. After vendor written confirmation, request separate owner approval to:
1. Reconfirm exact effective privileges and managed-object compatibility.
2. Grant **only** \`USAGE ON SCHEMA auth\` to checker if still absent; no broad Auth table grants.
3. Enable dedicated private LOGIN with a randomly generated password delivered only via owner-approved encrypted secret manager (not source, chat, CI output); ensure TLS validation, server-only ingress and minimal connectivity. Determine whether current PUBLIC TEMP/extension privileges need compatible mitigation.
4. Verify independently the checker cannot access other Auth columns, growth_starter data, legacy DEFINERs or privileged role paths.
5. Provision fictional Auth A/B/C only after separate explicit authorization and run live signed JWT sign-out/replay, user bans and timeouts, before advancing other deployment gates.
6. Roll back by disabling checker LOGIN and revoking **only newly introduced** schema USAGE, retiring its secret and restoring disabled runtime. Keep existing independently reviewed six-column grants unless separately approved.

Cost **not established** for this operation; do not claim that a database grant, a service plan or supported support access is free. Obtain plan-specific answer before any paid changes.

## G. Other hosted gates remaining
- Verified identity-to-tenant restricted DB principal binding and compromised-server blast-radius isolation.
- Actual Supabase Data API Exposed Schemas readback plus signed-out bearer bypass denial. PostgreSQL \`pgrst.db_schemas\` session GUC is not conclusive.
- Three legacy privileged \`staging_list_*\` / \`staging_session_active\` EXECUTE permissions and runtime SET ROLE old reader are still FAIL/OPEN.
- Approved protected HTTPS ingress, secret/role handling, fictional signed A/B/C acceptance and no customer deployment until accepted.

Even provider confirmation resolves only the first gate. Do **not** reactivate the disabled hosted PostgREST constructor.

## H. Exact-SHA verification and rollback
The new GitHub commit SHA and four new CI runs must be verified after commit and reported in the assistant's final response, not claimed from the starting SHA. If CI fails, correct and reverify.
Rollback: ordinary non-force revert of the Phase 3.12 source commit. There are no hosted modifications to roll back.

**Only actionable next step:** the owner should submit the exact support inquiry and return the written Supabase answer or ticket reference. Until then, **PROVIDER DECISION PENDING** and hosted API activation **BLOCKED**.
