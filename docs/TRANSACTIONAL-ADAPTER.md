# Transactional adapters — strict provider-neutral contract

This branch includes `backend/transactional.mjs`, a provider-neutral **domain service**, not a connected production persistence adapter. It imports Node `crypto`; AppDeploy compatibility is unknown. It refuses to initialize unless the supplied store advertises atomic transaction, row-lock, unique-membership, and audit guarantees. **Capability flags are not evidence**; independent database tests must establish real semantics.

## Required store interface
- `transaction(async tx => ...)` is SERIALIZABLE or implements equivalent linearizable locks for invitation consumption, membership uniqueness, request transitions, and audit events **in a single atomic commit**.
- `tx.lockWorkspace(id)` locks the workspace row; `tx.lockInvitation(id)` locks invitation state; `tx.lockMembership(workspaceId,userId)` locks unique membership row.
- `tx.insertInvitation`, `tx.consumeInvitation`, `tx.upsertMembership`, `tx.revokeMembership`, `tx.audit` must commit/rollback together; unique constraints and FK references are enforced by database.
- `tx.lockRequest` / `tx.updateRequest` must lock and update the same tenant's request with a monotonically increasing version; audit in the same transaction.
- `store.readMembership`, `store.readWorkspace`, `store.listUserMemberships` return up-to-date authoritative server records. Revoked memberships must be denied immediately (no unsafe stale cache).
- The actor's identity and verified email must be extracted from **server-verified auth claims**, not client JSON; the invite token is high entropy, HMAC-digested at rest, one-use, email-bound and expires after 48 h. The token must never appear in logs, URLs with third-party referrers, analytics, or other user workspaces.

## Runtime gates
- **No AppDeploy adapter is wired by this PR.** Existing AppDeploy `db.list/get/update` APIs have no independently established transaction/unique-constraint guarantees.
- Server defaults: foreign workspaces denied; no invitation API; request approval/status transitions 503; irreversible media deletion 503 unless a durable tombstone/outbox implementation is verified.
- Do not turn on cross-tenant access or send invitations until PostgreSQL (or equally capable provider) adapter passes disposable DB tests and hosted synthetic identity checks. No real patients/customer data.
- `main` and live AppDeploy remain unchanged.

## Acceptance
Verify under real concurrent sessions: exactly one invitation acceptance, verified email mismatch denied, expired/revoked token denied, no forged grants, no owner escalation, transaction rollback, immediate revocation, serialized request version checks and audit preservation. Mock test results are not sufficient evidence.

## Media path and retention
Per-workspace media must have server-enforced owner partition; consent is required before signed download URLs can be issued. The current image header/magic-byte tests do not decode full files or scan content. Secure deletion needs a persisted tombstone + outbox worker (idempotent, retryable) before physical removal. Videos require signed upload sessions and streaming rather than JSON/base64.
