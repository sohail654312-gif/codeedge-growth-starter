# Growth Starter security cutover runbook

**REVIEW_ONLY. No hosted change is authorized by this document.** Exact target:
`codeedge-growth-starter-staging` / `dbppeymhsemvghbvuvof`. PR #2 remains draft.

## Inspect and freeze the proposed change

1. Re-fetch branch/PR and obtain current source gate evidence. Record the exact
   candidate SHA, container digest, reviewed authority module hash and reviewer.
2. Read `db/reviews/phase315p_preflight_READ_ONLY.sql` and the earlier J catalog.
   Export migration IDs, columns/types/defaults, constraints, indexes, object owners,
   policies, table/column ACLs, function signatures/bodies/search paths and role edges.
   Record the actual Dashboard Data API exposed schemas and GraphQL configuration.
   A SQL editor's `pgrst.db_schemas` GUC is insufficient.
3. Compare the seven hosted migration IDs with `db/phase315p-manifest.json` and the
   sensitive-free baseline snapshot. Generate the atomic review bundle with
   `node scripts/phase315p-migration-bundle.mjs`. Its column/constraint assertion
   must reject drift; review defaults, indexes and policies separately as well.
   No automatic baseline repair or migration-history rewrite is provided.
4. Rehearse the generated bundle, fixed operations, lockdown and old J cutover in
   a fresh disposable PG17 environment. Export a recoverable prechange data/schema
   backup through the approved operator tool and prove restoration in isolation.
   Do not assume Free-plan PITR or verified backup recovery.

## Independent review and exact owner approval

Approval must identify the bundle and hashes; creation of the five K/M roles and
two P roles; explicit owner table/column/sequence grants; function EXECUTE; trigger
locking; private-schema isolation; removal of legacy function/role edges and browser
columns; credential delivery; controlled fictional accounts; HTTPS deployment and
rollback authority. Managed Auth permissions are a separate provider-approved action.

The P owner is NOLOGIN/NOBYPASSRLS and does not own tables. Its fixed DEFINER
functions operate under forced RLS with owner-role policies, qualified references
and `pg_catalog,pg_temp` search paths. Internal helpers are INVOKER and unavailable
to the writer/browser. The compromised server remains a trusted boundary: a stolen
valid Codeedge token and server writer credential are not protected against arbitrary
server-code compromise. Isolate issuer credentials and review secret access.

## Replacement then cutover

1. While private traffic is closed, an approved operator applies the reviewed
   atomic O -> K -> M -> P bundle **without reapplying 0001 over hosted records**.
   Baseline/assertion or existing-row constraint failure rolls back the transaction.
   Resolve differences in a separately reviewed migration, never by ignoring errors.
2. The bundle runs P postflight assertions before COMMIT. It creates NOLOGIN roles
   and no credentials. Only separately approved secret-managed role activation
   enables issuer, gateway and writer login. Run actual-login M and P catalog
   verifiers; a successful superuser query is not a replacement for this check.
3. Keep both `growth_starter` and `growth_starter_private` outside the exposed Data
   API/GraphQL schema surface. Verify authenticator cannot SET the private logins.
4. After the supported authority and fictional replacement tests pass, execute
   the reviewed J direct-API/legacy cutover and its assertions in one controlled
   operator transaction. Explicit column revokes are required; table REVOKE alone
   is insufficient. Retire old runtime -> reader SET ROLE and all three old actor
   argument function EXECUTEs. Inventory additional future/default grants first.
5. Re-run catalog assertions for PUBLIC, anon, authenticated, service_role, old
   reader/runtime, issuer/gateway/writer and function owners. Check views, materialized
   views, extensions, inherited roles and SECURITY DEFINERs, not just table RLS.

Never drop a legitimate service dependency without identifying its callers. The
source AppDeploy owner/demo route, old staging gateway, storage worker and private
writer are distinct integrations. Legacy services may need a maintenance window;
restoring insecure actor-argument entrypoints is not an acceptable recovery.

## Actual hosted acceptance

Use explicitly approved fictional A(owner clinic A), B(independent owner B),
C(staff A), with real email/PKCE flows and Supabase-signed tokens. Verify every
scenario in `INDEPENDENT-ACCEPTANCE-CHECKLIST.md`: cross-tenant writes/reads, current
role, revocation ordering/replay, expiry, callback replay, CSRF, cursor and receipt
tampering, media/consent, provider outages and actual logout/admin/password events.

Probe REST and GraphQL using signed-in and signed-out **unexpired** JWTs, direct
table and old/private function paths, forged actor/role claims, and revoked C.
Check denial after both Codeedge logout and provider events. Catalog checks alone
do not prove actual API exposure or provider event behavior. Any missing fact blocks.

## Deny-all recovery

Close private ingress first, stop external workers, run separately approved P and
M lockdown SQL, revoke EXECUTE/USAGE and disable logins, retire credentials, then
confirm existing pooled connections also fail. Preserve records and receipt/audit
history for investigation. Keep the old browser/function grants denied. Roll back
application/container code only to another accepted version or keep ingress closed.
Restoring a backup requires isolated validation and a fresh privilege cutover.

Source rollback is an ordinary non-force revert on the engineering branch. A
source revert does not undo hosted grants or migrations. No hosted rollback has
been executed or certified by this assignment.
