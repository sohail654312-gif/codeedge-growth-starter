# Codeedge Growth Starter — Phase 2.9 handoff

**Repository:** `sohail654312-gif/codeedge-growth-starter`; existing **PR #2 DRAFT**, `engineering/phase2-core-security`.

**Starting exact HEAD:** `338a7e7ec406eb91e3fb9ce0c24247d55719d145`.
**Final exact HEAD:** read current PR immediately after this documentation commit; add exact-head CI evidence in the PR conversation and final response. **Base main:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.

## Definition of done

**Phase 2.9 offline vertical slice — source implemented, awaiting final exact-head CI evidence.** Not a production launch, a live AI-search optimizer, verified Google/AI visibility tracker or hosted tenant acceptance.

### Work completed in existing branch

- `backend/premium-content-intelligence.mjs`, `.d.mts`: new strictly offline, provider-neutral strategy synthesis from bounded Phase 2.6 SEO and optional Phase 2.7 manually supplied GSC evidence, explicit source labels, case-insensitive business topics, intent and topic clusters, title/meta/heading drafts, SEO findings, proposed links, location/GBP/SCO priorities, GEO 10-signal excerpt audit with **null (not invented) score**, AEO factual-review questions, and optional social content proposals.
- `backend/premium-content-demo.mjs`: two formats, JSON/CSV, fictional Atlas Plumbing GSC demonstration.
- `src/PremiumContentPanel.tsx`, `src/premium-content.css`: navy/white mobile-first review desk with SEO / GEO / AEO / SCO+Local / Social views, selected page detail, evidence disclosure, downloadable JSON and CSV and a **disabled** implementation action. Browser fixture mode only; no remote action.
- `src/SeoGrowthManager.tsx` and `src/SearchPerformancePanel.tsx`: reuse original SEO interface and pass authorized manually imported observations into premium plan for the same current workspace; reset imported evidence after workspace/demo, service, area, instruction or HTML changes so stale evidence is not carried across contexts.
- `tests/premium-content-intelligence.test.mjs`: deterministic business and clinic examples, claim boundaries, no citations/performance fabrication, actor/workspace and property mismatch denial, formula-safe CSV, publication prohibition, and offline end-to-end CLI. Parent-domain and URL-prefix Google Search Console property checks added without loosening tenant isolation.
- `tsconfig.seo.json`, `.github/workflows/seo-ui-check.yml`: strengthen dedicated SEO UI typechecking and offline behavioral regression coverage.
- `docs/PHASE2-9-CONTENT-INTELLIGENCE.md` and this handoff; existing Phase 2.6–2.8 modules, CI suites and security restrictions retained.

### Real versus fictional evidence

**Real software:** deterministic strategy generation from supplied HTML, existing Page/KW audit records and validated unverified GSC import, content draft exports, tests. **Fictional data:** fixture businesses, example domains, fabricated synthetic GSC rows and generated recommendation texts. **Not established:** real keyword demand, backlinks, CPC, keyword difficulty, Google ranks/traffic, genuine citations in ChatGPT/Gemini/Google AI Overviews, local GBP performance or conversion causation. No real external website was crawled or edited; no real LLM provider was called.

### Security and 2.8 continuity

No new schema or database changes, no staging secrets or role activation, no Supabase users, no Google OAuth, no client/agency writes, no automatic publishing, no production deployment. Phase 2.8 **HIGH** `SECURITY DEFINER` actor-substitution flaw remains OPEN, as does external HTTPS two-user Supabase Auth acceptance. Consequently all premium content remains a reviewable local proposal. The existing source-only SEO storage draft remains disabled.

### Actual mobile, visuals and QA

React TypeScript and offline unit/e2e tests in CI are **not** equivalent to visual browser QA or a deployed live-hosted mobile acceptance. Neither was performed. No fabricated Lighthouse scores or screenshot claims.

**Next milestone:** finish independent principal / actor-binding remediation, owner-approved Node HTTPS staging, restricted password/login via a protected host secrets facility, two independent synthetic Supabase users, and actual hosted tenant-denial acceptance. Only then open report persistence / agency collaboration. See [operator guide](PHASE2-9-CONTENT-INTELLIGENCE.md) and [previous Phase 2.8 security assessment](PHASE2-8-SECURITY-DESIGN.md).

## Phase 2.9 final exact-head CI closure

The Phase 2.9 final verified PR HEAD was \`cddf16bc11d6fceab0284f1794df34f65012636e\`, not the earlier intermediate \`3c651c4b7d7d1334900587a26124d3c87ab56bee\`.
Verified exact-head workflows: core [101/101](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38001262913), disposable PostgreSQL [35/35](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38001262895), staging supply-chain [13/13](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38001262835), and offline SEO UI [34/34](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38001262844), plus TypeScript PASS. Counts overlap. Source-only verdict PASS; hosted/live remains BLOCKED.
