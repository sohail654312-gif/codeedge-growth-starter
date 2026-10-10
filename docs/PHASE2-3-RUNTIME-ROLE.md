# Phase 2.3 — Prepared restricted role (no network credentials)

This block intentionally prepares **growth_starter_runtime** as `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` and no direct `growth_starter` table/sequence privileges. The role is granted **SET TRUE, INHERIT FALSE, ADMIN FALSE** membership in the existing `growth_starter_reader` group.

Why: The Supabase management role `postgres` currently has ADMIN membership but `SET FALSE`, which explains the 42501 when `SET ROLE growth_starter_reader` was attempted from the management SQL session. **Do not** add `SET TRUE` to `postgres` to work around that. A separate least-privilege application principal is required.

This migration is safe to apply to a new, isolated and empty Growth Starter staging project, but **does not enable a hosted database connection**. The eventual principal may be changed to LOGIN **only after** the developer provides or rotates a strong unique secret into a protected backend-only secret manager, with TLS verification, host restrictions and runtime login verification. Do not generate any persistent password in GitHub or log one in any connector call.

Validation:
- `pg_roles` NOLOGIN/NOINHERIT/non-admin flags.
- `pg_has_role('growth_starter_runtime','growth_starter_reader','SET')` true.
- `pg_has_role('growth_starter_runtime','growth_starter_reader','USAGE')` false.
- No direct base-table grants or usable schema permissions for `growth_starter_runtime`.
- Existing `postgres` SET option remains false.
- 7/7 RLS enabled and zero direct policies.

**Pilot gate remains BLOCKED:** no restricted LOGIN, secret-safe staging server, verified email IdP, live revocation, two independent authenticated hosted accounts, write approval/service gateway or consent-scanned media. This block does not change AppDeploy production or PR merge state.
