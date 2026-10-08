# Phase 2.2 — Approved default-deny RLS rollout
**User approval:** 2026-10-08, apply only to isolated Growth Starter Supabase staging.
**Project:** `codeedge-growth-starter-staging` (`dbppeymhsemvghbvuvof`), `ap-south-1`.
**Migration:** `db/migrations/0003_staging_default_deny_rls.sql`.
- Enable PostgreSQL Row Level Security on the seven `growth_starter` base tables.
- Add **no** direct client-facing RLS policies or grants. These tables should remain private and empty; current roles `anon`, `authenticated` and `growth_starter_reader` still lack direct SELECT privileges.
- GitHub disposable CI tests RLS itself by temporarily granting a synthetic non-login role table privileges and verifying SELECT/DELETE cannot view or mutate rows, and INSERT is denied. Test-only grants must NOT be applied to hosted Supabase.
- `growth_starter.staging_list_workspaces` and `staging_list_requests` are `SECURITY DEFINER` and could execute with their owner's elevated privileges. Enabling RLS does **not** verify their caller's identity. Only the separately verified gateway may supply `p_actor`. A compromised gateway can still impersonate actors at this boundary.
- This change does NOT deploy a hosted runtime, generate credentials, create users, enable invitations or accept medical imagery.
- Independent acceptance remains mandatory; avoid treating RLS enabled as proof of full tenant isolation.
