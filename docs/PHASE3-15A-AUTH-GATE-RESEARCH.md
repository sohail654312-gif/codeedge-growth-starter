# Phase 3.15A — Supabase session-gate feasibility (offline proof only)

## Decision
**Conditional route A** remains the least disruptive: retain Supabase Auth and a private Codeedge API, validate the *original* bearer with the provider, then check the exact `(session_id, user_id)` against active Auth sessions using a narrowly constrained **server-only direct PostgreSQL principal**. No caller-supplied user ID can create an authority.

This design is **not yet approved for hosted activation**. Supabase's public documentation discusses checking `auth.sessions` after logout, but does not explicitly guarantee that the requested custom role's managed-schema `USAGE` and `LOGIN` permissions are supported, stable across platform upgrades, or compatible with all connection modes. Keep support tickets SU-502526 and SU-503988 open. Do not claim the API's `getUser()` call alone proves immediate session revocation.

## Baseline (live read-only inspection, 2026-10-14)
Project `dbppeymhsemvghbvuvof` is ACTIVE_HEALTHY, PostgreSQL 17.11. `growth_starter_session_checker` has six intended column-level SELECT grants, but remains NOLOGIN and lacks `USAGE ON SCHEMA auth`. There are seven RLS-enabled Growth Starter tables, three read policies, three legacy SECURITY DEFINER functions executable by `growth_starter_reader`, and a `SET ROLE` edge from the runtime to the legacy reader. No approved signed-user end-to-end acceptance exists.

## New reproducible proof
`tests/postgres/phase315a-auth-schema-gate.pg.test.mjs` creates an **independent fictional auth-like schema and NOLOGIN role** in a disposable PostgreSQL 17 test database, inside a rollback transaction. Its assertions show:
1. Six column-level grants do **not** overcome a missing schema `USAGE` privilege (42501).
2. After narrow `USAGE`, a session+subject lookup works; a mismatched user does not.
3. Sensitive columns, full-row SELECT and mutation remain denied (42501).
4. A hypothetical LOGIN role attribute can be toggled independently without acquiring broad database rights (rolled back, no password ever provisioned).
5. Removing a fictional session causes the same lookup to return no row.

The core GitHub workflow now also runs the previously unexecuted `backend/pg-session-authority.test.mjs`, with refreshed complete mock catalog fields. This verifies the application startup gate refuses NOLOGIN, absent schema USAGE, extra permissions, legacy function exposure and role escalation.

**Boundary:** This experiment proves ordinary PostgreSQL privilege semantics, not managed Supabase approval, actual password-based login, remote TLS connectivity, PostgREST/Data API exposure, real logout propagation or production tenant isolation. Tests are not a way to bypass managed Auth restrictions.

## Decision gates (must pass before ANY staging permission change)
- Written provider assurance or an independently supported documented mechanism for the exact managed-schema operation. No wide GRANTs and no new SECURITY DEFINER shortcut.
- Private secret delivery, dedicated LOGIN with no service-role/superuser/bypass/reader access, documented certificate and connection mode support.
- Readback of exact RLS policies, columns, role paths, exposed schemas and function grants.
- Transactional cutover of legacy actor-argument functions **only after** replacement validation; restore deny-all on failure.
- Real fictional accounts A/B/C: current sessions accepted, signed-out token replay blocked immediately, admin revocation and banned/deleted users blocked, cross-tenant reads denied, direct REST/SQL bypass denied, outages fail closed.
- Independent security review and separate owner approval for the specific staging mutation.

## Fallback (if managed Auth access is unsupported)
Design a private Codeedge-owned revocation store linked to trusted provider-authenticated login, with server-authoritative sessions and atomic per-request invalidation. Its guarantee applies to **Codeedge signout/revocation**. Independent Supabase signout/admin revocation is *not equivalent* until separately synchronized and tested. Require the owner to approve any change to this contract. Do not replace immediate provider revocation with shortened JWTs alone.

## Costs and boundaries
Target existing free allowances; no new project or subscription. No Supabase hosted permissions, Auth data, migrations, credentials, production codepaths, PR merges or deployments are changed by this phase.

Official reading:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/database/postgres/roles
- https://supabase.com/docs/guides/api/securing-your-api

## Reproduce
- `node --test backend/pg-session-authority.test.mjs` (no database, Node.js 22)
- `TEST_DATABASE_URL=<disposable-postgres17-url> node --test tests/postgres/phase315a-auth-schema-gate.pg.test.mjs`
- The existing four GitHub Actions checks on the new PR head.

## Next
Phase 3.15B must demonstrate provider-supported hosted identity plus restricted DB connection **before** any transition to a live API. If not possible safely on Free, prepare the fully tested Codeedge-session fallback without weakening isolation.
