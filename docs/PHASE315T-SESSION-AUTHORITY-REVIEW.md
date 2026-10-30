# Phase 3.15T — exact-session bridge / original-policy adapter acceptance

**Status: REVIEW ONLY. Not wired to hosted bootstrap. No supported provider-policy verifier has yet been accepted.**

## Current verified infrastructure (30 October 2026, read-only)
The connected staging project `dbppeymhsemvghbvuvof` is `ACTIVE_HEALTHY`, PostgreSQL 17.11. There are eight recorded migrations including `20261030045907_growth_starter_phase315s_remove_stale_auth_columns_and_install_private_bridge`. The private `growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid)` function exists, while `growth_starter_private` and the three intended LOGIN roles (`gs315m_issuer`, `gs315k_gateway`, `gs315p_writer`) do not. The seven legacy business tables have RLS, three policies; the `authenticated` principal retains 15 column SELECT privileges and three legacy SECURITY DEFINER functions remain. These are catalog observations, not live tenant or Data API denial proof.

## The implementation boundary
`backend/phase315t-bridge-authority.mjs` combines (a) the existing **narrow and unexposed** exact user/session pair snapshot with (b) a separately implemented, independently accepted `verifyOriginalSessionPolicy` callback. Both callbacks are mandatory. An exact pair and explicit `banned=false` / `deleted=false` are necessary but insufficient. The policy callback must return the exact same user/session and an explicitly validated `policyValid=true` with finite future expiration. No policy evaluator is invented or hardcoded; the new module is not imported into the operator bootstrap. No browser or service_role access to managed Auth is authorized by its existence.

**Important:** the bridge returns `session_not_after` which may be NULL. A NULL must not be interpreted as unlimited accepted policy; only the independently verified policy callback can supply a finite, accepted expiry. The adapter rejects malformed data, mismatch, bans, deletion, expiry, provider timeout, outage and cancellation.

Official reference: https://supabase.com/docs/guides/auth/sessions

## Provider lifecycle decision still required
| Requirement | Current accepted proof | Required evidence |
| --- | --- | --- |
| PKCE login / callback / original bearer | Synthetic only | Real configured email template and code exchange against a fictional identity; exact session_id matches validated original user |
| Local/global/others logout, administrative revocation | No signed lifecycle proof | Same-session and cross-device token replay denial, with correct scope expectations |
| Ban, deletion, password/security changes | Narrow catalog only | Real lifecycle negative tests; bridge flag plus provider event semantics |
| Timebox/inactivity/single session | No accepted Free-tier setting/proof | Decide **not required** or use supported plan feature with verified semantics; any change to mandatory security contract requires owner approval |
| Provider outages and cancellation | Synthetic fail-closed tests | Real fail-closed operations in restricted HTTPS runtime |
| Tenancy, REST/GraphQL exposure | Source tests and catalogs | Signed fictional A/B/C tenant cases and direct API probes after authorized migration |

Supabase states that timebox, inactivity and single-session options require Pro or above, and that their enforcement occurs on refresh, not immediate deletion. Do not assert `policyValid=true` merely because a row exists. See https://supabase.com/docs/guides/auth/signout and https://supabase.com/docs/guides/auth/managing-user-data .

## Deterministic, not-yet-authorized hosted cutover
1. Freeze one reviewed candidate commit and digest the exact source, SQL bundle and authority implementation. Re-run the current read-only schema/grants/roles/default privileges/owner/migrations inventory; reconcile the eight-migration live baseline rather than assuming October 14.
2. Independently review the current O→K→M→P bundle and narrow bridge, including postgres creator ADMIN-only role membership (SET=false, INHERIT=false), schemas exposed through the Data API, and every legacy table/column/function privilege.
3. Rehearse exact migration and deny-all rollback on disposable PostgreSQL 17 in GitHub Actions. Include clean bootstrap, rollback, repeated run, inconsistent baseline refusal, and recovery exercises.
4. Obtain **separate explicit approval** before any hosted migration/grant/LOGIN change, fictional Auth identity/email, or deployment. Do not place database credentials or user records in GitHub.
5. With private ingress closed, apply only reviewed changes, provision three independent restricted secret-managed LOGIN principals, validate TLS trust and runtime effective privileges with their actual connections; rollback first closes ingress and revokes runtime connection access without restoring old direct-API bypasses.
6. Deploy only after distinct HTTPS origin/callback and provider policy approval; execute real fictional owner/staff/client cross-tenant and signed REST/GraphQL negative journeys, revocation, expiry, provider outage, media and restoration checks. Production is a separate release decision.

No hosted modification, deployment, identity creation, paid upgrade or claim of live acceptance results from this PR.

### Release verdicts
- **Source:** pending exact-commit CI of this review branch.
- **Hosted catalog:** partial read-only observations only.
- **Real provider lifecycle:** BLOCKED pending supported policy verifier + approval.
- **Hosted tenant acceptance:** BLOCKED pending private schema/logins/deployment + approval.
- **Operational recovery:** BLOCKED.
- **Production:** BLOCKED.
