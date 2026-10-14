# Codeedge Growth Starter — final Codex to ChatGPT handoff

Updated October 14, 2026, Asia/Karachi. Source engineering delivery; no hosted activation.

## Identity and handoff boundary

- Repository: `sohail654312-gif/codeedge-growth-starter`.
- Branch: `engineering/phase2-core-security`.
- PR: https://github.com/sohail654312-gif/codeedge-growth-starter/pull/2 — OPEN, DRAFT, unmerged.
- Re-fetched starting implementation: `e4fc4e72395541582f43d9b86f6377cbf8484aa4`.
- Delivery identity: resolve `git rev-parse HEAD` and compare with the remote branch. The generated release-readiness JSON records the exact delivery SHA and four exact-SHA push CI URLs. Do not substitute an earlier implementation or documentation SHA for this check.
- Canonical generation command: `node scripts/release-readiness.mjs <outside-checkout-output.json>`; exit 2 means hosted/production BLOCKED, even when source is SOURCE_READY.

The final verification record is appended after the implementation push. A documentation commit cannot embed its own hash; the collected delivery evidence and PR carry that exact final identity. Do not treat a hand-entered readiness boolean as acceptance.

### Verified implementation record

Implementation commit: `097abccf70319bbe7af073427faace94ba22aa40`. All four exact-SHA **push** workflows completed successfully, with job logs inspected:

| Workflow | Verified result | CI evidence |
|---|---|---|
| Core safety | 238 tests, 238 pass, zero failures | [run 38608608272](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38608608272) |
| Disposable PostgreSQL 17 | 70 tests, 70 pass, zero failures | [run 38608608278](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38608608278) |
| UI/SEO | Both typechecks/private build; 12 existing + six integrated Chromium tests; 39 overlapping SEO tests; zero failures | [run 38608608277](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38608608277) |
| Supply chain/container | Root/staging audits zero findings; 16 overlapping staging tests; container built and unapproved startup refused | [run 38608608321](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38608608321) |

The browser dependency audit also returned zero vulnerabilities. These counts overlap; do not sum subset suites as unique tests. `artifacts/final-implementation-verification.json` preserves the fetched release snapshot bound to this implementation. Subsequent documentation/evidence commits must also pass all four exact-head workflows; regenerate the delivery JSON from the final clean pushed HEAD before accepting it. Source readiness does not establish hosted provider or production acceptance.

## Application and security architecture

`private.html` / `src/private-main.ts` builds `PrivateWorkspaceApp` separately from the existing AppDeploy demo. Vite's private build has no platform SDK dependency. The browser uses only same-origin HTTPS cookie requests through `src/private-workspace-client.mjs`; it never receives provider bearer/refresh tokens, PKCE verifiers, grants or database credentials.

`staging/phase315m-bootstrap.mjs` requires owner/reviewer evidence, exact commit/origin and the hash of a separately accepted provider authority module before opening a listener. `phase315m-server.mjs` composes assets, secure ingress, structured metadata-only logs, health checks, the existing Supabase PKCE HTTP adapter and the restricted SQL runtime. CLI startup without approval deliberately refuses.

Three independent real login pools are used: issuer `gs315m_issuer`, reader/logout gateway `gs315k_gateway`, operational writer `gs315p_writer`. Each production pool is capped at two connections. Fixed parameterized functions derive the actor from a hashed Codeedge session. NOLOGIN, non-BYPASSRLS function owners, qualified objects, restricted EXECUTE and forced RLS are checked on the actual runtime logins. No administrative raw SQL endpoint or browser role switch exists in this runtime.

PKCE flows are browser-bound, consumed before exchange and single-use. Issuance requires the provider-returned confirmed subject/email, fresh original session claims and the mandatory exact authority. Codeedge sessions expire within 15 minutes, with SQL expiry and transactional logout/revocation. Every operation checks the original provider pair before its business function and revalidates Codeedge/current workspace membership inside SQL. Provider waits are bounded and abortable. Session → workspace → business-row locking and durable receipts preserve authorization and mutation/audit ordering.

## Completed application journey

The built HTTPS application has been exercised through sign-in initiation, synthetic PKCE callback, workspace selection, private dashboard, business profile, request creation, current-member assignment, staff/agency review, client correction notes, reviewed-version approval, completion, reports/history, owner membership revocation, media deletion queue and logout/replay denial.

