# Phase 3.15J — Hosted integration readiness and security cutover review

## Scope and decision
**Prepared for review; NOT approved for hosted execution or fictional account creation.**
Repository: sohail654312-gif/codeedge-growth-starter, branch engineering/phase2-core-security, draft PR #2.
Only existing Supabase staging project: codeedge-growth-starter-staging / dbppeymhsemvghbvuvof, PostgreSQL 17.11, Free plan. No Business OS, MVP, production, or other code repositories.

## Live read-only catalog (October 14, 2026)
Seven RLS-enabled Growth Starter tables, three SELECT policies. Authenticated role has schema USAGE and column SELECT permissions on:
- workspaces: id, owner_user_id, state;
- memberships: workspace_id, user_id, owner_user_id, role, state;
- work_requests: id, workspace_id, title, kind, status, version, updated_at.

The work_requests policy's predicate checks auth.uid() is not null and workspace active through a subquery to workspaces; the workspace RLS policy checks owner/active membership. This policy chain may enforce **tenant visibility** when invoked in genuine signed PostgREST context (earlier disposable RLS tests demonstrated such isolation). But direct Data API access, if Growth Starter is exposed, **does not check Codeedge's separate session revocation**. An old unexpired Supabase JWT can therefore potentially bypass a Codeedge-only logout. No confirmed cross-tenant leak or confirmed REST exposure is claimed; verify the effective Dashboard setting and signed negative probes.

The old restricted runtime can SET ROLE growth_starter_reader, which can execute three postgres-owned SECURITY DEFINER routines accepting caller-supplied actors; this path must retire after replacement passes. The existing no-login managed Auth checker remains blocked and is not needed for the fallback.

## Four source-only cutover artifacts
1. db/reviews/phase315j_hosted_catalog_READ_ONLY.sql — complete sensitive-free preflight, includes RLS predicates and direct SELECT grant evidence.
2. db/drafts/phase315j_direct_api_legacy_cutover_REVIEW_ONLY.sql — proposed explicit **column** revocations, schema USAGE revocation, legacy function EXECUTE revocation and runtime -> reader membership removal. **NEVER run against hosted before a passing replacement and separate signoff.** 
3. db/drafts/phase315j_cutover_assertions_REVIEW_ONLY.sql — assert postcutover permissions in an *uncommitted* operator transaction; SQL alone cannot validate Data API config.
4. backend/phase315j-cutover-readiness.mjs + tests/phase315j-cutover-readiness.test.mjs — fail-closed diagnostic; even zero catalog blockers cannot authorize deployment.

## Exact execution gates for future approved fictional staging trial
- **G0 backup**: export prechange migration/version, ACL snapshots (including column grants and role memberships), RLS policy predicates, function source/owners and exact Dashboard exposed-schema settings. Prove restoration in isolated PG17. No claim of Supabase Free PITR.
- **G1 replace**: independently audit the Phase 3.15I private DB function pattern, including NOLOGIN owners, fixed search paths, no unintended PUBLIC EXECUTE or host exposure, locked session issuance path, membership/workspace mutation synchronization and secret nonlogging. Adapt fixture as a *new separately reviewed* hosted schema migration, not by running a CI test fixture.
- **G2 provider**: implement real Supabase-supported PKCE initiation and single-use code exchange at a trusted HTTPS callback; confirm provider user binding, cookies/CSRF, callback allowlist and no refresh tokens in browser output. Current HTTP adapter is source-only, not a working hosted endpoint.
- **G3 owner scope**: obtain explicit approval naming proposed role creation, grant/revokes, private schema, exposed-schema setting, gateway deploy, secret delivery and at most three controlled fictional accounts A(owner), B(owner), C(staff member of A).
- **G4 activate privately**: switch signed traffic to the tested gateway; cut off old actor-argument SQL paths only after replacement proves A/B/C, then revoke direct authenticated columns and schema USAGE in the same reviewed cutover window. Use SQL catalog assertions before COMMIT.
- **G5 verify**: perform actual signed JWT negative REST and GraphQL tests, including post-Codeedge-logout bearer, cross-tenant attempt, C membership revoke, A session replay, private function EXECUTE attempts, admin revocation checks, outages and rollback. Any failure => immediately close private ingress and retain deny-all grants, never restore the unsafe old role-switch/functions by default.
- **G6 release**: record independent security signoff, owner acceptance, Free-plan resource/connection budget, and reversible operating instructions. PR #2 remains DRAFT; never auto-merge or onboard real clients from a passing isolated CI.

## IMPORTANT rollback distinction
Disposable CI uses BEGIN/SAVEPOINT and ROLLBACK to prove the *old state is mechanically recoverable*. After a real hosted security cutover, reverting access grants to known-unsafe values is **not** an acceptable default recovery strategy. Application rollback should disable new ingress, revoke fictional sessions and retain deny-all old entrypoints. Never paste secrets into chat/GitHub logs.

## Independent Supabase revocation
The fallback explicitly guarantees revocation only by Codeedge-controlled logout/admin action. Supabase global logout, admin revocation or password-reset event may not instantly synchronize into Codeedge sessions. Do not claim parity. The owner must decide whether this narrower contract is acceptable for staging, or whether a provider-synchronized revocation mechanism is mandatory.

## Official docs
https://supabase.com/docs/guides/auth/sessions/pkce-flow
https://supabase.com/docs/guides/api/securing-your-api
https://supabase.com/docs/guides/database/functions
https://supabase.com/docs/guides/database/postgres/row-level-security
