# Growth Starter — Auth Authority Acceptance (29 October 2026)

**Source review and provider documentation; NOT a hosted acceptance.**
**Target**: codeedge-growth-starter-staging, Supabase project `dbppeymhsemvghbvuvof`.
**Verdict**: **EXTERNAL AUTHORITY BLOCKED.** Preserve mandatory fail-closed original-session validation.

## What was inspected

- `backend/exact-session-authority.mjs`: independently supplied `lookup({userId,sessionId,signal})`, strict exact subject/session pair, exists/revoked/deleted/banned/policyValid explicit facts, finite future expiresAt, bounded timer and abort.
- `backend/pg-session-authority.mjs`: original Auth session lookup restricted to managed `auth.sessions` and `auth.users`; checker needs a separately accepted managed-schema contract. Merely finding a session row does not certify provider policy.
- `backend/trusted-session-gate.mjs`: JWT-claim shape/issuer checks plus separately supplied active-session authority; not a JWT signature verifier.
- `backend/phase315m-private-runtime.mjs`: preflight on separate issuer/gateway pools, bounded provider check, fail-closed operations, workspace/current-membership SQL recheck.
- `staging/phase315m-bootstrap.mjs`: requires reviewed external authority module; does not install one when missing.
- `tests/phase315o-auth.test.mjs`: source regressions for timeout, revocation, unknown facts, in-flight abort and late results; mock lookups are NOT live Supabase provider evidence.

## Official documentation constraints

- Supabase session `session_id` is a JWT claim mapping to `auth.sessions.id`; a valid JWT does not necessarily mean the underlying session remains active.
- Time-box and inactivity limits are enforced when sessions refresh, not necessarily by immediate session-row removal. The documentation also describes refresh-token reuse exceptions.
- Supabase's session lifetime restrictions are plan-dependent; do not assume paid session-policy features are available on a Free project.
- `getUser()` can provide live user identity but has not been established to satisfy *every* Growth Starter exact original-session, global/admin logout, ban/deletion and policy contract.
- The checker is still NOLOGIN, has no managed `auth` schema USAGE in the actual hosted project. No broad grant or bypass was made.

Docs: https://supabase.com/docs/guides/auth/sessions ; https://supabase.com/docs/guides/auth/signout ; https://supabase.com/docs/guides/api/securing-your-api

## Evidence-backed decision

1. **Current approach**: retain Codeedge's separate short-lived, server-side sessions and SQL membership checks plus mandatory real original-session validation.
2. **BLOCKER**: obtain a supported least-privilege way to attest the exact original (user_id,session_id), current user state and policy, including admin/global logout, on **every protected operation**. Supabase support tickets `SU-502526` and `SU-503988` are not known to have a substantive written technical answer.
3. **Alternative only with owner approval**: evaluate an Auth-only provider adapter (e.g. Better Auth) using the same PostgreSQL/domain service. A migration must account for re-login, existing identities, provider callbacks, revocation, credentials, admin actions and rollback. Neither this alternative nor a Codeedge-only relaxed contract is authorized by source CI.
4. **No rollout**: no managed grants, users, secrets, callbacks, actual provider test, or deployment was changed during this review.

## Source correction this cycle

A late asynchronous response from the exact-session lookup is explicitly denied if the caller or lookup controller has been aborted. Added tests for concurrent abortion, unknown/missing provider facts and outages. This is defense in depth in **source only** and does not fulfill hosted provider authority.

## Mandatory acceptance matrix (all remain UNVERIFIED live)

| Scenario | Required real evidence |
|---|---|
| Login / PKCE | Approved fictional identity, same-origin callback, verified original session pair and cookie security |
| Own/foreign tenant | Signed A/B/C positive and negative tests through real HTTPS + restricted PostgreSQL logins |
| Current user state | Live ban, deletion, disabled account and password-security change proofs |
| Revocation | Local, global and administrative sign-out; stale JWT and replay denial |
| Policy | Genuine time-box/inactivity/single-session semantics where configured and supported |
| Failure handling | Provider outage/timeout/mismatch blocks reads and writes, no cached active result |
| Audit | Redacted logs, human-approved safe retention and independently reviewed evidence |

No hosted-ready or production-ready label may be issued before these proofs.
