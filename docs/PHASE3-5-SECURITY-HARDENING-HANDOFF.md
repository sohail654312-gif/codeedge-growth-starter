# CODEEDGE GROWTH STARTER — PHASE 3.5 SECURITY HARDENING HANDOFF

**Branch:** `engineering/phase2-core-security`; **PR:** #2 DRAFT. **Verified starting SHA:** `3c53106bb03d8abd1f68118ba3a6b35f78048fb6`.
**Final SHA:** identify from the current branch after this commit; no commit can embed its own hash. **Mode:** Manual single writer, isolated source-only tests, no deploy or hosted writes.
**Skills consulted:** Existing pinned `$supabase` and `$supabase-postgres-best-practices` instructions; `$ai-seo` is not relevant to this security-only block. None reinstalled or updated.

## 1. Phase 3.4 preserved

`tests/skill-acceptance.test.mjs` and its provenance requirements remain intact. At starting HEAD four GitHub Actions workflows were PASS. The historical hosted gates in `docs/PHASE3-3E-HANDOFF.md` remain OPEN.

## 2. Implemented source-only work

1. `backend/pg-rls-catalog.mjs` — independent, pinned reference of the **three reviewed live PostgreSQL 17 `pg_policies` deparse expressions**. It exact-compares the full policy definitions plus policy name, target table, role, command, permissive/restrictive classification, WITH CHECK, presence and absence of other policies; seven RLS table flags; all effective authenticated/anon/service/reader/runtime/checker table and column grants; all three legacy privileged-function EXECUTE paths (including PUBLIC); and the effective role-switch graph. No self-learning trust from a current compromised policy. On PostgreSQL version/deparser drift, fail closed and require a fresh independent review; do not silently loosen the snapshot.
2. `backend/pg-session-authority.mjs` — performs the complete new catalog preflight **inside the existing read-only startup transaction** in addition to the previously required dedicated login, Auth column-grants, and deny-by-default checks. The runtime remains unable to start on known insecure staging.
3. `tests/pg-rls-catalog.test.mjs` — deterministic positive synthetic approved-catalog fixture plus negative cases for deleted/renamed/foreign policies, accidental ALL/permissive policy drift, altered columns, schema/table grant widening, all three privileged functions, PUBLIC grant, role switching and missing fields.
4. `tests/pg-session-authority.test.mjs` and `backend/pg-session-authority.test.mjs` — update existing test-only pool to include explicit catalog query returning a known synthetic approved metadata fixture. The pre-existing session-checker and outage tests remain.
5. `db/drafts/0007_disable_legacy_actor_definers_REVIEW_ONLY.sql` — proposed future cutover adds `REVOKE growth_starter_reader FROM growth_starter_runtime` to retire the effective `SET ROLE` permission; never apply before the independently accepted replacement.
6. `db/drafts/0009_cutover_assertions_REVIEW_ONLY.sql` — broader existing-function EXECUTE assertions for all present restricted/authenticated roles, the third legacy function and SET ROLE permission. Absent disposable-only roles are harmlessly skipped.
7. `tests/postgres/phase35-policy-catalog.pg.test.mjs` — existing GitHub disposable PostgreSQL only: real catalog read, pre-cutover unsafe legacy rights/role-switch verification, deny, transaction-wrapped review-only cutover, post-cutover effective-grant verification and rollback. No real client data.

## 3. Independent security findings / status

