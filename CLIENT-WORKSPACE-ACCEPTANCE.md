# Growth Starter — Client Workspace Acceptance (29 October 2026)

**Status:** `IMPLEMENTED BUT NOT LIVE-VERIFIED`. Private source and synthetic HTTPS browser flows exist; actual hosted private client application is not accepted.

## Current source inventory

- Private UI entry: `private.html`, `src/private-main.ts`, `src/PrivateWorkspaceApp.tsx`.
- Same-origin cookie client: `src/private-workspace-client.mjs`; browser should not receive provider refresh tokens, PKCE verifier, database secrets or privileged grants.
- Private HTTPS and CSRF handlers: `backend/phase315e-https-cookies.mjs`, `staging/private-ui-assets.mjs`.
- Restricted server business operations: `backend/phase315p-private-operations.mjs`.
- Readiness and reproducibility: `scripts/release-readiness.mjs`, GitHub Actions `source-guards.yml`, `postgres-security.yml`, `seo-ui-check.yml`, `staging-supply-chain.yml`.

## Acceptance by client journey

| Journey | Source / synthetic test status | Hosted private acceptance |
|---|---|---|
| PKCE login, cookie session and logout | Implemented and tested with simulated provider | **BLOCKED** — real supported provider authority |
| Workspace select/change, owner/staff/client current membership | Implemented with scoped operations and source tests | **BLOCKED** — restricted hosted roles not installed |
| Business profile, onboarding and service requests | Implemented in private source and synthetic SQL journeys | **BLOCKED** — hosted migration and deployment |
| Agency assignment, client correction, review, approval | Versioned, consent/approval-oriented operations in source | **BLOCKED** — live role-specific journey |
| Request status, bounded history and scoped reports | Source implemented; no actual provider metrics | **BLOCKED** — live tenant-filtered data |
| Private media read/delete outbox | Source contracts exist; hosted storage/scan/delete worker disconnected | **BLOCKED** — live storage and deletion acceptance |
| SEO/AEO/GEO and content calendar drafts | Existing offline deterministic tools with labelled examples | Offline-only; Google and social data unconnected |
| Lead capture, AI receptionist, voice and publishing | Provider-neutral or demo/sandbox interfaces | Real effects **DISABLED / UNVERIFIED** |
| Mobile/desktop design and accessibility | Existing Chromium and axe CI journeys at engineering SHA | Live mobile browser/network/error acceptance needed |

## Client acceptance test cases (fictional)

**Clinic**: fictional clinic onboarding → website audit request → draft SEO/local GBP recommendations → original content proposal → clinic owner approval or rejection → review task progression → example enquiry with explicit `SIMULATED` provenance → report with only source-backed values.

**UK trades business**: fictional plumbing business onboarding → service areas → website conversion audit → weekly social calendar → client correction + approval → dummy enquiry pipeline → status and history → no live Google rankings or revenue claims.

These are acceptance scenarios, **not** evidence that the full end-to-end live journeys were executed in this review.

## Required launch UX gates

- One coherent dashboard: What Codeedge does / in progress / awaiting client approval / completed / evidence-backed results / next actions.
- Every visible button performs its advertised authorized action or has a clear disabled state and explanation.
- 390×844 mobile and 1280×900 desktop coverage; keyboard, focus, WCAG A/AA, loading, error, expired-session, empty-state, version conflict and offline state.
- Client content rights/consent and any clinic patient privacy rules must be reviewed prior to live marketing uploads.
- Actual HTTPS origin and cookies, protected admin operations, live data segregation and rollback proof.
