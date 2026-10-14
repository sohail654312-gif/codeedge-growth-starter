# Private staging deployment runbook

**BLOCKED pending approved host/hostname, supported authority, reviewed database
cutover, real credentials and owner deployment approval.** No deployment URL is
assumed. This package is portable preparation, not a successful live deployment.

## Build and prerequisites

Use the engineering SHA whose four push workflows succeeded. `npm ci --ignore-scripts`,
both typechecks and `npm run build:private` build the standalone cookie-only UI.
The existing AppDeploy build requires its platform-provided SDK; the private build
has no AppDeploy runtime dependency and does not redeploy that existing demo.

`staging/Dockerfile.phase315m` uses the existing digest-pinned Node 22 image, a
separate UI build stage, locked runtime dependencies and a non-root process. GitHub
Actions builds the container because no local Docker is assumed. The package must
exit before opening a listener when the approved prerequisites are missing.

Complete the security cutover runbook before credentialed activation. Supply the
reviewed supported authority module as a read-only operator asset and verify its
SHA-256. No built-in provider authority or fabricated attestation is supplied.

## Configuration and secret injection

| Variable | Contract |
|---|---|
| `GS315M_ACTIVATE` | Exact staging ref; no default |
| `GS315M_COMMIT_SHA` | Reviewed engineering SHA, matching operator evidence |
| `GS315M_APP_ORIGIN` | Approved canonical HTTPS origin, no credentials/path/query |
| `GS315M_ISSUER_DATABASE_URL` | Actual `gs315m_issuer` private database login |
| `GS315M_GATEWAY_DATABASE_URL` | Actual `gs315k_gateway` private database login |
| `GS315P_ACTIVATE` | Exact staging ref, only if private operations approved |
| `GS315P_WRITER_DATABASE_URL` | Actual `gs315p_writer`; never admin/service_role |
| `GS315M_DATABASE_CA_PEM` | Supabase CA; certificate verification remains enabled |
| `GS315M_PUBLISHABLE_KEY` | Project publishable Auth key; never service secret |
| `GS315M_CSRF_KEY_PATH` | Read-only mounted random key, >=32 bytes |
| `GS315P_CURSOR_KEY_PATH` | Read-only mounted independent high-entropy signing key |
| `GS315M_AUTHORITY_MODULE` | Independently reviewed supported exact-session adapter |
| `GS315M_EVIDENCE_PATH` | Exact operator evidence; IDs are not self-proving approvals |
| `GS315M_INGRESS_MODE` | `direct_tls` or approved `managed_https` |
| `GS315M_TLS_CERT_PATH`, `GS315M_TLS_KEY_PATH` | Approved cert/key for direct TLS |
| `GS315M_TRUSTED_PROXY_ADDRESSES` | Exact socket peer IPs; never trust headers alone |
| `GS315M_PORT` / `PORT` | Approved bound port; no public exposure by default |

Evidence also binds `operationsCommitSha` and `operationsMigrationReviewId`.
An owner ID or boolean is a routing/startup prerequisite, not proof of accepted
provider/hosted behavior. The release gate does not promote these checkboxes.

Use approved secret-manager mounts/injection; do not place URLs, passwords, keys,
cookies, auth codes, PKCE verifiers or bearer/refresh tokens in Git, logs, UI or chat.
Arrange separate rotation and access policies for issuer, gateway, writer, CSRF,
cursor signing and authority access. Revoke previous credentials and sessions at
rotation; do not silently retain unsafe old entrypoints.

Only the exact staging direct database or Supabase session pooler hostname is
accepted, port 5432, database `/postgres`, the exact login (pooler login includes
project ref), and TLS CA validation. Transaction pooler port 6543 is refused.
No raw SQL executor is exposed through HTTP. Custom-role support/ambient extension
privileges still require hosted verification.

## HTTPS, redirects and assets

All private data/UI routes require the accepted secure ingress and exact Host.
Managed HTTPS must replace forwarded headers and restrict the backend to actual
trusted proxy peers. Direct TLS binds loopback and needs an approved ingress to
serve a real hostname. Verify real certificate chains, HTTP->HTTPS redirection,
HSTS and no alternate hostname/cache paths before acceptance.

Authorize only the approved origin's `/auth/callback` in Supabase redirects and
confirm the email template delivers the PKCE code/state format expected by this
source. `create_user:false` does not create accounts. Provision fictional A/B/C
only after explicit approval. A callback sets Secure HttpOnly `__Host-ce_session`,
signed CSRF and clears flow state; logout is a same-origin CSRF-protected POST.

Built UI assets are an exact file map, with self-only CSP and no-store responses;
no arbitrary filesystem path, inline script or data cache is served. The browser
does not read Supabase tokens and makes only same-origin cookie API requests.

## Health, limits and operating logs

`/health` is process liveness only. `/ready` is ingress-protected and repeats
effective database privilege preflights. Its response explicitly says provider
acceptance is pending and `releaseReady:false`; neither endpoint promotes release.
Perform real synthetic-user acceptance separately after every relevant change.

Each of three pools has max two connections (six maximum per process), 3.5-second
connection admission timeout, five-second server statement timeout and 6.5-second
query timeout. P transactions use four-second statements, two-second lock and
six-second idle deadlines; provider waits are capped at three seconds. P does not
retry ambiguous mutations automatically; the UI retains the idempotency key for
the same in-page retry. A page reload loses that in-memory retry state: refresh and
inspect existing work before issuing another create after an ambiguous failure.

Server headers/body deadlines and bounded shutdown remain enabled. The approved
host must provide request/concurrency limits, abuse admission, health monitoring,
clock discipline, time-bounded secret access and private network constraints.
Log status/category/request correlation and aggregate pool/latency metrics, never
request bodies, cookies, callback URLs, credentialed connection URLs or raw errors.

## Resources, cost and recovery

Initial sizing is a planning assumption, not a selected host: one process, six DB
connections, bounded pages of 1–50, serial business operations per workspace and
no automatic worker. Measure workload/connection pressure with fictional tenants
before choosing capacity. Multiple instances multiply six-connection budgets;
SQL locks/receipts coordinate work, while the local sandbox journal does not offer
distributed worker coordination. Do not enable it as multi-instance production storage.

Current public pricing and explicit resource/cost assumptions are recorded in
`FINAL-CODEX-TO-CHATGPT-HANDOFF.md`; no host quote, Free-plan sufficiency,
production throughput or backup RPO/RTO is accepted. Obtain an exact spending approval before
provisioning. Approve retention for login flows, receipts, audit and media tombstones;
no destructive retention cleanup is enabled by this package.

`private-observability.mjs` emits only fixed route category, status, duration and
random request correlation ID on completed responses. Bodies, callback query
strings, cookies, identities, SQL and raw errors are excluded. Configure the
approved log destination and retention outside source. `monitoring.template.json`
contains proposed health/readiness cadence and alert thresholds; it neither
provisions monitoring nor contacts an incident recipient.

Backup/export and restore are part of the approved database cutover, with recorded
restore drill and incident ownership. On failure close ingress and run P/M deny-all
lockdowns; keep legacy API grants denied. Reopening needs new current-SHA tests,
effective ACL checks and independent acceptance. Use the independent checklist
and regenerate release JSON; HOSTED_STAGING_READY/PRODUCTION_READY remain blocked
until their missing facts are actually verified by an approved evidence collector.
