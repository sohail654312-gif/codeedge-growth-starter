# Phase 3.13 — Local multi-page correction handoff

## Scope
Source-only and offline-only continuation of Phase 3.12A. Work confined to `sohail654312-gif/codeedge-growth-starter` branch `engineering/phase2-core-security`, existing draft PR #2. This is a user-visible review improvement, not authenticated client functionality.

## Delivered
- Website Proposal Desk retains local correction notes while switching among proposed pages. Notes are keyed by workspace, proposal identifier, URL and draft title; they live in React memory, not a database or browser storage.
- The existing downloadable offline pilot JSON now includes up to one bounded note per proposed page, with `local_only_not_submitted` status. Blank/short notes are omitted. The existing single-page draft download remains.
- The pack builder independently rejects mismatched workspace IDs, unknown or repeated proposal IDs, excess/invalid note text, extra fields such as `approved`, and publication-capable inputs. It normalizes control characters and whitespace.
- The export remains untrusted, without a verified actor, recipient, approval, agency assignment, client notification, or publication capability.

## Acceptance
- Run `node --test tests/pilot-review-pack.test.mjs` and the existing core suite.
- Verify fictional clinic and plumbing exports work without a network.
- Verify TypeScript/UI CI and all four exact-HEAD GitHub Actions checks.
- Manual mobile/keyboard review is still required; GitHub CI does not establish hosted acceptance.

## Non-goals and security gates
No changes to Supabase permissions, Auth schema, RLS, data/API exposure, hosted accounts, production, publishing, private enquiries, paid services or other Codeedge repositories. PR #2 remains DRAFT and must not be merged automatically. All live-hosted blockers and independent review requirements from Phase 3.12A remain open, including provider decision on immediate session revocation and actual multi-user isolation tests.

Local notes can be lost on refresh and exports need secure human handling. No patient data should be entered. These notes must never be presented as consent, clinical verification, an actual support submission or an agency approval.

## Rollback
Ordinary non-force revert of this single source commit; no hosted migration to reverse.
