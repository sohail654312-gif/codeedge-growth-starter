# Growth Starter — Phase 3.0 controlled engineering handoff

**Date:** 2026-10-10. **Repository:** \`sohail654312-gif/codeedge-growth-starter\`.
**PR:** existing #2 DRAFT, branch \`engineering/phase2-core-security\` (NO merge).
**Starting exact HEAD:** \`cddf16bc11d6fceab0284f1794df34f65012636e\`.
**Base main:** \`dd0ee8a9b5c4a770443a7a2eff2732858c01300e\`.
**Final exact HEAD:** retrieve PR SHA after this documentation commit; exact-head CI links/counts posted to PR #2.

## Phase 2.9 closure

**PASS (SOURCE-ONLY):** premium SEO service clusters/title/metadata/page strategies, GEO content completeness without fabricated citation measurements, AEO human-fact-checked answers, SCO/local proposals, social ideas, mobile-source React components and deterministic JSON/CSV demo. Prior exact SHA \`cddf16bc11d6fceab0284f1794df34f65012636e\` had core **101/101**, disposable PostgreSQL **35/35**, staging supply chain **13/13**, SEO UI **34/34**, all PASS. This is not a live provider, real client, LLM-powered editing or deployed mobile acceptance.

## Phase 3.0 new work

- \`db/drafts/0007_disable_legacy_actor_definers_REVIEW_ONLY.sql\`: proposed **unapplied** transactional cutover revoking EXECUTE on privileged reader-accessible actor-ID SECURITY DEFINER functions. Disables the existing legacy read-only gateway if applied; MUST NOT apply without separately accepted replacement and owner approval.
- \`tests/postgres/actor-cutover.pg.test.mjs\`: disposable security test first confirms the existing actor-substitution vulnerability, then asserts reader's direct SQL function execution is denied after draft cutover; transaction rolled back and no hosted schema/grant change.
- \`backend/website-proposals.mjs\` and \`.d.mts\`: workspace-bounded, operator-supplied HTML **before** vs human-review-only SEO page **after** proposals; sanitized title/description/heading/sections, source clarity, no invented measurements, local optimistic revision/correction draft and all external actions disabled. Provider-neutral \`codeedge.ai-content-proposal.v1\` contract with deterministic fallback but no actual external LLM.
- \`tests/website-proposals.test.mjs\`: offline before/after evidence, cross-workspace/host mismatch denial, optimistic revision refusal, disabled publication/assignment/approval and no-harm fallback.
- \`src/WebsiteProposalDesk.tsx\` and \`src/website-proposals.css\`: navy/white mobile-first review of supplied vs proposed metadata, local correction note JSON download, explicitly disabled Codeedge submission/approval. Integrated into \`src/PremiumContentPanel.tsx\` as **Website changes** tab.
- \`.github/workflows/seo-ui-check.yml\`, \`tsconfig.seo.json\`: existing SEO TypeScript/testing workflow extended; no weakening of previous gates.
- \`docs/PHASE3-0-SECURITY-CUTOVER.md\`, this handoff and Phase 2.9 closure note.

## Requirement-by-requirement acceptance

| Area | Verdict | Honest evidence |
|---|---|---|
| Phase 2.9 closure | PASS | Prior exact HEAD and tested offline implementation |
| Phase 3.0 source proposals | PASS if final CI green | Offline-only before/after website drafts and review notes |
| Proposed actor-function cutover | PARTIAL | Real disposable PostgreSQL privilege-denial test; **no live activation** |
| Independent replacement verified actor/JWT/RLS boundary | BLOCKED | No deployed PostgREST/JWT+RLS replacement yet |
| Real HTTPS staging and 2 independent Auth users | BLOCKED | No approved host, secret manager or staging users |
| SEO report persistence and revision approvals | BLOCKED | Phase 2.8 versioned report schema still review-only, no live DDL/routes |
| Client/agency collaboration | PARTIAL/BLOCKED | Client may download local correction; no actual agency delivery/approval |
| Real Google provider connections | BLOCKED | GSC/GA4/GBP read-only contract only, no authorized OAuth |
| GEO citations / search outcome proof | NOT AVAILABLE | No verified AI-search referrals/citations or published changes |
| Business OS/CIGO/CIGO X integration | PREPARED ONLY | Separation preserved, no direct API connection or modifications |
| Live browser/mobile/accessibility/performance acceptance | NOT VERIFIED | Responsive CSS and TS tests are not Lighthouse/mobile field measurements |

### Live Supabase read-only check

Project \`dbppeymhsemvghbvuvof\` ACTIVE_HEALTHY PG17, five migrations, seven RLS tables, zero policies and zero Auth users/sessions/workspaces. Both restricted roles remain NOLOGIN. No new database migrations, paid services, credentials, real patient data, production deployment, crawling or agency writes.

**Residual HIGH:** postgres-owned SECURITY DEFINER actor substitution remains exploitable *if a reader-capable gateway is compromised*. Do not call the proposed cutover a completed live remedy. Never treat caller-writable JWT GUC claims as independently authenticated.

### CI and demonstration

Exact final SHA counts/links are posted in PR #2. Suites overlap; do not sum counts as distinct tests.

\`\`\`bash
node backend/premium-content-demo.mjs json
node --test tests/website-proposals.test.mjs tests/premium-content-intelligence.test.mjs
\`\`\`

To see the new UI, choose **Google & SEO**, create a fictional offline SEO plan, then in Premium Content Intelligence select **Website changes**. Compare supplied HTML metadata against owner-reviewable drafts and download a local correction-note JSON. No external message or website edit occurs.

### Next smallest milestone

**Owner-approved identity cutover in an isolated, secrets-managed staging environment**: establish cryptographically verified user-to-RLS identity and current membership enforcement, test non-bypassable authenticated read access and the removal of definer execution, then run the existing two-user hosted runner with expiry/revocation and direct SQL attacker probes. Only after that accept transactional client report storage; only later enable client-granted Google read adapters and agency tasks.

**Overall Phase 3.0:** source/readiness PARTIAL; full definition of done **BLOCKED** on independently verified replacement identity boundary and real hosted approval. No artificial completion percentage.
