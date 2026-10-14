# Phase 3.15F — Fictional-user staging approval and rollback package

**Decision: PREPARED, NOT APPROVED.** Scope only: repository `sohail654312-gif/codeedge-growth-starter`, branch `engineering/phase2-core-security`, draft PR #2, existing hosted project `codeedge-growth-starter-staging` / `dbppeymhsemvghbvuvof`. Up to **three fictional users (A, B, C)** after a *separate explicit authorization*. Do not modify Growth Starter production, other Codeedge projects, Business OS, MVP or real patients. No paid upgrade, local Docker or new project.

## Evidence from live Supabase read-only check (2026-10-14)
PG17.11 / project ACTIVE_HEALTHY. All 7 application tables have RLS; 3 policies exist (counts alone do NOT certify predicates). `anon` lacks Growth Starter schema USAGE; `authenticated` **HAS** schema USAGE and column-level SELECT on `growth_starter.work_requests.title`; full-table SELECT is false. The old runtime can still SET ROLE into `growth_starter_reader`, and that reader can execute 3 privileged `SECURITY DEFINER` functions. The old managed-Auth checker remains NOLOGIN with no `auth` schema USAGE. `growth_starter_private` does not exist on hosted staging. `pgrst.db_schemas` returned null in this DB session, and **does not prove** that the Data API is disabled. No Edge Functions were deployed at inspection time.

The fallback MUST NOT use a still-valid Supabase access JWT as a post-logout ticket to create a new Codeedge session. A Codeedge-issued session cookie alone is also insufficient while the old direct Data API grants remain.

## Proposed implementation sequence — each change requires review and separate owner consent
### Gate 0: Safeguards (read-only; no permission required for repo work)
- Capture exact Git commit, migration history, catalog privileges, RLS policy definitions, function ACLs, role membership paths and Dashboard Data API exposed schemas. Obtain an approved, reproducible backup/restore procedure; do not presume Free-plan point-in-time recovery.
- Verify this is the dedicated Growth Starter staging project, not the older read-only Business OS project.
- Record supported Supabase PKCE/SSR version, exact callback domain and redirect allowlist, cookie domain, TLS ingress, rate limits and Free plan quotas.
- Decide provider-global logout contract: independent Supabase admin revocation/password reset is **not** immediately mirrored into Codeedge sessions in the current fallback. Do not misrepresent Codeedge-only logout as global.

### Gate 1: Provider login adapter proposal (SOURCE ONLY first)
- Implement a server-controlled real Supabase Auth PKCE authorization-code exchange with current pinned SDK and proper ephemeral verifier/cookie storage, or a rigorously reviewed supported protocol implementation. Confirm exact `exchangeCodeForSession` and redirect behavior with the current SDK. **Do not fabricate Supabase URLs** or misuse the OAuth-server feature for third-party clients.
- Verify exchanged original access token with trusted Supabase Auth; bind same user, session ID, issuer, audience and freshly consumed code. One-use state+browser binding and unique one-time grant must prevent replay.
- Forbid provider refresh tokens, private keys and DB credentials from browser responses, logs or GitHub. Keep real hosted factory disabled until final acceptance.
- Use secure host-only HttpOnly session cookie, HMAC CSRF binding, HTTPS origin and failure-closed logout; test reverse-proxy TLS behavior under actual host.

### Gate 2: Database isolation proposal (SOURCE ONLY first)
- Create a *separate* private schema for hashed Codeedge sessions and PKCE flows, not managed `auth`; preserve original schema as rollback target. Do not apply disposable PG fixtures as hosted migrations.
- Design minimal private server roles for issuing/revoking sessions and reading business records. **Do not reuse `postgres`, `service_role`, `growth_starter_reader` or a universal `SET ROLE` credential**. Design database-enforced tenant isolation, not merely a caller-supplied actor ID, writable JWT GUC or app-only WHERE clause.
- Inspect `SELECT ... FOR SHARE` privilege requirements for the proposed restricted reader. Prove the lock/row security design with real non-owner PG principals in disposable PG17 before writing grants for hosted staging.
- No broad `auth.sessions` SELECT or `auth` schema grants are necessary for the fallback. Both protected read and revocation must serialize; complete revocation must deny subsequent reads; transient failures deny access.
- The existing 3 legacy privileged functions and role-switch edge may only be retired after the accepted replacement passes, with transactional before/after ACL snapshots and rollback verification.

