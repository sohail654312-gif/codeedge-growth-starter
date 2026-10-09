# Codeedge Growth Starter

Standalone, mobile-first Codeedge growth portal for clinics and small local businesses.

**Current status:** Phase 1 preview deployed; not production accepted.

**Live app:** https://codeedge-growth-starter-5jhvfk.v2.appdeploy.ai/

## Phase 2 engineering update (draft PR only)

**Latest continuation:** [Security and staging evidence](docs/PHASE2-CONTINUATION-EVIDENCE.md). The branch now includes fail-closed invitation/approval gates, a transaction-backed provider contract, simple client work progress UI, and secure media placeholders; none of this has been merged into production.

An isolated, review-only core has been added on the Phase 2 engineering branch:
- AppDeploy route adapter delegates to dependency-injected domain handlers; all private routes use SDK `requireAuth()`.
- Owner workspace ID is derived from authenticated server user ID; existing owner-keyed tables are preserved for legacy records.
- Role matrix covers owner, agency admin, staff and client; unknown/fabricated workspace selections fail closed.
- Server-side validation, paginated enquiry/request reads, MIME plus first-byte media signature checks.
- Bounded media quota, owner/admin media deletion and request review/client decision transition rules.
- 19 CI checks passed against *mocked* SDK adapters at the implementation SHA (not hosted runtime acceptance).

**Blocked:** No client invites or membership creation, verified email binding, real agency UI, true DB transactions, production file scanning, video upload, privacy approval, fully reproducible AppDeploy build, or independently verified cross-tenant hosted behavior. Do not enable real-client use from these source tests.

## Implemented in Phase 1
- Read-only sample clinic workspace with clearly illustrative data
- AppDeploy sign-in, owner-scoped business profile, enquiries and status
- Content requests, private image uploads and signed image URLs
- Website / local SEO / AEO roadmap without fabricated live metrics
- Mobile-friendly Codeedge dashboard

## Not yet included
Team and agency roles, production Business OS/CIGO integration, real Google metrics, AI publishing, direct WhatsApp workflows, video storage, payments, patient records, and production audit/acceptance.

## Development
React + TypeScript + Vite frontend, with AppDeploy SDK routes, database and storage.
This repository mirrors the currently deployed AppDeploy source snapshot. GitHub pushes do not automatically redeploy AppDeploy. The `@appdeploy/client` and `@appdeploy/sdk` imports are runtime-provided; the standard local Vite build is not yet portable without equivalent SDK support.

Run `node --test tests/source-contract.test.mjs` for **static source-guard tests only**. This does not replace backend, tenant-isolation or live end-to-end testing.

See [implementation gates](docs/IMPLEMENTATION.md) and [security boundaries](docs/SECURITY.md).

Other Codeedge repositories are read-only reference; changes here must not modify Business OS, CIGO or MVP.

Do not commit API credentials, real clinic/patient content, production datasets or uploaded photos. Consider changing this repository from public to private in GitHub Settings.

## Phase 2.1 implementation (PR #2, draft)
[Reviewable transactional/UX evidence](docs/PHASE2-1-REVIEW-HANDOFF.md): disposable PostgreSQL 16 tests, synthetic signed-session HTTP isolation, Website and guarded Agency desk pages, image decoding and deletion outbox. No live cross-workspace invitations or production provider binding.

## Phase 2.7 — offline Search Console analytics
The `Google & SEO` view now supports local-only Search Console CSV/normalized JSON import and verified arithmetic on supplied rows. See [operator guide](docs/PHASE2-7-SEARCH-ANALYTICS.md) and [Phase 2.7 handoff](docs/PHASE2-7-HANDOFF.md). Live Google OAuth, external crawling, website edits and client database writes remain disabled.

## Phase 2.9 — Premium offline content intelligence
Growth Starter now offers evidence-scoped SEO, GEO-readiness, AEO answer drafts, SCO, local visibility suggestions and social content concepts in its existing navy/white offline review interface. It accepts only supplied-page and clearly labelled unverified Search Console evidence, with no real AI-search citation or Google provider claim. See [Phase 2.9 guide](docs/PHASE2-9-CONTENT-INTELLIGENCE.md) and [handoff](docs/PHASE2-9-HANDOFF.md). Publication, report persistence, agency writes, live Auth and crawling remain disabled.

## Phase 3.0 — review-only content changes and security cutover preparation
The premium SEO desk now provides browser-local before/after website proposals and correction-note download with no editing/publishing capability. A review-only SQL draft and disposable test prepare retirement of the vulnerable actor-supplied SECURITY DEFINER reader functions; hosted security still BLOCKED. See [Phase 3.0 handoff](docs/PHASE3-0-HANDOFF.md).
