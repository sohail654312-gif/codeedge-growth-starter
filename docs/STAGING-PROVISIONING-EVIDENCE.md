# Growth Starter — Isolated Hosted Staging Provisioning Evidence

**Date:** 2026-10-08
**User approval:** same Supabase organization as Codeedge, *new separate Growth Starter project*; provider cost quote $0/month at creation.
**Mode:** manual single writer, PR #2 remains DRAFT/unmerged, no production AppDeploy deployment.

## Newly provisioned Supabase staging

- Organization: `umjmhwywjzimrmgskimo` (user-approved).
- Project name: `codeedge-growth-starter-staging`.
- Project ID: `dbppeymhsemvghbvuvof`.
- Region: `ap-south-1` (Mumbai).
- State: `ACTIVE_HEALTHY`, PostgreSQL 17.
- This project is **not** the Codeedge Business OS or MVP database. No patient or live business information has been inserted.

## Applied schema — this project ONLY
From repository branch `engineering/phase2-core-security`, revision `5ddbedfb35b7fb6f7efa92c81536cdea399c8c6c`:

1. `db/migrations/0001_growth_starter.sql` applied as Supabase migration `20261008141834_growth_starter_initial_private_schema`.
2. `db/migrations/0002_staging_readonly.sql` applied as Supabase migration `20261008141846_growth_starter_restricted_staging_reader`.

### Independent database readback
- Seven `growth_starter` tables present, with no workspace records.
- Two private read functions present.
- `growth_starter_reader` exists as NOLOGIN / non-superuser / NOBYPASSRLS.
- `anon` and `authenticated` cannot USAGE the `growth_starter` schema, SELECT its workspace table or EXECUTE its staging list function.
- Reader role cannot SELECT base workspace table but can EXECUTE its specific approved list function.
- No client records, invitations or media seeded. Admin SQL readback returned zero workspaces, zero invitations and zero media.

## APPROVED RLS gate — APPLIED / independently inspected

On 2026-10-08, the owner explicitly approved default-deny RLS on this isolated Growth Starter staging project. The implementation at `db/migrations/0003_staging_default_deny_rls.sql` was applied to project `dbppeymhsemvghbvuvof` as Supabase migration `20261008143234_growth_starter_staging_default_deny_rls`.

**Hosted SQL readback:** 7/7 base tables have `relrowsecurity=true`, zero policies on all seven, zero records in each table, and `anon`/`authenticated` still lack private schema usage; `growth_starter_reader` still lacks direct table SELECT but retains EXECUTE on the deliberately restricted read routine. The earlier critical `RLS disabled` advisory is gone. Supabase now reports 7 informational `rls_enabled_no_policy` notices, **expected** for the default-deny private schema. No automatic public or authenticated grants were added.

**Application of RLS is not a hosted multi-user security sign-off.** `SECURITY DEFINER` routines may bypass RLS as their function owner and accept actor identity only from a verified server gateway. Non-owner, TLS-secured staging login and actual two-user IdP connectivity are still missing.

**Hosted role switch limitation:** a manual test `SET LOCAL ROLE growth_starter_reader` via the management SQL connection failed with PostgreSQL `42501` permission denied. Subsequent metadata query confirmed the SQL connection runs as `postgres` and `pg_has_role('postgres','growth_starter_reader','SET')` is false. This does *not* invalidate the RLS readback, but independently confirms that management SQL is NOT the restricted application runtime login. Do not claim the read gateway works in hosted staging based on `SET ROLE` synthetic CI alone. Configure and test a dedicated authorized non-owner LOGIN on an isolated staging service before pilot use.

[Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Default-deny migration](../db/migrations/0003_staging_default_deny_rls.sql).

## Still BLOCKED for hosted pilot
- No restricted **LOGIN** account password / SSL pool created for app server. Do not store connection URI in GitHub or browser.
- No deployed trusted IdP issuer/audience, signing-key rotation service or per-request session revocation connection.
- Gateway source exists but is not deployed against this hosted project.
- No hosted real two-user integration test, tenant write test, invitation delivery, approved media previews, antivirus, privacy acceptance, client signoff or performance benchmark.
- Existing AppDeploy Phase 1 and isolated QA sandbox remain unchanged.
- R1, R3, R4, R6 and R7 remain blocked; R2 now has an isolated healthy staging database/schema but still no real restricted application login or hosted sessions.

## Next smallest safe block
1. Obtain owner approval to apply default-deny RLS to this isolated, empty staging schema.
2. Build a secret-safe restricted non-owner runtime account and verify SSL database access **from a separate staging service**.
3. Bind a trusted verified-email IdP and online session revocation.
4. Execute actual hosted two-user reads + foreign-denial, and only then enable transactional client/agency actions.

Do not copy existing Codeedge user tables or production records into this project.
