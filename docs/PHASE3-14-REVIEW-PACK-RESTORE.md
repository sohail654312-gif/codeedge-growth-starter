# Phase 3.14 — Safe local pilot review-pack restore

## Verified scope
Source-only continuation of Growth Starter Phase 3.13, same branch and draft PR #2. No hosting, database migrations, Supabase grants, client data, production merge, provider integrations, paid services or other Codeedge repositories.

## Implementation
- Added `restoreOfflinePilotCorrectionDrafts` to decode a bounded JSON export and return **only** local correction notes.
- The imported pack must have matching version, offline mode, workspace identity, business website, report provenance and exact current website proposals. It rejects altered/fake approval and external-action flags, unknown pages, duplicate notes, foreign workspaces, invalid note text, new correction metadata and oversized/invalid JSON.
- The website proposal desk includes an accessible file-input restore control. The user gets a replacement confirmation before changes to in-memory notes. No browser persistence, network upload or automatic submission.
- Only review comments are returned to the UI. No imported approval, identity, provider action, metrics or external state is trusted, executed or carried forward.
- Existing multi-page exported pack remains compatible, when based on the **same** unchanged offline source proposals.

## Tests and acceptance
`node --test tests/pilot-review-pack.test.mjs` covers round trips for fictional clinic and plumbing, malicious/foreign/stale inputs and size validation. Verify four existing GitHub Actions workflows against the exact final commit. This does **not** replace manual mobile/keyboard QA or hosted signed-session acceptance.

## Limitations
This is not cryptographic authentication of the file. Locally edited note contents are still unverified and require human review. A file generated from changed proposals is intentionally rejected rather than silently mapping comments onto new work. Browsers do not retain notes after refresh unless the owner exports a file first. Do not use real patient information or unreviewed medical claims.

## Remaining security gates
Supabase provider-supported immediate Auth session revocation, independently bound tenant database principals, direct Data API exposure review, removal of legacy privileged function permissions, hosted fictional multi-user isolation and independent reviewer sign-off are still open. Never merge or deploy based only on source CI.

## Rollback
One non-force revert of this phase's source commit. No hosted changes to undo.
