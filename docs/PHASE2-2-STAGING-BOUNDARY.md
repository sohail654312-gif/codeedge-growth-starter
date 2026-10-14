# Phase 2.2 — Restricted hosted staging boundary

**Status:** source + disposable tests only, NO hosted two-user acceptance. PR #2 remains DRAFT.

## Why not connect AppDeploy directly?
- AppDeploy SDK DB does not document serializable transactions or unique constraints.
- AppDeploy's signed-in user does not provide an independently verified email claim for invitation delivery.
- Supabase inventory on 2026-10-08 contains only Business OS and MVP projects, **not** an isolated Growth Starter staging project. None was modified.
- No server-held restricted PostgreSQL connection, staging IdP trust config or online session-revocation API has been furnished.

## Implemented standalone staging boundary (off by default)
- `backend/staging-identity.mjs` validates server-configured RSA-2048+ key-ring `kid`, signature, issuer, audience, short expiry, verified email, `sid`, `jti`; each call requires trusted online `checkSession` returning **true** (revocation checked). Rejects token-supplied key material and stale tokens. No static public test key in production config.
- `db/migrations/0002_staging_readonly.sql` creates a NOLOGIN, non-owner PostgreSQL role, with NO arbitrary table reads or mutation rights, only EXECUTE on tenant-filtered read routines.
- `backend/staging-gateway.mjs` supports read-only `GET /v1/workspaces`, `GET /v1/requests?workspaceId=...&limit=...`; requires verified identity; SQL routine limits to workspace owner or active server-persisted membership, and all inputs are bound parameters. No writes, invitations, approvals, uploads or external effects.
- No standalone public server or staging deployment started. Database function `p_actor` parameter is trusted *only through the gateway* after verified auth, **not** as a user-supplied field. A compromised server/runtime role might call a function with another subject; this requires further hardened identity-to-DB binding, least-privilege review, and threat modelling before production.

## Owner actions / infrastructure for next gate
1. Create a **new** isolated Growth Starter staging PostgreSQL database/project (not Business OS/MVP). Cost and organization approval required if using Supabase.
2. Apply `0001_growth_starter.sql`, then `0002_staging_readonly.sql` as a trusted database administrator.
3. Provision a separate LOGIN principal as an explicitly granted member of `growth_starter_reader`; rotate its password out of band. Grant no BYPASSRLS, schema ownership, database SUPERUSER or public schema grants.
4. Configure a server-only pool to connect as that role with TLS certificate validation and allowlist networking. Never put the PostgreSQL URI or signing material in browser or GitHub.
5. Configure an independent IdP with audience/issuer, a rotation-aware trusted RS256 public key-ring, an **online session revocation provider** checking each `sid` and `jti`, trusted verified email and short access-token life. Test revoked sessions, unknown keys, email downgrade and credential rotation.
6. Wire this adapter through an independently deployable Node/API staging service, then integrate the existing client portal behind a staged service proxy. Do not connect the production Phase 1 app.
7. Run real two-user, two-tenant staging HTTP tests with independently authenticated synthetic accounts, read/write denial, media restrictions, revocation and rollback. **Current CI only has synthetic signed identities.**
8. Complete scanned/consented media and transactional write paths before enabling agency mutations or user invites.

## Failure handling
Missing any server runtime principal, trusted identity verifier or session revocation source is a **BLOCKED** gateway dependency. Do not fall back to AppDeploy optional email or owner-only demo authentication for multi-tenant access.

## Rollback
The source branch is unmerged and no live data moved. The isolated staging migration may be rolled back manually in a disposable environment; never drop data or roles in a shared database without an independent migration plan.
