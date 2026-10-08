# Phase 2.2 — Real restricted-login acceptance increment

**Status:** disposable PostgreSQL + synthetic identity only; not hosted, not a client pilot.

The previous staging gateway used an injected pool and its disposable tests simulated `SET LOCAL ROLE growth_starter_reader` from a privileged test connection. That tested SQL permission checks but did **not** prove a separately authenticated non-owner PostgreSQL login could run the gateway.

`backend/staging-restricted-runtime.mjs` now creates the only approved read-only gateway pool boundary:
- Verifies a real PostgreSQL `LOGIN` role is **not** superuser, BYPASSRLS, database/schema owner/creator, role creator, replication role, or inheriting SQL privileges.
- Requires explicit `SET ROLE growth_starter_reader` membership and tests that transition before gateway construction.
- Rejects owner/admin test pools. Whitelists only two fixed parameterized SQL statements.
- Opens each query inside `BEGIN READ ONLY` and `SET LOCAL ROLE`, with statement timeout and transaction cleanup.
- `createRestrictedStagingGateway` will **not open a listening socket** unless this DB-role preflight completes.
- A new disposable PostgreSQL test now creates a **separate password-authenticated NOINHERIT LOGIN**, confirms direct table reads/writes and direct function calls are denied, then sends signed synthetic HTTP requests through the gateway. This is stronger than the prior simulated role but still **not hosted IdP/DB acceptance**.

Staging deployment prerequisites remain: separate real staging Postgres, secure network/CA-certified TLS pool, server-managed credentials, actual IdP JWKS + verified-email + online revocation source, invitation/approval write-service binding, media safety and two independently authenticated hosted users. No production deployment or migration occurred.

**Important:** actor-parameterised PostgreSQL SECURITY DEFINER functions still rely on a trusted runtime verifier for actor IDs. A compromised gateway could assert another identity at the DB function layer; this block reduces privileges and SQL injection exposure but does not remove that identity-binding threat. The pilot stays blocked.
