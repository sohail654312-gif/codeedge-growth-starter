# Phase 3.15K — Data API evidence and hosted private-session migration

## Scope and decision
**Review-only source, NOT a live Supabase change.** Target: existing \`codeedge-growth-starter-staging\` (ref \`dbppeymhsemvghbvuvof\`, PG 17.11), repo \`sohail654312-gif/codeedge-growth-starter\` draft PR #2. Preserve Business OS, MVP, production and real users. No upgrade, new Supabase project, Docker installation, or passwords in GitHub.

## What was verified on 2026-10-14
- Source: real \`growth_starter\` catalog. Seven RLS tables; current business tables are owned by \`postgres\`; policies are targeted at \`authenticated\`, and scoped through the workspace/membership RLS chain. Existing \`authenticated\` **column** SELECT grants remain on workspaces (3 columns), memberships (5) and work_requests (7). Legacy runtime can SET ROLE reader and three old privileged functions remain.
- No Edge Functions currently deployed.
- The **effective Data API exposed-schema setting was NOT verifiable** with the connected Supabase project/SQL tools. \`current_setting('pgrst.db_schemas',true) = NULL\` is inconclusive.
- TinyFish profile listing showed **no recorded Supabase login**; do not assume a saved browser session or pay metered automation to attempt login. User can read the setting at: https://supabase.com/dashboard/project/dbppeymhsemvghbvuvof/integrations/data_api/settings. Record the exact exposed schemas, Data API enabled/disabled status, and GraphQL availability from the authenticated Dashboard before any cutover.
- An independently verified dashboard screenshot or user-provided literal exposed schema list is needed to settle the exposure question.

## Prepared exact, staged, REVIEW ONLY SQL
- \`db/drafts/phase315k_private_sessions_REVIEW_ONLY.sql\`: new \`growth_starter_private\` schema, \`codeedge_sessions\` and \`fresh_login_flows\` tables (FORCE RLS; no browser grants); three NOLOGIN roles with no bypass RLS; separately owned fixed-purpose private read and revocation functions with explicit EXECUTE grants only to a NOLOGIN gateway role. Uses actual text schema field names and the existing Codeedge opaque credential digest. Does **not** grant a LOGIN, create external credentials, issue sessions or change old hosted permissions.
- \`db/drafts/phase315k_lockdown_REVIEW_ONLY.sql\`: fail-closed permission lockdown. Unlike a blind rollback it does NOT reactivate old privileged functions or authenticated REST columns.
- \`db/reviews/phase315k_private_schema_assertions_READ_ONLY.sql\`: verifies bounded role/function privileges without selecting session data.

## Dangerous assumptions not yet resolved
- **The reviewed migration is not safe for activation** merely because it deploys privately. Its \`gs315k_read_owner\` has SELECT access across workspace, member and request rows, with private function predicates enforcing per-user scope. An independent reviewer must verify function source, search path, permissions, direct call paths, malicious input and instrumentation logs. Per-function-owner \`FOR SELECT USING(true)\` is not per-user RLS.
- The issuer / fresh-login PKCE server requires an additional minimal privileged role and a reviewed one-time issuance mechanism. The private \`fresh_login_flows\` table is fail-closed with no policy; **the existing source-only session issuer is not wired to these new roles**.
- Transaction advisory locks on session and workspace/member rows are cooperative. Every writer (membership revocation, workspace suspension, session issuance) must use compatible lock keys. Preexisting unrelated writers are NOT proven compliant.
- No direct PostgREST / GraphQL bypass probe was executed because effective Data API settings and signed test-user tokens were unavailable. A valid unexpired original Supabase JWT may remain accepted by data APIs after Codeedge-specific logout unless old direct grants and exposed-schema routes are closed.
- Independent Supabase administrator/global logout is **not** automatically propagated into Codeedge-owned sessions; the security contract must be resolved explicitly.
- Server database TLS/pooler mode, secret delivery, backup/restore capacity, Free-plan quotas, callback redirect allowlist and HTTPS cookie/canonical hostname must be validated before any gateway provisioning. No hosted secret may be pasted into GitHub/chat.

## Required independent approval sequence
1. Confirm Dashboard exposed schemas and Data API/GraphQL state. Identify existing dependencies.
2. Independently review this exact SQL and hardened private function boundaries. Verify fully on disposable PG17, including rollback, permissions, fictional A/B/C and post-revocation denial.
3. Build and separately prove a restricted one-time fresh-login issuer (and membership/workspace writer consistency). Do not activate LOGIN merely to bypass a missing issuer.
4. Prepare an explicit, owner-approved change list naming each hosted migration, role/LOGIN change, gateway secrets, API exposure edit, legacy grant revoke, fictional test-account creation and host endpoint.
5. Apply a staging-only, transactional cutover with clean ACL backup and deny-all recovery. No automatic regrant of legacy actor-definer functions. Confirm real provider PKCE flow and negative REST/GraphQL tests after logout.
6. Independent security signoff, then separate production approval and PR merge.

## Gate status
- **Catalog: verified.**
- **Dashboard Data API exposure: unknown (requires authenticated Dashboard).**
- **Private migration: review-only.**
- **Tested disposable PG17: pending exact committed workflow.**
- **Hosted gateway and session issuance: deliberately disabled.**
- **Cost: source-only work within existing GitHub free limits, no extra service purchased.**

## References
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/secure-data
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