Workspace changes clear prior profile, detail, history, role and inputs. Late detail/history/mutation responses are fenced. Login prefers an owned workspace; a shared workspace can be selected explicitly. Expired/revoked Codeedge sessions return 401 and clear stale authentication cookies, so a new login can start. The UI clears private data at its server-supplied deadline, including on focus/visibility changes, and suppresses late responses. Callback failure URLs and workspace query URLs serve the built UI correctly while traversal remains denied.

The UI includes loaded-page search, server status filters, signed keyset request pages, older audit-event pages, conflict/network/unauthorized/empty/loading states and an explicitly loaded-page report. No full-workspace aggregate or live-provider report is implied. Access/media controls use exact IDs supplied by the agency; server-side current-member and tenant checks remain authoritative.

Offline SEO, local SEO, AEO, GEO, schema/calendar/content planning and supplied extracts remain available through Growth tools. Google/social/analytics contracts remain provider-neutral and disconnected. Fictional examples are labelled; no traffic, ranking, revenue, payment, publication or campaign success is invented.

## Verification and reproduction

Run with Node 22+ from the repository:

```sh
npm ci --ignore-scripts --no-fund
node --test tests/*.test.mjs backend/pg-session-authority.test.mjs
npx tsc --project tsconfig.seo.json --noEmit
npm run typecheck:private
npm run build:private
node scripts/phase315p-migration-bundle.mjs
npm audit --audit-level=high
npm ci --prefix staging --ignore-scripts --no-fund
npm audit --prefix staging --audit-level=high
npm ci --prefix tests/ui --ignore-scripts --no-fund
npm audit --prefix tests/ui --audit-level=high
npm test --prefix tests/ui
```

For the database suite, provision a NEW disposable loopback PostgreSQL 17 cluster with database `gs_test`, set `TEST_DATABASE_URL` only to that disposable database, and put OpenSSL on PATH:

```sh
node --test --test-concurrency=1 tests/postgres/*.test.mjs
# Then, sequentially, after the generated P/M roles have been removed:
cd tests/ui
npx playwright install chromium
npx playwright test --config playwright.integrated.config.mjs
```

On Windows, `GS_TEST_OPENSSL` can name the exact OpenSSL executable. The integrated harness requires the explicit fictional flag set by its Playwright config, guards the loopback URL/database/PG version, creates its own randomly named database, uses actual restricted network login roles, builds a one-day localhost test certificate and removes its database/roles before acknowledging shutdown. The TLS trust exception is confined to this disposable browser config. Never run this harness against hosted or shared databases. Do not run it concurrently with the database suites because PostgreSQL roles are cluster-wide. Older full suites leave disposable fixtures; provision a new cluster before rerunning all of them.

Expected local acceptance: all core tests, 70 PG17 tests, 12 existing Chromium tests and six actual built HTTPS journey tests; both UI typechecks, private build, bundle/drift assertions and three dependency audits. Browser tests run mobile 390×844 and desktop 1280×900, axe WCAG A/AA checks, overflow assertions, version conflicts, all four roles, tenant/role/CSRF/callback/logout denial, provider mismatch/outage, real SQL expiry, onboarding and UI idle deadline. The idle metadata test deliberately shortens browser metadata while leaving SQL expiry real; it establishes UI erasure, not shortened provider lifetime. CI adds the same actual build/HTTPS/PG browser journey to the existing UI workflow.

Four required workflows run on every engineering push: `source-guards.yml`, `postgres-security.yml`, `seo-ui-check.yml`, `staging-supply-chain.yml`. Supply-chain CI builds the digest-pinned non-root container and verifies refusal without activation prerequisites. Local Windows Docker is unavailable; container evidence must come from exact-SHA CI. Automated axe is not independent human screen-reader approval.

## Current hosted baseline and provider decision

Read-only metadata was refreshed October 14: staging `dbppeymhsemvghbvuvof`, PostgreSQL 17.11, `growth_starter_private` absent. Existing migration versions:

`20261008141834`, `20261008141846`, `20261008143234`, `20261008145300`, `20261008145917`, `20261010063818`, `20261010063911`.

Authenticated retains 15 column SELECT permissions across workspaces, memberships and work_requests. Three legacy actor-argument SECURITY DEFINER functions remain postgres-owned: `staging_list_workspaces(text)`, `staging_list_requests(text,text,integer)`, `staging_session_active(text,text,text)`. `growth_starter_runtime` can SET `growth_starter_reader`; both and the session checker are NOLOGIN, non-superuser/non-BYPASSRLS. The checker still lacks Auth schema USAGE. Four advisor INFO notices report historical default-deny RLS tables with no policies; do not add public allow policies to silence them.

Prior Dashboard readback showed exposed schemas public/graphql_public, Growth Starter unchecked, and no approved Auth callback redirect. That is historical configuration evidence; this final pass refreshed catalog metadata, not Dashboard settings or signed REST/GraphQL probes. No Auth user/session/customer data or secrets were read and no hosted mutation was made.

Supabase exact-session authority remains BLOCKED. Official [sessions](https://supabase.com/docs/guides/auth/sessions), [sign-out](https://supabase.com/docs/guides/auth/signout), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims), [roles](https://supabase.com/docs/guides/database/postgres/roles) and [user management](https://supabase.com/docs/guides/auth/managing-user-data) were rechecked. JWT validity can outlast logout. Session-row correlation is documented, but row existence alone does not establish refresh-enforced inactivity/timebox policies. A supported dedicated least-privilege method covering exact original session plus current ban/deletion/password/admin/global logout/policy state is still unconfirmed.

Matching connected emails for SU-502526/SU-503988 contained acknowledgments/followups, no technical provider answer. No message was sent and no claim is made about unseen support-portal conversations. Upgrading to Pro is not evidence that managed Auth permissions or semantics change.

Keep `checkProviderSession` mandatory and fail closed. Never replace it with always-active, JWT-only or getUser-only logic. The Codeedge-only session alternative requires an explicit owner security-contract decision and independent review; it is not an automatic fallback. See `SUPABASE-SESSION-AUTHORITY-FINAL-DECISION.md`.

## Exact staging cutover sequence — preparation only

1. Obtain the supported authority contract or an explicitly approved alternative security contract. Independently review the implementation and authority-module hash. Re-fetch the engineering branch and require four passing exact-SHA push workflows.
2. Approve an exact host, canonical HTTPS origin, spending limit, trusted ingress, secret channel, monitoring destination/retention, incident owner and controlled fictional Auth accounts/email delivery. Inventory legacy consumers; do not infer absence from NOLOGIN alone.
3. Refresh `db/reviews/phase315p_preflight_READ_ONLY.sql` and `phase315j_hosted_catalog_READ_ONLY.sql`, actual Dashboard exposed schemas and GraphQL configuration. Securely snapshot schema/functions/ACLs/column grants/policies/role edges and any now-present data. Prove restore in a separate disposable environment; metadata alone is not backup.
4. Generate and review the atomic O → K → M → P bundle, its LF-canonical hashes and manifest. Reconcile exact hosted columns/constraints plus defaults/indexes/policies/extensions. Rehearse bundle, cutover and deny-all recovery. Never reapply `0001` over hosted records, rewrite migration history, ignore drift or run CI fixtures on hosted.
5. With private traffic closed, separately authorized operator applies that exact atomic bundle to staging. Its pre/postflight assertions must pass before COMMIT; owner roles stay NOLOGIN and no passwords are created by it.
6. Separately activate only issuer/gateway/writer LOGIN credentials through the approved vault. Verify actual-login M/P effective privilege preflights and CA-validated session-mode port 5432 connectivity. Keep private/business schemas unexposed and authenticator unable to SET private roles.
7. Configure the exact approved callback and state-query allowlist/email template. Provision only approved fictional identities via managed APIs, with implicit signup disabled. Supply approved authority/secret files and private ingress; deploy only the explicitly approved staging image/origin. No production, other repositories or automatic merge.
8. In closed maintenance acceptance, verify fresh real PKCE and four-role workflows, own/foreign scope, membership revoke, Codeedge expiry/logout/replay, original provider mismatch/outage and supported local/global/others/admin/password/ban/deletion/policy events. Verify media rights/scan/deletion separately if its storage adapter is approved.
9. After replacement passes, execute `phase315j_direct_api_legacy_cutover_REVIEW_ONLY.sql` and its assertions in the reviewed transaction: revoke exact historical columns/schema access/old definers/reader edge. Verify Dashboard exclusion and genuine signed REST/GraphQL negative probes including an unexpired bearer after Codeedge logout.
10. Independent reviewer records current-SHA hosted acceptance, recovery drill, limits and incidents; owner separately approves release. Replace the deliberately blocked readiness collector only with an evidence-based hosted acceptance implementation, never manual booleans. PR remains draft unless the owner explicitly changes that instruction; no merge/deployment was authorized here.

## Independent read-only validation

```sh
git remote get-url origin
git branch --show-current
git status --porcelain --untracked-files=all
git rev-parse HEAD
git ls-remote origin refs/heads/engineering/phase2-core-security
git log origin/engineering/phase2-core-security..HEAD
node scripts/release-readiness.mjs <outside-checkout-output.json>
```

An authorized operator can run the two `db/reviews/*READ_ONLY.sql` files above using a securely injected read-only session. They inspect metadata only; review the current script before running. Do not paste credentialed psql URLs into commands/chat. Validate actual Data API settings separately; SQL-editor GUCs do not prove PostgREST exposure. Real signed-account probes require the separate account/test approval.

## Hosting budget and operations

Pricing checked October 14, 2026; no plan selected or purchased. [DigitalOcean's official pricing](https://www.digitalocean.com/pricing/droplets) lists Basic 1 GiB/1 vCPU at $6/month, 2 GiB/1 vCPU at $12 and 4 GiB/2 vCPU at $24. Prefer an estimated 2–4 GiB envelope for an initial always-on Node container with six DB connections, pending measured load. Daily percentage backups add 30% of VM cost. A VM entails OS patching, firewall/TLS/proxy, secret mounts, logs and incident ownership; those are not managed automatically by this repository.

[Supabase pricing](https://supabase.com/pricing) shows Pro starting at $25/month with $10 compute credit and a Micro project example; additional projects/resources/egress/backup requirements affect totals. Combined basic assumptions are roughly $37–49/month before VM backups, domain, monitoring, email/storage/egress, tax or a second staging resource; use $45–70 as a planning allowance, not a quote or authorization. Existing Free staging incurs no new paid activation here and is not accepted as production capacity/recovery.

[Render](https://render.com/pricing) offers a container/service model, but its dynamic rate table was not extractable in this check; obtain an exact quote and verify trusted peer/private ingress and secret-file capabilities before choosing it. [Vercel](https://vercel.com/pricing) lists Pro at $20/month plus applicable usage; adopting its request runtime would require an accepted platform adapter/connection/ingress proof rather than assuming this listener is a drop-in function. These are options, not provisioned environments.

`staging/monitoring.template.json` proposes 30-second liveness, protected 60-second DB readiness, bounded log fields, 5% 5xx alert over five minutes with a minimum request count and seven-day retention. None is activated externally. `private-observability.mjs` emits fixed-route/status/duration/request-ID logs only; it never logs callback URLs, cookies, identity, body, SQL or raw errors. A failed sink cannot crash responses. Health/ready never prove provider or release acceptance. Approved host abuse limits, pool pressure, clock discipline, backup RPO/RTO and real alert recipients remain operating acceptance gates.

## Safe rollback and remaining modules

Close private ingress first. Execute only separately approved P/M lockdowns to revoke private EXECUTE/USAGE and disable runtime LOGIN, including existing pooled connections. Retain session/business/audit/outbox records and old deny-all cutover. Do not delete private records, remove RLS or automatically restore unsafe legacy grants. Roll back to a verified image only while the approved schema/security contract remains compatible. Reopening requires new actual-login catalog checks, original-provider tests and independent acceptance. Restore a backup only under the approved recovery process and verified recovery point.

Remaining live work is explicit: supported authority injection and hosted policy acceptance; operator bootstrap/secrets/HTTPS host; old grants/Data API retirement; approved identity invitation/admission delivery; private media storage/scan/serving/deletion worker; external Google/social/payment/publishing adapters; distributed automation and representative capacity/backup/monitoring acceptance. Existing transactional invitation and storage interfaces are tested source contracts, not a bound private hosted product. They remain disabled; do not expose the old administrative store as the private writer or claim invite delivery/upload succeeded.

No known independently fixable Critical/High source finding from this final self-audit remains open. This is automated engineering/source review, not independent human signoff. External blockers are documented in `REMAINING-EXTERNAL-BLOCKERS.md` and the authority/cutover/deployment/audit documents. ChatGPT can continue provider correspondence, owner decisions and evidence review from this handoff without repeating repository discovery; accepted live contracts still need their specific adapter/operator integration and hosted tests.

## Evidence classes and verdicts

Local: locked installs, source/typecheck/build/audit checks and visually inspected desktop/mobile rendering. Disposable: PG17.11, actual restricted logins and built HTTPS application with fictional users/synthetic provider; database artifacts/certificates/traces stay ignored and are not committed as credentials. CI: exact-SHA GitHub source/PG/browser/container/audit results. Hosted: read-only catalog/advisor/support evidence only. Production: no deployment or acceptance.

`SOURCE_READY` requires clean synchronized source and all four current-SHA workflows. `HOSTED_STAGING_READY` is BLOCKED. `PRODUCTION_READY` is BLOCKED. No synthetic/local/CI success promotes the latter two verdicts.
