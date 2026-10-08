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
- Clone PR #2 in an isolated staging environment; install `staging/package.json` with Node >=22, including the backend source folder.
- Configure environment using backend-only secret storage; never paste connection strings or passwords into GitHub comments, CI logs or a browser frontend.
- Start from repository root with `cd staging && npm install --ignore-scripts && npm start`. Prior to production-quality release, pin a vetted lockfile and run software supply-chain audit.
- No service should start without dedicated database LOGIN, trusted Auth configuration and TLS CA.
- `GET /healthz` indicates only readiness; it is **not** proof of tenant access, revocation, or data correctness.
- `GET /v1/workspaces` and `GET /v1/requests?workspaceId=...` require verified bearer identity and active membership.
- No PUT/POST/DELETE and no client invitation, file/media or publishing routes.

## Blockers
The hosted `growth_starter_runtime` principal is still **NOLOGIN** with no credentials; real staging HTTPS ingress, database certificate, standalone service secret storage, Supabase Auth asymmetric signing configuration and actual user sessions must be set up and tested before live collaboration. Do not deploy a fake service with synthetic credentials.
