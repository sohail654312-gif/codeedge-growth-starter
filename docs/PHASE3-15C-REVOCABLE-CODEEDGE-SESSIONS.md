# Phase 3.15C — Isolated Codeedge-owned sessions (fallback proof)

## Scope and outcome
A disposable PostgreSQL 17 implementation and verification of a Codeedge-owned opaque session credential, never a live provider integration or production deployment. No Supabase permissions or hosted schema changes. Growth Starter PR #2 remains draft.

## Contract
- Login: an injected trusted fresh-authenticator must consume an opaque, one-time login proof. It must derive user ID, provider session ID, unique grant ID and authenticated-at timestamp from an independently verified fresh login.
- The present trusted-authenticator is TEST-ONLY and intentionally fictional. There is NO production bootstrap or factory.
- Reusing a once-consumed one-time login grant is rejected at the database UNIQUE constraint. Never auto-mint sessions from a still-valid old Supabase JWT after Codeedge logout.
- Session: 256-bit randomly generated secret, separate random UUID, SHA-256 domain-separated digest stored in a private PostgreSQL table; lifetime bounded to 5-30 minutes.
- Authorization: each protected read queries the session row for expiry and revocation, uses its database-bound actor, and checks active workspace ownership or membership. No browser-supplied actor or arbitrary SQL queries.
- Concurrency: protected data read holds PostgreSQL FOR SHARE locks on session and authorization rows until COMMIT; revocation obtains FOR UPDATE. Once revoke commits, later reads deny. Already in-flight authorized work is NOT retroactively cancelled.
- Logout: Codeedge must revoke its session before invoking provider logout; a failed provider logout must not restore Codeedge access.
- The disposable test database administrator can bypass RLS; this proof does NOT yet demonstrate a safe restricted production principal.

## Files
- backend/codeedge-session-proof.mjs — disabled-for-hosting service and transaction semantics
- tests/postgres/fixtures/phase315c-private-sessions.sql — synthetic private schema, no exposed grants
- tests/postgres/phase315c-codeedge-session.pg.test.mjs — real PG17 A/B/C and concurrent revocation tests

## Remaining work — security gates
1. Implement a real trusted, one-time fresh authentication exchange: server-side validated provider callback / authorization-code exchange with PKCE, anti-CSRF state, nonce, anti-replay, strict redirect and token verification. Merely calling Supabase getUser on an old bearer does not establish fresh authentication.
2. Specify external Supabase signout/admin revocation and stolen-token guarantees. This design guarantees immediate Codeedge-owned session revocation only; external Supabase revocation is NOT automatically propagated. The user must explicitly approve any change in this security requirement.
3. Build independent, least-privileged PostgreSQL access and strict tenant RLS isolation without universal privileged credentials or caller-writable claims.
4. Establish Data API exposure and bypass denials, private Edge/API endpoint, Secure/HttpOnly/SameSite cookie handling and CSRF defense, rate limits, audit, rotation, outages, session cleanup and rollback.
5. Real fictional A/B/C provider sessions and an independent security review, then seek separate approval before any hosted migration, legacy-role cutover or production rollout.

## Cost boundary
No paid Supabase upgrade, local Docker requirement or additional project. Existing free quotas must be checked before hosting.
