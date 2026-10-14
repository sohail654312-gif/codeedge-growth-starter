# Independent acceptance evidence requirements

This document identifies evidence to collect; checking a box is not release proof.
Record exact SHA, deployment/container/authority digests, target project/origin,
verifier version, test timestamps, redacted request/response outcomes and reviewer.
Keep credentials, cookies, PKCE codes and signed tokens out of evidence artifacts.

## Source versus actual hosted tests

| Scenario | Current source proof | Additional hosted proof required |
|---|---|---|
| A cannot access B, B cannot access A | Real PG restricted roles + composed cookie route denial | Real A/B Supabase identity/cookie and signed REST/GraphQL probes |
| C staff privileges only | SQL review permitted; assignment/approval/revoke denied; browser controls | Actual C identity and operation/cross-workspace attempts |
| Committed membership revocation | In-flight order plus subsequent denial | Real C and approved membership revoke |
| Inactive workspace | Real PG suspended workspace denial | Approved fictional workspace suspension/recovery |
| Expired/revoked Codeedge session | Real SQL expiry/revocation, callback-cookie logout replay | Real deployed cookie expiry/logout/admin Codeedge replay |
| Provider user/session mismatch | Strict pair check and synthetic denial | Supported actual authority identity binding |
| Authority outage/timeout/malformed/expiry | Synthetic failures before business function | Approved fault injection against the real adapter, no secret leakage |
| CSRF/Origin/Host/cookie ambiguity | Synthetic transport failures before SQL | Real HTTPS cookies and alternate-origin requests |
| Callback replay | Single-use SQL flow/grant, composed callback replay | Actual emailed provider code/state replay and token nonexposure |
| Forged actor/role | HTTP discarded; SQL actor from stored token | Browser/HTTP attempts across real roles |
| Cursor tampering/tenant/filter/actor binding | Real keyset/cursor PG integration | Real deployed requests with altered cursor/filter/user |
| Concurrent idempotency | One request/receipt/audit; payload mismatch denied | Multi-client and ambiguous network retry acceptance |
| Concurrent approval/revocation | Transaction locks/CAS and existing revocation race suites | Actual hosting/pool concurrency and receipt replay after revoke |
| Media/consent/delete authorization | SQL rights/scan/consent and exact durable outbox, lease tests | Actual private storage, scan and idempotent deletion without exposure |
| Private function/browser denial | Actual PG EXECUTE/schema denial, role/missing grant tests | Supabase Data API/GraphQL and browser-role RPC attempts |
| Legacy bypass closure | Existing J cutover rehearsal, proposed precise column/function/role revokes | Actual approved cutover catalog and signed negative probes |
| Provider sign-out local/global/others | Documentation only; synthetic boundary | Real exact original session, still-unexpired bearer and appropriate scope assertions |
| Provider admin/password/ban/deletion/policy | No live acceptance | Provider-supported event semantics plus controlled actual negative tests |
| Recovery | Existing pooled operations denied after SQL EXECUTE lockdown | Close ingress, role/secret retirement, backup restore drill and never restore unsafe grants |

## Independent review before hosted authorization

- Review all DEFINER bodies, owners, search paths, RLS policies, defaults/column ACLs,
  role inheritance and SET ROLE, optional extension/PUBLIC capabilities, shared
  locks and privileged administrator exceptions.
- Reconcile migration history plus complete catalog, actual exposure and service
  dependencies; an identical migration ID list alone is insufficient.
- Verify the exact supported authority module and account/session policy facts;
  reject JWT/getUser-only substitution or fabricated support approval.
- Exercise owner/agency/staff/client UI with real identities, keyboard/screen-reader
  use, loading/errors/conflicts, filtering/paging, profile and request workflows.
- Audit actual secrets/rotation, TLS/canonical redirects, pool admission, logging,
  backups/recovery, retention and host/resource cost approval.
- Confirm every external provider/effect remains disconnected unless separately
  approved. Check labelled offline evidence; no fictitious live business metrics.
- Re-run all four source workflows on the exact evaluated SHA and regenerate
  machine JSON. An independent human reviewer must give a scoped report; this
  assistant's fresh engineering audit does not substitute for that approval.

`scripts/release-readiness.mjs` accepts remote workflow evidence fetched over HTTPS
for source readiness. It currently keeps hosted/production BLOCKED because a verified
hosted evidence collector and provider acceptance do not exist. Do not edit it to
trust boolean checkboxes or screenshots of an unchecked deployment state.
