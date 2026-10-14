# Phase 3.1 — authenticated PostgREST read boundary (SOURCE ONLY)

**Scope:** Existing draft PR #2, engineering/phase2-core-security. No merge or hosting.

## Implementation
- `backend/postgrest-read-boundary.mjs` is a new opt-in, provider-scoped adapter, **not enabled by any server or client**.
- It passes the user's **original** bearer token to the trusted Supabase Auth `/auth/v1/user` verification endpoint and Supabase PostgREST `/rest/v1` (not direct SQL).
- A mandatory server-injected `verifyCurrentSession` hook must independently re-check active session/revocation. **An always-true hook is unacceptable in any deployment**; no production implementation or credential is provided here.
- Workspaces, own memberships and workspace-bounded requests have explicitly limited read-only REST operations and defense-in-depth response checks. Caller-provided actor IDs or role hints are never used for authorization.
- No writes, secret keys, PostgreSQL GUC impersonation or use of `staging_list_workspaces(p_actor)` / `staging_list_requests(p_actor,...)`.
- New synthetic offline tests exercise token forwarding, missing session checks, rejected bearer, foreign workspace/request denial and malformed responses.

## Not complete
1. Supabase's current staging database has **zero RLS policies** and no API exposure configured for the private growth_starter schema. **Do not enable this adapter** until independently reviewed, narrowly granted, tested RLS policies are available and the exposed schema setting is explicitly approved.
2. The live legacy `SECURITY DEFINER` actor-substitution weakness remains **HIGH OPEN**. The review-only cutover is not applied. Existing `staging/server.mjs` STILL uses that legacy gateway and is **not safe for real clients**.
3. A production-ready trusted session-revocation hook, actual independent HTTPS staging users, direct-SQL attacker probes, hosted isolation, tests of service error behavior, Web Vitals and accessibility acceptance are still **BLOCKED**.
4. PostgreSQL/HTTP tests using mock actors and fabricated tokens do **not** prove hosted Supabase JWT validation or a two-user tenant boundary.

## Next acceptance
Owner-approve isolated secrets-backed staging, build *review-only* RLS/grant/session-check proposal compatible with live Auth tables, verify in disposable PostgreSQL, then get independent review. Activate nothing until the legacy functions are retired and real signed users are tested both ways with revocation and direct SQL probes.

**Source status:** partial engineering increment only; no production, clinic/patient data, deployment, OAuth, publishing, automations or changes to other repositories.
