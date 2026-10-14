# Phase 3.15M — Restricted Supabase integration and activation package

Date: 2026-10-14, Asia/Karachi. Only `sohail654312-gif/codeedge-growth-starter`,
branch `engineering/phase2-core-security`, existing draft PR #2.

## Implemented independently of hosted changes

`backend/phase315m-private-runtime.mjs` composes the existing Supabase PKCE
HTTP adapter and HTTPS cookie transport with actual least-privilege PostgreSQL
issuer/gateway functions. It has no TEST_DATABASE_URL or fictional-only startup
dependency. Real Auth HTTP exchange and `/auth/v1/user` verification are reused,
not replaced by local JWT decoding. Email initiation uses `/auth/v1/otp`, S256
PKCE and `create_user:false`; only the trusted server retains the verifier.

One-time flow consumption commits before provider I/O. The exchanged subject,
confirmed email, issuer, audience, original session, freshness, expiry and nbf
are checked before session issuance. Only SHA-256 credential hashes persist.
Issuance and protected reads use different actual database login principals.
The gateway has function EXECUTE only and cannot mint caller-chosen actors,
read private tables, read arbitrary business rows or SET function-owner roles.
The dedicated issuer is a trusted authentication boundary: compromising that
issuer can forge identities, so it must be isolated, secret-managed and reviewed.

`phase315m_private_issuer_REVIEW_ONLY.sql` extends the exact Phase315K schema
with begin/consume/issue functions, one-time grant enforcement, admission limits,
private session context and explicit removal of default browser-role grants.
All owner roles remain NOLOGIN. Database triggers synchronize existing membership
and workspace writers with protected reads; no voluntary writer opt-in is needed.
Session read/logout uses the existing transaction advisory-lock protocol.

Cookies remain Secure, HttpOnly and SameSite=Lax, with signed CSRF protection,
browser binding, canonical Host, fixed callback, bounded JSON bodies, callback
replay rejection and no provider/refresh token returned to browser JavaScript.
The shared fresh-identity validator additionally rejects future nbf and malformed
confirmation/ban timestamps. Two older synthetic provider fixtures now include
the email field supplied by the real provider; existing assertions remain intact.

## Verified live staging baseline — read only

Project `dbppeymhsemvghbvuvof`: ACTIVE_HEALTHY, PostgreSQL 17.11.0.003,
seven existing migrations, no Edge Functions. Seven Growth Starter tables have
RLS enabled (not FORCE RLS); three authenticated SELECT policies are installed.
There are zero Auth users/sessions, workspaces, memberships and work requests.
The private schema is absent. Reader/runtime/checker are NOLOGIN; runtime can
SET reader; reader retains EXECUTE on all three old actor-argument functions.
The checker still lacks managed Auth schema USAGE.

Dashboard readback **now verified**: exposed schemas are `public` and
`graphql_public`; `growth_starter` is unchecked. Settings show 0/7 tables and
0/3 functions exposed, auto-exposure of new tables ON, extra search path
`public, extensions`, max rows 1000. No setting was changed and Save was disabled.
The installed Data API and selected GraphQL schema are configuration evidence,
not signed-user REST/GraphQL negative acceptance. The private schema must remain
unchecked after creation. Do not disable unrelated public or GraphQL schemas.

No growth-named active database connection was observed. That does not prove all
external dependency consumers are absent; dependency review remains an operator
gate. Exact current grants and function definitions were inspected without
reading secrets or customer rows. The authenticated role still has the known
15 column SELECT grants in Growth Starter despite the schema being unexposed.

## Deployment package — HOSTING DECISION PENDING

The owner explicitly has not selected or authorized a host or hostname. No
existing deployment is repurposed and no live environment is deployed.

- `staging/Dockerfile.phase315m`: provider-neutral Node 22 container, pinned pg
  lockfile install, non-root execution, no baked-in credentials, health endpoint.
- `staging/phase315m-bootstrap.mjs`: validates owner/reviewer evidence before
  importing a separately accepted exact-session authority module by SHA-256.
  Missing evidence/authority exits before opening a listener or database pool.
- `phase315m-server.mjs`: direct TLS or approved managed HTTPS ingress. Managed
  ingress supports PORT/0.0.0.0 and requires explicit trusted socket peers, HTTPS
  forwarding, canonical Host and evidence that the provider overwrites forwarded
  metadata and prevents public direct-container ingress. A client-supplied
  X-Forwarded-Proto alone cannot authenticate TLS. Direct TLS binds loopback.
- Database TLS validates CA/hostname. Separate issuer and gateway pools use
  session-mode port 5432, at most two connections each; no administrative pool.

A suitable free provider must support Node 22 or this container, verified HTTPS
ingress, protected secret files, approved PostgreSQL connectivity and sufficient
free-plan connection/runtime limits. This is a portable package, not a claim that
any provider has been selected, purchased or accepted. Record the exact resolved
Node base-image digest and provider limits before activation. No local Docker is
installed or run; container build/refusal checks use the existing GitHub runner.