### Gate 3: Direct Data API / access-bypass acceptance
- Independently verify the **effective Dashboard exposed schema setting** at [Data API settings](https://supabase.com/dashboard/project/dbppeymhsemvghbvuvof/integrations/data_api/settings). SQL `current_setting('pgrst.db_schemas',true)` is not authoritative.
- Choose a reviewed Data API disable/unexpose and revoke strategy scoped to Growth Starter. Verify no other legitimate staging components rely on the old authenticated column grants; do not revoke blind.
- Perform negative HTTPS `/rest/v1` tests using actual fictional A/B/C sessions, including stale JWT after Codeedge logout. **Any** successful direct access to a protected column or tenant outside the approved gateway blocks activation.
- Verify schema/table/column/function grants for `anon`, `authenticated`, `service_role`, existing custom roles and PUBLIC; do not assume RLS count 3 proves isolation.

### Gate 4: Actual hosted fictional-only trial (NOT AUTHORIZED YET)
After owner approves explicit change identifiers, register **at most 3 fictional accounts** (A owner, B separate owner, C authorized member of A), with disposable email addresses controlled by the testing team; never invent accessible email addresses or send unsolicited invitations. Deploy privately with minimal grants and capture **redacted** evidence:
1. Fresh A/B/C sign-in with real code and server PKCE; browser only receives Codeedge host cookies.
2. A sees A, B sees B, C can see A only while active; all cross-tenant access denied including direct Data API.
3. Codeedge logout A commits, then exact replay with stolen old Codeedge cookie denied; old Supabase JWT cannot create new Codeedge session.
4. Membership removal, workspace suspension, session expiry, flow replay, forged state, CSRF, wrong Host/Origin, repeated session bootstrap, provider timeout and DB outage fail closed.
5. Concurrent read/logout: no *new* authorized read after a completed revoke; document in-flight behavior.
6. Admin/global Supabase logout: test and accurately document **which** guarantees the chosen model does and does not meet.
7. Verify exact policy deparsing, role membership, no broad Auth grants, no remaining legacy executable paths, no Data API bypass, no service-role leakage and quota headroom.

### Gate 5: Rollback and release
- Before every staging mutation, store an independently reviewed exact original-role-ACL/policy/config snapshot and reversible migration and verify recovery in disposable PG17.
- Restore a **known secure deny-all** configuration on failed acceptance; do **not** turn old privileged functions back on automatically.
- Disable private gateway endpoint, invalidate all fictional Codeedge sessions, remove fictional test data only with verified ownership, reset staging settings with owner approval, rotate compromised secrets and run read-only catalog and direct API re-check.
- Keep PR #2 draft. Production merge and client onboarding require *additional* independent security acceptance and separate owner authorization.

## Artifacts
- `db/reviews/phase315f_staging_preflight_READ_ONLY.sql`: catalog-only SELECT, never edits Supabase.
- `backend/phase315f-staging-preflight.mjs`: fail-closed, diagnostic-only result; cannot self-authorize from a supplied checkbox or JSON flag.
- `tests/phase315f-staging-preflight.test.mjs`: red-team tests for catalog drift and false approvals.
- `docs/PHASE3-15F-FICTIONAL-STAGING-APPROVAL.md`: this runbook.

## Approval boundaries
**No hosted mutation requested or executed in Phase 3.15F.** Before Stage Gate 4, provide the user a precise, limited approval request naming each Auth setting, role GRANT/REVOKE, private schema migration, Edge Function/deployment, credential storage and fictional account creation. A generic "go ahead" with package preparation must NOT be mistaken for that specific approval.

## Official documentation
- [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Server-side Auth](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Database roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Secure Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Edge Function Auth](https://supabase.com/docs/guides/functions/auth)
