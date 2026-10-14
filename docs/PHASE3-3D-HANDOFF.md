# Growth Starter — Phase 3.3D engineering handoff

**Date:** 2026-10-10. **Repository:** `sohail654312-gif/codeedge-growth-starter`.
**Existing PR #2:** OPEN / DRAFT, `engineering/phase2-core-security`.
**Original phase starting SHA:** `d475c0e3887eb2a804ad4790c4f0bec5ba34dd07`.
**Base main SHA:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.
**Engineering commits:**
- `4470e12059b95f514e1d28903be60366b2a81d0d` — dedicated session authority and source tests.
- `00650e46d381787b64a999585373978131c539a6` — separate guarded hosted gateway, runtime entrypoint, role grant draft and tests.
- `5022e21da1d971936ca4d10b646c854393da6506` — restricted SQL permission checks and hosted construction tests.
- `bd9326d16a7e13f18307da5c47fadadbdac1ee38` — isolated disposable Auth fixture collision repair.
**Final SHA:** fetch PR HEAD after this handoff commit. Include exact final-head CI workflow links in PR comment, not by guessing the final commit hash.

## Actual implementation delivered

| File | Concrete change |
|---|---|
| `backend/pg-session-authority.mjs` | Dedicated least-privileged Auth session-row lookup by exact subject/session UUID, trusted startup role inventory, read-only transactions and RLS/privileged-function preflight |
| `backend/authenticated-read-gateway.mjs` | New `createHostedAuthenticatedReadGateway` path accepts only a runtime-branded authority after SQL checks; synthetic switch remains restricted to the old test factory |
| `staging/accepted-server.mjs` | Independently loadable loopback-only Node HTTP entrypoint; trusted ingress proto/host enforcement, TLS PG pool, safe errors, clean shutdown, default non-listening unless database security checks pass |
| `staging/accepted-config.mjs` | Minimal secret-bound server config, dedicated login and project reference validation, exact HTTPS origin and deployed SHA requirement |
| `db/drafts/0010_session_checker_minimal_auth_columns_REVIEW_ONLY.sql` | **UNAPPLIED** minimal `auth.sessions` and `auth.users` column grants with NOLOGIN role and no passwords |
| `tests/pg-session-authority.test.mjs` | Synthetic contract tests for startup drift, loss of session, provider failure and unavailable privileges |
| `tests/postgres/session-checker-privileges.pg.test.mjs` | Real disposable PG checks for minimal column access, denied sensitive fields and writes, row disappearance after deletion |
| `tests/hosted-authenticated-gateway.test.mjs` | Rejects forged unbranded authority, accepts only checked authority; not real hosted tests |
| `tests/accepted-staging-config.test.mjs` | Credential/host/HTTPS/port configuration failure checks |
| `staging/package.json`, `staging/README.md` | Opt-in accepted-runtime command and precise activation/runbook; legacy `npm start` remains disabled |
| This handoff | Operational limits and exact evidence rules |

No service was deployed or provisioned. No hosted schema/RLS/GRANT/REVOKE, Auth user, session, function or password was mutated. No other Codeedge repo, app design, real client or automation was touched.

## Provider findings and limitation

