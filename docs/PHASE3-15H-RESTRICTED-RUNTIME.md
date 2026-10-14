# Phase 3.15H — Least-privilege database role separation

This is a **source-only, disposable PostgreSQL 17 proof**. No SQL changes, production permissions, Edge Functions, secrets, new Auth users or deployments on Supabase staging. PR #2 remains draft.

## Hypothesis and experiment
- Tenant A and B use separate actual PostgreSQL LOGIN connections. Each role has SELECT on a narrow set of nonsecret request columns and its own session's hashed credential; database RLS policies bind the permitted rows to the authenticated database role, *not* untrusted caller identity, JWT metadata, Postgres GUC, or arbitrary SET ROLE.
- A third distinct LOGIN connection is a session-revocation writer. It can SELECT the session ID, hash and revoked_at and UPDATE **only revoked_at**. It cannot SELECT business requests, create session rows or become a tenant role.
- Readers use pg_advisory_xact_lock_shared and writer uses pg_advisory_xact_lock on a deterministic, domain-separated 64-bit key derived from the session UUID, followed by normal SELECT or narrow UPDATE. A reader needs **no UPDATE grant** to acquire a transaction-scoped advisory lock. A writer that completes revocation prevents later cooperating reads; earlier in-flight reads may finish.
- The proof uses synthetic gs315h tables independent of the managed Auth schema. Role passwords are random per CI run and never persisted in GitHub; identities and business records are fictional.

## Security limitations
**Not safe for production yet.** Advisory locks are voluntary: every session mutation and every protected read must use the exact lock convention. External updates or compromised privileged principals can bypass it. Tenant-per-role deployments increase database connections, secrets and lifecycle costs, may not scale to the Free tier, and need a deliberate provisioning/deprovisioning scheme. This experiment intentionally supports owner A and B only, not shared member C. A real gateway must bind the original trusted login to the server-selected tenant connection, check active membership and handle membership revocation. A restricted principal reading salted session hashes is still sensitive: reduce or eliminate that access in the final design.

Existing deployed staging role-switch and privileged SECURITY DEFINER functions remain unresolved. Direct REST access remains inconclusive because authenticated column grants exist and Dashboard exposure is unverified. Do not activate fallback from CI alone.

## Remaining acceptance and options
1. Review a more scalable, strongly isolated DB principal model without session-authenticated user identity being forgeable with caller-controlled text or GUC values.
2. Establish membership revocation semantics, logout across all access paths, provider administrator/global revocation strategy, connection-pool behaviour and secret rotation.
3. Verify direct Data API deny on actual signed fictional A/B/C users, plus real Supabase code-exchange adapter and callback host.
4. Propose fully reversible, independently reviewed staging migration and owner-approved private gateway before touching hosted roles.

Docs: https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS ; https://supabase.com/docs/guides/database/postgres/row-level-security
