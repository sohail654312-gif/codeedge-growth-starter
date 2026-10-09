# Phase 3.2 — staged identity/RLS cutover runbook (REVIEW ONLY)

**This is NOT authorization to run hosted SQL or deploy.** PR #2 remains draft.
**Risk:** Existing postgres-owned SECURITY DEFINER functions take caller-supplied actor IDs. A compromised direct PostgreSQL gateway with allowed function EXECUTE can impersonate a foreign tenant despite normal signed HTTP checks. This remains HIGH OPEN.

## Stage A — build a genuinely independent replacement

1. Use the `backend/postgrest-read-boundary.mjs` read-only adapter with the original user bearer token passed to the Supabase-managed JWT-validating Data API. Do not install request.jwt.claim.* via caller-controlled SQL.
2. Review draft `db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql` in disposable PostgreSQL (and independent review); its only grants are column-limited SELECT to `authenticated`. Its policies allow active-owner, active-member and workspace-request reads; member revocation removes access. They explicitly provide **no** writing permission.
3. Owner must approve the private `growth_starter` schema Data API exposure, needed restricted GRANTs and a secret-managed HTTPS staging host. No such changes have been made.
4. `backend/trusted-session-gate.mjs` parses **only after** Supabase Auth `/auth/v1/user` validates the exact bearer. A trusted server-side provider must attest current session state, verified user/session identity and expiry on every request. The check cannot trust browser metadata, a boolean stub, direct-PG claims, or the legacy actor-ID function. No live authorized provider exists yet.

## Stage B — independent acceptance with two distinct synthetic people

- Verify actual hosted JWT signature, audience/issuer, banned/anonymous/expired identities, independent user A/B memberships and row denial in *both* directions.
- Test revoked membership **without refreshing the JWT** and check immediate denial at the database RLS boundary.
- Verify active-session revocation through trusted server capability rather than assuming `/auth/v1/user` proves logout invalidation.
- Test direct SQL attacker can neither `SET ROLE authenticated` nor read tenant tables nor invoke privileged legacy functions after cutover; do not equate simulated `auth.uid()` via test-only GUC with real JWT signature proof.
- Confirm no real clinic or patient data, no unsecured host, and capture exact deployment SHA/HTTP evidence. Independent review required.

## Stage C — operator-approved atomic revocation and old-service disable

Prerequisites: accepted replacement and rollback plan, host owner approval, validated schema/grants, no production connections. STOP old staging gateway at the routing/network layer (it must never be reintroduced for client traffic).

On isolated, *approved* staging during controlled change window only:

```sql
BEGIN;
-- Execute contents of:
-- db/drafts/0007_disable_legacy_actor_definers_REVIEW_ONLY.sql
-- Then execute contents of:
-- db/drafts/0009_cutover_assertions_REVIEW_ONLY.sql
-- If either fails: ROLLBACK. Otherwise, independently re-check effective roles.
COMMIT;
```

Files are transaction-neutral. `0009` must fail **before** revocation and pass **after** it. The disposable `tests/postgres/actor-cutover.pg.test.mjs` exercises this sequence with synthetic data and rolls back.

## Stage D — prove safe cutover and rollback

- Repeat direct SQL permission tests *after commit* using real restricted runtime identity and two independently authenticated synthetic HTTPS sessions.
- Negative outcomes mean do **not** enable the new service; return to sealed/disabled staging, not unsafe legacy auth.
- Before COMMIT: SQL `ROLLBACK` restores original grants for diagnosis only in isolated synthetic staging. Never restore unsafe actor-ID EXECUTE access for real clients.
- After COMMIT: rollback the hosting/routing change to a deny-all maintenance response, or roll forward to a corrected JWT/RLS adapter. **Do not re-GRANT the vulnerable functions.**
- Keep production, client traffic, agency writes, OAuth, media publishing, and scheduled work OFF until separate acceptance.

## Exact present state

New RLS, session gate, cutover checks and docs are **review-only source**; migrations 0001–0005 remain the only hosted staging migrations at the last check. Hosted Supabase staging had seven RLS-enabled tables, zero policies, zero users, zero sessions and zero workspaces, and three privileged definer functions. No hosted DB/grant/secret/hosting change was made here.
