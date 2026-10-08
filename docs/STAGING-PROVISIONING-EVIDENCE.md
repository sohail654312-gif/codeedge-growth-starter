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

## CRITICAL RLS review gate — not yet applied
Supabase's table listing flags **all seven tables with RLS disabled**, marked critical. Despite that warning, direct SQL privilege tests independently found `anon`/`authenticated` lack schema usage and table grants, and the project schema is private, so do **not** infer they currently have effective table access. Both layers matter.

**Default-deny RLS proposal (owner approval required before execution):**

```sql
BEGIN;
ALTER TABLE growth_starter.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.media_delete_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.audit_events ENABLE ROW LEVEL SECURITY;
COMMIT;
```

No broad `USING (true)` policies or grants should be added. After owner approval, verify `rolrowsecurity`, per-role read/write denials, privileged function behavior and audit functionality. A `SECURITY DEFINER` routine owned by a bypassing role can still bypass RLS; do not equate the above proposal with complete tenant security.

References: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

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
