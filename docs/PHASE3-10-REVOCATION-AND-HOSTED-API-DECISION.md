# CODEEDGE GROWTH STARTER — PHASE 3.10 REVOCATION AND HOSTED API DECISION

**Scope:** Narrow execution after Phase 3.9, not a live rollout. Existing repo \`sohail654312-gif/codeedge-growth-starter\`, existing branch \`engineering/phase2-core-security\`, existing draft PR #2. No hosted mutations, no paid infrastructure, no production credentials or customers.

## A. Verified starting point

Starting exact branch HEAD: \`349b90523cc48572308fbb22151cd8e330e5b552\`.
Starting exact HEAD GitHub Actions **PASS**:
- Core: 171 — https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38086536006
- Disposable PG17: 42 — https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38086535975
- SEO/UI: 39 — https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38086535970
- Supply-chain: 16 — https://github.com/sohail654312-gif/codeedge-growth-starter/actions/runs/38086536018

268 successful test executions across workflows (possible overlap); no Phase 3.10 PASS claimed from previous runs. The Phase 3.5 fixed PG17 policy snapshot and Phase 3.9 tenant-principal test remain intact.

## B. Concrete operator paths to activation

**Option A — preferred, preserve Supabase Auth.** Obtain documented Supabase permission to query the provider's existing \`auth.sessions\` records via a narrowly restricted server-side PostgreSQL checker. Must verify the original bearer identity with the provider and match exact \`session_id\`, \`user_id\`, current session presence and session/user state. No browser direct access. The existing draft checker role is NOLOGIN and lacks \`auth\` schema USAGE: it is not operable. Ask provider whether the minimum managed schema USAGE and column-level SELECT on \`auth.sessions(id,user_id,not_after)\` and \`auth.users(id,deleted_at,banned_until)\` is supported and stable. Explicitly request an alternative provider-native revocation-aware introspection API if DB access is unsupported. Provider docs: https://supabase.com/docs/guides/auth/sessions (sign-out deletes sessions; a signed JWT need not imply an existing session).

**Option B — separate session service.** Larger design and operational footprint, requiring certified delivery of every Supabase sign-out, multi-device and admin revocation into the app session registry. Neither a local logout hook nor token expiry alone satisfies immediate provider sign-out guarantees. **Not recommended unless A is formally impossible and a revised product security design is explicitly approved.**

**Decision:** Pursue A; do not weaken the mandatory immediate-revocation property. No option is currently approved to activate.

## C. Phase 3.10 executable engineering

New disposable PostgreSQL **17** regression \`tests/postgres/phase310-revocation-concurrency.pg.test.mjs\` uses two genuine simultaneous DB connections. A fictional member can read an assigned tenant request before revocation. A separate connection commits membership revocation. A \`READ COMMITTED\` reader transaction re-queries and must return zero records, including in the immediately following new transaction.

**Important negative finding:** a \`REPEATABLE READ\` transaction begun before revocation continues to see the previous authorized membership snapshot after revocation. This behavior is expected PostgreSQL MVCC semantics. Avoid long-lived snapshots for these sensitive private read paths. A statement already in flight also cannot be retrospectively cancelled merely by another transaction committing a revocation. The transaction test does not establish provider JWT revocation, per-request atomicity, or hosted acceptance.

The fixture's fixed role and hardcoded user in disposable RLS are a test simulation, NOT an approved authenticated identity-to-tenant principal binding. The hypothetical private adapter remains disabled for hosted use. No trusted runtime wiring was enabled.

## D. Open blockers — not hidden

1. **BLOCKED:** provider-approved current \`auth.sessions\` authority, existing checker LOGIN/USAGE and real signed-out token acceptance.
2. **BLOCKED:** independent authenticated user-to-tenant DB-principal binding, safe role/credential provisioning and per-tenant protection against a compromised shared process.
3. **UNVERIFIED:** live Supabase Data API Exposed Schemas (the database \`pgrst.db_schemas\` setting is null and not proof).
4. **FAIL/OPEN:** three legacy privileged function EXECUTE paths, and runtime SET ROLE old reader privilege.
5. **BLOCKED:** secured ingress and approved fictional A/B/C hosted acceptance, zero new accepted hosted controls.

No schema, role, grant, user, credentials, endpoint, Edge Function or deployment was created or modified in the isolated hosted Supabase project.

## E. Review and rollback

This phase consists only of source-controlled executable tests and the handoff. It is reversible through an ordinary revert commit; no production rollback is required. Verify the **new** exact-commit four CI workflow runs before marking Phase 3.10 engineering PASS. Never merge PR #2 or activate APIs based on disposable tests alone.

## F. Narrow next operator decision

**Provider/owner question:** May we pursue a vendor-confirmed least-privilege session-row lookup using the dedicated checker role, then separately approve precise hosted grants and **fictional** Auth sign-out/replay tests only after support documentation? If this remains unresolved, leave hosted customer access disabled and do not repeat Phase 3.7–3.9 feasibility loops.

**Completion rule:** engineering can PASS when the actual two-connection PG17 test and all four workflows pass on the new SHA. Hosted API activation stays BLOCKED until provider authorization, DB identity isolation, direct Data API restriction, old-role cutover and real Auth acceptance are separately verified.
