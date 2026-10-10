# Phase 2.5 — strict browser CORS preflight acceptance

The existing staging API is provider-neutral, read-only, token-authenticated. Browser cross-origin GET calls with an `Authorization` header automatically issue an unauthenticated `OPTIONS` preflight. Before this increment, every non-GET method returned 405, which would prevent an actual hosted browser client from using the gateway even if identity and database credentials were configured.

`backend/staging-gateway.mjs` now answers **only** approved preflights:
- Exact configured HTTPS Origin; unknown origins return 403 with no CORS grant.
- `/v1/workspaces` and `/v1/requests` only.
- Requested method `GET` only; `POST` preflight returns 405 and actual `POST` remains 405.
- One requested header `Authorization` only; any extra custom headers return 403.
- HTTP 204, scoped `Access-Control-Allow-Origin/Methods/Headers`, no cookies or `Access-Control-Allow-Credentials`.
- The preflight is not treated as sign-in; no token, provider, SQL, membership or media operation is evaluated. Subsequent GET still must pass Supabase Auth, online session revocation and workspace-scoped SQL.

`tests/staging-cors.test.mjs` verifies the actual Node server's preflight behavior, disallowed origins and methods, and authenticating subsequent GETs. This is **local synthetic HTTP acceptance only**. HTTPS staging browser behavior still needs two real users and a deployed restricted non-owner gateway.
