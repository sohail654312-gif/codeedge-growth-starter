# Phase 2.7 — User-supplied Search Console analysis (offline)

**Scope:** Growth Starter PR #2, manual controlled single writer. No Google OAuth, token persistence, live Google requests, server report storage, website crawling or external modification.

## Usable functionality

The `Google & SEO` tab continues to show the Phase 2.6 offline HTML audit/keyword research; below it is **Search Performance**. It accepts one selected Search Console CSV report at a time, or an explicitly normalized `growth-starter.search-import.v1` JSON report. It reads the file in the **browser only**. The separate user-supplied date range, explicit property and dimensions are **not automatically verified with Google**. Access to the website/export must be confirmed by the operator, and real identity/storage gates remain blocked.

1. Select fictional Atlas Plumbing or use **My authorised website and export (offline)**. For a real business, provide a normal HTTPS origin, service, city, country, authorised non-sensitive homepage HTML and consent checkbox. Supplied HTML uses an **operator-assumed HTTP 200**, NOT a verified response or real scan.
2. Specify an eligible Search Console property: `sc-domain:example.com` (DNS domain and subdomains) or an HTTPS URL-prefix property. The selected business website MUST fall within that property, and any imported page URLs MUST remain in that scope.
3. Specify `web` search, table dimension **query OR page**, dates, then select one UTF-8 CSV or a normalized JSON. Max 512 KB, 1500 rows, 366 days, bounded fields. Supported native CSV query headers include `Top queries,Clicks,Impressions,CTR,Position`; Pages headers include `Top pages,Clicks,Impressions,CTR,Position`. Basic `Query` / `Page` aliases are supported. Import each native Search Console tab **separately**, never sum tab totals.
4. Figures are validated as nonnegative finite counts/positions. The report recomputes CTR as clicks/impressions and computes average position with **impression weighting**, never by simple averaging row positions. A declared CTR with more than 0.5 percentage-point difference is rejected. These are *export-row aggregates* and may omit anonymized/low-volume queries. No estimate of global search volume is made.
5. Relevant query opportunities are derived by matching declared business service terms. `high_impressions_low_ctr` is only a transparent heuristic: at least **50 impressions, under 4% CTR**. This is **not** a verified Google algorithm, a benchmark or proof of a ranking problem. Proposed SEO/AEO tasks require independent human fact review.
6. Optionally add the **same dimensional report** from an equal-length non-overlapping prior period for comparison. Incompatible property, search type, dimensions, sequence or dates fail closed. Changes are observations, not marketing attribution.
7. Download an evidence-led JSON client report and formula-safe CSV opportunity list, or print locally. No data is saved or sent to Codeedge/Google.

### Normalized JSON input format

For explicitly transformed Search Console export data, not raw Google Search Analytics API output:

```json
{
  "version": "growth-starter.search-import.v1",
  "manifest": {
    "workspaceId": "ws_local_offline_import_user",
    "property": "sc-domain:example.com",
    "searchType": "web",
    "dimensions": ["query"],
    "startDate": "2026-09-01",
    "endDate": "2026-09-30"
  },
  "rows": [{"query": "boiler repair manchester", "clicks": 12,
    "impressions": 600, "ctr": 0.02, "position": 7}]
}
```

The provided `manifest` must exactly match the user-selected scope. This is *not* evidence that the source was authenticated by Google. Beware that Google API `ctr` is a fraction but exported CSV often uses percent strings.

## Reproducible fictional end-to-end test

```bash
node backend/search-demo.mjs json > /tmp/atlas-search-analysis.json
node backend/search-demo.mjs csv > /tmp/atlas-search-opportunities.csv
node --test tests/seo-search-data.test.mjs tests/seo-provider-adapters.test.mjs
node --test tests/seo-growth.test.mjs
```

`Atlas Plumbing`, `Northstar Skin Clinic`, `*.example` sites and every CSV metric in the fixtures are **invented synthetic demonstration inputs**. The business logic genuinely validates/calculates them; the metrics do not represent a live customer or Google Analytics account.

## Provider contracts and accurate Google implementation references

No Google adapter is enabled. `backend/seo-provider-adapters.mjs` supplies a disabled-by-default read contract and a deterministic **synthetic mock** requiring workspace/property grants.

- **Google Search Console**: OAuth `https://www.googleapis.com/auth/webmasters.readonly`. Property discovery is `GET /webmasters/v3/sites`; Search Analytics is `POST /webmasters/v3/sites/{siteUrl}/searchAnalytics/query`. Relevant request fields: `startDate`, `endDate`, `dimensions`, `type`, `rowLimit` (1–25,000), `startRow`; results may return only top rows. Domain properties use `sc-domain:` format. Google documentation: https://developers.google.com/webmaster-tools/v1/sites/list and https://developers.google.com/webmaster-tools/v1/searchanalytics/query .
- **GA4**: OAuth `https://www.googleapis.com/auth/analytics.readonly`; read reporting via `POST /v1beta/properties/{propertyId}:runReport` with explicit authorized property, dimensions, metrics, time zone/date range and configured key-event semantics. Do **not** equate GA4 sessions/conversions with GSC clicks. Docs: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport .
- **Business Profile Performance**: `https://businessprofileperformance.googleapis.com/v1/`, daily performance methods and the monthly search-keyword impression endpoint; OAuth scope `https://www.googleapis.com/auth/business.manage` is **not a read-only OAuth scope**, therefore any future token must be tightly isolated and the Codeedge integration must permit only vetted read operations. Access may require project/API approval and nonzero quota; keyword counts may be reported as thresholds. Docs: https://developers.google.com/my-business/reference/performance/rest .
- All connectors require **trusted user sessions, explicit OAuth property/location grants, protected refresh tokens, consent records, quotas, retry/backoff, bounded requests, provider freshness and tenant-isolation acceptance**. Never place tokens in the client/browser, repository or logs. The current mock cannot connect or publish.

## AI-assisted SEO command boundary

`interpretSeoInstruction` is a **deterministic, locally executed structure parser**, NOT an LLM integration. It recognizes SEO performance, keywords, audits and AEO topics only for declared business services/areas/workspaces. Requests to publish, edit, update, deploy or send external content are denied. Future LLMs must be adapters that produce **proposals**, never trusted authorization or direct external actions.

## Security and known limitations

- Strict file-size/row/column/header/CTR/date/property/workspace checks; no remote fetch. CSV formula-like fields are neutralized in exported reports; untrusted file text is only rendered by normal escaped React text binding.
- This offline workspace ID is a local **scope consistency check only**, not authenticated tenancy. It cannot be used to grant cross-client access or persist reports.
- Query CSV often has no per-query page. A query-only export **cannot** attribute a query to a landing page. A Pages export typically has no query dimension. The engine deliberately does not join them or sum both as property totals.
- Real SEO outcomes, Search Console/OAuth data authenticity, Google AI Overviews, CPC, keyword difficulty, real traffic and conversions remain UNVERIFIED.
- Phase 2.5 HIGH SQL function actor-substitution residual remains OPEN, restricted LOGIN remains NOLOGIN, 2-user hosted Supabase acceptance and writes are still BLOCKED.
- Read-only Business OS contract `codeedge.marketing-read.v1` unchanged; no duplicate CRM, shared database or external user roles.

**Release status:** offline verified source; production/live two-user marketing connection and publication NOT accepted.
