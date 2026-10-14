# Phase 3.15P engineering handoff

Date: 2026-10-14, Asia/Karachi. Repository: `sohail654312-gif/codeedge-growth-starter`.
Branch: `engineering/phase2-core-security`; PR #2 stays draft and unmerged.
Starting remote HEAD was re-fetched and matched `b8180c80d4654c186ba6fabccfcc992a1270b94c`.

## Delivery and boundaries

The administrative source operations store now has a separate fixed-purpose
private SQL replacement, an effective writer privilege verifier, and a cookie/CSRF
HTTP composition. The private UI is built separately from the existing AppDeploy
demo. Its owner, agency, staff and client actions call the private cookie API.
The existing AppDeploy deployment and protected repositories were not changed.

This completes the next safe private operational layer in source. It does not
resolve the unverified provider contract or establish a live staging deployment.
No hosted DDL, grants, revokes, role LOGIN, accounts, secret creation, deployment,
external publishing, payment, messaging or paid resource was performed.

## Source inventory

| Component | Status | Concrete boundary |
|---|---|---|
| PKCE initiation/callback | Implemented and integrated in portable runtime | Server verifier, single-use flow/grant, provider-returned subject/email/session validation; synthetic provider acceptance |
| Cookies, CSRF, logout | Implemented and integrated | Secure HttpOnly session; session-bound CSRF; exact Origin/Host; duplicate cookies and callback replay denied |
| Exact provider session | Implemented fail-closed interface, external dependency | No JWT/getUser fallback, no managed Auth grant or supported live adapter supplied |
| Codeedge sessions | Implemented and integrated | Restricted issuer, hash-only session credentials, transactional lookup, expiry and logout |
| Owner workspace/profile onboarding | Implemented and integrated | Actor derives from session; bounded validated profile, version/CAS, receipt and audit |
| Current memberships/roles | Implemented and integrated | Scoped workspace selector, current-role authorization and owner revocation under locks |
| Membership invitation delivery | Existing transactional source, not wired to private writer/UI | Existing invitation service remains; real delivery and account admission require reviewed provider/identity setup |
| Requests/review/approval/corrections | Implemented and integrated | Idempotent create, current assignee validation, versioned state machine, client notes and role controls |
| Scoped detail/history | Implemented and integrated | Notes capped at 50; owner/agency audit; signed actor/workspace/filter-bound keyset cursors |
| Search/filter/pagination | Implemented and integrated | Status/type/assignee server filters; loaded-page text search in UI; bounded pages |
| Media authorization/deletion queue | Implemented SQL and server contract | Ready-media lookup is server-only; delete route enqueues atomically; actual storage delivery/worker remains disabled |
| Media upload/scan/storage serving | Existing source adapters, external dependency | No live storage binding or completed hosted scan/consent acceptance claimed |
| Owner/agency/client work UI | Implemented and integrated source package | Separate private entry; authority controls/actions tested with fictional browser fixtures |
| Offline SEO/local SEO/AEO/GEO | Preserved and exposed in private UI | Existing deterministic reports, supplied extracts and clearly labelled fictional examples |
| GSC/GBP/social/analytics providers | Existing provider interfaces, disconnected | No fabricated live Google data, traffic, revenue, ranking or campaign outcome |
| Schema drafts/calendar/duplicates/tasks | Implemented and integrated offline | Existing studio tabs, safe serialization, proposed calendars and recommendations |
| Automation | Existing sandbox engine and private owner authorization | Sandbox only; no external effect is authorized by returning an authorization snapshot |
| Finance/external contracts | Existing source interfaces, not live | No live payments or cross-project integration change |
| Release verification | Implemented and tested | Fresh remote branch and four exact-SHA push workflows; hosted/production stay BLOCKED |

## Implementation map

- `db/drafts/phase315p_operations_REVIEW_ONLY.sql`: 16 fixed `ops_*` entrypoints,
  six internal invoker helpers and a session mutation lock trigger.
- `backend/phase315p-private-operations.mjs`: separate writer LOGIN pool, fixed
  parameterized statements, mandatory exact pair/expiry authority, bounded
  transactions, generic errors, privilege preflight and signed cursor handling.
- `backend/phase315e-https-cookies.mjs`: `/v1/operations/*` GET/POST routes;
  forged actor/role/token fields discarded; mutation body capped at 8 KiB.
- `staging/phase315p-config.mjs`: existing M prerequisites plus exact writer
  identity, session-mode connection and cursor-key secret file. No default activation.
- `src/PrivateWorkspaceApp.tsx`, `src/private-workspace-client.mjs`: same-origin
  cookie-only client, profile/work queue/history, role controls, errors/loading,
  retry keys retained for a repeated in-page payload; response stream bounded.
