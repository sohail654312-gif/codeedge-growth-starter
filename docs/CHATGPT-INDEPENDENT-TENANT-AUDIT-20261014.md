# Independent Tenant Isolation & Database Permission Audit — 2026-10-14

**Scope:** Growth Starter isolated Supabase staging `dbppeymhsemvghbvuvof` and a fixed source snapshot from Growth Starter PR #2 (`8084d35a59f7503bcb51d3faa90489a92e3212e4`).

**Verdict:** **BLOCKED FOR LIVE ACTIVATION**. No confirmed public or cross-client data exposure was established by this catalog-only audit. An existing dashboard readback reported that `growth_starter` was not among the exposed Data API schemas; this particular audit did not independently read the authenticated Dashboard or perform signed REST/GraphQL probes.

## Direct live catalog observations (READ ONLY)

On 2026-10-14, the scoped `db/reviews/chatgpt_tenant_boundary_READ_ONLY.sql` query was executed against the **existing** staging database. It returned metadata only; there were no Auth session queries, client records, credentials, role changes or SQL writes.

| Boundary | Live finding | Interpretation |
|---|---|---|
| Project | `codeedge-growth-starter-staging` healthy, PostgreSQL 17.11 | Database is available, not proof of accepted security |
| Application tables | Exactly 7, all with `relrowsecurity=true` | Baseline RLS coverage exists |
| FORCE RLS | 0 / 7 `relforcerowsecurity=true` | Table owners/owner-executed privileged functions require separate audit; FORCE RLS is not an automatic change recommendation |
| SELECT policies | 3 for `authenticated`, on workspaces, memberships, work_requests | Owner/active-member policy chain inspected; no signed multiuser test here |
| Other 4 tables | No SELECT policy | Default RLS denial for ordinary authenticated calls; no claim against privileged bypass |
| `authenticated` | Growth Starter schema USAGE=true; 15 column-level SELECT grants remain | Critical prerequisite to review/revoke in a properly staged, validated cutover; existing unexposed API configuration reduces immediate direct API risk |
| `anon` | Schema USAGE=false, 0 SELECT column grants | No ordinary direct schema/column path observed |
| `service_role` | Schema USAGE=false, 0 SELECT column grants | Scoped Growth Starter catalog observation only; service-role credentials remain sensitive |
| PUBLIC functions | 0 PUBLIC EXECUTE grants in `growth_starter` | No direct PUBLIC EXECUTE path observed |
| Legacy functions | 3 `postgres`-owned `SECURITY DEFINER` functions; reader EXECUTE=true for all | Retain release blocker while old actor-argument entrypoints exist |
| Legacy role switch | `growth_starter_runtime` can SET `growth_starter_reader` | Must be retired only with accepted replacement and deny-all recovery |
| New `growth_starter_private` | Absent | Reviewed private sessions/schema SQL is not hosted |
| Hosted A/B/C | Not executed by this audit | Strictly required for actual tenant-read and revocation acceptance |

The observed policy names are `gs32_membership_self_read`, `gs32_active_workspace_requests_read` and `gs32_active_workspace_read`. The second obtains workspace eligibility indirectly through the `workspaces` RLS chain. A policy name, predicate and RLS flag cannot by themselves prove actual signed session isolation, especially when browser JWTs and Codeedge's private session-revocation contract differ.

## Severity-ranked release findings

1. **Critical conditional exposure / release blocker:** 15 `authenticated` column grants plus schema USAGE remain, even though the Growth Starter API schema was reported unexposed. If API exposure or routing changes, a still-valid Supabase JWT could reach policy-mediated data independently of Codeedge-only cookie logout. **This is not evidence that such a route is presently exposed or that tenant data has leaked.**
2. **Critical privilege-path design blocker:** Three older `postgres`-owned definer routines remain reader-executable and runtime can SET the reader role. They accept legacy actor arguments; preserve default denial and retire only after the independently verified private replacement and owner-approved cutover.
3. **High review requirement:** All seven tables currently lack FORCE RLS. Owner and privileged function behavior must be audited, with explicit decision about intended owner bypass and safe replacement. Turning on FORCE RLS blindly may break existing routines and is prohibited by this task.
4. **High hosted acceptance gap:** No private schema/issuer/gateway has been activated; real signed fictional A/B/C isolation, session expiry, revocation, direct REST/GraphQL denial and recovery remain unproven.
5. **Positive baseline:** `anon` / `service_role` lack direct Growth Starter schema/column privileges, and PUBLIC lacks EXECUTE on its functions in the inspected catalog. No evidence in this metadata query shows an ordinary anonymous direct read path.

## Independent artifacts created

- `db/reviews/chatgpt_tenant_boundary_READ_ONLY.sql`: metadata-only catalog query, safe for controlled manual readback; excludes protected data and does not prove Dashboard configuration.
- `backend/independent-tenant-audit.mjs`: pure fail-closed catalog evaluator with **no ability to deploy or certify security**.
- `tests/chatgpt-tenant-boundary.test.mjs`: synthetic negative tests for RLS/role drift, extra or missing tables/policies, anonymous/service-role privileges, function grants, forged approval evidence and incomplete snapshots.
- `.github/workflows/chatgpt-tenant-audit.yml`: isolated QA branch CI (targeted tests plus existing Node source regression suite), with no Supabase credentials.

**Test limitation:** Automated CI tests use fictional catalog snapshots. The live SQL query used the connected read-only Supabase interface separately. Neither step creates original Supabase Auth sessions or exercises signed hosted HTTP identity.

## Required follow-up before any hosted changes

- Independently audit exact privileged function source, effective database role/column grants, policy owner behavior and migration semantics; review private session replacement against Supabase's supported Auth contract.
- Verify effective Data API exposed schemas in the authenticated Dashboard and capture real signed negative REST/GraphQL evidence with explicitly approved fictional identities.
- Record precise recovery metadata, safe fallback and secret handling, and test disposable PostgreSQL rollback before requesting authorization for individual hosted DDL/grant/revoke steps.
- Select and approve exact isolated HTTPS host and hostname; no new host was invented or used.
- Obtain explicit owner approval for each sensitive staging change; never weaken RLS, restore legacy bypass by default, merge PR #2 or alter production.

**Coordination:** Codex owns `engineering/phase2-core-security`; this branch is independent and remains review-only. Prior independent CSV QA PR #3 is also untouched. No other Codeedge repository or production deployment was modified.
