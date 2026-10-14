# Phase 3.15G — Real Supabase protocol adapter + restricted-role feasibility

## Source-only work, not a hosted cutover
- Added `backend/phase315g-supabase-pkce-adapter.mjs`, a production-shaped, injectable HTTP adapter for Supabase Auth: POST `/auth/v1/token?grant_type=pkce` with server-held authorization-code verifier, then GET `/auth/v1/user` with the **exact exchanged** access token.
- Adapter validates trusted Supabase HTTPS project origin and fixed application callback path, accepts only publishable/legacy public key shape, disables redirects and caches, bounds network timeouts and response size, and returns **no refresh token**.
- The adapter is **not wired into any hosting entrypoint**, production constructor or deployed Edge Function. Phase 3.15D and Phase 3.15E remain synthetic until real Supabase authentication is verified against separately approved fictional users. A successful `getUser` call does not establish prior-session revocation.
- Tests: `tests/phase315g-supabase-pkce-adapter.test.mjs` uses an injected mock HTTP client. It is not a real provider exchange.

## Highest risk discovered: SQL row locking vs least privilege
PostgreSQL documentation states that `SELECT ... FOR SHARE` also requires at least one column's **UPDATE** privilege on each locked table, and PostgreSQL RLS must also allow the row under the relevant UPDATE policy. The current Phase 3.15C session revocation uses `FOR SHARE` on sessions, workspaces and memberships; simply granting `SELECT` to a restricted hosted role **cannot run that code**.
- `tests/postgres/phase315g-role-locks.pg.test.mjs` reproduces this in disposable PostgreSQL 17 with synthetic tenant roles.
- The fixture shows a role restricted to owner A's workspace cannot read B and cannot lock with SELECT only. Even with a narrow column UPDATE grant, the locking SELECT returns **zero rows** because there is no permissive UPDATE RLS policy. Granting a permissive UPDATE policy to recover the lock would also widen what that role could modify. Neither step is authorized for hosted use.
- **Do not solve this using a general-purpose SECURITY DEFINER function, service_role, postgres or role-switch superuser.**
- Next design must separate the gateway's session-management/writer transactions from tenant-scoped data readers, or otherwise prove a supported lock protocol and RLS design that does not empower unauthorized writes. A role per tenant must be evaluated for operational and resource costs; CI SET ROLE as a superuser is not proof that the production gateway can safely switch identities.

## Direct Data API cutover review
Live October 14 catalog inspection still shows that the `authenticated` role has Growth Starter schema USAGE and a column-level `work_requests.title` SELECT grant; direct REST bypass cannot be ruled out from SQL GUC alone. Effective exposed schemas in Supabase Dashboard remain unverified.
1. Check [effective Data API settings](https://supabase.com/dashboard/project/dbppeymhsemvghbvuvof/integrations/data_api/settings), identify ALL existing dependencies.
2. Plan to unexpose Growth Starter schema or disable the Data API only after confirming authentication and other use-cases remain intact. Unexposing alone does not remove grants and vice versa; validate both.
3. Source-only draft of explicit minimal REVOKE changes, with saved before/after ACL state and dry-run-only rollback proof, comes **after** the DB design is accepted; not in this phase.
4. Negative test direct `/rest/v1` using actual fictional sessions, including stale Supabase JWT **after Codeedge logout**. Any bypass access blocks activation.

## Explicit scope and remaining blockers
Keep PR #2 draft, don't merge. No managed Auth grants, new hosted user, real credentials, confidential session records, deployments, production DB roles, paid upgrade or local Docker. Existing Support tickets stay open. Real provider callback initiation/redirect scheme, exact PKCE URL authorization process, provider-wide signout/admin revocation contract, safe least-privileged database role, cookie ingress and CSRF, direct Data API bypass and independent security acceptance are all outstanding.

Sources:
- https://github.com/supabase/auth/blob/master/openapi.yaml
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://www.postgresql.org/docs/17/sql-select.html
- https://www.postgresql.org/docs/17/ddl-priv.html
