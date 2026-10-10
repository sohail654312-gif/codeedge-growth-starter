# CODEEDGE GROWTH STARTER — PHASE 3.6 TRUSTED SESSION ACCEPTANCE

**Mode:** Manual controlled single writer; no production or hosted modifications. **Repo:** `sohail654312-gif/codeedge-growth-starter`. **Branch:** `engineering/phase2-core-security`; **PR:** #2 remains DRAFT. **Verified starting SHA:** `9011a0da573cb23552f1e44cfe3c634e90a3de29`. The **final commit SHA and CI** must be verified externally after committing this document; a document cannot know its own future commit SHA.

## A. Starting evidence and carry-forward

Phase 3.4's three installed skills, offline six-test skill acceptance harness and report were preserved. Phase 3.5's `backend/pg-rls-catalog.mjs`, `backend/pg-session-authority.mjs`, strict PostgreSQL 17 policy snapshot, privilege drift and role-switch fail-closed preflight, and review-only cutover drafts were preserved.

At starting SHA the **four existing workflows succeeded**: [core safety](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38059833576), [disposable PostgreSQL](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38059833585), [offline SEO/UI](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38059833595), [staging supply chain](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38059833593). These historical passes are **not** Phase 3.6 final-head evidence.

Source inspected: `docs/PHASE3-3E-HANDOFF.md`, `docs/PHASE3-4-MCP-SKILL-ACCEPTANCE.md`, `docs/PHASE3-5-SECURITY-HARDENING-HANDOFF.md`, `docs/SECURITY.md`, `docs/INDEPENDENT-REVIEW.md`, `backend/trusted-session-gate.mjs`, `backend/pg-rls-catalog.mjs`, `backend/pg-session-authority.mjs`, `backend/postgrest-read-boundary.mjs`, `backend/authenticated-read-gateway.mjs`, `staging/accepted-server.mjs`, and reviewed cutover drafts and tests. `$supabase` and `$supabase-postgres-best-practices` were **read as project-local skills**; **native Codex invocation unverified**, no skill reinstallation or MCP retrieval.

## B. Implemented engineering — source-only

1. `tests/phase36-trust-boundaries.test.mjs`: fictional A/B/C JWT-bearing gateway simulation against *existing* source, covering tenant-specific reads, cross-tenant rejection, member revocation, signed-token session cancellation, ID provider and session authority outages, malformed/mismatched issuer/audience/session, forged roles/actor parameters, no writes, strict current catalog and privilege drift. JWT "signatures" are mocked; this is **not signed real-Auth acceptance**.
2. `staging/phase36-direct-api-probe.mjs`: separate future **manual, read-only** REST/Data API revoked-token replay probe. Requires operator-supplied signed-out-unexpired JWT, isolated fictional workspace, explicit flags and publishable key; sends only bounded GET and returns a token-free verdict. `200` with rows is **FAIL**; empty `200` is **BLOCKED/inconclusive**; `401/403/404/406` is **PARTIAL** pending evidence of why denied (e.g. configuration, RLS, user/session). The module performs **no logging, mutations or scheduled requests**.
3. `tests/phase36-direct-api-probe.test.mjs`: offline negative cases for missing approval flags, forged bearer, provider outage, unexpected response and no secret leakage. The probe itself is never run against hosted staging in this phase.
4. This report only. Existing product runtime, role-checker design, schema, SQL drafts, host, policies, other repositories and UI are untouched. New Node tests are discovered automatically by the existing `node --test tests/*.test.mjs` **core safety workflow**.

## C. Session authority architecture decision

**Candidate priority: private, provider-authenticated identity plus server-only current-session attestation.** Original bearer goes to Supabase Auth `/auth/v1/user` to verify signed user. An independently secured current-session authority must bind verified `user.id` to original JWT `session_id` and check session active/not revoked *on each protected request*; then independently check current workspace membership. Identity metadata, caller actor IDs, client-set Postgres GUCs, signature decoding without verification, and permanent cache entries are not authorities.

