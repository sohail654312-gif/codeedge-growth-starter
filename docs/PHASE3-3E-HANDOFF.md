# CODEEDGE GROWTH STARTER — PHASE 3.3E LIVE STAGING HANDOFF

**Date:** 2026-10-10 (Asia/Karachi).  
**Scope:** `sohail654312-gif/codeedge-growth-starter`, existing draft PR #2,
branch `engineering/phase2-core-security`; isolated Supabase
`codeedge-growth-starter-staging` (`dbppeymhsemvghbvuvof`, `ap-south-1`).
**Starting PR HEAD:** `7635b72546b51114d960ca4f0f45e2f00716501e`.
**Main HEAD:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.
**Final PR HEAD:** inspect live PR after this documentation commit. Exact-final-head CI links
must be published in its comment; commit SHA cannot be included in its own contents.

## Scope of owner authorization and implementation

The uploaded Phase 3.3E directive explicitly authorizes secure **isolated staging**
SQL RLS, minimal checker grants, fictional Auth accounts and signed-user tests,
but explicitly prohibits unreviewed exposure, paid infrastructure, real clients,
unrestricted service role, PR merge and other repositories.

This phase executed **TWO REAL hosted Supabase migrations**, not just source
drafts. NO production services were touched.

### Actually applied migrations

1. `growth_starter_phase33e_authenticated_read_rls` (version `20261010063818`).
   Source exactly `db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql`
   at starting SHA. It installed:
   - `gs32_membership_self_read` on `growth_starter.memberships` (active current-user rows only);
   - `gs32_active_workspace_read` on `growth_starter.workspaces`
     (active owner or current active agency/staff/client member);
   - `gs32_active_workspace_requests_read` on `growth_starter.work_requests`
     (only requests for currently visible active workspaces);
   - REVOKE `anon` / `authenticated` broad table and sequence privileges,
     granting `authenticated` only the required SELECT columns.
   The other four tables remain RLS enabled with NO policy = deny-by-default.

2. `growth_starter_phase33e_session_checker_columns_nologin` (version
   `20261010063911`). Source exactly
   `db/drafts/0010_session_checker_minimal_auth_columns_REVIEW_ONLY.sql`
   at starting SHA. It created `growth_starter_session_checker`
   **NOLOGIN / NOINHERIT / non-superuser / non-BYPASSRLS**, and recorded
   column-limited SELECT grants for
   `auth.sessions(id,user_id,not_after)` and
   `auth.users(id,deleted_at,banned_until)`.
   **MATERIAL FINDING:** `has_schema_privilege('growth_starter_session_checker','auth','USAGE') = false`
   despite migration success. This is because `auth` is managed by
   `supabase_admin`, not by migration user `postgres`, which is NOT allowed
   to SET `supabase_admin` and does not own the auth schema. PostgreSQL can
   report success with a non-effective GRANT of privileges the executor cannot
   grant. Therefore the checker is **NOT functional** and remains NOLOGIN
   without password or private hosting connection. Never assert this migration
   activated server-authoritative session validation.

### Actual verified live security catalog

| Item | Before | After |
|---|---:|---:|
| Supabase Auth users / sessions | 0 / 0 | 0 / 0 |
| Growth Starter workspaces / memberships / requests | 0 / 0 / 0 | 0 / 0 / 0 |
| RLS-enabled Growth Starter tables | 7 | 7 |
| Installed authenticated SELECT policies | 0 | 3 |
| Unauthenticated `growth_starter` schema USAGE | denied | denied |
| Authenticated schema USAGE | denied | granted |
| Authenticated SELECT on specific intended columns | denied | granted |
| Authenticated SELECT `work_requests.reviewed_by` | denied | denied |
| Authenticated SELECT on media/audit/invitations | denied | denied |
| Authenticated writes to workspace | denied | denied |
| Dedicated checker role / login | absent | NOLOGIN, unprivileged |
| Dedicated checker `auth` schema USAGE | absent | **DENIED — BLOCKER** |
| Privileged `growth_starter` SECURITY DEFINER functions | 3 | 3 |
| Legacy actor-ID EXECUTE for `growth_starter_reader` | true | **true — HIGH OPEN** |

The post-migration `pg_policies.qual` expressions were read back
and match the expected ACTIVE/current-user/owner or member predicates.
Supabase Security Advisor decreased RLS-no-policy notices from seven
to **four**; the four represent intentional deny-all tables.

No Supabase Auth users, passwords, signed access tokens, sessions, synthetic
records, hosted gateway endpoints, public Data API schema setting or third-party
paid resources were created. NO real hosted cross-tenant attack probe has
been performed. The source-level CI PostgreSQL RLS exercises simulated
`auth.uid()` claims and cannot independently verify real signed JWTs.

### Actual access and host review

- The Supabase connector exposes SQL, migrations, projects, metadata and
  Edge Function operations, but **no Auth Admin createUser/sign-in workflow**,
  no approved secret-manager password injection and no live protected Node
  execution endpoint. Direct modifications of `auth.users` / `auth.sessions`
  would violate the documented managed Supabase Auth lifecycle, so they were
  intentionally NOT made.
- Vercel account project search found only
  `codeedge-business-os-test` (another repo, outside this scope).
  Existing AppDeploy Growth Starter deployments are UI/concept demos,
  **not verified** as suitable for a long-running TLS-protected private
  PostgreSQL session checker and HTTPS reverse proxy. They were not repurposed.
- Protected `auth` schema owner `supabase_admin`; `auth.sessions` and
  `auth.users` are owned by `supabase_auth_admin`. Database `postgres`
  has auth schema USAGE only and cannot SET `supabase_admin`. The draft
  `0010` checker privileges are insufficient without a supported and
  independently reviewed Auth-session-introspection route; do NOT broaden
  grants or add a privileged SECURITY DEFINER bypass casually.
