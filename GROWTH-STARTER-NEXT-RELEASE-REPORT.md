# Codeedge Growth Starter — Next Engineering Release Report

**Execution date:** 2026-10-29 (Asia/Karachi).  
**Repository:** `sohail654312-gif/codeedge-growth-starter`  
**Source branch:** `review/growth-starter-auth-cutover-hardening-20261029`, stacked as **DRAFT PR #8** on top of **DRAFT PR #7**.  
**Engineering production candidate:** none, `engineering/phase2-core-security` remains unchanged at `9bddbbf029b7754566126be8a2225c776457326e`.

## Independent observed baseline

- Existing `main`: `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.
- PRs #2, #6, #7 all open/draft during investigation; no unresolved inline threads were reported by GitHub.
- Connected Supabase staging `dbppeymhsemvghbvuvof` remains `ACTIVE_HEALTHY` on PostgreSQL 17.11.
- Read-only SQL confirmed 7 application tables, 3 RLS policies, 0 FORCE RLS tables, 15 authenticated SELECT-column grants, 3 privileged functions and no installed private schema.
- The read-only **v2** role catalog independently executed on the real staging project. It showed old `growth_starter_runtime` still has **1 role membership**, old reader-role SET access and legacy EXECUTE. This is unresolved privilege surface, not proof of an exploit or breach.
- Supabase Security Advisor has 4 informational `rls_enabled_no_policy` findings for intentionally default-denied private tables. Do **not** create browser policies merely to eliminate INFO notices. Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Actual source changes in this review branch

| File | Correction |
|---|---|
| `db/reviews/phase315r_effective_privileges_READ_ONLY.sql` | Catalog schema v2, captures role inheritance, CREATEROLE, CREATEDB, REPLICATION and granted membership counts; verified read-only on hosted staging. |
| `scripts/phase315r-cutover-evidence.mjs` | Rejects missing/unsafe issuer, gateway, writer, operations owner and checker role capabilities. v1 evidence cannot pass. Hosted and production conclusions remain BLOCKED. |
| `tests/phase315r-cutover-evidence.test.mjs` | Negative tests for privilege escalation, inherited membership, missing properties and stale catalog format. |
| `backend/exact-session-authority.mjs` | Post-lookup cancellation guard; late provider success cannot authorize an already-aborted check. |
| `tests/phase315o-auth.test.mjs` | In-flight abort and missing/outage provider facts deny authorization. Mock provider tests only. |
| `.github/workflows/cutover-catalog-review.yml` | Isolated review branch CI for catalog regressions and full source tests; no service credentials required. |
| `GROWTH-STARTER-COMPLETION-BASELINE.md` | Append actual October 29 catalog and source-security findings without guessing percentages. |
| `AUTH-AUTHORITY-ACCEPTANCE.md` | Exact provider authority contract, limitations, supported docs and live test matrix. |
| `DATABASE-CUTOVER-READINESS.md` | Hosted read-only baseline, version 2 security evidence and gated cutover prerequisites. |
| `CLIENT-WORKSPACE-ACCEPTANCE.md` | Source vs actual hosted journey distinction and clinic/UK trades acceptance scenarios. |

## Verified CI evidence

**At pre-report source snapshot** `d15215cbf382d2262a3218fd5d88c5b0d56f9429`:
- Isolated pull-request regression workflow: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/40839151530 — **SUCCESS** (decoded job log).
- Catalog / privilege regressions: **11 passed, 0 failed, 0 skipped**.
- Source regression suite: **257 passed, 0 failed, 0 skipped**. Counts overlap; do not sum as unique tests.
- An earlier push workflow at source SHA `6b4432940b98469c5ed09c3b9d3d5bc09a8835cc`: https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/40838858353 — SUCCESS, same 11 and 257 results.
- These workflows are test-only, not live provider, direct API/GraphQL, disposable PostgreSQL integration, browser build, supply-chain or hosted release evidence **for this review SHA**. The four prior engineering-branch source workflows were successful at the **different** engineering SHA; they cannot be substituted for complete exact-SHA acceptance here.

The report file may be committed after the listed test SHA. Re-fetch the live branch HEAD and workflow executions for final acceptance; documentation changes do not retroactively authenticate an earlier test result.

## Phase verdicts

| Gate | Current verdict | Basis |
|---|---|---|
| Security catalog v2 and cancellation source work | **SOURCE TESTS PASS** | Isolated actual GitHub Actions job |
| Original Supabase session/account-policy authority | **BLOCKED** | Provider-supported exact session and account rules unverified; no external authority activated |
| O → K → M → P hosted restricted runtime | **BLOCKED** | New roles/schema absent; no approved migration or live LOGIN preflight |
| Direct REST/GraphQL signed bypass probes | **BLOCKED** | Provider configuration, fictional signed sessions and owner approval missing |
| Private media/live content and communications | **BLOCKED for commercial claims** | Provider contracts, private storage, scanning/consent and delivery not verified |
| `SOURCE_READY` for **entire** candidate | **NOT ESTABLISHED at this review SHA** | Full original workflow matrix not rerun at new branch SHA |
| `HOSTED_STAGING_READY` | **BLOCKED** | No approved hosted app + credential and restricted database acceptance |
| `PRODUCTION_READY` | **BLOCKED** | No independent hosted acceptance, operational restore or owner release sign-off |

## Exactly what requires owner/provider decisions

1. Supported original-session and account-policy authority (support tickets `SU-502526`, `SU-503988`) **or** a separately reviewed/approved provider-neutral Auth replacement contract. Do not weaken existing fail-closed checks.
2. Exact hosting provider, canonical HTTPS origin, costs, private ingress and secret vault.
3. Backup and independently tested restore, reviewed O→K→M→P SQL hashes, least-privilege login identity provisioning and staged legacy cutover.
4. Permission to create approved fictional hosted Auth A/B/C test identities and perform signed direct API/GraphQL and full PKCE revocation/denial journeys.
5. Only after staged proof: independent reviewer and owner authorization to merge and production release.

## Preservation and rollback

Nothing was changed in hosted roles, permissions, tables, Auth users, aliases, AppDeploy demonstrations, other Codeedge products or external providers. PR #8 remains **DRAFT**, stacked on PR #7, and must not auto-merge to `main`. Rollback of source changes means closing/reverting the isolated review PR; hosted rollback would require a separately reviewed deny-only and backup plan.

**Conclusion:** The security evidence tool is stricter and the provider cancellation boundary has additional fail-closed tests. Provider session guarantees, restrictive hosted database deployment and client acceptance are **not** yet solved. No fabricated completion percentage or 100% claim.
