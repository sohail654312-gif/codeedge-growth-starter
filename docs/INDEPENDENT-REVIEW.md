# Independent Security & Reliability Review — PR acceptance checklist

**Review isolation:** Independent reviewer, exact GitHub branch SHA + deployed staging version; builder must not self-approve, merge, or deploy.

## Evidence to obtain
- [ ] Confirm the PR base commit and head SHA; ensure changes only touch Growth Starter.
- [ ] Run `node --test tests/*.test.mjs` on exact SHA and capture output. Distinguish mocked SDK tests from live tests.
- [ ] Verify `@appdeploy/sdk` runtime import and bundling of `backend/routes.mjs` and `backend/core.mjs` on isolated AppDeploy staging, not production demo.
- [ ] Validate `requireAuth` on **every** protected route and how missing/expired tokens fail.
- [ ] Register two independent users and verify each sees only the owner's profile/enquiries/requests/assets; attempt ID guessing, `workspaceId` query/body spoofing and cross-workspace media URL access.
- [ ] Seed an authorized grant in a disposable staging backend through **server-only** path and verify agency_admin/staff/client matrix; ensure a client cannot set enquiry state or delete shared media.
- [ ] Verify forged, revoked, duplicate and malformed grants all deny access. Check how membership issuance, expiration and revocation will be implemented; not available yet.
- [ ] Exercise request state machine as distinct staff and client actors. Reject approval before Awaiting approval and any unsupported Published claim.
- [ ] Upload proper PNG/JPEG/WebP, fake extensions, mismatched magic, invalid base64, path traversal, oversized media and concurrent quota attempts. Verify private signed URL constraints and failed-delete recovery.
- [ ] Validate real SDK DB pagination, storage error paths and concurrent update behavior. Confirm no credential or patient data exposed in logs.
- [ ] Test legacy data in owner partitions survives staged branch deploy and rollback; never delete source data.
- [ ] Check performance with slower mobile networks, keyboard navigation, accessible labels, failure states, and no fictitious metrics in private user views.
- [ ] Inspect branch protection, repo visibility, privacy/consent and data deletion/retention policy before pilot.
- [ ] Require actual hosted end-to-end evidence, independent verdict per finding and explicit owner sign-off before production.

## Initial risk verdict
**BLOCKED for real-client pilot.** Mock-tested security foundation ≠ validated production multi-tenancy. See `docs/SECURITY.md` for open R1–R7.

## Suggested next safe increment
Implement a transactional, server-authoritative invitation/member adapter in disposable staging, and build separated agency/client screens with approval queue, then ask for independent cross-tenant review.
