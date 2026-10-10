# Growth Starter staging operations — Phase 3.3C

**Current status: NOT HOSTED / NOT ACCEPTED.** Never route real clients to these services.

## Safety correction: old staging command is disabled

`node staging/server.mjs` / `cd staging && npm start` deliberately exits with code **1**.
The former direct PostgreSQL gateway used actor-ID `SECURITY DEFINER` SQL and is
not acceptable for client workloads. Do **not** restore it to make the demo work.
The Codeedge AppDeploy navy dashboard/demo is a different runtime and is untouched.

`backend/authenticated-read-gateway.mjs` is a source-only replacement **factory**,
not a deployed service. Its `enableForSyntheticTesting: true` switch is a test
mechanism, not a deployable security approval or a production feature flag. There
is no permitted hosted Node startup that wires a real `checkAuthoritativeSession`
provider, accepted RLS/grants and HTTPS secrets together.

## Executable safe checks now

```bash
node --test tests/*.test.mjs
node --test tests/hosted-acceptance.test.mjs
node --test tests/legacy-entrypoint.test.mjs
# Disposable PostgreSQL only (never hosted):
TEST_DATABASE_URL='postgres://gs_test:...@localhost:5432/gs_test' node --test --test-concurrency=1 tests/postgres/*.test.mjs
```

The **read-only** `staging/hosted-catalog-preflight.sql` is suitable for an
authorized SQL management session against the isolated Growth Starter project.
It reports policies, limited privileges and legacy function EXECUTE exposure.
It applies no changes. The disconnected hosted project currently has no actual
RLS policies, authenticated users, workspaces or session provider deployment.

## Exact owner-controlled activation gates

1. **Owner approves:** isolated Growth Starter staging only, existing zero-cost
   host if possible, confirmed pricing, protected Node 22 secret manager,
   TLS termination, approved hostname and maintenance rollback. No production.
2. **Reviewer approves:** independent security assessment of review-only
   `db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql`; backup and
   rollback plan; private PostgREST schema exposure and column grants.
   Never confuse RLS with JWT signature validation.
3. **Owner approves synthetic Auth testing:** create **two independent fictional
   confirmed-email users A and B**, plus separate member C for revocation
   testing, each with their own real JWT and session ID. They must not carry
   real patient data.
4. **Trusted session provider:** implement a supported server-only
   authoritative current-session lookup (including exact user/session binding,
   expiry and revocation) independent of browser claims and untrusted
   direct-PG actor-ID routines. `/auth/v1/user` alone does not guarantee
   immediate logout invalidation. The Node gateway must fail at startup if the
   reviewer-accepted provider, secrets or RLS verification are unavailable.
5. **Under a separately approved change window:** apply reviewed RLS only to
   isolated staging; verify least-privilege grants, database policies and
   actual `auth.uid()` under signed per-user PostgREST requests. The current
   `0008` file is a review draft, not permission to execute it.
6. **Operator seeds fictional records only** using an approved auditable
   procedure and runs actual HTTPS acceptance as described below.
7. **Reviewer signs off:** confirm read/write isolation, membership and session
   revocation, banned/expired tokens, direct SQL privilege probes, precise
   deployment SHA, TLS evidence and cleanup.
8. **Only afterward and with explicit approval:** retire legacy actor-ID
   functions transactionally using `0007` and `0009`, route to the vetted
   replacement; on failure go to maintenance/deny-all, **never re-GRANT the
   vulnerable functions**. No agency writes, live SEO publishing, uploads or
   patient data until separately accepted.

## Manual real HTTPS acceptance — never run in public CI

Use protected **operator-local environment variables**, not arguments or a
GitHub issue/comment: `GS_ACCEPT_GATEWAY_URL`, `GS_ACCEPT_TOKEN_A`,
`GS_ACCEPT_TOKEN_B`, `GS_ACCEPT_WORKSPACE_A`,
`GS_ACCEPT_WORKSPACE_B`, `GS_ACCEPT_REQUEST_A`,
`GS_ACCEPT_REQUEST_B`, `GS_ACCEPT_ALLOWED_ORIGIN`.
The workspace IDs must exactly equal `ws_<token.subject>` for the owner users
to satisfy the current PostgreSQL schema. Tokens must be genuinely signed by
the connected staging Supabase Auth service.

```bash
# Baseline, both own/foreign directions + invalid signature/role/CORS/write:
GS_ACCEPT_PHASE=baseline node staging/hosted-acceptance.mjs

# Operator FIRST independently revokes A's actual session, keeps B active and
# confirms original A token remains valid by exp but invalid by revocation:
GS_ACCEPT_PHASE=session-revoked-a node staging/hosted-acceptance.mjs

# Operator FIRST records member C's allowed read, revokes membership in
# isolated staging and verifies the same unexpired original member-C token:
GS_ACCEPT_PHASE=member-revoked-c node staging/hosted-acceptance.mjs
```

The member revocation stage additionally requires `GS_ACCEPT_TOKEN_MEMBER_C`.
Do not set it to either owner token. These stages do **not** modify data or
perform user/session revocation; an authorized operator must supply actual
transition evidence separately. A 401 after JWT expiry is not immediate
revocation evidence. Record only check names, status, duration and SHA, never
tokens or client details.

**Failure behavior:** stop acceptance, block gateway activation, and use
maintenance mode. Do not silently re-enable legacy HTTP/SQL privileges.
See `docs/PHASE3-2-CUTOVER-RUNBOOK.md` and `docs/PHASE3-3-OPERATIONS.md`.
