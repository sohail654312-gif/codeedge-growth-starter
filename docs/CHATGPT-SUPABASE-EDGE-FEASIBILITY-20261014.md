# Independent feasibility decision — Supabase Edge Functions, Codeedge Growth Starter

**Date:** 2026-10-14. **Scope:** source snapshot `b8180c80d4654c186ba6fabccfcc992a1270b94c` (Codex's Phase 3.15O branch), existing isolated Supabase staging project `dbppeymhsemvghbvuvof`. **Read only** on Supabase; no deployment, new account, secret, grant, migration or billing action.

## Verified account and staging state

- Connected Supabase organization `umjmhwywjzimrmgskimo`: **Free** (`tier_free`), not Pro.
- `codeedge-growth-starter-staging`: `ACTIVE_HEALTHY`, PostgreSQL 17.11, Mumbai (`ap-south-1`).
- **Zero Edge Functions deployed**; seven existing staging migrations.
- The organization billing plan is Free, but this connector readback does **not** attest to invoices, accumulated quota usage or an eventual charge for other providers.
- Official Supabase Free pricing: **$0/month** with **500,000 Edge Function invocations/month** inside quotas. Pro starts from **$25/month**, and additional compute/projects/usage can increase charges. Optional Supabase custom domains require a paid plan and cost **$10/month per configured domain**; no domain was configured.
- Free projects can pause after inactivity, so Free is suitable for a technical pilot, not a contractual 24/7 production SLA.

References:
- https://supabase.com/pricing
- https://supabase.com/docs/guides/functions/pricing
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/platform/custom-domains

## Concrete code compatibility matrix

| Existing component | Evidence at checked SHA | Edge assessment |
|---|---|---|
| Offline SEO, content generation, lightweight provider-neutral rules | Source is offline JavaScript/TypeScript-shaped without live APIs | **Candidate**, subject to Deno unit tests and CPU/memory benchmarks |
| Public health checks or bounded webhooks | Can be implemented with Deno `Request -> Response` handler | **Candidate**, but custom validation required |
| PKCE protocol helper | `backend/phase315g-supabase-pkce-adapter.mjs`, `fetch` HTTP adapter | **Possible port**, must validate actual Supabase auth protocol and callbacks |
| Existing HTTPS gateway listener | `staging/phase315m-server.mjs` imports `node:https`, `node:http`, `node:fs`, `pg` and calls `server.listen()` | **NOT drop-in**. Supabase owns the server and TLS ingress; must rewrite around Deno's request handler |
| Secret and approval bootstrap | `staging/phase315m-bootstrap.mjs` expects protected secret/evidence files, SHA-256 module digest and dynamic import | **Needs new security design** for Edge secret delivery and immutable reviewed artifacts; never substitute plain env flags for independent approval |
| Issuer/gateway PostgreSQL restrictions | `backend/phase315m-private-runtime.mjs` uses two different PostgreSQL pools, transaction-scoped locks and preflight permission checks | **Not verified** on Edge; Deno Postgres clients exist but separate credentials/transactions, TLS, pooler mode, concurrency and RLS guarantees require disposable then hosted testing |
| Exact-session revocation | `backend/exact-session-authority.mjs` is a fail-closed provider-neutral interface; `capabilities.hostedVerified === false` | **BLOCKED** until a supported restricted hosted lookup proves administrator/global logout and original session state |
| Session cookies | `backend/phase315e-https-cookies.mjs` uses `__Host-` cookies and `SameSite=Lax` with a canonical HTTPS origin | **Origin design BLOCKED**. Existing AppDeploy preview and `*.supabase.co` Edge endpoints are cross-site; cannot assume browser session cookies work across them merely by enabling CORS |
| Image normalization | `backend/image-inspector.mjs` uses an injected `sharp` image decoder | **NOT supported on hosted Edge** according to official runtime limits; retain in another trusted worker or redesign separately |
| Frontend dashboard | Existing AppDeploy/Vite frontend | **Does not automatically move to Edge**. Supabase Edge rewrites HTML GET responses to text/plain without a custom domain; do not repurpose the current preview |
| Durable/heavy automation, media processing | Provider-neutral workers plus native decoder and long-lived needs | **Not a safe always-on Edge workload** without workload-level review and tested provider limits |

Official Edge limits: 256 MB RAM, 2 seconds CPU *per request* (async I/O excluded), 150-second Free worker wall-clock lifetime, and specific bundle-size/HTML constraints. Official docs confirm Deno is the runtime; Deno Postgres clients are available but cannot be assumed compatible with the exact Node listener or all Node dependencies.

References:
- https://supabase.com/docs/guides/functions/limits
- https://supabase.com/docs/guides/functions/connect-to-postgres
- https://supabase.com/docs/guides/functions/quickstart
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/auth-headers

## Critical auth boundary for a redesigned Edge gateway

Supabase Edge normally validates the caller's **Supabase JWT** via `verify_jwt=true`. A **Codeedge opaque session cookie is not that JWT**. Setting `verify_jwt=false` would make the function invokable without Supabase's platform JWT check, so the function itself must correctly authenticate every protected request and must never rely on a publishable API key as user authorization. Do not enable anonymous privileged SQL endpoints, inject `service_role` as business-data authority, trust forged Origin/forwarded headers, or weaken the exact-session revocation requirement.

The gateway's current `__Host-ce_session` cookie with `SameSite=Lax` must be served under a **verified consistent browser origin**, or the authentication design needs a separately reviewed alternative. The current AppDeploy domain and Supabase project domain are not interchangeable origins.

## Decision

**Staging cost:** $0/month is viable **only for source/design checks and light Edge experiments within Free quotas** using the existing project, not evidence that our entire present Node gateway can be hosted free.

**Current production gateway compatibility: NO — not drop-in and not security-accepted.**

**Conditional, staged candidate:** port *one* minimal, non-sensitive, stateless offline SEO/proposal function to Deno, unit-test in CI without Docker/credentials, and independently verify bounded runtime/resource behavior. No client media, authentication, admin DB pools, external publishing, real customer data or secrets in this first proof.

**To migrate the whole private gateway:** independently design a Deno request adapter, secure same-origin browser transport, distinct issuer/read DB roles, exact-provider-session authority, effective origin and callback policy, durable transaction guarantees, negative direct API probes and signed fictional A/B/C hosted tests. Do not infer completion from a successful synthetic test. An alternative isolated Node backend host may be simpler and cheaper in engineering risk, even if not zero-cost.

## Explicit gates and safe next steps

1. Keep Codex's current `engineering/phase2-core-security` branch and PR #2 **untouched**. This QA report has a separate branch and is review-only.
2. No Edge function is deployed, no Auth URLs changed, no database DDL or billing actions.
3. If authorized later, create a **separate, no-auth, stateless Deno proof in this QA branch**, and run Deno CI before proposing a deploy.
4. Before any hosted test, request separate explicit owner approval for exact function name, ref, source hash, exposure, resource budget and rollback. Staging Auth test accounts and any secret handling require their own reviewed authorization.
5. **Do not claim Free production readiness** without verifying quota, inactivity pause behavior, ingress, cookie transport and authenticated-hosted tests.

**Assessment verdict: LIMITED EDGE USE IS FEASIBLE IN PRINCIPLE; THE CURRENT FULL PRIVATE GATEWAY IS NOT READY FOR SUPABASE EDGE FUNCTIONS.**
