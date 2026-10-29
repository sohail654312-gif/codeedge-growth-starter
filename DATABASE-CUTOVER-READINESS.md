# Growth Starter — Database Cutover Readiness (29 October 2026)

**Verdict:** Database HEALTHY, restricted cutover **NOT AUTHORIZED / NOT INSTALLED**. This is a read-only staging inspection and source-level security correction, not an applied migration.

## Exact live catalog (read-only connector)

- Supabase project `dbppeymhsemvghbvuvof`, PostgreSQL 17.11, `ACTIVE_HEALTHY`.
- **7** `growth_starter` base tables; RLS enabled on all, FORCE RLS on **0**.
- **3** SELECT policies, four tables default-denied (Security Advisor INFO notices; no broad policy should be added).
- `authenticated` has schema USAGE and **15** column-level SELECT grants.
- **3** historic `postgres`-owned `SECURITY DEFINER` functions remain; the reader has EXECUTE on them.
- Old runtime can SET the old reader role; effective privilege catalog reveals the runtime has **one granted role edge**.
- `growth_starter_private` absent, new `gs315m_issuer` / `gs315k_gateway` / `gs315p_writer` / `gs315p_ops_owner` roles absent.
- `growth_starter_session_checker` remains NOLOGIN without Auth schema USAGE.
- **7** old hosted migrations only; no O→K→M→P private sequence was applied.
- No observed leak is claimed. Actual Dashboard exposure, signed REST and GraphQL tests have NOT been performed.

## Engineering improvement — catalog snapshot version 2

Files: `db/reviews/phase315r_effective_privileges_READ_ONLY.sql`, `scripts/phase315r-cutover-evidence.mjs`, `tests/phase315r-cutover-evidence.test.mjs`.

Role checks now enforce for issuer, gateway, writer and operations owner:
- Exactly the prescribed LOGIN/NOLOGIN state.
- No SUPERUSER or BYPASSRLS.
- No INHERIT, CREATEROLE, CREATEDB or REPLICATION.
- No granted role memberships (to prevent implicit or SET-role escalation).

The historical unapproved session checker must remain inert. Invalid/missing role properties and older v1 snapshots fail closed. A new, **read-only** v2 catalog SQL query executed successfully on real staging; it detected the historical role membership and old grants.

**Meaning of source PASS:** only that evaluator logic works against synthetic fixtures. Even a catalog-consistent v2 JSON must produce `HOSTED_STAGING=BLOCKED` and `PRODUCTION=BLOCKED` until attested external gates pass.

## Rehearsal and owner-approval procedure

1. Re-fetch current engineering/PR head and SQL bundle `scripts/phase315p-migration-bundle.mjs`; verify exact hashes, version dependencies and baseline drift.
2. Perform a disposable PostgreSQL 17 rehearsal (same supported extension, role and schema assumptions). Validate default/index/constraint/generic privilege and policy compatibility.
3. Obtain a backup through an approved protected channel; independently prove restoration **off-host** using fictional/non-sensitive data. Retain rollback and deny-all recovery procedure.
4. Obtain written independent review of O→K→M→P and supplemental J/legacy cutover. Confirm the original-session authority and exact HTTPS host have been approved first.
5. After exact owner approval, apply the reviewed migrations to staging with private ingress **closed**, provision the three independent restricted runtime LOGIN identities and validate real effective privileges/function bodies with their actual connections.
6. Verify all positive and negative tenant/session/role tests against hosted staging. Confirm actual Data API exposed schemas via Dashboard; perform signed REST and GraphQL probes including post-logout stale JWT.
7. Only after replacement is accepted, retire authenticated direct column grants, obsolete SECURITY DEFINER entrypoints and role-switch edges. Do not revoke blindly; check dependencies first.
8. Independently verify backup recovery, incident access restriction and deny-all rollback; production release requires another separate owner approval.

Never give the browser privileged credentials, grant blanket `auth` schema USAGE, create an allow-all policy or automatically merge PRs.

## Remaining gating evidence

- Exact provider Auth and account-policy verification contract (separate approval).
- Host, canonical HTTPS origin, secrets and separate restricted runtime sessions.
- Reviewed SQL change set and operator approval.
- Live PostgreSQL role preflight, FORCE RLS, tenant A/B/C and fail/rollback test.
- Signed live REST/GraphQL bypass tests.
- Independent release audit and backup/restore acceptance.

Official Supabase API permission model: https://supabase.com/docs/guides/api/securing-your-api
