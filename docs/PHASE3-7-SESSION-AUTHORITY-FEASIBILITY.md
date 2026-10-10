# CODEEDGE GROWTH STARTER — PHASE 3.7 SESSION AUTHORITY FEASIBILITY

**Scope:** repository `sohail654312-gif/codeedge-growth-starter`, branch `engineering/phase2-core-security`, existing PR #2 **DRAFT**. Manual single-writer, read-only provider assessment and source-only regressions. **Starting verified HEAD:** `1546ce997e819e52724172e70df617254d0696ca`. **Final HEAD / CI:** must be read from GitHub after this document's commit; never infer them from prior results.

## 1. Starting exact-SHA evidence

At starting HEAD all four workflows were PASS:
- Core safety, **152/152**: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38075394030
- Disposable PostgreSQL, **40/40**: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38075394027
- Offline SEO/UI, **39/39**: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38075394011
- Supply-chain, **16/16**: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38075394012

Preserved: Phase 3.4 three installed skills and acceptance tests, Phase 3.5 strict PG17 policy/grant fingerprint and hardening, Phase 3.6 A/B/C synthetic regressions and direct-Data-API probe. Read existing Phase 3.5/3.6 handoffs, `backend/pg-session-authority.mjs`, `backend/pg-rls-catalog.mjs`, `backend/postgrest-read-boundary.mjs`, `backend/trusted-session-gate.mjs`, `staging/accepted-server.mjs` and existing tests. `$supabase`, `$supabase-postgres-best-practices` and permission/RLS references read manually from approved skill files, **not** native Codex skill execution. Skill Retrieval MCP not installed.

## 2. Provider-supported identity versus session currency — verified distinction

Official current Supabase sources:
- Sessions: https://supabase.com/docs/guides/auth/sessions
- Signing out: https://supabase.com/docs/guides/auth/signout
- JWTs and verification: https://supabase.com/docs/guides/auth/jwts
- Auth getUser: https://supabase.com/docs/reference/javascript/auth-getuser
- Data API grants: https://supabase.com/docs/guides/api/securing-your-api
- Custom schema exposure: https://supabase.com/docs/guides/api/using-custom-schemas

The Auth server or verified Supabase JWT establishes identity, not automatically **current** session state. After signout, an unexpired access token can still be accepted; `getUser(jwt)` is documented as a fresh user/identity lookup, **not an explicit guarantee that the `session_id` remains present in `auth.sessions`**. Supabase documents checking that table for immediate logout revocation. A custom JWT hook evaluates issuance, not every protected read. An HTTP-only cookie or a private Edge/Node service alone cannot manufacture session revocation evidence. Signature decoding is not verification.

### Candidate verdicts

| Candidate | Identity and session control | Available in present isolated staging? | Verdict |
|---|---|---|---|
| **A — narrowly privileged `auth.sessions` lookup after verified original bearer** | Strongest defined design: independently verify user and signed original token; bind `sub` and `session_id` to provider-current session row and current membership; reject errors, mismatches or revoked/expired. | Not usable: `growth_starter_session_checker` is NOLOGIN, lacks effective `auth` schema USAGE despite apparent column-level grants. Managed `auth` owned by `supabase_admin`; user-controlled broad grants not acceptable. | **PREFERRED CONDITIONAL / BLOCKED** |
| **B — private Node/Edge session-introspection service** | Can only be accepted if its *underlying* current-session signal is provider-approved and least-privileged. It must securely verify identity, current `session_id`, fail closed and protect its own credentials. | No independently approved current-session endpoint or private TLS Node host/secret path; staging Edge Functions count 0. | **BLOCKED** |
| **C — signed JWT + PostgREST RLS only** | Signature, `exp`, tenant membership/RLS are useful, but do not guarantee immediate logout/revocation before JWT expiry. | Base RLS exists; not sufficient for the stated immediate-revocation security gate. | **INSUFFICIENT** |

**Architecture decision:** Do not activate any candidate as a hosted session authority now. Retain **BLOCKED** pending provider-supported *current-session* attestation and separately accepted isolated hosting. Investigate provider support for a non-escalating/private, minimal Auth-session check; if unavailable, review an alternate private data access model with an independent trusted identity/session registry only by separate owner decision. Avoid unrestricted service-role credentials and unreviewed `SECURITY DEFINER` shortcuts.

## 3. Fresh live, read-only staging evidence (2026-10-10)

Supabase isolated project `codeedge-growth-starter-staging`, project ref `dbppeymhsemvghbvuvof`, **ACTIVE_HEALTHY**, PostgreSQL **17.11**, region ap-south-1.

| Readback | Observed |
|---|---|
| `auth` schema owner | `supabase_admin` |
| `growth_starter` schema owner | `postgres` |
| Managed Auth users/sessions | **0 / 0** |
| Active checker role LOGIN | **false** |
| Checker `auth` schema USAGE | **false** |
| Checker SELECT `auth.sessions` id/user_id/not_after columns | **true / true / true**, insufficient without schema USAGE |
| Growth Starter RLS-enabled tables / policies | **7 / 3** |
| Restricted reader can EXECUTE the three old actor-ID SECURITY DEFINER routines | **true / true / true** |
| Runtime can SET ROLE reader | **true** |
| Isolated Supabase deployed Edge Functions | **0** |
| Vercel project-name lookup 'growth-starter' | **0 matches**; not proof that no host exists under another name |

