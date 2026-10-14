# Phase 3.15N — Exact provider-session revocation gate (review only)

Date: 2026-10-14. Repository: `sohail654312-gif/codeedge-growth-starter`.
Branch: `engineering/phase2-core-security`. Existing PR #2 remains **DRAFT / unmerged**.

## Narrow result

Added `tests/phase315n-authority.test.mjs` to the existing source-guards CI
suite. The regression uses synthetic restricted pools and a fictional provider
session authority; no real user login or hosted SQL is touched. It proves the
Phase 3.15M gateway will not invoke a tenant-data read after the injected
authority reports a revoked session, a mismatched user ID, a mismatched
session ID, an expired session, a malformed response, an outage or a timeout.
A matching response permits only the already scoped `read_requests` path.

**This is source-code safety coverage, NOT a verified hosted Supabase
revocation integration.** It must never be interpreted as evidence that
Supabase administrator/global logout is synchronized with Codeedge sessions.

## Official provider behavior and the decision

Supabase's official signing-out guide says a sign-out invalidates refresh
tokens while already issued JWT access tokens remain valid until `exp`:
https://supabase.com/docs/guides/auth/signout

Supabase's session guide documents that a JWT's `session_id` is the identifier
of `auth.sessions.id`, and that checking for a corresponding session row
can close the post-logout access-token window for sensitive operations:
https://supabase.com/docs/guides/auth/sessions

Therefore **JWT signature/expiry checks alone cannot establish immediate
revocation**, and a standalone `getClaims()` / `getUser()` fallback must not
be silently substituted for the Phase 3.15M exact-session authority contract.

## Read-only live staging catalog inspection

Project `dbppeymhsemvghbvuvof` (the existing isolated Growth Starter
staging project): the `auth.sessions` table exists, has RLS enabled, is
owned by `supabase_auth_admin` and includes `id`, `user_id`,
`not_after`, `created_at`, `updated_at` and `refreshed_at`.
Only SQL catalog metadata was read. **No actual Auth sessions, user rows,
customer data, private keys or credentials were queried.**

That catalog fact does **not** establish a supported or authorized way for
a private application role to read the managed Auth schema, and does not
prove the semantics of account banning, password reset or administrator
revocation. Existing restricted gateway roles must not receive direct
`auth.sessions` SELECT/USAGE privileges merely to make tests pass.

## Unresolved deployment requirements

1. Independently review with current Supabase documentation/support a
   **supported, least-privilege, server-only** exact-session check for the
   database-bound `(user_id, session_id)` pair, including `not_after`
   semantics and revocation on provider local/global signout, admin action,
   password reset and user deletion. Return a deny/not-active assertion when
   the session does not exist. Verify user-account suspension separately.
2. If the design would require grants on managed `auth` tables or privileged
   functions, stop and request **separate exact owner approval** after an
   independent privilege and lifecycle review. Never grant broad Auth access
   to the gateway/issuer, copy provider tokens into a browser, or introduce a
   `service_role` pool. The new checker must not rely only on claims.
3. Verify the real provider event semantics with controlled fictional A/B/C
   accounts and signed negative HTTP tests. A local test double cannot prove
   a hosted provider-wide logout or JWT bypass closure.
4. Pick an actual HTTPS host and canonical hostname, confirm hosting's trusted
   ingress, Supabase callback allowlist, Free plan limits, secret delivery and
   real TLS. No host has been selected or authorized, so do not deploy.
5. After independent security signoff, request an explicit change-by-change
   owner approval before **staging-only** role/migration/Auth changes. Preserve
   `growth_starter` and `growth_starter_private` outside the Supabase
   Data API exposed schemas. Confirm negative REST/GraphQL bypass probes,
   rollback and data-recovery evidence.
6. Keep PR #2 draft, current AppDeploy demo unchanged and all unrelated
   Codeedge repositories untouched until separately approved.

## Evidence and CI

The standard `source-guards.yml` workflow runs `tests/*.test.mjs`, so
Phase 3.15N regression checks participate in core safety CI on the existing
engineering branch. The PostgreSQL 17 CI continues as a **disposable**
database proof, not a hosted acceptance test. Check exact push SHA and all
four workflow results before claiming source-level acceptance.

**Release verdict: BLOCKED.**
