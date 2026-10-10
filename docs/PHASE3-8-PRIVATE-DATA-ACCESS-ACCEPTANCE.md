# CODEEDGE GROWTH STARTER — PHASE 3.8 PRIVATE DATA ACCESS ACCEPTANCE

**Mode:** source-only, manual single writer, isolated fictional tests. Existing PR #2 remains **DRAFT**; branch \`engineering/phase2-core-security\`. **Starting exact HEAD:** \`dc35ad04c22229b1e4187f552141758c83fd3637\`.

## A. Baseline
Starting four GitHub Action runs, all completed successfully against that exact SHA:
- Core safety: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38076748567
- Disposable PG security: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38076748587
- Offline SEO/UI: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38076748588
- Staging supply-chain: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38076748621

All three existing repository skills remain installed: \`ai-seo\`, \`supabase\`, and \`supabase-postgres-best-practices\`. The latter two and the pinned permissions/RLS references were read; none changed. Retain Phase 3.5–3.7 findings and hardened PG17 snapshot.

## B. Provider current-session authority — BLOCKED
Official provider sources: https://supabase.com/docs/guides/auth/sessions ; https://supabase.com/docs/guides/auth/signout ; https://supabase.com/docs/guides/auth/jwts ; https://supabase.com/docs/guides/api/securing-your-api . A validated signature or \`/auth/v1/user\` identity does not prove the original JWT's \`session_id\` remains in \`auth.sessions\`. The provider explicitly recommends checking the session table for immediate sign-out rejection; tokens can remain cryptographically valid until expiry. A currently supported and least-privilege way to perform that check in this project is **not accepted**.

A (minimal auth.sessions lookup): conditional design only. Checker cannot LOGIN and lacks effective managed \`auth\` schema USAGE; do not grant broad access. B (private Auth service): no verified supported revocation endpoint beyond the blocked table; service alone adds no evidence. C (alternate app-managed sessions): would need proven exact provider sign-out synchronisation and immediate user/session revocation plus tenant isolation; not equivalent by assertion. **No candidate meets the non-negotiable security requirement.** Escalate provider capability/permission question for a supported least-privilege session lookup; separate owner review if unavailable, without weakening revocation.

## C. Engineering completed (source, not hosted)
- \`backend/private-read-adapter.mjs\`: fixed parameterised read-only SQL against exactly \`growth_starter.workspaces\`, \`memberships\`, \`work_requests\`, with active owner/member restrictions on queries, bounded maximum 25 workspaces, maximum 50 request records/page and offset 950; projection/row-shape checks; per-operation verified identity and exact current-session proof in injected fictional authority; no actor-ID input, dynamic table/column names, PostgREST, role switch or old SECURITY DEFINER fallbacks.
- \`tests/phase38-private-read-adapter.test.mjs\`: independent fictional A/B/C tests of allowed/denied, revocation, unavailable providers, injection, grants, rows and direct-API architectural conflict.
- The contract requires \`fictionalTestOnly: true\`; \`createHostedPrivateReadAdapter\` always fails closed. Existing \`staging/accepted-server.mjs\` is NOT rewired or deployed.

**Important:** The private SQL WHERE clauses are app-layer safeguards, not proof of PostgreSQL tenant-level RLS. A shared DB login without authenticated per-user RLS identity could query data beyond a tenant if compromised; existing \`auth.uid()\` policies cannot be assumed valid for this login. **Do not enable a real connection or create LOGIN.** Required DB acceptance is an independent provider-vetted, tenant-isolated SQL privilege/RLS security model with disposable adversarial tests and a fresh exact PG17 policy snapshot. No authenticated user GUC or service-role shortcut is acceptable.

## D. Direct Data API exposure
Current PostgREST path requires \`/rest/v1/workspaces\`, \`/rest/v1/memberships\`, \`/rest/v1/work_requests\` and \`accept-profile: growth_starter\`. This cannot coexist with the unguarded direct JWT replay route under immediate-revocation requirements. **Supabase Exposed Schemas UI configuration: UNVERIFIED**; \`current_setting('pgrst.db_schemas', true)\` returned NULL, which does not prove schema inaccessible. The new SQL contract does not require Data API exposure; no live bypass probe occurred.

## E. Read-only hosted inspection (2026-10-10)
Isolated project \`dbppeymhsemvghbvuvof\` (\`codeedge-growth-starter-staging\`) ACTIVE_HEALTHY, PG 17.11, ap-south-1; Edge Functions 0. Checker \`auth\` USAGE FALSE, LOGIN FALSE; runtime can SET ROLE legacy reader TRUE. Previous three legacy SECURITY DEFINER EXECUTE rights remain HIGH/OPEN, verified by Phase 3.7 and preserved in Phase 3.5 tests. No hosted SQL mutations, credentials, users, deployment or paid resources created.

## F. Legacy cutover and rollback
Keep reviewed 0007/0009 drafts and Phase 3.5 disposable PostgreSQL transaction-wrapped cutover and rollback tests; do not apply. Assertions must reject all three legacy EXECUTE paths and \`growth_starter_runtime\` SET ROLE \`growth_starter_reader\`. PG16 disposable tests do not establish hosted PG17 acceptance. A failed fictional adapter can be removed by reverting its source commit without enabling unsafe production access.

## G. Hosted prerequisites / separate owner decisions
1. Provider-confirmed least-privilege live-session check: approved method/permissions binding \`session_id\` to verified original \`user_id\`, with sign-out replay proof.
2. Independently accepted private DB role with *database-layer* tenant security (not client-set GUCs), narrow column grants, no BYPASSRLS, no old EXECUTE paths, no role-switch; validate on disposable PG17 before approved hosted cutover.
3. Owner approval for isolated HTTPS reverse proxy + server-only Node 22 host, server-only minimal credentials, protected DB networking, outbound Auth connectivity, logging redaction, fictional A/B/C users and revoke/sign-out tests, maintenance switch and rollback. Existing free isolated resources first, no Docker, paid infra or Business OS.
4. Authorized read-only provider Data API configuration readback and explicit replay probe with fictional signed-out unexpired bearer.

## H. Acceptance accounting / follow-up
**Completed engineering**: isolated SQL contract and source tests, subject to actual exact-commit CI verification. **Hosted security**: 0 new controls accepted. **Unresolved**: provider current-session authority, independent DB tenant enforcement, live Exposed Schemas evidence, privileged legacy cutover, host and real A/B/C acceptance. Do not increase overall deployment readiness for documentation or mocks.

**Final commit and CI**: verify from https://github.com/sohail654312-gif/codeedge-growth-starter/pull/2/commits and https://github.com/sohail654312-gif/codeedge-growth-starter/actions?query=branch%3Aengineering%2Fphase2-core-security . A commit cannot embed its own SHA or final CI outcome; they must be independently appended to the external Phase 3.8 execution report. If any workflow is absent/pending/failing, treat acceptance as pending.

**Narrow Phase 3.9**: a single provider/owner session-introspection permission decision; **only if supported**, independently design restricted DB-RLS-backed access before any hosted activation. No further identical feasibility audit.
