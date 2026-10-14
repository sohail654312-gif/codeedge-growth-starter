# Growth Starter — Phase 2.6 exact-scope SEO & AEO handoff

**Date:** 2026-10-08. **Repository:** `sohail654312-gif/codeedge-growth-starter`.
**Existing PR #2:** Draft, unmerged, branch `engineering/phase2-core-security`.
**Starting reviewed SHA:** `36ac699a68a6447faae7504e006263a20bba7ec2`.
**Final SHA:** Use the live PR HEAD *after this handoff commit* and report exact-head CI links in the PR conversation.
**Base main at phase start:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.

## Phase verdict

**OFFLINE SEO/AEO VERTICAL SLICE IMPLEMENTED — independent hosted/business pilot is NOT ACCEPTED.**

Source-based research can now produce a deterministic, useful report from supplied evidence; it is no longer a collection of decorative marketing cards. No live website has been crawled or optimized, no Google API/OAuth has been connected, and no website edit or marketing action has been published.

### Source changes
- `backend/seo-growth.mjs` / `backend/seo-growth.d.mts`: bounded profile/page validation, offline HTML audit, keyword hypothesis generator by intent/service/location, topic/page mapping, duplicate/overlap warnings, reviewable work items, AEO draft questions with unresolved fact-checks, provenance/freshness, null disconnected analytics metrics, formula-safe CSV.
- `backend/seo-fixtures.mjs` / `backend/seo-fixtures.d.mts`: invented Atlas Plumbing (Manchester/Salford) and Northstar Skin Clinic (Peshawar), reserved `.example` URLs and small HTML documents; no patient/real trade information.
- `backend/seo-demo.mjs`: runnable, no-provider end-to-end JSON/CSV demo for either fictional business.
- `src/SeoGrowthManager.tsx`, `src/seo-growth.css`: mobile-first navy/white SEO Manager, controlled selectors, client instruction, optional authorized HTML paste, offline research, evidence-led tasks/AEO review, CSV/JSON downloads. No backend network calls, real business storage, or live approval button.
- `src/App.tsx`: existing `Google & SEO` tab now renders real offline workflow rather than four decorative generic cards.
- `tests/seo-growth.test.mjs` and `tests/source-contract.test.mjs`: domain/fixture/CSV security tests, cross-workspace/off-origin/missing metrics/no crawl, CLI E2E, and UI source contract.
- `tsconfig.seo.json` and `.github/workflows/seo-ui-check.yml`: isolated React TypeScript source typecheck and SEO core fixture smoke tests with Node 22; path-filtered workflow to limit GitHub Actions usage.
- `docs/PHASE2-6-SEO-GROWTH-MANAGER.md` plus this handoff.

### Explicit evidence boundaries
- **Valid report source:** operator-supplied HTML and HTTP status *fixtures*. HTML parser deliberately does not render browser JavaScript.
- **Keyword evidence:** deterministic service/location hypotheses and page mappings, **not** volume, difficulty, CPC, click, ranking or competitor intelligence. All such values are null/`Not available`.
- **AEO:** drafts require human factual review; professional/clinic qualifications and treatment outcomes never inferred. No promise of Google AI Overview or LLM citations.
- **Robots/sitemaps:** optional supplied text is inspected only if provided; no remote robots fetch, DNS, status or crawl is performed.
- **Browser output:** offline in-memory. Authenticated private site submissions, server-side persisted reports, client approvals, agency assignments and external publication all remain disabled pending two-user hosted isolation.
- **No real OAuth provider:** Search Console, GA4, GBP, PageSpeed and external research adapters remain `not_connected`; no source-backed traffic measurement is claimed.
- **SSRF threat:** no fetch, DNS, HTTP redirect following or worker exists; network crawl API is an explicit throw. Any future live fetch adapter needs separate authenticated scope, pinned DNS/IP across redirects, metadata/private IP blocks, robots permissions, budgets and independent acceptance; a simple hostname validation is insufficient.
- **Integration:** `codeedge.marketing-read.v1` is a disabled versioned, read-only contract toward Business OS. No shared identity mapping or cross-repo database access yet.

### Repeatable no-cost verification

```bash
node backend/seo-demo.mjs plumbing json > plumbing-report.json
node backend/seo-demo.mjs clinic csv > clinic-keywords.csv
node --test tests/seo-growth.test.mjs
```

Optional client UI can be reviewed from the current PR branch using the existing frontend development process; neither the production site nor the separate QA sandbox has been redeployed in this phase.

## Phase 2.5 security controls retained
- Draft PR #2, original Business OS/MVP/CIGO repositories, and separate Supabase staging are unchanged.
- Existing `dbppeymhsemvghbvuvof` project was observed ACTIVE_HEALTHY at phase start with migrations 0001–0005; no migrations added.
- `growth_starter_reader` and `growth_starter_runtime` remain **NOLOGIN**. Seven private tables still default-deny RLS; no live client data or real two-user Auth test.
- HIGH residual SQL risk: privileged `postgres`-owned SECURITY DEFINER routines accept server-supplied actor arguments, with no independent DB cryptographic identity binding. No elevated agency/SEO actions.
- No patient data, production deploy, public crawling, paid provider, external effects, background automation, self-approval or PR merge.

## R1–R7 acceptance

| Category | Verdict |
|---|---|
| R1 invitations and roles | Offline contract remains; hosted **BLOCKED** |
| R2 database and tenant isolation | Previous staging RLS and disposable tests retained; hosted restricted LOGIN **BLOCKED** |
| R3 verified two-user hosted auth | **BLOCKED**; SEO has no new server state or users |
| R4 media/privacy | **PARTIAL**, patient/media/consent/revocation acceptance **BLOCKED** |
| R5 video and publishing | **DEFERRED**, no autonomous effects |
| R6 client/agency collaboration | Read-only UI and offline SEO plan present; shared transactional task writes **BLOCKED** |
| R7 deploy/accessibility/mobile/performance | Source-level responsive design and typecheck; actual browser/mobile/latency/rollback measurements **BLOCKED** |

## Next smallest highest-value increment
1. Owner approves a specific HTTPS staging Node host and its actual cost; create private secrets only via protected host-side configuration, never GitHub.
2. Activate/restrict the PostgreSQL application LOGIN through explicit secret-handling authorization and prove actual TLS/privilege limitations.
3. Verify two actual independent fictional Supabase Auth user sessions, session revocation and opposite-workspace denial through the existing read-only gateway.
4. Add an authenticated, versioned, tenant-isolated SEO report persistence and human request-review contract. Until independent acceptance, keep offline reports browser-only.
5. After documented website ownership verification and approved robots/crawl scope, add a sandboxed network SEO collector. Connect real Google sources only after consented OAuth.

**Product judgment:** phase 2.6 source-only offline workflow is substantially implemented. Overall client pilot readiness cannot be inferred from number of keywords or UI cards; prior 45–50% is a rough estimate and real hosted security gates remain the launch blocker.
