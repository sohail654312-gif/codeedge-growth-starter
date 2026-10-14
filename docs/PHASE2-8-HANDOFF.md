# Codeedge Growth Starter — Phase 2.8 controlled engineering handoff

**Starting exact HEAD:** `5f39529bddef7f02fe4a9188d2647459e38bb0e9`. **Existing draft PR:** #2, branch `engineering/phase2-core-security`; original `main` `dd0ee8a9b5c4a770443a7a2eff2732858c01300e`.
**Final exact HEAD:** verify PR head *after this documentation commit*; use exact-head GitHub Action runs in the final PR comment.
**Verdict:** SOURCE HARDENING/PERSISTENCE DRAFT prepared; **HOSTED DEFINITION OF DONE BLOCKED**.

### Implemented safely
- Disposable PostgreSQL negative security regression for privileged actor ID substitution in the existing `SECURITY DEFINER` paths. HTTP gateway's signed user test remains denying foreign workspace, but an actor substitution by the reader role is reproducible. Risk remains HIGH.
- Pure `backend/seo-report-draft.mjs`: bounded source-only report envelopes for prior offline SEO or user-supplied Search Console evidence, SHA-256 content/evidence digests, stale source flag, immutable optimistic draft revision history, duplicate evidence checks, foreign-tenant denial and no claimed Google verification.
- `createDisabledSeoReportRepository`: all save/read/list/review/assign/publish operations fail closed.
- `db/drafts/0006_seo_reports_REVIEW_ONLY.sql`: future minimal SEO reports/revisions/reviews with RLS default deny and composite workspace FK integrity. **Draft only, never applied to Supabase staging**. Disposable PG DDL + FK negative probe **rolled back** after the tests.
- `tests/seo-report-draft.test.mjs`, `tests/postgres/seo-report-draft.pg.test.mjs` and documentation `docs/PHASE2-8-SECURITY-DESIGN.md` plus this handoff.
- No new AI/OAuth integration, no marketing statistics, no frontend redraw, no production deployment, no new PR/repo/project, no live role/password/Auth change or paid host.

### Current actual Supabase staging evidence
Project `dbppeymhsemvghbvuvof` remains `ACTIVE_HEALTHY`, PostgreSQL 17, five migrations, 7 RLS-private default-deny tables with 0 policies, 0 records, 0 Auth users/sessions. Both dedicated runtime and reader are NOLOGIN; three privileged postgres-owned functions are callable by reader. No genuine hosted restricted LOGIN, no two-user real sessions or HTTPS acceptance.

### Exact gating checklist and security design
See [Phase 2.8 independent identity assessment](PHASE2-8-SECURITY-DESIGN.md). A direct PostgreSQL `SET LOCAL request.jwt.claims` strategy would allow a compromised runtime to forge caller identity; **do not treat it as remediation**. Investigate Supabase's verified JWT/API -> RLS path with per-tenant permissions and revocation instead. No live policy or grant changes until approved.

### R1–R7
- **R1:** invites/role contracts disposable only; real provisioning BLOCKED.
- **R2:** role catalog/source preflight/disposable tests PASS; real restricted TLS LOGIN BLOCKED.
- **R3:** synthetic signed HTTP PASS; **independent actual Auth + two-user HTTPS BLOCKED**. Privileged actor binding remains HIGH/OPEN.
- **R4:** media and patient/privacy controls PARTIAL / hosted BLOCKED.
- **R5:** external publishing DEFERRED; disabled.
- **R6:** offline SEO report/review contracts ready; real persistence, agency writes and live approvals BLOCKED.
- **R7:** exact-head CI evidence recorded separately; staging host, mobile field/performance/restore/rollback acceptance BLOCKED.

**Owner actions:** approve an actual compatible cost-reviewed Node 22 HTTPS staging host and protected secret-entry service; explicitly authorize secure LOGIN/password activation and two synthetic Auth users, then independently verify a safe actor-binding design and execute the existing hosted acceptance runner.

**Next smallest milestone:** real authenticated actor-bound read-only staging gateway proof, followed by a permission-scoped transaction and report revision acceptance (not a premature live migration). No arbitrary completion percentage: shipping readiness is BLOCKED until independent tenant security passes.
