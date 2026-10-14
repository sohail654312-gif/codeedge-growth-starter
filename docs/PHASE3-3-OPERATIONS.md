# Phase 3.3B — authenticated read gateway / source-only activation requirements

**NOT DEPLOYED AND NOT APPROVED FOR REAL CLIENTS.** This is an operator checklist, not permission to provision hosted infrastructure or access patients.

## What the branch can actually execute
- `createAuthenticatedReadGateway` in `backend/authenticated-read-gateway.mjs` composes the token-forwarding PostgREST reader with `createTrustedSessionGate`. Its construction requires `enableForSyntheticTesting:true`; default mode throws. No deployed entrypoint uses it.
- A successful `GET /auth/v1/user` on the exact bearer precedes all data reads, then the injected `checkAuthoritativeSession` must attest the exact active `userId` + `sessionId` from an independently controlled trusted registry. Never use browser/user metadata, a constant-true callback or the direct-PG actor-ID definer for the live callback.
- Read-only HTTP: `GET /healthz`, `GET /v1/workspaces`, `GET /v1/requests?workspaceId=...&limit=1..50&page=0..19`. Write operations receive 405; unknown query/actor IDs, off-origin CORS, malformed resources and untrusted users are rejected. Provider errors fail with 503 and cannot fall back to the legacy gateway.
- Database RLS and column grants are still **review-only**, not installed. Mock HTTP response isolation is **not** a substitute for trusted PostgREST RLS.

## Safe default / legacy retirement

The old `staging/server.mjs` Node entrypoint now exits with code 1 and never listens; `tests/legacy-entrypoint.test.mjs` verifies this. The AppDeploy demo has its own runtime and remains unchanged. The insecure SECURITY DEFINER functions still exist with their old grants in hosted staging: **HIGH OPEN**, even though the entrypoint is sealed in this branch. Do not reenlist the legacy code as a recovery path.

## Exact approval-dependent activation order

1. Explicit owner approval for isolated HTTPS Node 22 hosting and any costs, synthetic Supabase users, secure secret injection, staging-only schema exposure/RLS grants, independent review and controlled cutover. No credentials in GitHub or chat. Verify zero real clinic/patient data.
2. Have an independent reviewer validate the `growth_starter` private schema, `0008_authenticated_read_rls_REVIEW_ONLY.sql` against live version/privileges, and existing privileged functions. The schema must not be exposed before narrow grants and policy verification.
3. Provision **an independently trusted, per-request active session source** using approved provider capabilities. A healthy `/auth/v1/user` response alone cannot guarantee immediate session revocation; refresh-token logout behavior and JWT expiry are different. Do not assume the private Auth schema can be read from public PostgREST.
4. Build an operator-approved staging-only startup module that checks the actual approved session provider, loaded secret manager, verified RLS/grant inventory, accepted deployment SHA and TLS. Do **not** convert `enableForSyntheticTesting` into a production feature flag or deploy the fixture implementation.
5. Test two independent signed fictional Supabase users, own/foreign requests in both directions, client/staff role denials, banned/expired/revoked sessions, membership removals, suspended tenant, provider outages, Direct SQL attacker probes and no external mutations. Record the actual HTTP endpoint, SHA and token-safe evidence.
6. Only then, with explicit approval, stop legacy HTTP routing, transactionally run `0007` and `0009` checks, verify real restricted principals cannot EXECUTE those routines; rollback to maintenance/deny-all, **not** to insecure function grants.
7. Independent security reviewer accepts or rejects the hosted evidence. Keep clinic pilots, agency writes, SEO persistence, social publishing, real Google OAuth and background automations disabled until authorized.

## Local/dry-run verification

```bash
node --test tests/authenticated-read-gateway.test.mjs tests/legacy-entrypoint.test.mjs
node --test tests/postgrest-read-boundary.test.mjs tests/trusted-session-gate.test.mjs
node --test tests/*.test.mjs
# Disposable PostgreSQL 16 ONLY (not live Supabase):
TEST_DATABASE_URL='postgres://gs_test:...@localhost:5432/gs_test' node --test --test-concurrency=1 tests/postgres/*.test.mjs
```

Tests with synthetic `auth.uid()` GUC configuration simulate the JWT-to-database identity channel. That channel is **not verified cryptographically** in disposable CI. Source acceptance does not prove production readiness.
