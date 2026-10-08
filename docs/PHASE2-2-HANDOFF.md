# Growth Starter Phase 2.2 — Controlled Engineering Handoff

**Date:** 2026-10-08  
**Existing PR:** #2, `engineering/phase2-core-security` — DRAFT, unmerged.  
**Starting head:** `18614a4de7c5590c1672c251a8a66f304696b1eb`  
**Final exact head:** Verify GitHub PR #2 after this documentation-only commit; do not infer from prior source commits.  
**Existing main:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`

## What was preserved
- Original Phase 1 AppDeploy application `codeedge-growth-starter-5jhvfk`: **not redeployed or migrated**.
- Separate Phase 2.1 AppDeploy sandbox `growth-starter-phase-2-qa-sandbox-gve53p`: **not modified**; prior snapshot `1791455061355` per handoff.
- Existing clinic dashboard and mobile-first navy/white design, Website, Enquiries, Content studio, Local SEO, Media, Work Progress and Agency desk.
- Real PostgreSQL adapter, one-use invitations, atomic request approval tests, signed synthetic identities, image inspector, media gate, deletion outbox. No existing tests removed.
- Business OS, CIGO, Finance Suite, MVP and other repos are untouched.

## Findings and implementation
1. **High: hosted sessions and PG collaboration disconnected.** Added `backend/staging-identity.mjs`, a strict RS256 public-key keyring with explicit `kid`, issuer/audience, verified email, bounded expiry and `sid`/`jti`. It demands a trusted, online per-request session-revocation check; absent/failing introspection cannot grant access. Rotation requires a trusted server-supplied replacement/overlap of keyring entries. This is a source capability, **not an active hosted IdP**.
2. **High: no restricted staging runtime DB principal.** Added migration `0002_staging_readonly.sql` with `growth_starter_reader` NOLOGIN/NOINHERIT/NOBYPASSRLS, no table or sequence reads or writes, and EXECUTE-only protected read routines. Requires a *separately provisioned* LOGIN/credential and isolated staging DB. Disposable PG tests execute as restricted role. These SQL routines accept an actor ID parameter from **trusted server code only**, not direct browser inputs; impersonation by a compromised DB runtime is an unclosed risk.
3. **High: no safe hosted collaboration adapter.** Added `backend/staging-gateway.mjs`, a separately deployable read-only HTTP handler for workspace/request data, using cryptographically verified actors, per-call revocation checks, parameterized read routines and bounded queries. Foreign workspace 403; mutations disabled by default (405). No full trusted runtime hosting connected.
4. **High: upload response released unapproved media.** `backend/routes.mjs` now avoids signing unverified uploads in POST responses; `tests/core.integration.test.mjs` asserts `url:''` and no internal storage path leakage. GET overview continues to hide unapproved media. **Existing signed URLs issued in earlier sessions are not revoked by this source change**; storage TTL/revocation needs hosted acceptance.
5. **Tests.** New `tests/staging-identity.test.mjs` for key rotation, forged signing claims, session revocation/offline denial, expiry and verified email; new `tests/postgres/staging-gateway.pg.test.mjs` for restricted PG role, two signed synthetic HTTP actors/two workspaces, foreign access 403, active membership/revoke, forged claims, disallowed HTTP writes and origins. These are **disposable CI evidence only**.

## R1–R7 independent acceptance status

| ID | Security or delivery gate | Status | Why |
|---|---|---|---|
| R1 | Trusted invitation/role lifecycle | **BLOCKED hosted** | PG domain/invitation tests pass; no real hosted verified identity or invited account workflow |
| R2 | Transactional persistence / database authority | **PASS disposable PostgreSQL / BLOCKED hosted** | Restricted DB read role and real transactions tested; no independent staging connection using real restricted login, no production RLS or operational rotation proof |
| R3 | Two-user tenant isolation / token revocation | **PASS synthetic HTTP + real disposable PG / BLOCKED hosted** | Two separately signed synthetic users; no actual two AppDeploy/IdP staging sessions |
| R4 | Media consent, scanning, signed access & deletion | **PARTIAL / BLOCKED pilot** | Upload signing gap closed, image decoder and outbox tested; live scanner, consent approvals, old link revocation, retention/export and hosted deletion not proven |
| R5 | Video and publishing | **OPEN, deferred** | No video pipeline or scheduled/social publication; intentionally out of pilot scope |
| R6 | Agency/client operational workflows | **PARTIAL / BLOCKED multi-user** | Work Progress, Website, read-only Agency desk exist; assignment, approval, cross-client selector and client media review remain off until staging trust |
| R7 | Hosted staging, accessibility, speed & policy | **BLOCKED** | No independently verified hosted two-user acceptance, Lighthouse data, device/keyboard/screen-reader audit, operational policy or pilot signoff |

## CI evidence discipline
- Prior verified head `18614a4de7c5590c1672c251a8a66f304696b1eb`: 35/35 source/core; 13/13 real disposable PostgreSQL.
- The new increment adds 5 identity unit tests and 4 disposable PG staging tests, preserving existing suites. **Check exact final SHA and workflows for the current result**. Do not claim passing based on earlier head.

## Hosted infrastructure blocker
Supabase inventory currently lists only other Codeedge projects; no isolated Growth Starter staging DB exists. Project creation requires owner-chosen organization/cost confirmation, and a production-grade IdP revocation source plus restricted runtime login. Existing AppDeploy email is not independently verified and AppDeploy database is not a proven serializable store. Never reuse Business OS or MVP databases.

## Next smallest controlled block
1. Obtain a **separate, owner-approved staging PostgreSQL** instance, restricted runtime login, TLS credentials and server-only secrets.
2. Bind a trusted IdP with email verification, short RS256 tokens, key refresh/rotation and live revocation checks.
3. Re-run two independently authenticated synthetic staging accounts against actual hosted endpoints, including corrupted/foreign IDs and media.
4. Implement transactionally safe invitation/agency actions and consent-scanned media only after the above evidence. Keep Phase 1 data in place.
5. Measure mobile/keyboard/a11y and performance objectively before pilot.

## Practical readiness
**Current stage: engineering-ready for controlled infrastructure setup; not pilot-ready.** Approximate `40–50%` of a *secure two-user pilot* is complete; this is an engineering judgment, **not an independently measured percentage**. The limiting path is identity+database+hosted tenancy proof, not dashboard visuals.

## Deployment verdict
**NO MERGE; NO PRODUCTION DEPLOYMENT; NO BACKGROUND WORKERS; NO REAL PATIENT DATA.** This is a reviewable Phase 2.2 source increment only.
