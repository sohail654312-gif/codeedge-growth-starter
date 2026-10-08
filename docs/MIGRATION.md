# Non-destructive Phase 1 → Phase 2 workspace bridge

**State:** Designed and mock-tested in the review branch; NO hosted data moved.

## Existing source of truth
Phase 1 stores profile/enquiry/request/asset records in `gs_<kind>_<signed-in-appdeploy-userId>`, e.g. `gs_enquiries_<ownerId>`. Existing record IDs are database-generated.

## Phase 2 staged change
- Derive `workspaceId = ws_<authenticatedOwnerId>` only on the server.
- By default, authenticated owners read/write the **exact legacy table keys**, without an import, mass rewrite, data wipe or mutable migration marker. All existing data persists at its original IDs.
- Requests specifying a different workspace ID must carry an exact active server-controlled membership in `gs_memberships_<authenticatedMemberId>`. Unknown/duplicated/inactive grants are denied. This branch has no client-accessible grant creation API.
- Individual record IDs are used only *after* authorization chooses the correct owner's table.
- Clients and staff currently cannot be onboarded via public API, by design.

## Before real agency membership can be enabled
1. Choose a persistence adapter with atomic invitation claim, unique active membership enforcement, membership revocation and audit events (PostgreSQL + RLS is a candidate; provider-neutral interface required).
2. Verify verified-email binding and invitation recipient identity through the configured auth provider. Reject token/email mismatches and expired/replayed invitations.
3. Implement owner-created agency/client workspaces and tenant-scoped team membership. Do not rely on user-controllable role or owner IDs.
4. Add idempotent migration tooling only if a new physical tenant key schema is later required. Copy in bounded pages with checkpoint + record-ID map, double-read verification, rollback and no deleting original keys until sign-off.
5. Test denied cross-workspace reads/writes/upload/deletes with two real users and distinct storage prefixes.

## Rollback
No data move = revert branch/deployment without schema restoration. Do not merge while unsupported SDK behavior is unresolved.

## Phase 2.1 rollback assurance
New PostgreSQL tables are provisioned **only in disposable GitHub Actions**, not in any connected Codeedge Supabase project. The running Phase 1 AppDeploy owner tables were never migrated or edited. Database transaction rollback of request state/audit was tested with real PostgreSQL; no production deployment rollback rehearsal was performed. See [review handoff](PHASE2-1-REVIEW-HANDOFF.md).