Compare the three approaches:

- **1. Provider-approved narrow session lookup:** Preferred if Supabase can support a strictly least-privilege, auditable session-read channel. Project's `growth_starter_session_checker` is `NOLOGIN`; `auth` schema USAGE **false** despite column grants. Protected managed schema owner cannot be overridden by regular `postgres` migration role. **BLOCKED**; do not grant broad access or activate LOGIN.
- **2. Trusted private service:** Potentially valid *only* with a verified provider-supported current-session source, protected secrets, outbound Auth connectivity, safe hosting and exact authenticated user/session binding. An Edge Function or Node service alone is **not** proof of reliable revocation state; custom Auth hooks run on issuance and do not solve per-read revocation. No private host, credentials, or approved session provider exists. **BLOCKED**.
- **3. Native JWT + RLS:** Supabase verifies signed JWT and RLS can enforce membership, but an unexpired JWT may remain valid after logout; direct Data API access bypasses the Node pre-read active-session check. Does **not** satisfy mandated immediate-revocation guarantee without database-level equivalent session enforcement. **INSUFFICIENT**.

**Decision:** Keep protected `growth_starter` schema unexposed to the Data API and hosted accepted server fail-closed until provider-supported current-session authority and every accessible route are independently verified. Neither broad `SECURITY DEFINER` helpers nor service-role shortcuts are authorised. If provider-native current-session introspection remains unavailable, this requirement stays **BLOCKED**; a different, explicitly approved authentication/access architecture is needed. Never silently relax the guarantee.

