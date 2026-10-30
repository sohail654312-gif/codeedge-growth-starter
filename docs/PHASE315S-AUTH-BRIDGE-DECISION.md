# Phase 3.15S — Auth data bridge, disposable proof, and outstanding guarantee

Updated 29 October 2026. REVIEW ONLY. Draft PR #14 was parent at 864b43dd19f761c99e764d0e773474bd1f4a2373.

## New authoritative finding
Supabase's Knowledge Base supports narrowly scoped SECURITY DEFINER functions in a non-exposed private schema to read managed Auth data without granting custom roles direct auth schema USAGE:
https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema

The review-only SQL provides a minimal (user UUID, session UUID) read with session existence, ban/deletion flags and not_after, bound to the existing NOLOGIN checker role. It does not grant Auth schema usage, expose tokens, create logins, return policyValid, update hosted SQL or connect to private ingress. SECURITY DEFINER ownership and function grants require independent security review; the narrower exception must not become generic RLS bypass.

## Disposable proof
A dedicated branch-only GitHub Actions workflow provides a fresh PostgreSQL 17 container and runs tests/postgres/phase315s-auth-bridge.pg.test.mjs with a strict loopback gs_test marker. The test builds a **synthetic** auth.users and auth.sessions schema, executes the exact review-only SQL, proves caller cannot read Auth tables, tests EXECUTE denial, exact pairs, ban/deletion/expired not_after and session removal. No hosted Supabase changes or real users.

## What this does NOT guarantee
Provider-returned original bearer and claims still require server Auth verification. Exact session row existence does not prove Supabase Free-tier inactivity/timebox enforcement, every logout scope, password/admin/global revocation, or the application's complete account-policy contract. No auto-fallback to JWT-only or getUser-only. The injected createExactSessionAuthority remains mandatory and fails closed. A future independently approved adapter must combine validated original identity, exact pair, relevant account events, bounded expiry and externally accepted policy evidence. Do not set policyValid=true based on this function alone.

## Next checks before any activation
1. Independent review of definer owner, narrow output, private schema exposure, no EXECUTE for PUBLIC/API users, actual managed Auth schema compatibility and upgrade risk.
2. Decide (with provider technical answer where needed) the exact requirements for local/global/others/admin logout, password changes, account bans/deletion, and timebox/inactivity on Free tier; establish genuine negative lifecycle tests.
3. Full disposable O->K->M->P migration rehearsal, catalog drift/default/index/role verification, rollback and isolated restore evidence. This test is only a focused preliminary proof.
4. Separate explicit owner approval for any hosted grants/migrations, fictional Auth identities, credentials or staging deployment, then signed A/B/C and REST/GraphQL negative probes, independent review and final release signoff.

Verdict: Supported narrow Auth access candidate FOUND; pending disposable CI and independent review. Exact original-session/account-policy guarantee NOT YET ACCEPTED; restricted hosted runtime still BLOCKED.
