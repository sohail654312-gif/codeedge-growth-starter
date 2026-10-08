# Growth Starter — Phase 2 Continuation Evidence (2026-10-08)

**Source of record:** PR #2, branch `engineering/phase2-core-security`.
**Main SHA at start:** `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.
**Prior PR head:** `6d0c96ad6cc1a630e0cf5b542696ff36820fe331`.
**Latest audited increment (before documentation-only commit):** `8fbbe4dbd4d9f34e3975201db81fcdd3358ac616`.
**Evidence:** [GitHub Actions run 37760438295](https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/37760438295) — **32/32 pass**, 0 failures. These tests run against in-memory transactional simulations and a mocked AppDeploy SDK; they are not production security proof.

## GitHub vs deployed AppDeploy
- The live Phase 1 app `codeedge-growth-starter-5jhvfk` remains **unchanged**, deployed snapshot `1791451334342` (status READY, no QA frontend/network/backend errors). Its core remains owner-isolated by per-user AppDeploy DB table names. It has no Phase 2 collaboration.
- At audit start, GitHub `main` and the applied AppDeploy snapshot had matching `backend/index.ts`, `src/App.tsx`, `src/ClinicOverview.tsx`, `tests/tests.json` and `package.json`. README differs intentionally (GitHub contains expanded documentation).
- A separate AppDeploy **sandbox app** was created: `growth-starter-phase-2-qa-sandbox-gve53p` (snapshot `1791453448557`), status READY with clean initial screenshots/log snapshots on desktop and mobile. This snapshot was built from engineering head `c8cb67a2151e47edb0558f449d0f1dea4b7a0be2` to check extracted `backend/routes.mjs` + `core.mjs` bundling; it **predates** the later media UX changes. It does not prove two-user identity or tenant denial.
- The AppDeploy SDK documentation supplies DB `add/get/list/update/delete`, but **no verified transaction/unique-constraint/compare-and-swap primitives**. `AuthUser` includes `userId`, optional `email`, `name`, `scope`; it has **no `emailVerified` claim**. Therefore live invitation issuance/acceptance must remain disabled.

## PASS / FAIL / BLOCKED
| Boundary | Verdict | Evidence / limits |
|---|---|---|
| GitHub branch integrity, existing owner storage keys | PASS | Latest branch / source, mock regression |
| Domain role policy, input & pagination validation | PASS (mock only) | 32 GitHub tests |
| Legacy grants cannot unlock foreign workspaces | PASS (mock only) | Direct denial tests; production requires hosted checks |
| One-use, verified-email-bound invitation **domain adapter** | PASS (mock only) | Two concurrent attempts: one accepted, one rejected; **no live provider bound** |
| Atomic review and conflict/version handling domain adapter | PASS (mock only) | Serialized transaction simulator; server route defaults 503 |
| Non-atomic AppDeploy request mutations | FAIL (original design) → BLOCKED/disabled in new branch | Unsafe mutation path returns 503 unless verified transaction adapter exists |
| Media signing & shared upload protections | PASS (mock only) | Unapproved media yields no signed URL; shared uploads return 503; full scanning remains open |
| Extracted backend staging bundle/UI launch | PASS (basic smoke) | Separate AppDeploy sandbox READY, no initial JS/network/backend QA errors |
| Real two-user cross-tenant denial & verified identity binding | BLOCKED | No separately authenticated synthetic staging users/evidence |
| Invitations, role issuance/revocation in live deployment | BLOCKED | No verified transactional persistence + AppDeploy lacks verified email claim |
| End-to-end private media deletion/retention | BLOCKED | No durable tombstone/outbox or delete-after-confirm lifecycle |
| Full reproducible TypeScript/backend runtime verification | BLOCKED | AppDeploy-provided SDK modules not a portable local `npm build`; no complete compile/typecheck proof |
| Production pilot / privacy acceptance | BLOCKED | Independent reviewer and real-service evidence missing |

## Implementation increment
1. Removed acceptance of legacy `gs_memberships_<userId>` records as authoritative proof for a foreign tenant; the server defaults to deny unless a verified transactional adapter is bound.
2. Added `backend/transactional.mjs` with high-entropy, HMAC-digested one-time invitation tokens, 48-hour expiry, exact verified-email subject binding, owner-controlled role creation/revocation and no elevation to owner; all operations require transaction/locking/uniqueness/audit contract.
3. Added transactional request service with version-checked state transitions and atomic audit design; existing non-atomic AppDeploy approvals/reviews are gated off (HTTP 503) by default.
4. Media: reject foreign/malformed paths for signing, do not issue signed preview links for unapproved images, deny shared uploads until transactional media lifecycle is proven, and disable non-durable delete. Source includes format headers, 3 MiB guard and an advisory quota, **not** full decoder validation/scanning or race-proof limits.
5. Added a focused, mobile-responsive `WorkProgress` client/agency panel (navy + white). Clients can create a **separate** change request with notes through existing safe append-only request creation; actual in-app approval remains visibly disabled. Agency role is derived from server response, not a UI toggle.
6. Media interface requires rights attestation before selecting small business photos and shows a secure placeholder when a stored image has no approved signed URL. This is **not** a professional consent-verification system.

## Rollback / migration
No live tables were migrated; source `gs_profiles_<authUserId>`, `gs_enquiries_<authUserId>`, `gs_requests_<authUserId>`, `gs_assets_<authUserId>` are reused. GitHub branch changes do not affect existing running AppDeploy users. Source rollback is reverting this PR if necessary; no live data restoration or destructive schema changes are required. **Actual staging rollback drill not performed**.

## Mobile/accessibility and performance
Responsive CSS breakpoints and semantic labels/controls exist in code; an isolated AppDeploy desktop/mobile screenshot was generated without runtime errors. **No Lighthouse/Web Vitals benchmark, keyboard-only walkthrough, screen-reader review or WCAG conformance test has been performed.** Actual slower-network performance is therefore BLOCKED for production acceptance.

## Required before next handoff
- Choose a transactional persistence provider with a real serializable transaction and unique membership/consumption constraint; verify in disposable PostgreSQL or equivalent, then author an adapter and run concurrency tests on that real DB.
- Identify a server-trusted identity provider that provides verified-email claim evidence and revocation state; do not treat an optional AppDeploy email value as verification.
- Perform two-identity hosted isolation tests for read/write/upload/download/role elevation; capture account IDs, trace timestamps, SHA, status and sanitized failure evidence.
- Build genuine agency operations UX **only after** server-authoritative member lifecycle is available. Implement full media consent review, storage outbox/tombstones, retention/export, scanning, and chunked video.
- Separate independent security review required; draft PR remains unmerged, no production deployment.

**Verdict: REVIEWABLE INCREMENT / NOT PILOT-READY.**
