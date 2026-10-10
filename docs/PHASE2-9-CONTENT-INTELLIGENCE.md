# Phase 2.9 — Premium SEO, GEO, AEO, SCO and content intelligence

**Implementation mode:** deterministic, bounded, source-only, manual single writer. **Not** a connected LLM, an automated website crawler, a Google Search Console OAuth integration or a content-publishing system.

## What is implemented

The existing `Google & SEO` experience now includes a navy/white, mobile-first **Premium Content Intelligence** review panel built directly on the accepted Phase 2.6/2.7 source contracts:

- **SEO strategy:** primary and supporting keyword *hypotheses*, local intent/service clusters, target page mapping (existing supplied fixture or proposed), keyword overlap warnings, suggested titles/meta descriptions/headings, content-refresh hints, technical audit findings, proposed internal links and an expected objective without promised results.
- **GEO readiness:** for each supplied HTML excerpt, checks whether text *appears to contain* a consistent business name, service, location, heading, structured organization signal, contact route, public phone number, first-hand proof, qualifications and source references. Signals not observed are **not evidence of absence from the live website**. No proprietary GEO ranking score, verified AI-search citation, referral, AI Overview or placement is computed.
- **AEO:** answer-first customer questions, support topics and factual review checklists; evidence source is either business/service-derived hypothesis or a **user-supplied, unverified** query observation from Phase 2.7. Medical content is limited to safe procedural/consultation explanations and never patient-specific outcomes.
- **SCO (search content optimization):** intent/uniqueness, business-fact verification, organization, accessible answers, internal links, useful call-to-action and freshness review checklist. Not a claimed search-engine metric.
- **Local SEO and GBP:** accurate service-area, contact and eligible LocalBusiness structured-data recommendations, owner-reviewed GBP description and genuine review practices. Actual GBP APIs/discovery/performance remain disconnected.
- **Social content:** up to four service-derived ideas for educational short videos, local posts or carousels, with a hook, CTA, fact-check fields and explicit `draft_for_review` status. No invented trend/traffic metrics, posting, scheduling or accounts.
- **Human-review task plan:** recommended changes plus reasons, affected page URLs, priorities, original evidence and `proposed_not_submitted` status. No client or agency task write.

`backend/premium-content-intelligence.mjs` is provider-neutral and has no network/storage/publication capabilities; `src/PremiumContentPanel.tsx` provides SEO/GEO/AEO/SCO/Social tabs, safe empty/denial messaging and local JSON/CSV exports. Original site auditor, service/location keyword engine, GSC CSV importer, secure report draft contracts, and navy/white design are reused, not rebuilt.

## Run the end-to-end fictional demonstration

Using Node.js 22 from the repository root:

```bash
node backend/premium-content-demo.mjs json > /tmp/codeedge-premium-fictional-report.json
node backend/premium-content-demo.mjs csv > /tmp/codeedge-premium-fictional-pages.csv
node --test tests/premium-content-intelligence.test.mjs tests/seo-growth.test.mjs tests/seo-search-data.test.mjs
```

Open the existing Growth Starter UI, select `Google & SEO`, select **Atlas Plumbing — Manchester (fictional)** or **Northstar Skin Clinic — Peshawar (fictional)**, generate an offline SEO report, then review the new Premium Content Intelligence tabs. Optionally import the **fictional Search Console CSV** in the adjacent Search Performance panel: if an import is valid and scope-matched, its *manually supplied observations* feed premium suggestions, without being relabelled as verified Google data. Export the premium plan as JSON or a CSV service-page strategy.

The demo fixtures are explicitly fictional; `.example` domains and example impressions/clicks are not real Google measurements. Local content generation requires owner-approved facts and does not claim actual ranking, AI citation or website improvements. Live screenshots, field mobile results and browser-based visual acceptance have not yet been performed; CI checks only source/React type soundness and behavioral tests.

## Evidence classification and safe review workflow

| Type | Provenance | Permitted conclusion |
|---|---|---|
| Service/location phrase | Supplied business context | Keyword hypothesis; demand **Not available** |
| HTML titles/H1/metadata | Supplied HTML fixture/operator text | What was present in supplied text; not a live website scan |
| Imported GSC query | Explicit, scope-validated CSV/JSON | Observed *within supplied rows*; authenticity **not live-verified** |
| Search Console impressions | Imported click/impression rows | Export-row impressions, **not** total query volume |
| GEO content coverage | Ten textual completeness checks | Content improvement directions, **not** a search-engine score |
| AI referrals or citations | No connected measured source | **Not available**, never manufactured |
| Social topic | Service-based deterministic proposal | Content idea, **not** trend/engagement evidence |
| Draft answer / medical claim | Safe generic draft / explicit fact-check | Human review required; no unverified credentials/outcomes |

Before external use, Codeedge and the business owner must review the service description, areas, operating hours, contact channels, prices, professional credentials, references, patients' consent if relevant, clinical/legal claims and actual publication permissions. Never turn unsupported statements into “verified expertise” or invented first-hand case studies. FAQ structured data should only be used where appropriate and visible; eligibility and rich-result display are not guaranteed.

**No network crawling, OAuth, protected report persistence, automatic edits, approval, publication, paid APIs or background workers exist in Phase 2.9.** `requestPremiumPublication()` explicitly rejects all requests. No LLM service was called, and text quality is deterministic templates supported by a review workflow, not independently demonstrated human-level or novel AI-generated editorial quality.

## Security gates remain unchanged

The independently verified Phase 2.8 PostgreSQL test proved a **HIGH** actor-substitution risk in the `postgres`-owned `SECURITY DEFINER` functions. The original direct DB login/role remains NOLOGIN; hosted two-user real Supabase Auth and HTTPS gateway acceptance is not complete, and no persistence/agency writes or external publication may be switched on.

Continue the existing PR #2 in manual single-writer mode; do not create another repository, modify Business OS/CIGO/Finance Suite, alter production or activate the hosted DB without explicit owner authorization and protected secret handling.

**Next highest-value milestone:** close the independent DB actor-binding risk, secure an owner-approved Node HTTPS staging gateway and complete two-user live tenant isolation. Only then consider transactional report persistence and approved live-provider data. More GEO scorecards do not compensate for this security gap.
