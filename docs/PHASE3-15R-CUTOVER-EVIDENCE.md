# Phase 3.15R — live privilege cutover dossier (review only)

**Working branch:** engineering/phase2-core-security. **PR #2:** draft, unmerged.
**Target:** codeedge-growth-starter-staging / dbppeymhsemvghbvuvof.
**Scope:** sensitive-free, read-only SQL and a fail-closed offline privilege evaluator.
No managed Auth grants, live DDL, role LOGIN, client accounts, hosting, merging
or production/legacy cutover changes are permitted by this report.

## Actual observed staging baseline (2026-10-14)

Read-only connected Supabase query returned:
- Three legacy actor-argument SECURITY DEFINER functions and three
  callable through the old reader role;
- Old runtime can SET the old reader role;
- Fifteen authenticated column SELECT grants and authenticated schema USAGE;
- Seven existing Growth Starter tables, with their RLS in place (Phase 3.15Q);
- No installed private schema/tables or gs315 restricted runtime roles;
- Historical session checker NOLOGIN, without managed auth schema USAGE;
- No discovered anon table reads or old public/anonymous schema USAGE in the
  queried catalog (not proof of effective REST exposure).

These facts are **not an observed data leak**. They are access and permission
risks that require approved replacement and signed API tests before launch.
Supabase support SU-502526 and SU-503988 have no matching substantive
written answer in connected email as checked. Portal-only responses may be unseen.

## New reproducible read-only inspection

Operator first independently confirms the exact project ref in Dashboard.
Review db/reviews/phase315r_effective_privileges_READ_ONLY.sql. It reads only
pg_roles, pg_class, pg_proc, pg_attribute, information_schema grants and privilege
functions. It does not inspect Auth user/session rows, password hashes or clients.

Execute read-only in Supabase SQL editor and save only the value of the returned
JSON \`snapshot\` field as a local JSON file outside this repository. Never paste
credentials or patient/tenant data into the output.

    node scripts/phase315r-cutover-evidence.mjs /secure/catalog.json /secure/new-report.json

The output file must not already exist (exclusive write, mode 0600). Maximum
snapshot size: 128 KiB. Exit code **2** is intentional: external gates stay
BLOCKED even if catalog values match. The tool does not open network connections.

Run deterministic tests with:

    node --test tests/phase315r-cutover-evidence.test.mjs

The normal core GitHub workflow includes these tests through tests/*.test.mjs.

## Meaning of a PASS

A catalog check only means its **unattested operator JSON** matches the expected
property. The script cannot prove which project supplied the JSON, actual
managed provider logout semantics, effective exposed Data API schemas, or an
owner/reviewer approval. It never generates SOURCE_READY, STAGING_READY or
PRODUCTION_READY. Do not treat all green catalog fields as launch authorization.

Catalog safety probes include:
- the exact legacy SECURITY DEFINER reader/role switch and browser column grants;
- table and column effective SELECT/mutation checks on the restricted writer;
- writer and private-owner LOGIN/SUPERUSER/BYPASSRLS role properties;
- FORCE RLS on private tables and browser/private schema USAGE restrictions;
- missing restricted writer schema usage, or unexpected Auth/public capabilities.

The new SQL supplements, but does not replace, the existing Q migration/RLS
baseline, Phase 3.15P real-login tests, manifest drift assertions and final
release-readiness collector. The role owner function-body and token/session
contract also require separate expert review. SQL catalog data alone cannot
justify changing Supabase-managed \`auth\` ACLs.

## Controlled next step (requires separate approval)

1. Obtain written Supabase guidance on exact original (user_id,session_id)
   validation and current ban/deletion/password/admin/signout/policy behavior,
   or independently approve a *different* explicitly disclosed security contract.
2. Confirm hosting provider/origin, budget, private ingress, secret-vault support,
   callback redirects, fictional Auth identities and operator incident owner.
3. Record actual Dashboard Data API exposed schemas and REST/GraphQL
   configuration; inspect legacy dependencies and complete a no-customer-data
   baseline/default/index/grant/policy comparison.
4. Independently review and rehearse O→K→M→P private migration bundle, signed
   identity authority module, staged J legacy cutover and isolated backup restore.
5. Obtain **specific** approval for each hosted change. Keep all traffic closed
   while applying reviewed migrations and provisioning least-privilege roles.
6. Verify *actual* restricted logins, signed REST/GraphQL denials,
   same-session logout, global/admin/password/ban/deletion/policy scenarios,
   client tenant A/B/C isolation, reversal/recovery and monitoring.
7. Independently sign off and obtain owner release approval before merging
   or accepting any production/real-client exposure.

No one should grant managed Auth schema USAGE or activate a custom checker role
just to satisfy this evidence tool. The intended boundary remains fail-closed.

See docs/SUPABASE-SESSION-AUTHORITY-FINAL-DECISION.md and
docs/SUPABASE-SECURITY-CUTOVER-RUNBOOK.md for explicit constraints.
