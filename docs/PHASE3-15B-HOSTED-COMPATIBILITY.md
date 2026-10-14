# Phase 3.15B — Provider compatibility, hosted diagnostic and acceptance gates

## Decision (as of 2026-10-14)
**BLOCKED.** The read-only hosted inspection of `codeedge-growth-starter-staging` (ref `dbppeymhsemvghbvuvof`) establishes the technical difference between ordinary PostgreSQL feasibility and provider-compatible hosted acceptance. It does **not** activate or approve credentials, role grants, functions, API exposure or deployment.

### Directly observed database baseline
| Fact | Read-only result |
|---|---|
| Hosted project | `ACTIVE_HEALTHY`, PG 17.11 |
| Session checker `LOGIN` | false |
| Session checker `USAGE ON SCHEMA auth` | false |
| Narrow Auth column grants | 6 of 6 |
| Broad table SELECT on `auth.sessions` / `auth.users` | false / false |
| Session checker `SET ROLE` legacy reader | false |
| Runtime `SET ROLE` legacy reader | **true** |
| Legacy privileged definer functions executable by old reader | **3** |
| RLS-enabled Growth Starter tables | 7 |
| Growth Starter RLS policies | 3 |
| `current_setting('pgrst.db_schemas',true)` | **null / inconclusive** |

The direct dashboard exposed-schema configuration is **not** established by that GUC (particularly when queried through another database session). Do not infer "Data API disabled" or "safe" from null.

## Delivered Phase 3.15B source code
- `db/reviews/phase315b_hosted_catalog_READ_ONLY.sql`: only a SELECT against PostgreSQL catalogs and role privileges, with no Auth user/session rows, secrets or mutations.
- `backend/phase315b-readiness.mjs`: deterministic fail-closed readiness diagnostic. It refuses activation **even with an all-green database catalog**, because database results cannot certify provider support or external system permissions.
- `tests/phase315b-readiness.test.mjs`: validates observed blockers, malicious broad access, role escalation, schema-policy drift, malformed evidence, falsified acceptance, and an all-green-but-unapproved snapshot.

The code is **not** imported by any deployed server entrypoint. No hosted permissions, migrations, credentials, policies, roles, API settings or function deployments were changed.

## Reproduce against staging (read-only; no secrets in output)
Through the authorized Supabase SQL read tool, execute the SELECT in `db/reviews/phase315b_hosted_catalog_READ_ONLY.sql` against ref `dbppeymhsemvghbvuvof`, then pass only its one non-sensitive result row to `assessHostedAuthReadiness`. Do not use a repository CI workflow with hosted database secrets. Run `node --test tests/phase315b-readiness.test.mjs` for offline acceptance tests.

## Strict activation blockers and sequence
1. Provider support for custom `auth` schema USAGE and isolated LOGIN is **not yet evidenced**. The official session guide describes checking `session_id` in `auth.sessions`, but does not certify these specific managed-schema grants; keep original tickets SU-502526 and SU-503988 open.
2. Capture the **effective** Dashboard Data API exposed-schema setting and perform signed-in/direct REST negative tests; do not assume `pgrst.db_schemas` is authoritative.
3. Design separate private checker and runtime credentials, TLS/pooler mode validation, and demonstrate no broad Auth reads, no `service_role`, `postgres`, inherited ownership, writable session columns, arbitrary `SET ROLE` or browser access.
4. Use fictional client A/B/C with actual provider-issued signed tokens; require valid session acceptance, logout and admin revocation replay denial, membership revocation, cross-tenant denial, outage fail-closed and direct API bypass denial.
5. Independently review the full RLS policy predicates and role catalogue; the count 3 is **not** a policy security proof.
6. Only after supported replacement passes, propose separate owner-approved transactional cutover for the three legacy actor-argument functions and the reader role-switch edge. Pre-cutover execution is **not permitted**.

## Free-plan fallback
If supported session checker access cannot be established, start a new source-only design for **Codeedge-owned server sessions** with a revocation table and atomic per-request checks behind the private API. That can enforce immediate **Codeedge** logout/revocation, but cannot claim instant independent Supabase logout/admin revocation without a separately verified provider signal. This contract change requires explicit owner review. Do not silently weaken it to plain JWT validity or short expiry.

## Security and project boundaries
Keep Growth Starter PR #2 draft. Do not touch Business OS, original MVP, other Codeedge systems, production data or user accounts. No paid services, new projects, Docker installs, or secrets in GitHub/chat. Keep personal or clinical data out of tests.

References:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/database/postgres/roles
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/functions/auth
