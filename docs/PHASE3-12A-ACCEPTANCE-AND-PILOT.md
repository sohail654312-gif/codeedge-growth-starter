# Phase 3.12A — Offline Pilot Handoff and Security Acceptance

## Scope and observed support status
Source-only change on the existing Growth Starter branch and PR #2 (DRAFT).
No hosted grants, migrations, accounts, passwords, RLS changes, exposed-schema changes, merges, production deployment or customer actions.

The owner confirmed support ticket **SU-502526** / conversation **cnv_1olowg2m** was submitted and linked to staging project **dbppeymhsemvghbvuvof**.
The only connected Gmail-visible reply at preparation was an automated acknowledgment. **PROVIDER DECISION PENDING.** This is not provider acceptance of managed Auth permissions.

## Delivered client-facing functionality
The existing Website Proposal Desk includes an additional **Download offline pilot review pack** control. The export is a local JSON handoff assembling bounded, tenant-matched SEO tasks, keyword hypotheses, AEO drafts, social content concepts and the existing human-review-only website improvement proposals. Never verified live Google analytics, patient data, persisted approval or remote publishing.

A no-network CLI produces the same JSON for the fictional Peshawar clinic or Manchester plumbing business:
- node backend/pilot-review-demo.mjs clinic
- node backend/pilot-review-demo.mjs plumbing
- node --test tests/pilot-review-pack.test.mjs

The site remains a preview; this feature does not create authenticated client work or replace the secure host.

## Security acceptance matrix

| Check | Reproducible source evidence | Hosted verdict |
| --- | --- | --- |
| Fictional A/B/C identities, rejected actor forgery and foreign tenant reads | tests/phase311-private-gateway.test.mjs | BLOCKED |
| Revoked session, denied membership, provider/SQL outage | tests/phase311-private-gateway.test.mjs; tests/pg-session-authority.test.mjs | BLOCKED |
| Invalid/expired identity and signed JWT boundary | tests/hosted-authenticated-gateway.test.mjs; tests/pg-session-authority.test.mjs | BLOCKED real identities |
| Direct SQL denial, limited tenant roles, privilege escalation | tests/postgres/phase39-tenant-principal.pg.test.mjs (disposable PG17) | BLOCKED |
| Membership revocation under two-connection concurrency | tests/postgres/phase310-revocation-concurrency.pg.test.mjs (disposable PG17) | BLOCKED |
| Direct Data API bypass using signed-out JWT | tests/phase36-direct-api-probe.test.mjs (source simulation) | NOT TESTED hosted |
| Legacy privileged function cutover | tests/postgres/actor-cutover.pg.test.mjs | FAIL/OPEN (3 legacy EXECUTE paths) |
| Actual signed A/B/C sessions, logout/replay and denied cross-client HTTP | Requires owner-approved isolated hosted accounts and HTTPS endpoint | BLOCKED |
| Fictional pilot export and rejection of cross-tenant/publication-capable inputs | tests/pilot-review-pack.test.mjs | Source-only, subject to final SHA CI |
| Real Google OAuth, WhatsApp, patient-data onboarding, external publishing | Not authorized | Disabled |

Source/disposable tests can PASS without establishing hosted acceptance. The four RLS-enabled tables lacking SELECT policies are intentionally deny-all, not proof of a fault requiring broad grants.

## Conditional vendor-supported activation routes

**Route A — Supabase confirms supported session-checker privileges:** Independently review official answer and validate supported managed Auth semantics. Separately obtain owner approval for exact minimal managed-schema USAGE, private LOGIN/credential-vault delivery, TLS host, and fictional user provisioning. Require exact JWT session/revocation tests, database-enforced user-to-tenant identity binding, Data API exposure readback, adversarial SQL denial, and independent security review. Only then revoke old privileged reader execution using reviewed transactional cutover. Roll back to maintenance/deny-all and disable credentials on failure.

**Route B — Supabase rejects the proposed session lookup:** Do not switch to unchecked JWT or service_role. Design a separately authorized, provider-supported revocation-aware session service, define logout/suspension guarantees, threat model tenant isolation, test real replay/rollback, and obtain independent approval before changing any hosted security control.

No option is silently activated; real costs for hosting or paid Supabase support have not been verified.

## Staging read-only baseline
Staging project ACTIVE_HEALTHY, PostgreSQL 17.11 (2026-10-12). Seven RLS-enabled Growth Starter tables, three read policies; session-checker LOGIN false and managed auth schema USAGE false; runtime can SET ROLE old reader; three legacy privileged functions executable by old reader. No hosted mutation was made.

## Pilot readiness and unfinished work
- Added a concrete, review-only evidence handoff and automated fictional integration tests.
- Client approvals, private enquiries, role-bound mutations, secure storage, real Google integrations, production authentication, hosting, logging, mobile a11y and independent reviewer signoff are still incomplete.
- Existing preview and fictional-only workflows may be shown as *demonstrations*, not a working production client system.
- Never include clinical claims without medical professional fact review.

## Quality control
Verify the four workflows on the exact new commit SHA: core safety, disposable PostgreSQL 17, SEO UI/TypeScript and staging supply-chain. Report actual conclusions, not earlier passes. Keep PR #2 DRAFT.
Rollback is a normal non-force revert of the Phase 3.12A commit on this branch; there is no hosted database change to undo.

## Next highest-impact external decision
Obtain the technical written response to Supabase support ticket **SU-502526**, then ask for separate owner approval to test the accepted design in isolated staging.