- `staging/private-ui-assets.mjs`: exact built assets, authenticated ingress and
  canonical Host, strict self-only CSP and no-store responses.
- `scripts/phase315p-migration-bundle.mjs`: atomic O -> K -> M -> P bundle,
  column/constraint baseline assertions, dependency hashes and postflight checks.
- `scripts/release-readiness.mjs`: live GitHub evidence retrieval, migration
  inventory and separate source/hosted/production verdicts. Exit 2 means BLOCKED.

## Transaction and privilege contract

Operations first validate the Codeedge token and hold its shared session advisory
lock. The server checks the exact provider pair without caching. SQL revalidates
the session, then acquires the workspace advisory lock before current membership,
receipt and business changes. The lock is exclusive even for P reads: this is a
conservative per-workspace serialization choice, not a throughput claim.
Workspace lists acquire at most 25 workspace locks in ascending ID order.

Revocation waits for an already ordered authorized transaction. After revocation
commits, new operations and receipt replay deny. A committed response already
delivered cannot be recalled. Provider revocation is checked at operation admission;
atomic cancellation across two independent systems is not claimed.

The writer has schema USAGE plus only 16 operations and `session_context` EXECUTE.
It cannot read tables, mint sessions, set owner roles or execute internal helpers.
The NOLOGIN/NOBYPASSRLS operation owner has explicit table/column/sequence grants
and fixed function bodies. Forced RLS is retained; its owner-only policies permit
the reviewed functions, whose predicates enforce tenancy. Neither caller GUCs nor
browser JWT role metadata authorize an operation. PostgreSQL PUBLIC TEMP capability
is not represented as absent; `pg_temp` is last and application objects are qualified.
Standard PUBLIC Auth helper EXECUTEs are not treated as usable RPCs when Auth
schema USAGE is absent. The writer explicitly rejects Auth USAGE, arbitrary
non-temporary schema CREATE, and owner privilege drift; it does not require changes
to managed helper ACLs. This compatibility case is rehearsed with a disposable helper.

Existing privileged administrators/legacy writers remain outside this replacement's
least-privilege boundary. They must be retired or constrained in the approved cutover.
Administrative row writes may enter triggers after a row lock; lock/statement
deadlines fail closed rather than promise deadlock-free arbitrary administrator SQL.

## Verification and reproducibility

Run from the repository with Node 22+:

```sh
npm ci --ignore-scripts
node --test tests/*.test.mjs backend/pg-session-authority.test.mjs
npx tsc --project tsconfig.seo.json --noEmit
npm run typecheck:private
npm run build:private
node scripts/phase315p-migration-bundle.mjs
npm ci --prefix staging --ignore-scripts
npm audit --prefix staging --omit=dev --audit-level=high
npm audit --audit-level=high
npm ci --prefix tests/ui --ignore-scripts
npm audit --prefix tests/ui --audit-level=high
npm test --prefix tests/ui
```

The full PostgreSQL suite needs a **fresh** local disposable PostgreSQL 17 cluster,
database `gs_test`, OpenSSL on PATH, and `TEST_DATABASE_URL`. Some older suites leave
test schema/data in that disposable database; do not rerun the full suite against
its populated previous state. CI provisions a fresh `postgres:17-alpine` service.
The P suite creates/drops its own generated database and uses actual network roles.

Local verification includes the core tests, the expanded disposable PG suite,
12 Chromium mobile/desktop tests, both typechecks, private build and zero current
dependency audit findings. Exact final SHA, CI URLs and final counts are recorded
in the generated release evidence and delivery report after remote checks complete.
No earlier-SHA CI result is accepted for the new commit.

`work/phase315p-pg-evidence.json` records ten complete restricted list transactions
on fictional A/B/C/D data, local loopback PostgreSQL 17.11 and synthetic authority.
`work/phase315o-pg-performance.json` retains the 10,000-row query benchmark.
Raw samples are recorded; neither is production latency or capacity evidence.

## Supply chain correction

Root dependencies are pinned and locked. Removed the unused Tailwind 3 compiler,
which pulled unpatched `braces`; preserved its existing MIT-licensed static reset.
Updated the test image decoder to `sharp@0.35.5` for current upstream native-library
advisories. CI uses `npm ci`, audits root/staging/browser dependencies, builds the
private UI into the non-root portable container and verifies blocked startup.

## Remaining decision

See `SUPABASE-SESSION-AUTHORITY-FINAL-DECISION.md`,
`SUPABASE-SECURITY-CUTOVER-RUNBOOK.md`, `STAGING-DEPLOYMENT-RUNBOOK.md`,
`FINAL-SECURITY-AUDIT.md`, and `REMAINING-EXTERNAL-BLOCKERS.md`.
Source readiness is a current-commit engineering gate, not an independent release
approval or evidence of completed hosting. Keep PR #2 draft and unmerged.
