# CODEEDGE GROWTH STARTER — PHASE 3.9 PRIVATE API SECURITY DECISION

**Scope:** manual controlled single writer; source-only and disposable PostgreSQL only. Existing repo \`sohail654312-gif/codeedge-growth-starter\`, branch \`engineering/phase2-core-security\`, PR #2 stays **DRAFT**.

## A. Exact-head starting baseline

Starting verified SHA: \`01a5ee6c9388e50ef2f1ba19ff2a8311f99f13a6\` (Phase 3.8). Four completed PASS GitHub Actions:
- Core safety: 171/171 — https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38083101842
- Disposable PostgreSQL security: 41/41 — https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38083101841
- Offline SEO/UI: 39/39 — https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38083101848
- Staging supply-chain: 16/16 — https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38083101833

Preserved all three project-local skills \`$supabase\`, \`$supabase-postgres-best-practices\`, \`$ai-seo\`; reviewed the first two, no installation or modifications. Phase 3.5 PG17 policy snapshot, phase 3.6/3.7 gateway and phase 3.8 synthetic read adapter retained.

## B. Session authority verdict — BLOCKED

Official:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/signout
- https://supabase.com/docs/guides/auth/jwts
- https://supabase.com/docs/guides/auth/server-side/creating-a-client

The signed JWT has a \`session_id\` claim mapped to \`auth.sessions.id\`. A verified JWT signature, \`getClaims\`, or fresh user record via \`getUser\` does not, without additional explicit provider guarantees, provide a revocation-aware per-request lookup of *that exact session*. Supabase describes a terminated session and JWT validity as distinct and warns about delay until access-token expiry for some session controls. A current-session check must bind verified \`user_id\`, exact bearer \`session_id\`, live \`auth.sessions\` membership, active state, and live tenant membership on each protected request.

**A**: A minimally scoped \`auth.sessions\` query is the preferred *conditional* design. The existing \`growth_starter_session_checker\` has \`rolcanlogin=false\` and no effective managed \`auth\` schema USAGE; never grant broad rights or enable LOGIN in this phase.

**B**: \`/auth/v1/user\` alone is insufficient as documented, and no provider-native endpoint with proven per-session immediate-revocation contract has been accepted. Edge/Node services cannot manufacture provider revocation signals.

**C**: Application-managed server sessions cannot be treated as synchronized with every provider sign-out or multi-device revocation without an independently accepted protocol and proof.

**Provider decision:** obtain official approval/confirmation of the least-privileged provider session-row lookup or a documented revocation-aware introspection endpoint. If unavailable, choose a different explicitly approved authentication/session architecture. Do not weaken immediate revocation.

## C. Executable source-level engineering

- \`tests/postgres/phase39-tenant-principal.pg.test.mjs\`: exercises actual disposable PostgreSQL 17 principal-scoped RLS policies, FORCE RLS, narrow column grants, two fictional owner workspaces and member C, direct unfiltered SQL attacks, forged actor/GUC, member revocation, unauthorized tables/columns, mutations, role-switch and old EXECUTE rights.
- \`.github/workflows/postgres-security.yml\`: changes disposable CI PostgreSQL service from 16 to **17**, aligning real SQL and policy behavior with isolated hosted PostgreSQL 17.11. Old 3.5 hardening and full PostgreSQL suite remain required; a CI regression means this phase is NOT accepted.
- Existing \`backend/private-read-adapter.mjs\` untouched: still \`fictionalTestOnly\`; \`createHostedPrivateReadAdapter()\` is fail-closed.
- No hosted SQL, schema, grants, credentials, users, runtime wiring or production endpoints.

**Independent enforcement demonstrated only in a disposable fixture:** PostgreSQL roles \`gs39_private_tenant_a\` and \`gs39_private_tenant_b\` each have their own limited read grants and tenant-restrictive RLS policies. Raw SQL without the Node actor filter cannot cross tenants for the selected database principal; crafted JWT GUCs have no bearing on the RLS policy. Only CI superuser performs test role impersonation; the tenant role itself has NOLOGIN, NOINHERIT, NOBYPASSRLS and cannot switch into another tenant role. This is **not** a safe deployed implementation: the production process has no independently approved credential-to-workspace binding, per-tenant credential lifecycle/rotation, or protection from a multi-tenant backend compromised with all credentials. Explicit owner decision needed on DB-principal-per-tenant operational complexity versus an independently audited alternative.

**Limits:** tenant principal isolates tenants, not individual members *within the same tenant*; per-user authenticated membership and current-session checks still required. CI fixture policies must NOT replace the locked Phase 3.5 PG17 snapshot or be installed on hosted tables.

## D. Direct Data API exposure — UNVERIFIED

The actual Supabase Exposed Schemas setting was not available via approved read-only management capability. \`current_setting('pgrst.db_schemas',true)\` returned null. Never confuse SQL grants with the UI setting.

The old \`postgrest-read-boundary.mjs\` requires \`accept-profile:growth_starter\` and paths \`/rest/v1/workspaces\`, \`/rest/v1/memberships\`, \`/rest/v1/work_requests\`. Direct access could bypass an upstream Node live-session check if signed-out JWT remains otherwise accepted. **Keep \`growth_starter\` unexposed pending separately authorized readback and signed-out replay evidence.** New private SQL contract never calls REST endpoints.

Provider references:
- https://supabase.com/docs/guides/api/using-custom-schemas
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## E. Hosted read-only evidence, open legacy cutover

Isolated Supabase \`codeedge-growth-starter-staging\` ref \`dbppeymhsemvghbvuvof\`, ACTIVE_HEALTHY, PG 17.11, ap-south-1; 0 hosted Auth users, 0 Auth sessions at read-only observation. Checker LOGIN FALSE and \`auth\` schema USAGE FALSE; \`growth_starter_runtime\` can SET ROLE \`growth_starter_reader\`. Legacy \`growth_starter_reader\` effective EXECUTE on three privileged functions remains HIGH OPEN per latest prior hosted readback.

Preserve Phase 3.5 0007/0009 **review-only** SQL and disposable rollback tests. No hosted cutover, role activation or policy change. Existing repository's strict PG17 policy fingerprint is unchanged.

## F. Hosted readiness and operator prerequisites

No matched Growth Starter Vercel host in available connected project scope (not proof no host exists elsewhere). No observed approved TLS reverse proxy, server-only Node/credentials, independent DB networking and signing/revocation acceptance. No fictional Supabase Auth A/B/C sessions provisioned. Need owner permission separately for isolated host, fictional Auth accounts, secret handling, network policy, provider permission resolution, Data API readback, signed-out token replay, maintenance and rollback; prefer free isolated resources, never Business OS.

## G. Gates, rollback and next step

**Engineering**: new runnable PG17 tenant-authorization test fixture, subject to exact-final-SHA CI pass. **Disposable DB enforcement**: tenant-role restrictive policies and denial tests, not permission to reuse test roles in hosting. **Hosted provider security**: ZERO additional controls accepted. **Open**: live-session authority, safe provisioning/binding of private DB principal to exactly one tenant, Data API configuration, three old privileged functions/role switch, secured host, real signout and A/B/C acceptance.

To rollback without touching hosted infrastructure: revert the Phase 3.9 test and workflow version commit(s) on the existing development branch using ordinary non-force commits. Do not expose schema or enable runtime. The previous known PASS HEAD is \`01a5ee6c9388e50ef2f1ba19ff2a8311f99f13a6\`.

**Exact final commit and CI URLs** must be verified after commit externally; no document can include the SHA of the commit containing itself. Do not claim PASS while CI is pending.

**Phase 4.0 narrowly scoped action:** official provider/owner decision on an approved per-session revocation-aware Auth lookup and its least-privilege managed-schema access. If unavailable, formally approve a different authentication architecture before further hosted work.
