# Phase 3.0 — independent identity cutover review

## Current risk and disposal-level proof

The existing read-only staging gateway uses \`growth_starter.staging_list_workspaces(p_actor)\` and \`staging_list_requests(p_actor,p_workspace,p_limit)\`, executed as a restricted reader that is permitted to invoke \`postgres\`-owned SECURITY DEFINER functions. The actor ID is supplied by the gateway. A compromised gateway that can execute permitted SQL can substitute another user ID even when its own normal HTTP endpoints verify signed JWTs.

The existing negative test in \`tests/postgres/restricted-runtime.pg.test.mjs\` confirms this exact issue on disposable PostgreSQL using invented tenants. **Severity HIGH, unresolved in live staging.** The current PostgreSQL role is still NOLOGIN and no real customers are stored, which limits present deployment exposure but does not correct the design.

## Prepared cutover that actually removes the vulnerable SQL capability

The new \`db/drafts/0007_disable_legacy_actor_definers_REVIEW_ONLY.sql\` revokes the reader and runtime roles' EXECUTE grants on both actor-ID functions, plus the session probe where present; \`PUBLIC\` is revoked too. This script is **NOT a migration, was NOT applied to live Supabase, and deliberately disables the existing staging read-only gateway** until a trusted successor is accepted.

The new \`tests/postgres/actor-cutover.pg.test.mjs\` runs the existing vulnerable query with a substituted synthetic actor, applies the cutover inside a disposable transaction, demonstrates PostgreSQL permission denial, then rolls back. This shows that **revoking the capability prevents the specific substitution attack**. It does **not** prove a replacement interface supports legitimate users or protects every database table.

The draft has no role activation, password, grants, RLS loosening, schema mutation, Auth user provisioning, service-role access, JWT signing key, token transport or endpoint creation.

## Defensible future trust boundary

1. Use a **JWT-validating API boundary that the application direct-PostgreSQL runtime cannot impersonate**. With Supabase, evaluate PostgREST/verified Auth JWT enforcement, JWT issuer/audience/signature/kid/expiry, short sessions and real revocation. Query \`auth.uid()\` only when context is installed by that trusted verified API and direct PostgreSQL application roles cannot SET/assume the API's database role.
2. Apply strictly scoped RLS \`USING\` / \`WITH CHECK\` policies, always using the server-verified subject and authoritative current memberships. Protect readers and writers independently; do not grant blanket \`service_role\`/postgres access to the HTTP gateway.
3. Prefer \`SECURITY INVOKER\` operations; independently audit every necessary SECURITY DEFINER function, search_path, owner, narrow grant and impersonation probe. For a direct PG runtime, \`SET request.jwt.claim.sub\`, \`request.jwt.claims\` or \`auth.uid()\` derived from caller-supplied GUCs is **not independent identity authentication**.
4. Use two independently authenticated real *fictional-user* staging sessions and the existing \`staging/hosted-acceptance.mjs\`. Confirm own and foreign HTTP data/roles, token forgery, revoked memberships, expired/revoked sessions, direct SQL denial, HTTPS/TLS, teardown/cleanup and actual deployed SHA. Additional gateway-compromise SQL probes are mandatory.
5. Do not enable any report writes, agency approvals, cross-repository services, OAuth tokens or website publishing until identity isolation and transactional report authorization have independent evidence.

### Owner approval still required

Choose and approve secrets-capable Node 22 HTTPS hosting (including costs), explicitly authorize protected credentials and restricted LOGIN only through a secret-entry facility, then authorize creation and cleanup of two synthetic Supabase Auth users. None of these external steps were performed during Phase 3.0.

### Current outcome

**REVIEW DRAFT / DISPOSABLE PROOF: PASS if exact-head CI passes.**

**LIVE SECURITY DEFINER VULNERABILITY: HIGH OPEN.**

**INDEPENDENT ACTOR-BOUND REPLACEMENT / REAL HOSTED 2-USER ACCEPTANCE: BLOCKED.**
