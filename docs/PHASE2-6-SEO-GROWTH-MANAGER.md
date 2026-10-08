# Growth Starter Phase 2.6 — Offline SEO/AEO Growth Manager

**Review scope:** existing repo, branch `engineering/phase2-core-security` / PR #2. No new PR or workspace. Existing Phase 2.5 security gates remain OPEN.

## What is real and usable in this increment

`backend/seo-growth.mjs` is deterministic domain software with no external integrations. Given a validated fictional business research profile and bounded operator-supplied HTML:
- Validates workspace scope and page origin; caps pages (8), HTML per page (120,000 characters), links (70) and keyword hypotheses (64).
- Derives local, informational, commercial and conversion-intent candidate phrases from declared services and places, groups them into topic clusters, maps them to existing fixture pages or proposed new ones, and proposes page titles/headings/internal links.
- Extracts titles, meta descriptions, H1/H2, mobile viewport declarations, robots meta tags, canonical links, images/alt, in-scope internal links and structured-data types from supplied HTML text.
- Detects missing/duplicate metadata, potential thin content, noindex, schema absence, broken links **only when the broken target is explicitly present in the supplied fixture list**, and possible target-page overlap.
- Optionally parses operator-supplied `robots.txt` and XML sitemap text; **neither file is fetched**. Detects wildcard disallow-all as an evidence-backed warning. It does not prove actual search-engine indexability.
- Produces reviewable tasks with evidence, suggested improvements, owner, status and completion evidence fields; suggested FAQ/AEO answers expressly mark unverified facts, never fabricate clinical outcomes or professional qualifications.
- Exports a full JSON report and spreadsheet-compatible CSV with metrics explicitly **Not available**. CSV cells beginning with spreadsheet formula operators receive a neutralising prefix.
- Exposes disconnected, read-only provider-neutral analytics contract for Search Console, GA4, Google Business Profile, web performance tools, and research providers; null metrics until independently verified.
- Defines `codeedge.marketing-read.v1` future Business OS boundary: versioned, permission-scoped, read-only; no shared database or credentials.

`src/SeoGrowthManager.tsx` replaces the decorative `Google & SEO` content with a keyboard-accessible, responsive navy/white research workflow. Users choose a **fictional** sample business, service and target area, submit a plain-language instruction, optionally paste authorised non-sensitive public HTML, then receive an in-browser report and offline downloads. The command is recorded as a brief; it is **not** sent to any LLM and does not extract structured facts from arbitrary natural-language prompts yet. It never sends private HTML to a server or saves generated reports.

### Reproducible offline E2E demo

```bash
node backend/seo-demo.mjs plumbing json > plumbing-seo-report.json
node backend/seo-demo.mjs plumbing csv > plumbing-keywords.csv
node backend/seo-demo.mjs clinic json > clinic-seo-report.json
node --test tests/seo-growth.test.mjs
```

The UK plumbing and Pakistani clinic cases are entirely fictional `.example` domains with invented HTML and status fixtures. **No patients, real businesses, SEO traffic/rankings or actual website scans are involved**. Example entities are simulated, but computations on the supplied HTML really execute.

## Security and authorization limitations

- **Network crawling is not implemented**. `requestNetworkCrawl()` always throws, including for an operator-authorised URL. The public-looking HTTPS hostname guard alone is **NOT sufficient SSRF protection**. Before introducing any network connector, independently verify DNS resolution at connection time, pin the vetted address across redirects, reject loopback/private/link-local/metadata/IPv6 aliases, enforce robots and approved paths, response-size/time/page/redirect budgets and per-tenant execution authorization.
- Workspace scope in this offline engine checks that all supplied fixture records match the caller's specified workspace ID. This does **not** authenticate the browser or grant access to other workspaces. There is **no** report storage, persistence, server route or tenant-authorization issuance in this phase. Server persistence/crawling requires independent hosted identity and RLS acceptance.
- Existing AppDeploy authorization and `growth_starter_runtime` NOLOGIN restrictions remain unchanged. Authenticated real client/agency SEO jobs, invitations, task issuance, website editing, publication and Google OAuth are **BLOCKED** pending hosted gates.
- HTML parsing is bounded, deterministic and intentionally not a production browser/DOM or JavaScript renderer; it does not measure JavaScript-rendered content, live response headers, real DNS, Lighthouse/Core Web Vitals, backlinks, crawling rules or Google Search performance.
- Never assert ranking improvements, search volumes, CPC, SEO difficulty, AI citations, traffic or medical treatment effectiveness from hypotheses.

## SEO/AEO acceptance goals for the next stage
1. Independently authorize the staging Node host and activate a restricted TLS database login with secrets in approved private storage.
2. Verify two real synthetic users and tenant-isolated authenticated HTTPS gateway before adding stored SEO jobs.
3. Define an explicit consent/audit record for domain verification and allowlisted crawl scope.
4. Implement a network collector as a separate sandboxed adapter with independent SSRF/robots tests, identity-scoped execution and bounded queues; do not use a generic server fetch against arbitrary URLs.
5. Obtain explicit Google OAuth permissions for GSC/GA4/GBP, introduce immutable metric provenance, then measure live outcomes rather than demo estimates.

**Phase verdict:** Offline SEO/AEO research vertical slice implemented; genuine live SEO provider measurement, authorised web crawling and hosted two-user storage acceptance remain blocked.
