# Phase 3.15O engineering delivery

Starting revision: `8084d35a59f7503bcb51d3faa90489a92e3212e4`.
Branch: `engineering/phase2-core-security`. PR #2 remains draft and unmerged.
Only Growth Starter source was changed. No hosted migration, permission change,
account creation, publishing, deployment, paid infrastructure or external message
was performed. Supabase migration history remains the inspected seven-migration
baseline. Hosting provider and exact hostname remain pending.

## Implemented package

| Workstream | Concrete changes | Acceptance boundary |
|---|---|---|
| Authentication | Bounded fetch/body reads, 32 KiB response cap, generic eligible/account-denied initiation, redacted transport errors, exact-session fail-closed wrapper with strict flags/expiry/clock | Synthetic provider tests; supported live authority remains unavailable |
| Tenant/database | Live transactional role checks, revoked replay denial, owner-pair FK, exact media outbox FK, forced default-deny RLS for new tables, version/CAS/receipt rollback, bounded database statements | Real disposable PostgreSQL 17, not hosted Supabase |
| Client/agency | Versioned onboarding, idempotent requests, owner/agency assignment, client corrections and notes, scoped detail, signed/filter-bound keyset pagination, restricted audit history, disabled-by-default API wiring | Source service and disposable integration; hosted writer not activated |
| Media | Transactional lookup/consent checks, reauthorized delete enqueue, stale-lease fencing, bounded manual storage worker | SQL and synthetic storage tests; no live storage deletion |
| Growth intelligence | Schema drafts/subset validation/safe serialization, confirmed FAQ boundary, UTC proposed calendar, duplicate supplied-extract detection, prioritized tasks, new studio tabs | Deterministic offline evidence, no live search/ranking/AI/provider claims |
| Automation | Five disconnected provider contracts, validated triggers/conditions, dry runs, owner approvals, persistent local logs/receipts, timeouts/retries/concurrency, owner recovery, real PG authorizer composition | Sandbox only; no live mode or scheduler |
| Reliability/UI | Eight-card loaded queue, search/status/sort/pagination, correction errors, role controls, stronger contrast/focus, database deadlines and bounded idempotent shutdown | Typecheck, actual loopback HTTP and isolated Chromium mobile/desktop/axe |

See [operations contract](PHASE3-15O-OPERATIONS-CONTRACT.md) and
[offline/sandbox boundaries](PHASE3-15O-OFFLINE-AND-SANDBOX.md) for exact semantics.

## Corrected security defects

Transactional request transitions previously trusted a supplied workspace role. They
now derive the actor's active role under workspace/membership locks. Shared SDK reads
and writes cannot be enabled by an earlier membership proof because that does not
protect the subsequent SDK operation from revocation. New shared operations use
transactional reauthorization. Media reads/deletion queueing had similar separated
authorization gaps; these now check live scope in their database transaction.

Provider bodies could allocate unbounded text before checking size, and an injected
fetch/body reader could hang or leak an arbitrary error. Reads now have streaming
size/deadline boundaries and generic errors. Account-specific expected email denials
no longer expose a distinct response. Exact-session lookups require explicit valid
facts and reject invalid clocks. Old storage workers could acknowledge a later lease;
attempt fencing now rejects them. Hung manual deletes and gateway shutdowns are bounded.

## Reproducible verification

- `node --test tests/*.test.mjs backend/pg-session-authority.test.mjs`
- `npx tsc --project tsconfig.seo.json --noEmit`
- Disposable PG17 workflow: `node --test --test-concurrency=1 tests/postgres/*.test.mjs`
- Browser harness: `npm ci --prefix tests/ui --ignore-scripts`, install Chromium,
  then `npm test --prefix tests/ui`. Its pretest reads the specified starting commit;
  the checkout must contain that commit, as the CI checkout does.
- Supply-chain workflow: locked staging runtime install/audit, portable Docker build,
  and refusal to start without approved prerequisites. Browser QA dependencies also
  use a committed lockfile and high-severity audit.

Core tests use synthetic identity/provider/SDK boundaries. PostgreSQL tests execute
real serializable transactions, constraints, forced RLS, cross-tenant denials,
concurrent requests, rollback, stale leases and revocation. The new suite creates
and drops only a generated database on local `gs_test` PostgreSQL 17. Sandbox stores
are local fictional development fixtures. Browser tests exercise actual React
components with 1,000 fictional requests, never real accounts.

The query benchmark records five EXPLAIN ANALYZE/BUFFERS runs before/after the review
draft on 10,000 fictional rows (5,000 per tenant), for the ordered first-page query
and cursor projection. It excludes network, gateway authorization and transaction
lock contention. It records plans and raw timings rather than asserting a speedup.
The browser comparison reads the starting WorkProgress source and measures actual
rendered card/element counts for the same fixture. DOM reduction is not a claim
about hosted latency, conversion or a complete application bundle.

CI artifacts retain the raw database and browser evidence. The final external
engineering report records exact delivery SHA, check URLs, counts and measurements
only after those checks complete.

## Remaining release blockers and next safe task

1. No host or exact hostname is authorized. No live deployment may occur until both
   are approved, with an accepted HTTPS ingress contract and the existing gates.
2. No supported least-privilege exact provider-session lookup is deployed/verified.
   JWT/user verification is not immediate administrator/global revocation evidence.
3. Private schemas, legacy direct API cutover, limited credentials, approved Auth
   redirect/email setup, and hosted two-user acceptance have not been activated.
4. The new operational writer uses a disposable administrative test role. Hosted
   fixed-purpose writer RPCs, privilege preflight and combined migration/lock-order
   reconciliation are still required. No production pool may use the disposable role.
5. Source API/UI adapters need accepted identity, CSRF and runtime wiring before
   shared operational data can be used. Existing SDK entrypoint gates remain intact.
6. Sandbox local persistence is not production tenancy/storage. Distributed worker
   coordination, per-action external idempotency, accepted retention and real provider
   credentials/permissions are separate work. External actions remain disabled.
7. Real media approval/scan/storage-provider acceptance, owner factual review of
   content, full hosted app acceptance and release monitoring remain incomplete.

Next safe source task: implement fixed-purpose private operational RPCs and a
restricted writer-role catalog preflight; rehearse them with the existing private
session stack in disposable PG17, including concurrent membership/session revocation.
This does not require a live host or hosted mutations.

The package substantially extends independently testable engineering foundations.
It is not a completed production release, and no completion percentage is asserted.
