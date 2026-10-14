# Phase 3.15I — Scalable tenant identity and member revocation proof

**Source-only, test-only proposal** for \`sohail654312-gif/codeedge-growth-starter\`, draft PR #2. Do NOT run \`tests/postgres/fixtures/phase315i-scalable-authority.sql\` against hosted Supabase. The SQL creates throwaway roles/functions and is **not** a staging migration.

## Decision under proof
One restricted **gateway LOGIN role** and two **NOLOGIN private function-owner roles**, rather than a database login/password per tenant. The gateway gets no direct table privileges and cannot supply a caller/actor ID; it can invoke only:
- \`gs315i.read_requests(codeedge_session_token, workspace_id)\` (fixed output: ID, workspace, title; no arbitrary SQL/columns)
- \`gs315i.revoke_session(codeedge_session_token)\` (only changes \`revoked_at\`)

Both are private, narrowly bounded, \`SECURITY DEFINER\` functions with a fixed \`pg_catalog,pg_temp\` search path and explicit execution grants. **They are not the legacy actor-argument SECURITY DEFINER APIs.** The read owner has SELECT on only required columns, with no UPDATE; the revoker has SELECT on session ID/digest/revocation and UPDATE on revocation timestamp alone, with no business access. RLS is enabled and forced on all synthetic tables; per-function owner SELECT policies do not themselves enforce tenant restriction—the carefully scoped, audited function predicates do. This is a meaningful residual risk requiring independent SQL security review before hosted use.

The original \`ce1.<uuid>.<256-bit secret>\` token is verified *inside the database* using PostgreSQL 17 built-in SHA-256 with the same domain separation as the existing Codeedge session proof; the gateway cannot forge an actor via an arbitrary PostgreSQL GUC, REST input actor, or token payload. The session actor comes exclusively from the unexpired, unrevoked private session record; workspace ownership or active membership bound to the workspace's owner is re-checked on every read.

Transaction-scoped shared advisory locks use domain-separated session, workspace and member keys. Read/revocation serialization is demonstrated with concurrent real transactions, **but advisory locks are cooperative**; every session/membership/workspace-changing path must honor the same locks or guarantees are weakened. In particular, a membership remove that bypasses the agreed lock protocol is outside this proof's consistency guarantee.

## Acceptance targets
- Real PostgreSQL 17 network connection as the single gateway login; owner A reads A only, owner B reads B only, client/staff C reads A only while active.
- Forged token, wrong secret, expired session, cross-workspace requests and direct business-table queries denied.
- Authenticated gateway cannot \`SET ROLE\` to either private function owner or perform session writes directly. Unprivileged role cannot execute the private function.
- Revocation serialized behind an in-flight protected read and prevents subsequent reads. Membership revoke and workspace suspend updates, when using the agreed advisory locks, cause subsequent authorized reads to fail.
- No external \`auth\` schema permissions, \`service_role\`, superuser, or extra tenant credentials.
- Permission audit for function EXECUTE (including PUBLIC), table columns, search path, role attributes and owner identities.

## Limits and next decision
1. Functions verify a **Codeedge** bearer already issued through a trusted fresh provider login. Source-only PKCE HTTP adapter is still not a live provider flow. Never mint a fresh Codeedge session from a stale Supabase JWT.
2. This design does not automatically detect independent Supabase logout, administrative revocation or password reset; do not silently weaken that original contract.
3. The function input is a reusable bearer passed as a query parameter to PostgreSQL. The trusted server must prevent token logging, tracing and SQL error leakage, configure TLS, bound requests and avoid exposing these routines via Data API. Consider stronger channel binding and attack surface before hosted use.
4. Role/function permissions are only safe if the hosting setup truly keeps gateway credentials server-only. Evaluate pooler/session transaction behaviour, runtime secret management and adversarial function auditing.
5. The three older hosted SECURITY DEFINER routines, \`SET ROLE\` legacy edge, authenticated column grants and effective Data API exposed schema remain unremediated.
6. The architecture uses only two private function-owner NOLOGIN roles and one gateway LOGIN, regardless of number of tenants; unlike per-tenant credentials it avoids linear credential provisioning.
7. Real A/B/C hosted acceptance, reversible migration, staging data API negative probes and owner approval remain mandatory before activation.

## References
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/troubleshooting/how-can-i-revoke-execution-of-a-postgresql-function-2GYb0A
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://www.postgresql.org/docs/17/functions-binarystring.html
- https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS
