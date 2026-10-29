# GROWTH STARTER — COMPLETION BASELINE (independent)

**Observed:** 2026-10-29, 07:32–07:40 UTC (read-only Supabase catalog and GitHub connector).
**Repository:** `sohail654312-gif/codeedge-growth-starter`.
**Engineering baseline SHA:** `9bddbbf029b7754566126be8a2225c776457326e`, branch `engineering/phase2-core-security`, draft PR #2.
**Independent evidence branch:** `review/growth-starter-completion-baseline-20261029`, based on that engineering SHA. This report and a cutover-evidence regression are NOT a hosted release.
**Recovery review:** draft PR #6 at `7ab6b27b69aeed9d5a80e09f4ffcb1bdd5ab63eb`; its single new file records the recovered project and is not merged.
**Verdict:** Database available; source workflows pass at engineering SHA; **HOSTED STAGING NOT ACCEPTED / PRODUCTION NOT ACCEPTED**.

## Evidence actually checked in this review

1. Connected Supabase project `dbppeymhsemvghbvuvof` reports `ACTIVE_HEALTHY`, Postgres `17.11` in `ap-south-1`; read-only `SELECT` of database version and catalog succeeded. This is database availability only.
2. Seven recorded managed migrations: `20261008141834`, `20261008141846`, `20261008143234`, `20261008145300`, `20261008145917`, `20261010063818`, `20261010063911`. No additional private-schema migration recorded.
3. Seven `growth_starter` tables have RLS enabled; none has FORCE RLS. Three SELECT policies exist on `memberships`, `workspaces`, `work_requests`; four other tables have no policies (default deny, **not** a reason to add broad policies). Security Advisor reports four informational RLS/no-policy notices.
4. `authenticated` has `growth_starter` schema USAGE and **15 direct SELECT-column grants** (5 memberships, 3 workspaces, 7 work requests). This is a remaining permission surface, **not a proven leak**. Whether the schema is exposed in REST/GraphQL needs Dashboard settings and authenticated signed HTTP probes.
5. Three historical `postgres`-owned `SECURITY DEFINER` functions remain: `staging_list_workspaces`, `staging_list_requests`, `staging_session_active`. The old `growth_starter_runtime` → `growth_starter_reader` SET-role edge and reader function EXECUTE remain.
6. `growth_starter_private` schema and new `gs315m_issuer`, `gs315k_gateway`, `gs315p_writer` LOGIN roles do not exist in hosted staging. `growth_starter_session_checker` is NOLOGIN and lacks managed Auth schema USAGE.
7. Current exact-SHA GitHub **push** workflows all concluded success:
   - Core safety: [run 38615269140](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38615269140).
   - Disposable Postgres 17: [run 38615269159](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38615269159).
   - UI, SEO, Chromium/HTTPS: [run 38615269369](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38615269369).
   - Supply chain and container refusal: [run 38615269209](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38615269209).
   The additional PR-triggered workflow runs succeeded; **do not double-count** as additional independent suites. Exact individual latest-SHA test counts were not extracted from the full logs in this review. Previous published counts are at older commits and do not replace the current evidence.
8. AppDeploy has public-facing Codeedge Growth Starter and clinic/trades **demonstrations**. A demo deployment is not the separately built private, hosted Node/Postgres workspace, nor proof of provider authentication, message delivery or live growth metrics. No AppDeploy application was changed.

Evidence derived from read-only system/catalog metadata, GitHub workflow metadata and inspected handoff/source. No user or session row data, credentials, patient data, customer information, write SQL, hosting deployment or paid resources were used.

## Acceptance ledger and weights (NOT a completion percentage)

Weights are a proposed **release-acceptance** rubric totalling 100, not claimed earned points. No score can be earned for a phase without requirement-level pass/fail evidence for the corresponding environment. Source simulations cannot substitute for hosted or provider acceptance. Recompute only after individually bound tests and owner/reviewer sign-off.

| Phase | Weight | Current classification | Acceptance missing |
|---|---:|---|---|
| 0 Discovery/baseline | 8 | IMPLEMENTED AND VERIFIED (partial live catalog, GitHub metadata) | Full dependency/PR conflict inspection; dated acceptance inventory |
| 1 Auth/session | 18 | IMPLEMENTED BUT NOT LIVE-VERIFIED | Supported exact original session + account/policy semantics, live login and revocation |
| 2 Database isolation | 14 | PARTIALLY IMPLEMENTED | Approved O→K→M→P hosted restricted cutover, actual logins, signed cross-tenant denials |
| 3 Private workspace | 10 | IMPLEMENTED BUT NOT LIVE-VERIFIED | Real HTTPS host, owner/staff/client acceptance and lifecycle |
| 4 Website/SEO/AEO/GEO | 8 | PARTIALLY IMPLEMENTED | Authorized provider data, reporting and change-approval acceptance |
| 5 Social/content | 6 | PARTIALLY IMPLEMENTED | End-to-end approval, asset rights and optional approved publisher |
| 6 Lead/communications/AI | 7 | PARTIALLY IMPLEMENTED | Accepted provider adapters, consent, delivery/opt-out and human takeover |
| 7 Private media | 5 | PARTIALLY IMPLEMENTED | Live private storage, scanning/quarantine, deletion worker and retention |
| 8 Automation | 4 | PARTIALLY IMPLEMENTED | Durable hosted jobs, provider idempotency and failure recovery |
| 9 UI/demo | 5 | IMPLEMENTED BUT NOT LIVE-VERIFIED | Hosted private mobile and accessibility acceptance; clearly fictional clinic/trades walkthrough |
| 10 QA/security | 6 | IMPLEMENTED AND VERIFIED (source/CI scope only) | Independent real A/B/C, signed API/GraphQL, backups, load and browser acceptance |
| 11 Hosting/cutover | 7 | BLOCKED BY EXTERNAL DEPENDENCY | Approved HTTPS provider/host/callback/secrets, successful staging and recovery |
| 12 Client/commercial | 2 | PARTIALLY IMPLEMENTED | Launch/support/checklist, account and spend permissions, client UAT |
| **Total** | **100** | **No overall completion percentage attested** | |

## Blocking gaps — cause, affected source, risk and required proof

| ID / priority | Observed cause and source | Operational risk | Required correction / acceptance |
|---|---|---|---|
| AUTH-01 CRITICAL release gate | Exact original Supabase session/account policy contract unresolved: `backend/exact-session-authority.mjs`, `backend/pg-session-authority.mjs`, `staging/phase315m-bootstrap.mjs`; official sessions docs do not guarantee immediate JWT revocation | Logged-out, banned or deleted identity could retain token or be accepted by a weaker fallback | Written supported least-privilege contract and negative lifecycle tests, or **separately owner-approved** provider-neutral identity redesign. Must fail closed until accepted. |
| DB-01 HIGH | Reviewed O→K→M→P scripts in `db/drafts/phase315k_private_sessions_REVIEW_ONLY.sql`, `phase315m_private_issuer_REVIEW_ONLY.sql`, `phase315p_operations_REVIEW_ONLY.sql` have not been applied to staging | Private runtime lacks restricted authenticated DB entrypoints | Validate hashes, schema/index/default/grant drift, disposable PG17 rehearsal, backup/restore and exact owner-approved hosted cutover; verify real restricted logins and FORCE RLS. |
| API-01 HIGH | Historical authenticated column grants, legacy actor-argument definers and role edge persist. Review `db/reviews/phase315r_effective_privileges_READ_ONLY.sql` and `db/drafts/phase315j_direct_api_legacy_cutover_REVIEW_ONLY.sql` | Potential gateway bypass if exposed and permissive policies/functions | Dashboard exposed-schema review plus signed own/other-tenant REST and GraphQL probes including stale JWT after logout; retire old grants/functions only **after** replacement and approved rollback. |
| RLS-01 HIGH defense in depth | `work_requests` SELECT policy presently relies on filtered `workspaces` rows; the workspaces policy currently applies owner/member checks | A future workspace RLS policy relaxation could weaken request reads | Preserve restrictive workspaces policy; add an independent explicit membership predicate only after reviewed migration and negative tenant tests. No leak is asserted. |
| HOST-01 BLOCKED | Private Node HTTPS gateway/hostname, secret injection, actual PG restricted LOGIN pools not hosted. See `docs/STAGING-DEPLOYMENT-RUNBOOK.md` | Source tests cannot establish network/auth/cookie behavior | Approve existing low-cost environment and exact canonical TLS origin; deploy **staging only** after privilege/authority gates, run live acceptance. |
| MEDIA-01 HIGH before activation | Media authorization and deletion queue implemented; no confirmed private storage/scan/delivery worker. See `backend/phase315p-private-operations.mjs` | Unsafe upload/download or false processed/deleted claims | Private bucket, MIME/signature/size checks, quarantine, tenant signed delivery, durable delete/retention and real worker failure tests. |
| PROVIDER-01 BLOCKED | SEO/social/GBP/GSC/analytics and client messaging adapters remain disconnected; see `docs/REMAINING-EXTERNAL-BLOCKERS.md` and `src/SeoGrowthManager.tsx` | Fictional engagement/revenue/publishing mistaken as real | Client-approved OAuth/scopes and provider contracts, audited errors and consent, no real effects before approval. |
| OPS-01 BLOCKED | No approved staged backup restoration, operational RPO/RTO, monitoring, real-user capacity baseline or incident owner | Data loss, long outage or unsupported client SLA | Demonstrate isolated restore, failure recovery, alerts, log redaction, limits and emergency deny-only rollback. |
| RELEASE-01 BLOCKED | PR #2 and PR #6 remain DRAFT. `scripts/release-readiness.mjs` deliberately blocks hosted/production independently of CI | Misrepresenting green CI as deployment acceptance | Current-SHA CI + signed hosted results + independent security review + explicit owner release approval. |

## Reversible security-engineering correction accompanying this baseline

`scripts/phase315r-cutover-evidence.mjs` previously verified only `gs315p_writer` and `gs315p_ops_owner` as new private identities. Its catalog status could say `MATCHES_EXPECTED_VALUES_UNATTESTED` despite missing `gs315m_issuer` or `gs315k_gateway`, although private runtime requires all three isolated LOGIN pools. The independent branch adds fail-closed `issuer_identity` and `gateway_identity` checks and negative tests in `tests/phase315r-cutover-evidence.test.mjs` for absent roles, no LOGIN, SUPERUSER or BYPASSRLS drift. This does **not** install roles, grant permissions, upgrade migration readiness or claim provider authority. Source CI at the **new review commit** must pass before accepting this correction.

## Exact decision gates / rollback boundaries

**Immediately allowed:** continued read-only catalog analysis, code/test improvements on isolated review branches, fictional disposable PostgreSQL 17 CI and documentation. Preserve main, PR #2, all other Codeedge projects, Demo/Sandbox data and AppDeploy deployments.

**Requires a separately reviewed owner decision:** real provider Auth contract or a replacement security contract; managed Auth grant/role change; any hosted O→K→M→P migration, ACL revoke or LOGIN credential; A/B/C fictional hosted Auth account creation; host/domain/deployment; backup and restore operation against hosted resources; external OAuth, email, WhatsApp, publishing, payments and costs.

**Rollback contract:** block private ingress; revoke new private execute rights if approved; retain existing tables and data; never restore an unsafe broad browser grant to recover availability; test recovery on disposable infrastructure before hosted changes. Do not promote or merge `main` until hosted staging, independent reviewer and owner release acceptance all pass.

## References

- [PR #2](https://github.com/sohail654312-gif/codeedge-growth-starter/pull/2) and [PR #6](https://github.com/sohail654312-gif/codeedge-growth-starter/pull/6)
- [Supabase user sessions](https://supabase.com/docs/guides/auth/sessions), [user management](https://supabase.com/docs/guides/auth/managing-user-data), [Data API security](https://supabase.com/docs/guides/api/securing-your-api)
- Repository: `docs/FINAL-CODEX-TO-CHATGPT-HANDOFF.md`, `docs/SUPABASE-SESSION-AUTHORITY-FINAL-DECISION.md`, `docs/PHASE3-15R-CUTOVER-EVIDENCE.md`, `docs/REMAINING-EXTERNAL-BLOCKERS.md`
