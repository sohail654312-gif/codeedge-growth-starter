# Separately deployable staging-only Growth Starter API

This is **not** the public Growth Starter frontend and must not be wired to production until hosted acceptance passes.

The entrypoint `staging/server.mjs` launches the existing read-only gateway, but ONLY after:
- Mandatory environment configuration is present (see `staging/config.mjs`).
- The database URL references the exact Supabase project origin and the separate `growth_starter_runtime` non-owner LOGIN. Pooler connections use `growth_starter_runtime.<project-ref>`.
- PostgreSQL TLS is enabled with `rejectUnauthorized:true` and a configured Supabase-provided PEM CA certificate.
- The connection is checked for non-owner / NOINHERIT / NOBYPASSRLS rights and whitelisted read-only routines.
- A real Supabase Auth bearer token is verified online and the corresponding `auth.sessions` row is checked on every request.
- The allowed frontend origin is explicitly set. Never open on `0.0.0.0` unless the ingress terminates HTTPS.

## Required environment variable names (values never committed)
`STAGING_DATABASE_URL` — **private**, restricted runtime database login only, no URL query overrides.
`STAGING_POSTGRES_CA_PEM` — PEM CA downloaded securely from Supabase dashboard.
`STAGING_SUPABASE_URL` — `https://<staging-project-ref>.supabase.co`.
`STAGING_SUPABASE_PUBLISHABLE_KEY` — publishable key, not service_role.
`STAGING_ALLOWED_ORIGIN` — exact HTTPS client staging origin.
Optional: `STAGING_BIND_HOST` (default loopback), `STAGING_TLS_TERMINATED=true` for external TLS reverse proxy, `PORT` (default 8787).

## Deployment process
- Clone the exact PR #2 commit into an isolated, HTTPS-only staging environment with Node.js 22 and the repository backend folder intact.
- Configure environment using backend-only secret storage; never paste connection strings or passwords into GitHub comments, CI logs or a browser frontend.
- The committed `staging/package-lock.json` pins `pg@8.13.3` and its dependency integrity hashes. Install from repository root with `cd staging && npm ci --ignore-scripts --no-fund && npm audit --omit=dev --audit-level=high`. Start **only after** the restricted runtime credential, trusted provider and CA are configured: `npm start`. Never regenerate dependency versions as a deployment fallback.
- No service should start without dedicated database LOGIN, trusted Auth configuration and TLS CA.
- `GET /healthz` indicates only readiness; it is **not** proof of tenant access, revocation, or data correctness.
- `GET /v1/workspaces` and `GET /v1/requests?workspaceId=...` require verified bearer identity and active membership.
- No PUT/POST/DELETE and no client invitation, file/media or publishing routes.

## Blockers
The hosted `growth_starter_runtime` principal is still **NOLOGIN** with no credentials; real staging HTTPS ingress, database certificate, standalone service secret storage, Supabase Auth asymmetric signing configuration and actual user sessions must be set up and tested before live collaboration. Do not deploy a fake service with synthetic credentials.

## Manual hosted acceptance (never run with real credentials in public CI)
- `node staging/hosted-acceptance.mjs` requires the following **secret-managed environment names**: `GS_ACCEPT_GATEWAY_URL`, `GS_ACCEPT_TOKEN_A`, `GS_ACCEPT_TOKEN_B`, `GS_ACCEPT_WORKSPACE_A`, `GS_ACCEPT_WORKSPACE_B`, `GS_ACCEPT_REQUEST_A`, `GS_ACCEPT_REQUEST_B`, `GS_ACCEPT_ALLOWED_ORIGIN`. Supply two independently authenticated, confirmed staging test accounts and two synthetic workspaces with identifiable fictional requests using an authorized ephemeral test fixture. Never use patient data.
- The runner validates HTTPS, separate token subjects and session IDs, both foreign tenant denials, forged claims/signatures, wrong origin, read-only methods and unavailable media routes. It prints only check names/status/latency; no access tokens or response bodies.
- It **does not** independently establish password/TLS quality, actual JWT key-rotation support, expired/revoked session behavior, database privileges, or cleanup. These require separate security-controller evidence. A mock unit-test pass does not constitute hosted acceptance.
- On first failing status or unexpected cross-workspace data, stop; keep agency writes/media disabled and document the sanitized outcome.
