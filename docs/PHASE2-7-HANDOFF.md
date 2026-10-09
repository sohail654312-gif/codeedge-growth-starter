# Growth Starter — Phase 2.7 exact-SHA handoff

**Date:** 2026-10-09. **Existing PR:** #2, `engineering/phase2-core-security` (draft/unmerged). **Starting SHA:** `9cb71b28bafcbb3a4f0874cd45005bc0af67c719`. **Base main:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`. **Final SHA:** inspect the live PR after documentation commits, then capture exact-head CI.

## Verdict: offline Search Console evidence vertical slice implemented; real Google OAuth and hosted pilot BLOCKED.

Implemented files:
- `backend/seo-search-data.mjs` / `.d.mts`: limited CSV/normalized JSON import; scope, date, metrics and uniqueness checks; CTR/weighted-position summaries; keyword/source matching; AEO proposal hints; safe comparisons and CSV; local deterministic SEO command parser; disabled Google provider contracts.
- `backend/seo-provider-adapters.mjs` / `.d.mts`: explicit read-only Google provider contract, disabled production OAuth port, synthetic permission-scoped GSC mock.
- `backend/search-fixtures.mjs` / `.d.mts`: invented Atlas Plumbing performance CSV, comparison fixture, exact declared property; `backend/search-demo.mjs`: repeatable JSON/CSV CLI.
- `src/SearchPerformancePanel.tsx`, `src/seo-search-data.css`: responsive navy/white file importer, fictional vs authorised offline input, property and date selection, no-data and failure states, performance evidence, relevant search opportunities, optional valid comparison, client exports and print.
- `src/SeoGrowthManager.tsx`: preserved old offline SEO/AEO and embedded new Search Performance view.
- `tests/seo-search-data.test.mjs`, `tests/seo-provider-adapters.test.mjs`: 15 new dedicated tests covering imports, provenance, numeric weighting, period/type isolation, CSV formula safety, source-port authorization and disabled publication.
- `tsconfig.seo.json`, `.github/workflows/seo-ui-check.yml`: isolated UI typechecking and offline analytics regression workflow. Existing core/PostgreSQL/supply-chain suites retained.
- `docs/PHASE2-7-SEARCH-ANALYTICS.md`, this handoff, security and implementation docs.

**Real vs simulated:** There has been **NO** live Google Search Console API request, no real OAuth, no verified Google data, no crawling or live publishing. Example metrics are fictional, calculations applied to those numbers genuinely run. Browser-imported genuine exports can be analyzed locally but their provenance is **USER SUPPLIED — NOT API VERIFIED**. No hosted role/user validation, backend data persistence, cross-tenant authenticated report read/write or actual visual browser screenshot acceptance was performed. Google connectors remain deliberately offline.

**Live staging security baseline checked:** project `dbppeymhsemvghbvuvof` ACTIVE_HEALTHY (PostgreSQL 17, Mumbai), migrations 0001–0005, seven default-deny RLS tables, zero client records / auth users / sessions / policies; restricted runtime NOLOGIN. No Supabase migration or project change this phase. Existing HIGH-risk `SECURITY DEFINER` actor argument substitution still open. No changes to Business OS, CIGO, MVP, Finance Suite or production.

**R1–R7:** R1/R2/R3 real hosted invitations/restricted LOGIN/two-user auth **BLOCKED** (offline/disposable security acceptance preserved); R4 media **PARTIAL/BLOCKED**; R5 external video/publishing **DEFERRED**; R6 real client/agency task-write integration **BLOCKED**, offline reports ready; R7 operational deployed gateway, mobile/performance and rollback **BLOCKED** despite UI source typecheck and CI passing.

**Google OAuth actions that remain:** owner property/identity consent, approved HTTPS host and protected backend token manager, narrow authorized GSC property list, API scopes and quotas, tested token revocation/rotation, property-scoped storage with workspace RLS, and independent two-user read isolation. GA4 and GBP need separate approved grants, no assumed scope equivalence.

**Next smallest milestone:** finish hosted Phase 2.5 authentication/restricted HTTPS runtime acceptance; then add tenant-isolated, versioned **SEO import record and client review** persistence with a human approval gate, followed by an independently reviewed GSC OAuth adapter. Never activate automatic website edits or publication.

**CI:** exact-final-head workflow links and final test counts to be added in PR comment after final docs commit. No merge or deployment. See [analysis/operator guide](PHASE2-7-SEARCH-ANALYTICS.md).