Supabase references (checked): [User sessions](https://supabase.com/docs/guides/auth/sessions), [JWTs](https://supabase.com/docs/guides/auth/jwts), [Securing the API](https://supabase.com/docs/guides/api/securing-your-api), [Custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas), [Signing out](https://supabase.com/docs/guides/auth/signout).

## D. Verification and regression commands

Use **Node 22**, no Docker on owner device, no third-party packages for new tests:

```sh
node --check staging/phase36-direct-api-probe.mjs
node --check tests/phase36-trust-boundaries.test.mjs
node --check tests/phase36-direct-api-probe.test.mjs
node --test tests/phase36-trust-boundaries.test.mjs tests/phase36-direct-api-probe.test.mjs
node --test tests/*.test.mjs
# Existing CI uses its own disposable Postgres 16 service:
TEST_DATABASE_URL=<ephemeral-CI-URL> node --test --test-concurrency=1 tests/postgres/*.test.mjs
```

**Evidence:** At document drafting, Phase 3.6 tests have been added to a prepared commit tree; execution and **final-head CI results are PENDING**, not assumed to pass. After commit and real workflow runs, record exact SHA/run conclusions externally or append an independently reviewed evidence update. The PG16 disposable runner cannot substitute for the PG17 exact policy fingerprint acceptance.

## E. Effective-access inventory and direct API

| Path | Present source/live evidence | Verdict/gate |
|---|---|---|
| Supabase Auth `/auth/v1/user` | Implemented in `backend/postgrest-read-boundary.mjs` with original bearer; provider's JWT verification. | Validates user identity, but alone cannot guarantee immediate session revocation. |
| Supabase Data API `/rest/v1/*` | `authenticated` has `growth_starter` schema USAGE and select column grants on 3 tables; 3 membership/owner policies installed; no per-read live session check in policies. Custom exposed-schemas *Dashboard setting is not exposed by read-only connector*, so no independently verified API config. | **HIGH CONDITIONAL**: if custom schema exposed, revoked-but-unexpired signed user may bypass gateway current-session gate. Keep unexposed; require provider Dashboard configuration proof and revoked-token replay. No known live rows/users at audit. |
| Accepted Node gateway `/v1/*` | `staging/accepted-server.mjs` requires dedicated role login, pinned RLS/privilege preflight, loopback/TLS ingress. Not deployed, fails closed against current role configuration. | Source-guarded, **HOSTED BLOCKED**. |
| AppDeploy legacy routes | `docs/SECURITY.md` notes SDK auth and owner partition and incomplete hosted provider acceptance; no tested alternate privileged Supabase path confirmed. | **BLOCKED for real client data**; do not turn on or share as accepted Auth/RLS channel. |
| Restricted PostgreSQL `growth_starter_reader` | Live role `NOLOGIN`, but can execute all 3 `postgres`-owned `SECURITY DEFINER` routines. `growth_starter_runtime` can `SET ROLE growth_starter_reader`. | **HIGH OPEN**; role remains not directly connectable; old gateway disabled; do not enable connection. |
| Old staging gateway | Disabled at source via `backend/staging-gateway.mjs`/`staging/server.mjs`, no authorised accepted service deployed. | Fail closed if kept disabled. |
| Edge Functions | Supabase connector lists **0** deployed functions on isolated staging. | No verified session-introspection service. |

**Direct bypass acceptance:** A gateway-level successful check does **not** imply direct PostgREST access is safe. `phase36-direct-api-probe` is an instrument, not enforcement; only owner-approved real signed-user, revoked-session, seeded-row, API-config and current RLS evidence can close this risk.

## F. Hosted staging readiness and A/B/C acceptance — future manual procedure

Isolated project `codeedge-growth-starter-staging` (`dbppeymhsemvghbvuvof`, `ap-south-1`) was **ACTIVE_HEALTHY, PostgreSQL 17** at read-only inspection. Last actual counts: **0** `auth.users`, **0** `auth.sessions`, **0** Growth Starter workspaces/memberships. **7/7** RLS base tables and **3** read policies; `growth_starter_session_checker` remains `NOLOGIN` with `auth` schema USAGE **false**. All 3 actor-ID legacy functions remain EXECUTE-accessible by `growth_starter_reader`, and `growth_starter_runtime` can still SET reader role. Supabase Security Advisor's 4 no-policy notices are intentionally deny-all tables; do not enable policies just to clear a lint. Supabase has **0** deployed Edge Functions. Connected Vercel project-name lookup `growth-starter` found **0** matching projects; no private TLS Node host with suitable secrets/networking has been verified. No hosted write was performed.

**Prerequisites to obtain under separate owner approval, in order:**

1. Independently review and choose *one* provider-supported current-session lookup. Request supported access from Supabase provider, not owner-created broad `auth` grants. Verify provider failure means deny. Reject any resolution requiring unrestricted service-role or caller-controlled actor.
2. Verify restricted **Data API exposed-schemas setting** in Supabase Dashboard/management configuration. Require explicit evidence `growth_starter` is not exposed, not a guess from `current_setting('pgrst.db_schemas')`. Preserve 7 RLS tables/3 approved policies until reviewed.
3. Select zero-cost, isolated **HTTPS Node 22 ingress** with TLS, loopback-only server, secure secret entry, private outbound PostgreSQL access, IP/network support, redacted logs and rollback. Existing Business OS infrastructure and live demo cannot be repurposed. Vercel serverless is not automatically a private long-lived Node+PG service.
4. Through supported Supabase Auth Dashboard or Auth Admin API, create **fictional**, independently credentialed users A (owner workspace A), B (owner workspace B), C (active member of A); email-verify legitimately; store passwords/tokens only in approved operator secret manager, never repo/chat/logs. Owner approves seed scope and cleanup.
5. Generate genuinely provider-issued, independently verified JWTs A/B/C. Review `iss`, `aud`, distinct `sub`/`session_id`; do **not** treat decoded payload as cryptographic verification. Seed minimal owner/membership/work-request fixtures through independently authenticated, operator-only channel.
6. Start approved private host **only after** checker privilege preflight and future cutover are accepted. Test A own A, B own B, C member A and both directions denied, no write/grant escalation, unavailable or wrong/expired/forged claims denied. Revoke C membership with *same JWT* and prove immediate denial.
7. Sign out A via provider-supported method with original A JWT still unexpired, replay at accepted gateway **and direct Data API**; verify no rows. Read-only `staging/phase36-direct-api-probe.mjs` can capture token-free classification; 401/403/404/406 is only partial without independent exposure/read evidence. Test TLS wrong host/forwarded headers, errors, rate limits and provider outage.
8. Audit role graph, all 3 old functions and policy snapshots, perform **separately approved** atomic cutover only after accepted replacement; after commit prove rights absent and original gateway sealed. Evidence log must retain **only** timestamp, hashed fixture IDs, route class, expected/actual status, current deployment SHA and reviewer verdict; never record JWT, email/password, secret keys or patient data.
9. Cleanup only positively identified fictional fixtures/sessions under authorised operator action; verify 0 residual synthetic rows, 7 RLS tables and no broadened rights. Fail-closed maintenance-mode recovery: disable gateway/API access, **never** restore actor-ID privilege.

**Hosted acceptance now: BLOCKED.** Needed: approved account issuance, protected session authority, safe host/secrets/network, exposed-schema proof, operator-approved controlled cutover and independent sign-off. GitHub runner disposable PostgreSQL is not an alternate managed Auth service.

## G. Outstanding risks by severity

| Severity | Issue / evidence | Status |
|---|---|---|
| CRITICAL | No provider-supported current-session authority accessible with existing checker `auth` schema privileges. | BLOCKED |
| HIGH | Direct Data API may bypass gateway revocation if `growth_starter` is exposed; exposed-schemas setting not independently verified here. | OPEN / conditional |
| HIGH | All 3 legacy `SECURITY DEFINER` functions executable by legacy reader; runtime role SET edge still present. | OPEN |
| HIGH | Signed independent A/B/C JWT, immediate logout, cross-tenant and ingress acceptance absent. | BLOCKED |
| MEDIUM | PostgreSQL 17 pinned policy deparse versus disposable PostgreSQL 16; cannot auto-relearn current live metadata. | OPEN review |
| MEDIUM | No verified protected free Node/TLS host and secrets/network path. | BLOCKED |
| LOW | Unused indexes flagged in empty staging — insufficient load/usage evidence to drop. | DEFER |

## H. Exact CI and rollback evidence

**Starting SHA:** `9011a0da573cb23552f1e44cfe3c634e90a3de29`; all 4 run URLs in section A **PASS**. **New commit and 4 exact-final-SHA runs:** report **only after** execution; do not infer success from push. This report does not self-approve.

**Rollback of Phase 3.6 only:** reviewed revert commit that removes the 3 new source/test files and this report. Do **not** revert Phase 3.4 skills, Phase 3.5 catalog, draft SQL grants, service lockdown, or safety tests. Do not reset/force-push branch, restore actor-ID gateway, disable RLS or broaden grants.

## I. Owner decisions and Phase 3.7

**Owner approvals still needed, independently:** supported narrow current-session source/provider escalation; private host/security budget (prefer no-cost), fictional provider Auth user creation, protected secret injection; verified Data API exposure config, synthetic staging fixture setup, controlled cutover and rollback, authorised hosted acceptance run, independent reviewer verdict. None authorised by Phase 3.6 source-only scope.

**Recommended Phase 3.7:** *read-only Supabase Auth-session mechanism feasibility and secured hosted environment acceptance design*, focused solely on resolving the provider-approved source of **current** session state; compare vetted Auth Admin/Edge/private connection options using exact role support and supported APIs, propose minimal isolated zero-cost infrastructure and pre-cutover synthetic acceptance. No service-role or privileged helper bypass, no hosted changes until distinct owner approval. Commercial pilot remains blocked.
