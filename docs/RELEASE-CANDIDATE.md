# Consolidated source candidate — 30 October 2026

Branch: `release/growth-starter-candidate-20261030`. Repository: `sohail654312-gif/codeedge-growth-starter`. All editing, dependency resolution, builds and tests for this candidate occur through GitHub and GitHub-hosted runners.

## Problem and resulting behavior

The early preview, newer private application and security reviews were spread across branches, and tests at different commits could be mistaken for evidence for one complete release. This candidate combines the latest security-review ancestry with the outstanding CSV correction and patched Vite, then requires the complete source matrix at one exact commit.

## Reconciliation

| Existing work | Candidate decision |
| --- | --- |
| PR #2, engineering `9bddbbf029b7754566126be8a2225c776457326e` | Newer private application and existing acceptance suites are retained through PR #30 ancestry. |
| PR #3, `74596020629be0f5b6febbdb004434a9d752e7e2` | Apply the whitespace-aware keyword CSV correction and all three regression tests. Its standalone workflow is replaced by the complete candidate matrix. |
| PRs #7–#30 | Retain the latest cancellation, effective-privilege, pooled-transaction and Auth-bridge review state carried by `6d7aecec51f3ee566de1b818872d4b71d0965f0d`. SQL stays review-only. |
| PR #4 | Historical tenant catalog audit. Keep its findings as hosted acceptance questions; do not import the old seven-table model as the current hosted schema. |
| PR #5 | Historical Edge feasibility review, not a deployable adapter. Its old transaction-signature assertion no longer matches the hardened runtime; no Deno/Edge readiness is claimed. |
| PR #6 | Historical recovery recommendation. The later mandatory exact-session authority remains authoritative; no relaxed fallback is activated. |

Existing PRs and branches remain available for review. This candidate does not merge or close them automatically.

## Dependency correction

Pin Vite 6.4.5 for CVE-2026-118662 / GHSA-8g5g-mxqh-grgj. Its package metadata was resolved by npm on a GitHub-hosted runner. Only the root Vite declaration and Vite package entry change in the lockfile; unrelated native optional-package libc metadata is preserved. No force audit fix or unrelated version update is applied.

## Exact-commit validation

Every candidate push triggers core source checks, PostgreSQL security, UI/browser checks and supply-chain/container checks. The PostgreSQL workflow runs the synthetic Auth bridge first with its explicit disposable marker, then the remaining database suite. Full CI must cover the combined application and hardening.

The separate candidate evidence workflow waits for all four **push** workflows at the same commit and branch, checks the remote head and clean checkout, and publishes `candidate-evidence-<commit SHA>`. It rejects missing, pending, failed, stale, forked, wrong-branch or forged-URL evidence. A newer failed/pending run supersedes an earlier successful run.

Evidence is stored as a GitHub Actions artifact and job summary, not as a self-referential commit that changes the SHA after testing. An unavailable or expired artifact requires fresh CI. The source verdict can become SOURCE_READY; hosted staging, production and the overall deployment verdict remain BLOCKED.

## Current scope and unresolved gates

- Private profiles, work requests, role-specific review/corrections, assignment, history and scoped reports exist in source.
- Login still requires a separately accepted exact provider-session/account-policy module. The narrow bridge is a data primitive, not complete provider lifecycle acceptance.
- PR #30 reports a hosted bridge installation/catalog pass. This candidate does not re-probe it or treat that report as current runtime/tenant acceptance.
- The O→K→M→P bundle and its October 14 catalog remain a historical rehearsal baseline. Reconcile current hosted schema, grants, defaults and migration history before proposing any execution. No migration is applied here.
- Real signed A/B/C tenant journeys, REST/GraphQL bypass denial, identity admission/invitations, private storage/scanning/deletion, hosting/credentials, operational load and restore remain unaccepted.
- Workspace discovery remains capped at 25. Reports describe the loaded page. Named-member selection and a complete agency onboarding journey remain later work.
- The portable private UI does not yet provide full enquiry/CRM parity or live Google/social/AI-provider integrations.
- Current source tests do not establish current credential-history scanning or a live penetration test.

## Review and rollback

Review this candidate as one source package against the engineering branch. Keep it draft until independent review. Source rollback is reverting this candidate's commits or closing its draft PR. Hosted data, permissions, services and the AppDeploy preview are untouched; no database rollback is needed for this work.
