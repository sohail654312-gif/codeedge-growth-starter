# Remaining external dependencies

Date: 2026-10-14. **Hosted staging and production: BLOCKED.**
The following are not resolved by a source build or disposable test.

| Dependency | Current evidence | Owner/provider action |
|---|---|---|
| Exact provider authority | Official mechanism documented; dedicated managed Auth contract/lifecycle unverified; matching support emails automated only | Obtain technical answer for SU-502526/SU-503988, confirm exact pair/account/policy semantics and independent review |
| Managed-schema privileges | Refreshed checker is NOLOGIN, lacks Auth schema USAGE, has only six previously reviewed column SELECTs; no new grant | Recheck at approval time; explicit separate authorization if any change is proposed |
| Host/hostname | None selected or approved | Approve exact provider/origin, current cost, TLS, private ingress and secret injection |
| Private migrations and credentials | REVIEW_ONLY O/K/M/P bundle; hosted private schema absent | Review hashes, baseline/default/index/policy compatibility, backup restore, exact change approval and actual restricted login preflights |
| Legacy/Data API closure | Column grants and runtime -> reader edge still present | Dependency analysis, replacement acceptance, approved cutover, actual Dashboard/GraphQL inspection and signed bypass probes |
| Fictional hosted identities | No accounts or email sends created here | Authorize controlled A/B/C, redirects/email template and real login/logout/admin/password acceptance |
| Storage | SQL consent/read/delete queue tested; live storage unconnected | Approve storage adapter, scan/rights/retention, private media serving and manual deletion acceptance |
| Invitations/provider delivery | Existing transactional invitation source remains; private live delivery not wired | Approve identity admission/delivery contract before exposing invitation issue/accept in private hosted UI |
| External growth providers | GSC/GBP/social/analytics interfaces disabled | Approve real accounts, scopes, adapters and evidence; preserve neutral domain->interface->adapter separation |
| Automation/payment/publishing | Sandbox only; disconnected actions | Separate approval, distributed durable coordination and per-provider idempotency before real effects |
| Operations | No production timings/capacity/RPO/RTO/retention measured | Fictional representative load, backups/restore drill, monitoring, resource budget, incident owner and retention acceptance |
| Release | Independent reviewer/human owner approvals absent | Complete hosted evidence collector and independent acceptance; source CI alone cannot promote release |

Provider-only Codeedge session alternative is described in the final authority
decision. It is an explicit possible contract change, not the chosen architecture.
No confirmation is requested for completed reversible source work. Only the specific
future hosted actions in the user's assignment need separate authorization.
