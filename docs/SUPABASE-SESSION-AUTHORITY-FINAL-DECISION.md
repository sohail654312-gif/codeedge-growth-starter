# Supabase session authority decision

Reviewed 2026-10-14. **Decision: retain the mandatory exact-session fail-closed
boundary. Supported hosted authority is UNVERIFIED; hosted activation is BLOCKED.**
This is not a claim that Supabase rejects the architecture.

## Evidence and precise guarantees

| Architecture | Verified guarantee | Decision |
|---|---|---|
| Signed, unexpired JWT / `getClaims()` | Cryptographic claim validation; asymmetric keys can be verified against JWKS | Insufficient for immediate provider-session revocation |
| `getUser()` / server `/auth/v1/user` | Server-returned user identity; existing source validates issuer/audience/subject/email/freshness | Not accepted as an independently proven exact active-session/policy guarantee |
| Exact `(user_id, session_id)` lookup | Official sessions guide recommends session-row correlation to close sign-out token window | Mechanism documented; dedicated managed-schema grants, lifecycle/policy semantics and upgrade stability still require support/review |
| Codeedge-owned session | Immediate new-operation denial after Codeedge logout/revocation commits; expiry and current membership checked in SQL | Implemented; does not automatically synchronize provider global/admin actions |

Supabase documents `session_id` as the identifier of an `auth.sessions` row, and
that affected rows are removed on sign-out. It also documents that time-box and
inactivity limits are checked on refresh and expired session rows may persist.
Row existence therefore does not establish every configured session policy.
Refresh-token reuse exceptions are documented; repeatedly refreshing a provider
token is not a substitute for exact-session introspection.

Public documentation does not establish the exact dedicated custom-role contract
needed here across bans, deletion, password changes, local/global/others sign-out,
administrative revocation, inactivity and time-box policy. Current account status
must be verified separately from token validity and original-session activity.

## Support and staging facts

Connected Gmail searches for SU-502526/SU-503988 returned the original forwarded
automated acknowledgment and the follow-up automated acknowledgment dated Oct 12.
No technical provider answer was present in those matching messages. This is not
a claim to have inspected every support portal conversation. No message was sent.

Read-only staging metadata reconfirmed PostgreSQL 17.11, the seven recorded
migrations, no `growth_starter_private` schema, existing authenticated column
reads and the old runtime -> reader SET ROLE edge. No Auth/session/user records,
credentials or customer rows were read. A refreshed managed Auth catalog confirmed
`users` and `sessions` are RLS-enabled and owned by `supabase_auth_admin`; the
checker remains NOLOGIN with Auth schema USAGE false and only effective SELECT
on sessions `(id,user_id,not_after)` and users `(id,banned_until,deleted_at)`.
These metadata facts do not establish supported lifecycle semantics. Recheck before approval.

## Accepted source contract

The injected authority must verify the database-bound original pair and current
account/policy state, return explicit activity and a future integer expiry, fail
on unknown/malformed facts, and honor bounded abortable requests. No active result
is cached. The P adapter rejects absent expiry, mismatch, denial, outage and timeout
before its business function. Codeedge validity is rechecked in the SQL function.
The existing `createExactSessionAuthority` wrapper additionally requires explicit
exists/revoked/deleted/banned/policyValid facts.

No built-in always-active, claims-only or user-only implementation is provided.
The authority module digest binds the operator bootstrap to reviewed source; its
digest alone does not prove provider behavior. Hosted acceptance must supply real
event tests and provider support evidence. Test doubles prove failure handling only.

## Owner-scoped alternative

If the provider cannot confirm a supported exact authority, the owner can consider
a **different explicitly approved staging security contract**: Codeedge-owned
sessions with independent Codeedge logout/admin revocation and short bounded expiry,
while disclosing the absence of automatic Supabase global/admin synchronization.
That alternative has not been selected or activated. It requires an explicit
contract change and independent review; it cannot be substituted to obtain green CI.

## Current official sources

- [Sessions and post-sign-out checks](https://supabase.com/docs/guides/auth/sessions)
- [Sign-out scopes and token lifetime](https://supabase.com/docs/guides/auth/signout)
- [getUser](https://supabase.com/docs/reference/javascript/auth-getuser) and [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [User management / managed Auth](https://supabase.com/docs/guides/auth/managing-user-data)
- [Postgres roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Secure data](https://supabase.com/docs/guides/database/secure-data), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Direct and pooled connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Platform permissions](https://supabase.com/docs/guides/platform/permissions) concern platform access and are not, alone, authorization to change managed Auth grants.
- [Changelog](https://supabase.com/changelog): Oct 12 TLS cipher deprecation reviewed; use modern TLS and validation. No relevant change confirmed an exact introspection authority.