| Gate | Evidence | Status |
|---|---|---|
| Existing RLS installed | Staging 7 RLS tables / 3 SELECT policies, owner/member scoped | PASS for catalog installation, **not** signed JWT acceptance |
| Preflight source fail-closed on policy privilege drift | Strict snapshot + unit negative tests; exact-SHA CI required | SOURCE-LEVEL PENDING CI |
| Protected Auth-schema checker | `growth_starter_session_checker`: NOLOGIN and lacks effective `auth` schema USAGE | BLOCKED |
| Trusted immediate session check | No provider-vetted session-introspection authority; no host | BLOCKED |
| Old direct-PG actor functions | Live `growth_starter_reader` can EXECUTE all three SECURITY DEFINER functions | FAIL/HIGH OPEN |
| Runtime membership | Live `growth_starter_runtime` can `SET ROLE growth_starter_reader` | FAIL / REVIEW-ONLY FIX PREPARED |
| Real A/B/C JWT tenant tests | 0 Auth users and 0 sessions at last read-only inspection | BLOCKED |
| Direct Data API bypass | Pre-read Node gateway checks do not secure a direct Data API route using signed-out unexpired JWT | HIGH DESIGN BLOCKER; no newly exposed schema |
| Hosted ingress/TLS and independent signoff | Protected Node host and two-user attack probes absent | BLOCKED |

Existing `pg_policies` definitions **do not** establish immediate session revocation if those base tables are exposed through the Data API. Do not imply that stronger startup checks remedy that architectural gap. Keep custom schema exposure disabled until an independently accepted alternative proves revocation parity on every protected path.

## 4. Supabase-supported session design comparison

- **A — narrow private server lookup:** Server authenticates the original bearer through Supabase Auth and independently validates server-current session by a provider-approved, restricted reader or endpoint. The proposed direct `auth.sessions` reader is **not yet possible** on this project, because the managed `auth` schema grants are ineffective. Do not activate LOGIN or broaden managed schema rights.
- **B — private session-introspection service:** May be viable only with independently verified JWT identity, secure secret storage/networking, least-privilege DB access and a secure revocation signal; no user-supplied actor, JWT-decoded-only trust, shared browser secret, or generic privileged actor-ID function. New service cannot be claimed until an approved host and provider-supported current-session check exist.
- **C — provider-native JWT + PostgREST RLS:** Suitable for usual signed JWT and membership RLS; standard JWT validation alone does **not** prove immediate sign-out revocation while JWT is unexpired. Session-claim hooks run on issuance, not on every direct read. This cannot satisfy the current strict immediate-revocation gate without an additional accepted live-session check enforced on every path.

**Decision:** Keep the Growth Starter schema **unexposed** and accepted runtime fail-closed. Investigate provider-supported private current-session authority and protected hosting in a separately approved hosted acceptance stage. None of A–C currently satisfies all requirements with verified evidence.

Official provider references:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/api/using-custom-schemas
- https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook

## 5. Source-only test and verification commands

```sh
node --check backend/pg-rls-catalog.mjs
node --check backend/pg-session-authority.mjs
node --test tests/pg-rls-catalog.test.mjs tests/pg-session-authority.test.mjs tests/skill-acceptance.test.mjs
node --test tests/*.test.mjs
# Disposable GitHub CI only, using its existing ephemeral Postgres 16 runner:
TEST_DATABASE_URL=<disposable-ci-database> node --test --test-concurrency=1 tests/postgres/*.pg.test.mjs
```

**No local Docker required.** Historical core safety, disposable PostgreSQL, offline SEO/UI and supply-chain workflows MUST be rechecked at **final exact HEAD**; the handoff does not predeclare the outcome.

## 6. Trust/rollback rules

No hosted Supabase DDL/DML, no production, signed-in users, credentials, new packages, UI changes, other repositories, publishing or automations. Revert **only** the Phase 3.5 commit via a reviewed revert commit if the tests fail; do not reset, force-push or restore the old actor-ID gateway. No client medical data was used.

## 7. Next controlled engineering block

Obtain independent review of the pinned PostgreSQL 17 policy fingerprint and effective-grant matrix; repair any cross-version deparser mismatches by separately reviewed allowlisted snapshots, not loosened substring conditions. Then verify a supported current-session authority and exact deployment boundary on isolated approved hosted infrastructure. Only after hosted A/B/C signed-JWT, revoked-session/direct-API, TLS and privilege tests pass should a later separately authorised operator perform the atomic cutover.