No SQL write or migration was run. No passwords, JWTs, tokens, user records, paid resources, deployments, global Codex configuration or other repositories were changed.

**Data API setting not proven:** `pgrst.db_schemas` not exposed by our PostgreSQL read-only query; the Supabase Dashboard 'Exposed schemas' setting was NOT independently read from the provider management config. Never confuse database grants or absence of rows with a demonstrated inaccessible API.

## 4. Significant direct-access architecture conflict — HIGH / OPEN

`backend/postgrest-read-boundary.mjs` performs protected customer reads using `/rest/v1/{workspaces,memberships,work_requests}`, the customer's JWT bearer and `accept-profile: growth_starter`. To execute these as written, Supabase's `growth_starter` Data API schema would have to be exposed. **But** the current three RLS policies in `backend/pg-rls-catalog.mjs` restrict by owner/membership and do not check live `session_id`. If this Data API schema were exposed, users could bypass the gateway's current-session check and directly read data with a signed-out but unexpired JWT.

This is a source-verified *architectural conflict and contingent exposure risk*, not a demonstrated hosted data leak. **Do not enable the custom schema in Data API settings.** Before hosting, independently choose one of:
- a private server-only data access layer with verified signed identity, server-trusted live-session state and per-workspace authorization; or
- an approved direct-Data-API model enforcing equivalent live-session checks at the database boundary itself.

Neither is currently implemented and validated. Merely wrapping PostgREST in Node does not make the downstream route private.

## 5. Phase 3.7 executable source-only improvement

**New:** `tests/phase37-session-feasibility.test.mjs` (five offline Node tests, picked up by existing core-safety workflow). These execute the existing real source modules, not a replacement auth design:
1. Fully populated simulated column grants still fail startup if `auth` schema USAGE is false; no session-row query runs.
2. NOLOGIN role fails startup even if schema/column-read evidence looks positive.
3. Supabase `/auth/v1/user` 200 with still-unexpired synthetic token cannot result in protected PostgREST reads if authoritative current-session lookup returns revoked.
4. User/session mismatch, missing session evidence, expired record and provider outage are rejected; matching *synthetic callback* is not provider acceptance.
5. Source diagnostic explicitly records PostgREST's `growth_starter` profile requirement and lack of a live-session predicate in the pinned three RLS policies.

Run:
```sh
node --test tests/phase37-session-feasibility.test.mjs
node --test tests/*.test.mjs
```
No additional package, external network, environment variable, credential, hosted SQL, runtime module or deployment change. Test results and exact-final-SHA CI must be verified after commit; historical CI is **not** newly successful CI.

## 6. Hosted acceptance prerequisites and severity

| Severity | Gate | Evidence / unresolved dependency |
|---|---|---|
| CRITICAL / BLOCKED | Current session authority | Managed `auth` schema inaccessible to minimal role; no independently approved live-session provider API, no verified signed-user proof |
| HIGH / OPEN | Direct Data API bypass | Gateway requires exposed custom PostgREST schema while current RLS lacks per-read live session check; provider schema setting unverified |
| HIGH / OPEN | Legacy privilege retirement | All 3 historical functions executable by reader; effective runtime SET ROLE path remains |
| HIGH / BLOCKED | Real A/B/C provider-signed acceptance | No provider Auth users/sessions or synthetic hosted workspaces; no approved host/ingress |
| MEDIUM / BLOCKED | Protected Node HTTPS, secrets and network | No verified suitable isolated staging host / secret store / TLS reverse proxy |
| MEDIUM / REVIEW | PostgreSQL17 fingerprint vs disposable PostgreSQL16 | Never auto-relearn or widen known good snapshot for test compatibility |

A provider-authenticated A/B/C acceptance run needs explicit separate owner approval: managed fictional accounts, signed JWTs and test secrets in secure manager; independently verified live session signal; secure isolated Node TLS ingress/egress; verified Data API schema config; seeded fictional A/B/C workspaces and membership; logout/revocation replay at every protected endpoint including raw Data API; verified actual privilege cutover only after replacement accepted, fail-closed rollback and independent reviewer signoff. No real patient data or Codeedge other-repo host may be involved. Prefer zero-cost supported infrastructure; **no new resources provisioned in this phase**.

## 7. Rollback and remaining decisions

Revert **only** this Phase 3.7 test and document in a reviewed new commit if required; do not reset or force-push, disable Phases 3.4–3.6, alter RLS or restore legacy actor-ID rights. PR #2 must remain draft.

Owner decisions still required, independently: (i) provider-assisted least-privileged *current-session* introspection or approved alternative, (ii) private data path vs database-per-read session enforcement and exposed-schema setting, (iii) supported protected HTTPS host/secrets/network, (iv) staged fictional users/fixtures, (v) later hosted acceptance, (vi) later atomic cutover, (vii) independent signoff.

**Phase 3.8 recommendation:** Independent provider-current-session verification and private-API boundary spike in isolated owner-approved synthetic staging. Establish a provider-supported introspection mechanism **first**; until then do source-only boundary design, no hosted access, no migrated privileges, no direct exposure and no pilot onboarding.