Runtime variables (values entered only through the approved secret channel):
GS315M_ACTIVATE (exact staging ref), GS315M_COMMIT_SHA, GS315M_APP_ORIGIN,
GS315M_ISSUER_DATABASE_URL, GS315M_GATEWAY_DATABASE_URL,
GS315M_DATABASE_CA_PEM, GS315M_PUBLISHABLE_KEY, GS315M_CSRF_KEY_PATH,
GS315M_EVIDENCE_PATH, GS315M_AUTHORITY_MODULE, PORT/GS315M_PORT,
GS315M_INGRESS_MODE and approved proxy socket addresses or TLS cert/key paths.
Evidence records exact commit/origin, owner approval ID, independent reviewer,
private-schema exclusion, closed direct API paths, supported exact provider
revocation, authority-module SHA-256 and ingress contract. This administrative
attestation is not cryptographic proof or a replacement for live acceptance.

AppDeploy `backend/index.ts` remains the existing SDK entrypoint. This separate
gateway is not automatically bound to the live demo or its UI. Route the reviewed
callback/private API behind the same approved origin during staging acceptance;
the existing callback success destination `/dashboard` must be mapped to the
isolated staging UI by that ingress, not to a guessed production host.

## Strict provider-wide revocation — TECHNICAL DEPENDENCY OPEN

Codeedge logout is durable and prevents new reads after completed revocation.
Codeedge-owned sessions alone do **not** inherit Supabase administrator/global
logout, password-reset or original-session revocation guarantees. The runtime
therefore requires a separately supported `checkProviderSession` for the exact
database-bound user/session pair at issuance and on every protected read, without
active-result caching. Failure, timeout, revoked state or mismatched identity
denies access. The 3-second authority deadline also supplies an abort signal.

No supported live authority adapter has been confirmed. The old managed-Auth
checker cannot satisfy it currently, and its previous PostgREST-specific
constructor requires grants incompatible with this private cutover. Do not
activate it, silently reuse getUser-only validation, weaken the contract, or
grant managed Auth permissions to make a test pass. The accepted adapter and
provider semantics require independent approval and hosted replay testing.

## Consolidated hosted approval scope — PREPARED, NOT REQUESTED OR EXECUTED

Hosting remains unselected by the owner's latest instruction. Once the host,
hostname and strict authority are resolved, request ONE approval for the exact
commit and SQL hashes, including:

1. Apply the exact Phase315K private schema, then Phase315M issuer extension in
   a staging-only window. New schema `growth_starter_private`, roles
   gs315k_gateway/read_owner/revoke_owner and gs315m_issuer/issue_owner. Owners
   remain NOLOGIN/non-BYPASSRLS. Gateway/issuer get only the documented function
   EXECUTE; no browser tables/roles, managed Auth grants or admin application pool.
2. Separately enable only gs315k_gateway and gs315m_issuer LOGIN with generated
   private credentials in the approved vault. Set compatible minimal role PUBLIC
   capabilities after audit. No credential values in source, logs or chat.
3. Auth: provision at most A/B/C fictional accounts through managed Auth APIs,
   establish approved test email delivery, disable implicit signup, verify PKCE
   email templates and exact callback-state redirect allowlist. No direct Auth
   table manipulation or assumed Free email/SMTP capacity.
4. Data API: preserve current public/graphql_public configuration. Verify
   growth_starter and growth_starter_private remain unexposed after provisioning;
   no broad auto-exposure changes to unrelated schemas. Test signed REST/GraphQL
   denial. Revoke only the existing Growth Starter direct grants and old routines
   using the exact Phase315J SQL after replacement passes in private maintenance.
5. Deploy only to the exact approved isolated free host/hostname and verified
   ingress. No production, other repo, paid plan, new Supabase project or merge.
6. Fictional A owns clinic A; B owns clinic B; C is staff in A. Verify fresh
   real PKCE, cookies, own/foreign reads, C revocation, session expiry/alteration,
   logout/replay, provider admin/global actions, outage, API bypass and rollback.
7. Snapshot exact prechange catalog/ACL/column grants, policies, owners/functions,
   schema definitions and Dashboard settings. Counts currently zero in relevant
   business/Auth tables; a metadata snapshot is NOT a full hosted backup. Export
   any newly present data securely before mutation. Free PITR is not assumed.
   Existing disposable Phase315J tests rehearse transaction rollback; M rehearses
   failed issuance rollback and deny-all recovery. Refresh backup and independently
   approve operational recovery before actual execution.
8. Expect staging maintenance while switching access. No observed old LOGIN or
   growth connection is active, but dependency confirmation is still required.
   On failure close ingress, disable new LOGINS, revoke private EXECUTE using
   phase315m_lockdown_REVIEW_ONLY.sql and retain old cutover denial. Do not delete
   sessions/data, remove RLS or automatically restore unsafe legacy permissions.

## Verification boundaries

All four existing workflows run on each engineering push. Core includes existing
tests plus narrow new transport/identity/config checks. Disposable PG17 applies
the exact K+M SQL and uses separate real gateway/issuer LOGINS: fictional A/B/C,
fresh provider-request shape, one-time flow/grant, direct permission/role denial,
RLS, expiry, membership/workspace synchronization, read/logout races, provider
failure/revocation, default browser grants and security-first lockdown. Provider
HTTP responses and identities in CI remain synthetic, not hosted Auth proof.
UI typecheck/regression and runtime dependency audit remain unchanged in strength.
Container build/refusal checks do not deploy or authenticate to Supabase.

Independent security signoff, hosted PKCE, actual signed A/B/C, provider-wide
revocation and live REST/GraphQL probes remain pending. PR #2 stays draft.

References: [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[official Auth client OTP protocol](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts),
[session semantics](https://supabase.com/docs/guides/auth/sessions),
[Data API permissions](https://supabase.com/docs/guides/api/securing-your-api).
