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

## Phase 3.3D — new source-only trusted hosted entrypoint (NOT ACTIVATED)

The old `npm start` is intentionally disabled. A **separate** operator-approved
command now exists: `npm run start:accepted` (from `staging/`). It will not
listen unless **all** of the following are true: a dedicated authenticated
PostgreSQL `growth_starter_session_checker` LOGIN connects over validated TLS
with minimally scoped Auth-column grants; the three authenticated workspace,
membership and work-request RLS policies and column grants are installed;
all old actor-ID function EXECUTE rights have been revoked from restricted
reader/runtime roles; and the service is bound to 127.0.0.1 behind a trusted
HTTPS reverse proxy that overrides `X-Forwarded-Proto` and
`X-Forwarded-Host`. Header values must not be forwarded from untrusted
clients without being replaced by the ingress.

**This is a real executable server source path, not an enabled deployment.**
The source preflight is necessary but not sufficient for independent host
acceptance. A manager-controlled staging setup, TLS and secrets inspection,
synthetic signed-user tests and an external security acceptance are still
required before client traffic.

### Server-only secret variables (never put values in GitHub or browser)

- `STAGING_SUPABASE_URL`: exact `https://<growth-starter-ref>.supabase.co`
- `STAGING_SUPABASE_PUBLISHABLE_KEY`: publishable public API key only
- `STAGING_SESSION_DATABASE_URL`: dedicated, separately protected
  `growth_starter_session_checker` PostgreSQL LOGIN with a unique password;
  it is NOT the old `growth_starter_runtime`, superuser or service_role
- `STAGING_POSTGRES_CA_PEM`: correctly validated Supabase PostgreSQL CA
- `STAGING_ALLOWED_ORIGIN`: exact HTTPS frontend origin
- `STAGING_PUBLIC_HOST`: approved HTTPS ingress hostname only
- `STAGING_DEPLOYMENT_SHA`: exact audited Git SHA (operator must verify
  this independently against the actual deployment; a string alone is not proof)
- Optional `PORT`, `STAGING_BIND_HOST=127.0.0.1` only.

### Auth session behavior

Supabase documentation (<https://supabase.com/docs/guides/auth/sessions>)
states a signed-out session's row is removed from `auth.sessions`, while its
JWT may remain valid until expiry. The new session checker joins
`auth.sessions` by exact UUID session and user to `auth.users`, checks
`not_after`, `banned_until` and `deleted_at`. It runs as a narrow SQL
principal after the original bearer has been verified by Supabase Auth at
`/auth/v1/user`. This does **not** substitute a SQL session GUC for JWT
signature verification, does not use the old actor-ID functions and cannot
be directly called by clients.

The proposed privileges are in
`db/drafts/0010_session_checker_minimal_auth_columns_REVIEW_ONLY.sql`.
The role is deliberately **NOLOGIN**, with no password in source; enabling
LOGIN and granting Auth-table columns requires separate owner permission and
a security reviewer. Never expose `auth` or this role to PostgREST.

### Safe verified transition ordering — owner and reviewer approvals required

1. Read-only preflight and independent review of Auth schema columns,
   postgres grants, RLS policies and any API exposure.
2. Backup isolated staging config. Activate owner-approved RLS and narrow
   grants but keep all externally reachable client API routes off.
3. Test genuinely signed synthetic A/B/Member-C tokens against Supabase
   PostgREST directly, including foreign-tenant denial and immediate
   membership-revocation. Keep caller SQL role off the client network.
4. For immediate logout checks, review the minimal Auth-column grants for the
   dedicated private session checker and confirm the correct real login via
   host secret manager.
5. During a controlled maintenance window, revoke legacy EXECUTE rights
   via review-only `0007` followed by `0009`, with an approved host cutover.
   If revocation fails, keep maintenance mode; never restore unsafe EXECUTE
   access to serve real clients.
6. Verify `npm run start:accepted` on trusted HTTPS ingress, original bearer
   Auth verification, exact active session check, RLS, real A/B/C HTTPS
   acceptance, direct SQL privilege-denial tests and provider failures.
7. Obtain independent security reviewer signoff; clean up fictional users,
   sessions and workspaces and verify no secrets in logs. Never onboard real
   patients, launch production or enable external actions without approval.

The current hosted project intentionally lacks the necessary RLS policies,
trusted-login grants and synthetic sessions; the accepted server **will fail
closed** if invoked against it. No hosted changes were made during this phase.
