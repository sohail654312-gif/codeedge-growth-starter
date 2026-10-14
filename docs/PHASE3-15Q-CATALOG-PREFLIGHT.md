# Phase 3.15Q — offline, fail-closed Supabase catalog preflight

**Scope:** new read-only SQL, pure evaluator, regression tests. No hosted DDL,
credential activation, deployment, client data or integration effect. The private
runtime in the existing draft PR is not modified. This preflight does not replace
scripts/release-readiness.mjs or its independently obtained exact-SHA CI evidence.

## Operator procedure

1. Independently confirm the intended **staging** project reference
   dbppeymhsemvghbvuvof in Supabase Dashboard. The SQL cannot attest project ID.
2. Run db/reviews/phase315q_catalog_READ_ONLY.sql with a read-only connection or
   reviewed SQL editor; it contains BEGIN TRANSACTION READ ONLY and selects only
   catalog metadata and migration versions, not Auth users/sessions or customer data.
3. Save **only** the snapshot JSON result from the SELECT as a local UTF-8 JSON
   file outside the repository. Do not include SQL-editor banners, credentials,
   browser cookies, or provider replies. If results cannot be obtained, do not
   fabricate them; the evaluator treats absent evidence as BLOCKED.
4. Run (with Node 22+) from repository root:

       node scripts/supabase-staging-preflight.mjs /path/to/staging-snapshot.json /path/to/new-staging-report.json

   The output path must not exist: it is created with exclusive write and mode 0600.
   The command exits **2** deliberately, even if all catalog checks pass, because
   provider/session, Dashboard, signed-API and independent review facts are missing.
   This is **not** a CI passing readiness command.
5. Run node --test tests/supabase-staging-preflight.test.mjs for deterministic
   fictional positive and negative regressions. The normal core workflow includes
   it through tests/*.test.mjs.

## Interpretation

- **PASS** means a value in the operator-supplied catalog JSON matches an expected
  baseline. It is not cryptographically authenticated or proof of the project used.
- **BLOCKED** means a mismatch, incomplete input or unmet hosted requirement.
- **CATALOG_CONSISTENT_UNATTESTED** says only that the supplied database catalog
  appears consistent. It **never** authorizes deployment.
- **UNVERIFIED** requires separately obtained provider support, real hosted
  identity/sign-out tests, Dashboard API configuration checks, signed REST/GraphQL
  negative probes, backup/restore, independent review and owner approval.

Current read-only metadata before this new query indicated seven migrations,
PostgreSQL 17.11, missing private schema/new roles, historical actor-argument
SECURITY DEFINER functions, authenticated column access, old runtime SET-role edge,
and an unactivated NOLOGIN checker lacking managed Auth schema USAGE. Those last
privileges must **not** be broadened merely to make a checklist green.

Four Supabase rls_enabled_no_policy INFO notices are consistent with intentionally
**default-deny** historical tables. Do not add browser allow policies to quiet them.
Historical pgrst.db_schemas SQL settings do not prove what is exposed in the actual
Dashboard. Only signed real REST/GraphQL probes can validate the effective surface.

## Explicitly outstanding

Provider written exact-session/account/policy contract (tickets SU-502526 and
SU-503988); independently reviewed authority adapter; approved HTTPS host/hostname;
reviewed O→K→M→P SQL bundle/role credentials and J legacy cutover; separately
approved fictional PKCE users; hosted A/B/C isolation/revocation and recovery;
media/invitation/provider integrations; owner/independent release approvals.

The preferred safe sequence remains: provider decision → owner/reviewer-approved
staging rehearsal and backup restore → reviewed migration/restricted-role cutover
→ signed hosted denial tests → final human release acceptance. Keep PR #2 draft.
