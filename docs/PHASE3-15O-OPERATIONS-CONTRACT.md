# Phase 3.15O source operations contract

This package is source engineering for the existing draft PR. It creates no listener,
accounts, hosted grants, migrations, external actions or deployment. Hosting and its
exact hostname remain pending. Existing private gateway deployment gates remain intact.

## Authorization and persistence

`createWorkspaceOperations` requires the injected transactional store, a server-only
cursor signing key, and an actor obtained by server identity middleware. The routes
discard body actor and role claims. Each operation locks workspace, current membership,
then its business record. The live role authorizes the operation. A revoked member
cannot read a page, mutate a record or retrieve an idempotency receipt after revocation
commits. A request already ordered before revocation may finish first; no claim of
cancelling in-flight responses is made.

The source API implements profile onboarding with version checks, idempotent request
creation, owner/agency assignment to current agency/staff members or the owner,
versioned client/owner corrections of work awaiting approval, scoped detail/notes,
filtered request pages and owner/agency audit history. Existing versioned review and
approval transitions now derive the role inside their transaction. Staff can review
but cannot assign or approve. Receipt reuse with a different validated payload is a
conflict. All receipt, business and audit changes commit or roll back together.

Request cursors preserve PostgreSQL microsecond ordering and bind the workspace,
actor and filters under HMAC for 15 minutes. Pages are 1–50 records; notes are capped
at the latest 50. Counts describe the loaded page, not a global performance metric.
Receipts and audit retention need an accepted retention policy before hosted use;
there is no automatic destructive cleanup.

SDK operations still work for a personal owner workspace. Previously resolved shared
membership cannot open non-transactional shared SDK reads/writes. Shared use requires
the new operations service or the existing transactional transition boundary.

Media lookup checks actor and consent in the same transaction. Deletion rechecks
workspace authorization and uses tombstone/outbox persistence. Lease attempts fence
stale acknowledgements and retries. The manual deletion worker has an aborting storage
deadline; storage must support idempotent deletion. It is not automatically scheduled.

## Database rehearsal

`phase315o_operations_REVIEW_ONLY.sql` is a non-idempotent review draft, tested against
the disposable 0001 baseline on PostgreSQL 17. It adds a composite owner foreign key,
exact media outbox references, profiles, correction notes, receipts and ordered indexes.
New tables force default-deny RLS without allow policies or browser grants. Existing
inconsistent rows will reject the migration instead of being repaired silently.

The PostgreSQL source store is exercised with an administrative **disposable test role**.
It does not establish a production least-privilege writer. Private fixed-purpose
operations RPCs, accepted identity/cookie composition, grant preflight, hosted migration
reconciliation and two-user acceptance remain release blockers. The source operations
API returns 503 until a trusted transactional service is explicitly supplied; the
existing hosted entrypoint supplies none.

## Authentication evidence boundary

Supabase PKCE codes are short-lived and one-use. Codeedge consumes its own login state
before exchange, keeps the verifier server-side and verifies the provider-returned
identity. Response streams are capped at 32 KiB and body reads have deadlines. Expected
account-specific email denials produce the same generic result as eligible initiation;
this is not a claim that mail was delivered. Operational outages remain visible.

The exact-session authority wrapper rejects missing policy/identity/expiry facts,
outage and timeout. Its injected lookup is a source contract, not a deployed provider.
No broad managed Auth grants are added. A JWT or `getUser` alone does not establish
immediate global/admin revocation. The supported authority implementation and hosted
semantics are still blocked independently of the remaining engineering work.

Official references reviewed: [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[sessions](https://supabase.com/docs/guides/auth/sessions), and
[sign-out semantics](https://supabase.com/docs/guides/auth/signout).

## Runtime reliability

The private gateway adds a five-second PostgreSQL statement deadline, a 6.5-second
client query deadline and a ten-second idle transaction deadline. See the documented
[node-postgres configuration](https://node-postgres.com/apis/client). Successful and
failed startup use bounded shutdown. Shutdown is idempotent, closes admission/idle
connections, forces lingering HTTP connections after three seconds and bounds pool
draining to five seconds. A pool that cannot drain produces a generic shutdown
failure instead of hanging indefinitely. Real loopback HTTP tests exercise a request
that never finishes; no production listener is opened by the tests.
