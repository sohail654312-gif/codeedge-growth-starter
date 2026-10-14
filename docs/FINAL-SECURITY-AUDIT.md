# Fresh security audit

Date: 2026-10-14. Scope: current engineering source, read-only staging metadata,
official provider documentation, dependency audits and fresh disposable acceptance.
This is a fresh engineering audit pass, not independent human signoff, penetration
testing of a deployed service or verified Supabase logout behavior. Separate
independent reviewer acceptance remains mandatory before hosted changes/release.

## Findings corrected in source

| Severity | Finding | Correction and evidence |
|---|---|---|
| HIGH | Operational store required disposable administrator table access | Separate fixed-function writer, NOLOGIN/NOBYPASSRLS owner, forced RLS, exact EXECUTE and privilege-drift preflight; real network-role PG tests |
| HIGH | New private operations could otherwise be exposed without cookie/CSRF/session composition | All HTTP operations use session cookie; mutation Origin/CSRF/body checks before SQL; actor/role/token body claims discarded; synthetic transport plus composed callback->PG->logout test |
| HIGH | Older private read authority accepted missing expiry / an invalid server clock | Require safe current time and future integer provider expiry in M as in P; missing/wrong-type/invalid-clock regressions deny before data callbacks |
| HIGH | Tailwind 3 tooling pulled unpatched braces recursion DoS | Removed unused compiler; MIT static reset preserved, pinned root lockfile; root audit currently zero findings |
| HIGH | Test image decoder used vulnerable bundled native libraries | Updated sharp to 0.35.5; real malformed/oversized image PG tests and high-severity audit included in CI |
| MEDIUM | Separate migration drafts could be applied against drifted baseline/partial state | Ordered atomic review bundle, exact observed column/constraint baseline, pre/postflight; altered baseline rejects and mutation/audit failure rolls back |
| MEDIUM | P definer owner privilege drift could broaden hidden capabilities | Writer preflight checks owner attributes, unexpected table privileges, destructive/CREATE privileges, owners/search paths and browser/private function access |
| MEDIUM | UI workspace editing could mix displayed source and mutation target | Active workspace remains separate from selector; only successful authorized load changes active workspace; scoped server list and generation fencing |
| LOW | Readiness/CI snapshots could be mistaken for release proof | Readiness says releaseReady false; release collector fetches exact-SHA remote push workflows, rejects stale/fork/failed evidence and always blocks missing hosted facts |

Dependency facts were checked against the current advisory records:
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[PostCSS parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf),
[sharp native dependency](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).

## Unresolved findings

| Severity | Finding | Class and required action |
|---|---|---|
| HIGH | Supported exact original provider-session and account/policy authority unverified | Supabase support / independent review. Keep fail-closed boundary; no managed Auth privilege activation |
| HIGH | Old reader/runtime actor-argument definers and SET ROLE edge remain in staging | Hosted approval. Replace first, then approved J cutover and negative probes; never restore for rollback |
| HIGH | Historical authenticated column reads can bypass Codeedge logout if Data API exposed | Hosted configuration/approval. Actual exposed schemas and signed REST/GraphQL denial unverified; conditional risk, no confirmed cross-tenant leak claimed |
| MEDIUM | No approved HTTPS host, secrets, canonical hostname or actual identity flow acceptance | Hosting/owner dependency. Container/startup refusal does not prove deployment |
| MEDIUM | Media storage/scan acceptance and private invitation delivery are not live | Provider/owner dependency. Existing source contracts remain; no upload/deletion/send is scheduled or activated |
| MEDIUM | Per-workspace exclusive lock limits concurrency; retention/capacity unknown | Operations acceptance. Measure representative load; preserve lock order and deny on deadlines; approve retention before cleanup |
| MEDIUM | In-memory UI retry keys do not persist through reload; old full PG suites need a fresh database | Documented operating limits. Inspect requests after ambiguous reload; use fresh disposable clusters, not a populated previous run |
| MEDIUM | Sandbox journal is local, not distributed production tenancy | Unconnected integration. No live/distributed scheduler; external adapters remain disabled |
| LOW | Accessibility verified automatically on fixtures and the built HTTPS/PG application | Independent human screen-reader and complete hosted-flow review remains required |
| INFORMATIONAL | PUBLIC TEMP/extension privileges are ambient PostgreSQL capabilities | Do not claim zero capabilities; audit extensions on actual host, qualified objects and last pg_temp search path |
| INFORMATIONAL | Supabase advisor returned four RLS-enabled/no-policy notices on audit/invitation/media/outbox tables | Expected historical default-deny; do not add public allow policies to silence notices. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |

No independently fixable Critical/High issue discovered in the new source package
remains open. The hosted High findings remain open because this assignment explicitly
forbids their unapproved live changes. Source readiness requires current-SHA CI;
hosted and production readiness remain BLOCKED regardless of source test success.

## Audit coverage

Architecture: fixed-purpose operations, separate issuer/gateway/writer principals,
no raw privileged executor, no shared SDK bypass. Authentication: one-time PKCE flow,
provider-returned identity, bounded exact authority, HttpOnly session and generic errors.
Authorization/tenant isolation: current workspace/membership under locks; actor derives
from stored credential; only owner/agency audit, staff review, owner/client approval.
Sessions: original provider pair kept distinct from Codeedge session, membership and JWT.

PostgreSQL: version and baseline checks, forced RLS, restricted EXECUTE, safe ownership,
qualified search paths, explicit browser default-grant removal and role-edge checks.
Transactional integrity: receipts after authorization, concurrent replay, version/CAS,
atomic business/audit/receipt rollback, revocation ordering and bounded waits.
Media: approved rights/consent/scan predicate, immediate tombstone, exact outbox reference,
existing fenced leases and bounded manual storage worker; actual provider remains disabled.

Reliability: bounded pages/notes/streams, three small pools, client/server/database
deadlines, no automatic ambiguous-effect retry, generation-fenced UI loading and bounded
shutdown. Growth/provider integration: offline evidence labels and disconnected live
providers; no ranking/revenue/traffic fabrication or publishing/payment/message effects.
Recovery: private EXECUTE/USAGE and LOGIN lockdown affects existing pooled connections,
keeps records and legacy deny-all; backup restore and hosted recovery still need acceptance.

## Evidence limits

Final assignment review additionally fixed scope/history/detail response races,
idle session-screen erasure, unusable stale cookies after SQL expiry, callback
error URL serving and nondeterministic initial workspace selection. Owner
revocation/media queue and scoped reports/history paging are connected in the UI.
The actual built app now has six HTTPS/PG browser journeys across mobile/desktop,
including all four roles, owner-to-client workspace switching, review/corrections,
reports, logout, denial, provider failure and new-owner onboarding. All use
fictional users and synthetic provider responses, never live Supabase acceptance.
Metadata-only runtime logs and a review-only monitoring template were added;
regressions prove callback secrets, cookies, bodies, identities and SQL are omitted.

Local source tests and PG17 execute fictional A/B/C/D, including actual restricted
database logins and cookie transport. Provider APIs are synthetic, so no real
Supabase logout/admin/password/reset behavior is established. Browser fixtures test
mobile/desktop role states, conflict errors and axe checks; they are not live clients.
Container build and refusal are verified by GitHub Actions for the delivery SHA.
The generated evidence lists final CI URLs; an earlier-SHA result is not accepted.
