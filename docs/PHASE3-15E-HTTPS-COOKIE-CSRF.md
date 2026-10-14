# Phase 3.15E — Secure HTTPS callback and cookie/CSRF integration (source only)

This phase composes the existing fictional PKCE bridge with the revocable Codeedge session proof. No Supabase hosted role, password, project, migration, Auth session, production service or Data API setting is changed. Growth Starter PR #2 must remain draft.

Endpoints in the synthetic HTTPS harness:

- GET /auth/start: same-origin request, strict TLS/Host, server-held PKCE S256 verifier, one-use 5-minute state and __Host-ce_flow cookie (Secure; HttpOnly; SameSite=Lax; Path=/). Returns only the public state/challenge/redirect data. Does NOT redirect directly to Supabase yet.
- GET /auth/callback?code=...&state=...: verifies exactly one of each field and browser flow cookie. Calls the existing one-use code exchange and fictional provider verifier. Creates the separate Codeedge session, and returns only Secure HttpOnly __Host-ce_session and a Secure JS-readable HMAC-bound __Host-ce_csrf cookie. Strips the authorization code via fixed local 303 redirect, never returns Supabase access/refresh tokens.
- GET /v1/requests?workspaceId=...: reads with the session cookie through the database transaction and current workspace authorization. No caller-provided actor.
- POST /auth/logout: requires exact Origin, Fetch Metadata restriction, zero request body, correct HMAC-bound cookie and X-CSRF-Token. Only on committed revocation does it clear cookies and return 204. Failure returns 503, not a false logout success.

Defenses: HTTPS socket checked directly (no trust of X-Forwarded-Proto); exact Host and Origin; cookie parser rejects duplicates; host-only cookie prefix; no wildcard CORS; private no-store, no-referrer, CSP, HSTS; fixed redirect targets; tests use fictional users.

Remaining blockers before any deployment: real Supabase server-controlled code exchange and original-token verification, production cookie secret storage and rotation, browser UI wiring, production network/TLS ingress and rate limits, restricted non-bypass PostgreSQL roles and independent RLS tenant checks, direct Data API bypass tests and owner decision concerning independent Supabase admin/global signout revocation. The hosted constructor deliberately throws. Do not treat CI as real-hosted acceptance.

Staging acceptance requires an independently reviewed change/rollback plan, verified actual Data API exposed schema settings, a supported provider login adapter, fictional A/B/C users, and separate explicit owner approval for each hosted mutation. No paid upgrade or local Docker is required for this source-only phase.

Supabase references: https://supabase.com/docs/guides/auth/sessions/pkce-flow ; https://supabase.com/docs/guides/auth/server-side/advanced-guide
