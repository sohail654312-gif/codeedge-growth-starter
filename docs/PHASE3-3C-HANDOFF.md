# Codeedge Growth Starter — Phase 3.3C exact engineering handoff

**Date:** 2026-10-10. **Existing PR:** #2 DRAFT / OPEN,
`engineering/phase2-core-security`. **Base main HEAD:**
`dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.
**Starting PR HEAD:** `68551e3c902c13dec940c3ecfd51fffb77664aa0`.
**Source increment SHA:** `f29fbc9142d9c2565ceb29857112a8d0ba72723c`.
**Final HEAD:** retrieve from the PR after this handoff commit and append final
exact-head CI links in the PR conversation; a commit cannot contain its own SHA.

## What was actually done

- Inspected actual latest PR, commits, original Phase 3.3B auth/reader/RLS
  source and previous CI.
- Read-only Supabase project interrogation (project `dbppeymhsemvghbvuvof`,
  PostgreSQL 17.11, ACTIVE_HEALTHY): **five** installed staging migrations,
  **seven** RLS-enabled tables, **zero** RLS policies, **zero** Auth users,
  **zero** Auth sessions, **zero** workspaces, **three** SECURITY DEFINER functions,
  and **both actor-ID legacy functions still executable by
  `growth_starter_reader`**. The restricted roles are NOLOGIN.
- Verified current Supabase docs: managed Auth issues JWTs with `session_id`
  correlated with `auth.sessions`; logout/refresh-token invalidation does NOT
  by itself prove immediate access-token revocation. Signatures must be verified
  by the managed Auth/PostgREST boundary, followed by independent server-side
  session validity checks if immediate denial is required. An approved live
  authoritative session provider is still **unavailable**.
- Corrected `staging/hosted-acceptance.mjs`: prior `actorId` query expectation
  (403) did not match secure gateway rejection (400); baseline now requires
  secure-gateway health marker, real UUID identities and actual
  `ws_<owner_subject>` schema constraints, exactly scoped own/foreign
  workspaces and requests, extra unauthorized query denial.
- Added manually invoked real HTTPS **post-revocation checks** using original
  token of User A before expiry and still-working User B, and a separate
  *member C* workspace/request denial check after authorized membership
  revocation. These operations themselves **do not mutate or revoke anything**.
- Strengthened `tests/hosted-acceptance.test.mjs` for new runner, legacy
  service rejection, non-expired A logout probe and member-C probe.
- Added `staging/hosted-catalog-preflight.sql`, a **read-only** privilege/RLS
  catalog query to support independent operator readback. It cannot attest
  real JWT signatures or browser/mobile acceptance.
- Corrected outdated `staging/README.md` claiming the disabled legacy
  `npm start` still hosted the gateway. Now lists the exact approval-gated
  trusted HTTPS, policy, synthetic account, legacy cutover and safe rollback
  procedure. The AppDeploy demo and navy dashboard are untouched.

Changed files in this phase: `staging/hosted-acceptance.mjs`,
`tests/hosted-acceptance.test.mjs`, `staging/hosted-catalog-preflight.sql`,
`staging/README.md` and this `docs/PHASE3-3C-HANDOFF.md`.

## Reproducible evidence

Commands:
```
node --test tests/*.test.mjs
node --test tests/hosted-acceptance.test.mjs
# Disposable PostgreSQL, no hosted mutations:
TEST_DATABASE_URL='postgres://gs_test:...@localhost:5432/gs_test' node --test --test-concurrency=1 tests/postgres/*.test.mjs
```

The existing four GitHub workflows cover core, supply-chain, SEO TypeScript/UI
and disposable PostgreSQL. Capture **the final exact-head** run IDs and counts
in the PR comment; do not assume a newly written document's commit passes CI
until those runs complete. Suites overlap and must not be summed.

## Acceptance verdicts

| Domain | Verdict | Distinguishing evidence |
|---|---|---|
| Source gateway | PASS from prior Phase 3.3B | CI-verified source + mock HTTP; deliberately unhosted |
| Hosted runner correctness | PASS only when final source CI green | Real HTTP protocol and guard test fixtures; no real hosted calls |
| SQL RLS read policies | PARTIAL | Existing disposable PG tests; not applied to Supabase staging |
| Immediate session revocation | BLOCKED | No independently trusted live session source; no real Auth users/sessions |
| Real signed two-user HTTPS | BLOCKED | No approved HTTPS service or synthetic Auth credentials |
| Legacy definer remediation | **FAIL / HIGH OPEN** | Restricted reader can still invoke both functions in hosted DB |
| Independent external security audit | BLOCKED | No independent hosted review and attack simulation yet |
| Pilot readiness | BLOCKED | No trusted Auth, hosted acceptance, privacy/media or accessibility QA |

Internal review is not an independent audit. No hosted policy/grant/function
changes, paid infrastructure, browser exposure, new credentials, real patient
data, other repositories, PR merge or background automations.

## Percentages — unchanged baseline, no artificial inflation

Phase 3.3B's seven-category weights: core functionality 20% (64),
auth/sessions 20% (48), isolation/RLS 20% (58), client/agency workflow 10% (44),
SEO 15% (78), security QA 10% (87), staging/pilot 5% (14).
**Weighted source readiness remains 59.5% (~60%).**
This increment improves acceptance tooling and understanding, but did not
close a hosted-security gate; it does not justify an additional increase.
**Phase 3.3C:** two deliverables (hosted acceptance protocol and read-only
catalog preflight) prepared/tested, but **0/5 critical hosted-security gates
accepted** (real Auth, authoritative revocation, RLS, two users, legacy cutover).
A commercial pilot acceptance percentage is **not asserted**.

## Precise owner approval checklist

| Operation | Scope | Expected effect / risk | Recovery |
|---|---|---|---|
| Secret-backed HTTPS staging host | Isolated Growth Starter only, confirmed price | Creates externally reachable test API; TLS/secrets risk | Remove route / maintenance |
| Auth test users A/B/member C | Fictional, no patients | Makes real Auth JWTs/sessions; identity/cleanup risk | Revoke sessions, delete fixtures |
| Review/private schema RLS grants | Staging `growth_starter` only | Grants SELECT subject to RLS; accidental cross-tenant data risk | Disable exposure/permissions; do not delete records |
| Trusted session-state provider | Server only with authorized privileges | Checks real active sessions and revocation; availability/privilege risk | Fail closed (503) |
| Cutover legacy EXECUTE | After independent replacement acceptance | Breaks old gateway intentionally, removes spoofable function rights | Maintenance/deny-all, never re-GRANT |

Do not treat approval of one operation as approval of the others.

## Next smallest milestone

Owner chooses and approves **one** protected zero-cost-if-available HTTPS
staging host / secret channel and scoped synthetic test-user creation; security
reviewer then accepts the specific live session authority design. Only after
that, schedule owner-approved staging-only RLS and real signed two-user
acceptance, followed by privileged-function retirement. Until then Phase 3.3C
hosted security acceptance remains **BLOCKED**, no production release.