- The current source `staging/accepted-server.mjs` correctly fails
  closed until that verified session authority, RLS checks, revoked
  legacy function EXECUTE and a protected loopback/TLS host all work.

### Legacy vulnerability — still HIGH OPEN

`growth_starter.staging_list_workspaces(text)`,
`growth_starter.staging_list_requests(text,text,integer)` and
`growth_starter.staging_session_active(text,text,text)` remain owned
by `postgres` and use SECURITY DEFINER. They are not executable by
public/anon/authenticated but ARE effectively executable by the restricted
`growth_starter_reader`. The old direct-PG Node gateway has been sealed
in source since Phase 3.3B; **SQL grants have not been retired**, because
the owner directed that cutover occur only after real replacement acceptance.
Review-only `0007` and `0009` are UNAPPLIED. Do not restore or enable
the vulnerable path in any recovery procedure.

### Security verdicts at this handoff

| Area | Verdict |
|---|---|
| Live 3 RLS policy installation and exact SQL catalog | **PASS** (installation) |
| Least-privilege anonymous/write denial, static grants | **PASS** (catalog) |
| Source RLS tests and code | **PASS** (prior disposable CI) |
| Live JWT A/B/C tenant isolation | **BLOCKED** (no managed Auth user creation) |
| Trusted session checker role configuration | **PARTIAL** (NOLOGIN / cannot USAGE auth) |
| Immediate signed-out session denial | **BLOCKED** |
| External HTTPS hosted runtime | **BLOCKED** |
| Legacy actor-ID closure | **FAIL / HIGH OPEN** |
| Independent external reviewer acceptance | **BLOCKED** |
| Commercial pilot/production readiness | **BLOCKED** |

Do not report installed RLS as fully **hosted authenticated RLS acceptance**.
Asymmetric signed JWT origin, session revocation, genuine users and gateway
routing have NOT been proven.

### Completion measurement

Same seven-category engineering source-readiness weights:
core 20% = 64%; authentication 20% = 55%;
isolation/RLS 20% = 62%; agency workflows 10% = 44%;
SEO/reporting 15% = 78%; security QA 10% = 89%;
staging/pilot 5% = 22%.
**Weighted estimate: 62.3%**, compared to 61.3% before this phase.
This modest increase is based on installed and verified *hosted SQL*;
no progress credit for merely drafting plans. Approximately 37.7%
of weighted engineering readiness remains. Phase 3.3E process completion
estimated **~30%**: schema/grants stage applied and audited but real Auth,
trusted session, host, cutover, signoff and cleanup acceptance remain undone.
Five critical *fully accepted* hosted gates: **0/5** (RLS **installed** but
signed-user acceptance not complete). Not a commercial-launch score.

### Precise next actions by owner/operator

1. **Independent security approval:** Review the installed three RLS
   `pg_policies.qual` expressions, the minimal Auth-column grants,
   checker inability to USE `auth`, and a provider-supported alternative.
   Consider a reviewed unexposed, no-caller-actor privileged session
   introspection route *only if* direct managed Auth schema GRANT is unsupported;
   ensure it cannot repeat the old actor-ID impersonation issue.
2. **Auth user administration access:** Provide an authorized Supabase
   Dashboard Auth Users or provider-supported Admin API/Cloud Browser operator
   to create independent, fictional, email-confirmed A/B/member C and collect
   separately stored, genuinely issued JWT access tokens. A single SQL
   editor cannot safely impersonate this lifecycle.
3. **Existing zero-cost HTTPS host:** Provide a suitable isolated Node 22
   host with real TLS, protected secret entry and private PostgreSQL networking;
   neither the Business OS Vercel service nor UI demo should be repurposed.
   No paid infrastructure is authorized.
4. **Session checker:** Only after review and protected credentials, enable
   minimal LOGIN or reviewed alternative, prove signed-out session row
   rejection before JWT expiry, and verify no Auth data exposed to clients.
5. **Accepted gateway and tenant isolation:** Test actual signed A/B/C
   opposite-tenant denials, membership revocation, POST/UPDATE rejection,
   forged/expired bearer denial and provider outage fail-closed; record
   deployed exact SHA, HTTPS host and token-redacted evidence.
6. **Legacy cutover:** After replacement acceptance, run operator-approved
   transactional `0007` followed by `0009` and fresh restricted-role
   privilege proof; safe rollback is to disable gateway and revoke exposure,
   never regrant old actor routines for real clients.
7. **Cleanup:** Revoke synthetic sessions and remove only positively
   identified fixture records; verify owner scope, logs and tenant status.

### Safe maintenance-mode recovery

If a policy is unexpectedly exposed or identity proof fails, restrict the
PostgREST `growth_starter` exposed schema and REVOKE SELECT grants from
`authenticated` for the three tables in a controlled transaction, leaving
RLS enabled and all data intact. Do **not** remove RLS, set JWT GUCs directly
as an authentication substitute or reinstate privileged actor functions.
No destructive rollback or data cleanup was necessary during this phase.

### CI and exact SHA

Commands previously used for source:
`node --test tests/*.test.mjs`,
`TEST_DATABASE_URL=... node --test --test-concurrency=1 tests/postgres/*.test.mjs`,
and the four existing GitHub workflows. This handoff commit triggers a new
exact-HEAD CI run. Its SHA and four actual URLs/counts must be appended to PR #2
**after** completion; no result is asserted in advance.

**PR #2 is NOT merged.** No production, clinic data, SEO publishing, outbound
messages, other Codeedge repo writes, or background automations.
