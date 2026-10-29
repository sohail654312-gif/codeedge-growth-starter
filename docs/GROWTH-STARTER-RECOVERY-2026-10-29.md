# Growth Starter recovery review — 29 October 2026

Status: **recovery initiated; staging/production NOT accepted**. This is a review
artifact on an isolated branch, not a live cutover or authorization to run DDL.
Its evidence supersedes the earlier *availability* observation only; do not
replace the security and release gates in
`docs/FINAL-CODEX-TO-CHATGPT-HANDOFF.md`.

## Confirmed findings

1. **Staging availability.** Supabase project
   `codeedge-growth-starter-staging` (`dbppeymhsemvghbvuvof`) returned
   `INACTIVE` on 2026-10-29. The existing project was successfully sent a
   `restore_project` request (provider response: `success: true`).
   Subsequent project reads returned `COMING_UP`. A first read-only SQL attempt
   failed with `Database is possibly not accessible at the moment`.
   This is **not** proof of a usable database or a completed restoration.

2. **Provider Auth authority.** The exact original Supabase
   `(user_id, session_id)`/current-account-and-policy verification contract is
   unconfirmed. The current project custom checker historically lacks
   `USAGE` on the managed `auth` schema. Official documentation says JWTs
   can remain usable after logout and a session-row check has more limited
   guarantees. There is **no approval to weaken or bypass**
   `checkProviderSession`, use `getUser()` alone, grant superuser access,
   or alter managed `auth` objects. The latest matching connected support
   email check showed automated replies, not a technical answer to
   `SU-502526`/`SU-503988`.

3. **Hosted privilege/Data API gap.** The Oct 14 handoff showed older
   authenticated column SELECT grants, three legacy postgres-owned
   SECURITY DEFINER functions and a role-setting edge. The new private schema,
   actual login roles, signed REST/GraphQL denial probes and live hosted
   acceptance were NOT installed or verified. Do not claim a leak: this is an
   unresolved exposure/cutover review. October 30, 2026 is also Supabase's
   scheduled new-table Data API grant default change; audit explicit grants
   but do not add public grants to repair access.

4. **Delivery and provider integration.** PR #2 remains open, draft, unmerged.
   The last documented clean exact-SHA workflows passed; source evidence is
   **not** deployed HTTPS provider evidence. A working host/ingress, protected
   callbacks, real account acceptance, media/storage, invitation email,
   backup/restore, monitoring and production approval are not established.

## Safe recovery sequence (current Supabase first)

**A. Prove actual availability without changing data.**

- Require project state `ACTIVE_HEALTHY` (or independently documented
  equivalent). `COMING_UP`, `INACTIVE` and a successful restore request
  are not sufficient.
- Execute one minimal read-only SQL check: `select 1 as healthy;`.
- Re-run and review `db/reviews/phase315j_hosted_catalog_READ_ONLY.sql`
  and `db/reviews/phase315p_preflight_READ_ONLY.sql` on the current hosted
  project. Compare against *current* code and migration hashes, not Oct 14
  numbers. Inspect Data API exposed-schema settings separately in Dashboard;
  a database GUC alone does not prove external exposure.
- Do not run any migration, write synthetic users, change grants, add roles,
  rotate credentials, deploy or merge as part of these read-only checks.
- Supabase Free projects can pause after prolonged low activity; a one-off
  restore does not provide an always-on SLA. Establish an explicit availability
  expectation and backup/recovery plan.

**B. Resolve the identity contract, not by removing checks.**

- Request a **specific documented least-privilege** Supabase method to check
  current original session, user deleted/banned state and configured session
  policy immediately before every sensitive request, including logout and
  admin events; independently verify the actual semantics.
- If the provider confirms this contract and the owner accepts the change,
  inject and review the hashed authority implementation already required by
  the server bootstrap. Run live signed positive/negative tests with separately
  approved fictional accounts; never infer acceptance from mocks.
- If managed Auth cannot support the contract, select an explicitly reviewed
  **own-session identity adapter** with direct database-backed revocation,
  current tenant/membership checks, short expiry and no session-cookie cache
  on sensitive operations. **This changes the security contract** and needs a
  separate owner decision, threat-model review, staged migration and re-login.
  It is not an auto-fallback to return HTTP 200.

**C. Retire legacy access safely.**

- Make a recoverable pre-change backup and test restore in a disposable
  environment. Confirm live schema/default/index/policy drift. Rehearse the
  versioned O -> K -> M -> P private-schema bundle and restricted database
  logins outside hosted staging first.
- After reviewed approval and with private traffic closed, apply exactly the
  accepted transaction to hosted staging; verify actual database-login
  permissions, FORCE RLS, denial to another tenant and successful own-tenant
  workflows. Never replace an existing database or reset migrations.
- Only after replacement is proven, revoke the known legacy column grants,
  obsolete SECURITY DEFINER entrypoints and reader role edge. Perform signed
  Data API and GraphQL bypass probes and test user revocation/replay.
  Preserve deny-all rollback; do not restore unsafe grants after a failure.

**D. Hosted acceptance, then production decision.**

- Use a reviewed modern TLS host with protected HTTPS origin and secret
  injection. Run real PKCE/owner/staff/client onboarding, authorization,
  tenant separation, logout, provider outage, backup and recovery tests.
- Re-fetch the exact current PR head and require the four corresponding
  GitHub push workflows; regenerate the release-readiness artifact at that SHA.
  Staging approval is separate from production release and any paid spend.
- Keep other Codeedge products and the existing AppDeploy demo untouched.

## Fallback ladder — in this order

1. **Preferred:** Resume existing Supabase PostgreSQL and resolve its supported
   Auth authority; no new project, no new monthly commitment.
2. **Auth-only replacement:** Preserve application tables, provider-neutral
   application services and SQL; replace the unconfirmed managed Auth dependency
   with a separately accepted database-backed server session provider (evaluate
   Better Auth, but require adapter integration, explicit data and identity
   migration, no stale session caching and negative revocation tests).
   Database may remain on the existing Supabase project at this stage.
3. **Full provider migration only if necessary:** Export schema/data through a
   controlled validated route, preserve IDs/audit history, deploy PostgreSQL
   on a separately approved managed host or VM, migrate identity, keep the same
   provider-neutral interfaces, perform parallel isolated read/denial tests and
   rollback rehearsal, then cut over one documented hostname. Verify cost,
   durability, backups, access, RLS and availability before selection.
   No free hosting option is assumed to provide guaranteed always-on service.

## Do not confuse these verdicts

- **Supabase restore requested:** confirmed, provider returned success.
- **Supabase database healthy / read-only query succeeded:** not yet confirmed
  at the time this review was written.
- **Growth Starter source:** previous exact-SHA passing test evidence; recheck
  before using current source.
- **Hosted secure authentication and tenant acceptance:** blocked.
- **Production:** blocked. No data, existing demo, production system, billed
  resource, grants, Auth users or live service changed by this review.

## References

- [Growth Starter draft PR #2](https://github.com/sohail654312-gif/codeedge-growth-starter/pull/2)
- [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase session guarantees](https://supabase.com/docs/guides/auth/sessions)
- [Supabase sign-out semantics](https://supabase.com/docs/guides/auth/signout)
- [October 30 Data API change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