The supported Supabase [User sessions](https://supabase.com/docs/guides/auth/sessions) documentation says signing out removes affected rows from `auth.sessions`, while the signed JWT might remain usable until expiry. A trusted **server-side** lookup of the exact `session_id` and verified `user_id` checks logout before JWT expiry. The original access token is cryptographically evaluated by Supabase Auth `/auth/v1/user` and sent unchanged to the PostgREST RLS APIs; local JWT decoding in `trusted-session-gate.mjs` is only a correlation/expiry check, never signature verification.

Before accessing sensitive Auth internals, an owner must explicitly authorize narrow grants and a trusted LOGIN credential. The new source authority refuses login with excess PG privileges, missing grants/policies, active old actor-ID functions or missing Auth schema access. The real host cannot launch until these prerequisites are met. Even with that startup preflight, hosted acceptance and independent review are separate.

## Reproducible verification

```sh
node --test tests/*.test.mjs
node --test tests/pg-session-authority.test.mjs tests/accepted-staging-config.test.mjs tests/hosted-authenticated-gateway.test.mjs
# Disposable PG ONLY, with required isolated test driver/dependencies:
TEST_DATABASE_URL='postgres://gs_test:...@localhost:5432/gs_test' node --test --test-concurrency=1 tests/postgres/*.test.mjs
cd staging && npm ci --ignore-scripts --no-fund && npm run check
```

Security acceptance MUST reference the final SHA in all four GitHub workflows. Prior to fixture repair, one disposable PG run FAILED due to duplicate synthetic auth-user IDs; no security implementation failure was asserted. The collision was repaired with an isolated synthetic identity and conflict-safe test setup. Do not claim final PG acceptance without green exact-head results.

## Hosted Supabase read-only inventory (unchanged)

Isolated project `dbppeymhsemvghbvuvof` PG 17.11 / ACTIVE_HEALTHY:
five historical migrations, seven RLS-enabled tables, **zero policies**,
zero Auth users/sessions/workspaces, three SECURITY DEFINER routines.
Both old actor-ID read functions retain effective EXECUTE for the restricted
`growth_starter_reader`. No approved `growth_starter_session_checker` LOGIN
or Auth-column grants exist. This fact prevents both hosted activation and
honest vulnerability closure.

## Security verdicts

| Area | Verdict | Evidence boundary |
|---|---|---|
| Dedicated session row source | PARTIAL | Real SQL query, minimal grant draft, offline tests; no live LOGIN |
| Trusted JWT signature | PARTIAL | Existing Supabase Auth/PostgREST bearer forwarding; no actual signed test users |
| Read-only RLS and scoped roles | PASS disposable / BLOCKED hosted | Existing database tests on synthetic identity; no hosted policies |
| New staging server start path | PARTIAL | Source and construction tests only; no approved HTTPS ingress |
| Session revocation | PARTIAL | Real server-side lookup implementation; no live signed-out user acceptance |
| Legacy entrypoint disabled | PASS source | Prior test verifies `staging/server.mjs` exits rather than listening |
| **Legacy privileged SQL** | **FAIL / HIGH OPEN** | Hosted function EXECUTE still allowed; cutover SQL remains review-only |
| End-to-end real A/B/C and independent external audit | BLOCKED | No authorized users/hosted privileges/real host |
| Commercial pilot and production | BLOCKED | Security acceptance, privacy/media consent and mobile/accessibility not verified |

## Progress methodology (NOT a release percentage)

Keep the original seven-category weights and make **modest** changes for a real provider-facing implementation: core application 64% (weight 20%); authentication and sessions 55% (20%); tenant isolation/RLS 58% (20%); agency/client workflows 44% (10%); SEO 78% (15%); automated QA 89% (10%); staging/pilot 18% (5%). **Weighted source engineering estimate: 61.3%**, compared with prior 59.5%. The increase is justified by a real row-checking source adapter and hardened runtime; no hosted gate was closed. **Critical hosted gates: 0/5 accepted.** Phase 3.3D source tasks: approximately **65%** as estimated engineering coverage, with real host integration, security review, and live A/B/C verification still BLOCKED. Pilot readiness not asserted.

## Exact owner decisions (each independently scoped)

1. **Staging host:** approve one identified existing HTTPS-capable Node 22 service, confirmed monthly cost (prefer £0), protected secret manager, isolated DNS and fail-closed maintenance rollback. No public bind until TLS and review.
2. **Auth grant:** approve after independent review only the `auth.sessions(id,user_id,not_after)` and `auth.users(id,deleted_at,banned_until)` SELECT column permissions to dedicated `growth_starter_session_checker`, plus a unique protected LOGIN password. Risk: auth-schema data access and credential exposure. Rollback: revoke login/grants and disable host; deny-all, never expose Auth schema to browser.
3. **RLS:** separately authorize applying independently reviewed `0008_authenticated_read_rls_REVIEW_ONLY.sql` and Data API schema exposure **only** to isolated staging with snapshot/rollback and probe evidence; risk of cross-tenant data exposure; rollback deny API/RLS access, not broad grants.
4. **Synthetic users:** approve creation/cleanup of two independent fictional owners plus member C in isolated Auth, signed tokens and workspaces; risk of state pollution and token leakage; rollback delete/revoke fixtures and verify cleanup.
5. **Legacy cutover:** only after Auth/RLS/hosted acceptance approval, allow transactionally executing `0007` and checking `0009`. Risk old gateway stops; recovery **maintenance/deny-all**, not regrant.
6. **Independent signoff:** separately commission/assign reviewer to verify actual SQL privileges, JWT/Supabase logout semantics, TLS, 2-user reciprocal denial, session/member revocation and rollback.

Do not treat executing one step as implicit approval for another; none was requested/applied during this engineering phase.

## Next smallest milestone

Owner-governed **Phase 3.3E hosted acceptance**: independent security reviewer signs off minimum Auth-column grants and draft RLS, then owner approves a specific secret-managed staging Node host and synthetic users. Apply RLS only to isolated staging under an approved change window, authenticate two fictional users directly against PostgREST, revoke legacy grants once replacement is safe and accepted, and start the trusted runtime for real revocation/tenant probes. No live clinic/patient data or unrelated work.
