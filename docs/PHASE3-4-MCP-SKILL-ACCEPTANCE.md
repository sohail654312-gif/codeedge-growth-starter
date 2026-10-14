# CODEEDGE GROWTH STARTER — PHASE 3.4 MCP / SKILL ACCEPTANCE

**Mode:** Manual, controlled, single writer. Repository `sohail654312-gif/codeedge-growth-starter`, branch `engineering/phase2-core-security`, existing draft PR #2. **Audit source SHA:** `40889ca245dc103ac09df983e67975ae49faa6b6`. Read this alongside current HEAD and exact-HEAD CI; this document cannot predict the SHA or CI status of the commit containing itself.

## 1. Verified baseline

- Three project-local skills exist: `$supabase` (0.1.2), `$supabase-postgres-best-practices` (1.1.1), `$ai-seo` (2.7.6). Each has an MIT licence, pinned source notice, Codeedge safeguards, and `agents/openai.yaml` requiring explicit invocation.
- Official Supabase skills are pinned to `c9be0e931b7930f7d02126d04774d904c381e7d7`; Corey Haines AI SEO is pinned to `1efedbc5148b54b2f0f6c6c9fe0be62e151c7fff`.
- The three skills were **read manually**; no hosted/CLI Codex skill execution session was available. Presence and native invocation are different statuses.
- Pre-change exact-SHA CI: core safety run 38043571952 PASS; disposable PostgreSQL run 38043571893 PASS; offline SEO/UI 38043571860 PASS; supply-chain 38043571922 PASS. The current SHA must be rechecked after this commit.
- Reviewed `docs/SECURITY.md`, `docs/INDEPENDENT-REVIEW.md`, `docs/PHASE3-3E-HANDOFF.md`, authenticated gateway and RLS SQL drafts, premium content and SEO tests.
- Live isolated staging **read-only** query on 2026-10-10: 0 Auth users, 0 Auth sessions, 7 RLS-enabled tables, 3 read policies, session checker `auth` schema USAGE **false**, all three old `SECURITY DEFINER` functions executable by `growth_starter_reader`, and `growth_starter_runtime` may `SET ROLE growth_starter_reader`. No hosted changes were made.

## 2. Security review — evidence and safe corrections

| Severity / state | Evidence | Safe correction; separately approved implementation required |
|---|---|---|
| CRITICAL / BLOCKED | `backend/pg-session-authority.mjs` expects a working role with minimal `auth.sessions`/`auth.users` reads. `db/drafts/0010_session_checker_minimal_auth_columns_REVIEW_ONLY.sql` created a NOLOGIN role; hosted `auth` USAGE is false. | Select a Supabase-supported server-trusted session introspection design; no broad `auth` grants, caller-supplied actor IDs, or unreviewed privileged function. Test actual current/logout sessions. |
| HIGH / FAIL | `db/drafts/0007_disable_legacy_actor_definers_REVIEW_ONLY.sql` not applied; live role can EXECUTE `staging_list_workspaces`, `staging_list_requests`, `staging_session_active`. | Keep old gateway sealed; revoke rights only after accepted replacement using controlled transaction and `0009` assertions; prove direct restricted-role denial. |
| HIGH / design blocker | `backend/postgrest-read-boundary.mjs` uses original bearer and pre-read session gate, but direct exposed `growth_starter` Data API calls would not traverse this Node gateway. `db/drafts/0008_authenticated_read_rls_REVIEW_ONLY.sql` currently has membership-only SELECT policies, no server-current-session predicate. | Do **not** expose base schema directly. Decide between private gateway-only data path and independently enforced database session gate/restricted API surface. Test stolen signed-out unexpired JWT against every exposure path. No claim of live exploit: schema exposure not accepted. |
| HIGH / prevention gap | `backend/pg-session-authority.mjs` preflight checks counts/names of three RLS policies, not exact expressions; checks two old actor functions, not `staging_session_active`. | Strengthen source-only privilege catalog assertions, 3-definer checks, and policy semantic or hash drift checks. Verify fail-closed tampering tests in disposable PostgreSQL. |
| MEDIUM / role graph | Live `growth_starter_runtime` has `SET` option on `growth_starter_reader` despite NOINHERIT; both NOLOGIN. | Prove `pg_has_role(...,'SET')` false after approved cutover; do not confuse NOINHERIT with inability to SET ROLE. |
| BLOCKED / hosted acceptance | No managed Auth users/sessions and no approved HTTPS trusted-session host; mock/disposable tests do not verify provider-issued JWT or cross-tenant access. | Provider-created fictional users A/B/member C, separate signed sessions, revoked/expired, opposite-tenant, direct API, denial-on-provider-outage, ingress/TLS and redacted evidence; independent reviewer sign-off. |

Live Supabase security advisor had four expected `rls_enabled_no_policy` informational notices on intentionally deny-all media/audit/invitation/outbox tables. Do not add unsafe read policies merely to clear these. Two unused-index warnings in empty staging do not justify index deletion.

**Suggested tests (not run against hosted):** disposable `tests/postgres/actor-cutover.pg.test.mjs`, `authenticated-read-rls.pg.test.mjs`, `authenticated-role-matrix.pg.test.mjs`, and `session-checker-privileges.pg.test.mjs`; add explicit policy-drift, third legacy function, role-switch and bypass prevention cases in a future authorised security block.

## 3. SEO/AEO/GEO intelligence review (fictional data only)

- `backend/seo-growth.mjs` audits bounded **supplied HTML**, service+location keyword hypotheses, FAQ/answer drafts, robots/sitemap *supplied text*; it does not crawl, prove Google rankings, or publish.
- `backend/seo-search-data.mjs` validates user-supplied Search Console CSV/JSON with property, workspace, date and dimensional constraints; evidence remains **unverified user import**, not connected GSC or search-volume proof.
- `backend/seo-provider-adapters.mjs` defines disabled or synthetic, provider-neutral read adapters; no live Google OAuth or GBP automation.
- `backend/premium-content-intelligence.mjs` produces reviewable SEO, GEO, AEO, social and clinic suggestions; tests explicitly require no invented citations, medical outcomes, clinician credentials or engagement numbers.
- `tests/seo-growth.test.mjs`, `tests/seo-search-data.test.mjs` and `tests/premium-content-intelligence.test.mjs` cover fictional Manchester plumbing and Peshawar clinic scenarios.
- Skill-assisted refinement: improve citeability with genuine concise answers, original service evidence, verifiable author/clinician identity, visible FAQs where appropriate, source-aware GEO claims and clinician approval for treatment copy. **Do not** promise Google AI citation or claim special AI files/FAQ schema are prerequisites or guarantee rich results.

## 4. Fixed six-task benchmark — manual matched desk evaluation

**Protocol:** A baseline repository-only pass and a skill-reference-assisted review of the same six source/fixture tasks. Scoring is **1** if a key risk/control is identified with a safe proposed response, else **0**. This is a transparent, non-blinded **analyst review**, **not** two independent model runs or a native Codex invocation. Human evaluator bias and prior context limit inference. Unsupported claims were rejected, not awarded points.

| # | Fixture/task and expected control | Baseline | Skill assisted | Additional instruction-specific insight |
|---|---|---:|---:|---|
| 1 | Missing trusted session authority: deny even if bearer syntax looks valid | 1 | 1 | Distinguish signed JWT validation from live session-state attestation; no client GUC identity |
| 2 | RLS workspace claim/tenant mistake: reject user-derived actor/role and cross-tenant visibility | 1 | 1 | Check direct Data API exposure and restrictive session policies in addition to member policy |
| 3 | Privileged `SECURITY DEFINER` actor-ID functions: fail and plan controlled removal | 1 | 1 | Include third session function and role-switch `SET` path |
| 4 | SQL limited SELECT columns: check no writes, hidden columns and exposed schema | 1 | 1 | Differentiate column privileges, table privileges, schema USAGE and Data API exposure |
| 5 | Fictional Peshawar skin clinic SEO: local services and verifiable answers, no made-up metrics | 1 | 1 | Citeability, visible FAQs and original clinician credentials require evidence and approval |
| 6 | Unsupported "guaranteed permanent laser results" claim: reject and require clinical sign-off | 1 | 1 | No unsupported health claim, review, patient outcome or guarantee |
| **Total** | **Six risk/control detections** | **6/6** | **6/6** | **No incremental detection on this small test; more detailed review notes in 3/6 cases** |

**Missed expected risk/control categories:** 0/6 in either analyst pass. **Unsupported recommendations adopted:** 0/6; suggested privileged-helper options are conditional and require independent security review. **Measured latency:** UNAVAILABLE (no independently timed model executions). **Token usage:** UNAVAILABLE (no model token telemetry). **Native Codex skill-invocation success:** UNAVAILABLE. Consequently no measured speed, accuracy, or token advantage can be claimed for this sample.

References read: installed `supabase/SKILL.md`; `supabase-postgres-best-practices/SKILL.md`, `references/security-rls-basics.md`, `references/security-privileges.md`, `references/security-rls-performance.md`; `ai-seo/SKILL.md` and `references/content-types.md`, `references/content-patterns.md`. Supplement with current official Supabase Auth Sessions / Data API guides before implementation.

## 5. Skill Retrieval MCP compatibility decision — DEFER

Reviewed `JayCheng113/skill-retrieval-mcp` at SHA `7d034a2af4ac26ff7a69522ee4a3e22b865d586e`: Python >=3.10, MCP >=2, Pydantic >=2.11, faiss-cpu >=1.8, NumPy >=1.26, Click >=8, PyYAML, tqdm; optional `sentence-transformers` (local semantic embeddings) and `huggingface-hub` (curated corpus/index download); local SQLite FTS5 + FAISS files. `search_skills`, `keyword_search`, `get_skill`, `list_categories` are implemented; importer `skill-mcp import --source directory --path <absolute-path-to-project/.agents/skills>` scans SKILL.md recursively.

**Important verified limitation:** `src/skill_mcp/importers/directory.py` persists frontmatter and SKILL.md body, not sibling Markdown reference files. `get_skill` returns that stored body, not `references/*.md` or Codeedge `CODEEDGE-SOURCE.md`/`LICENSE`; therefore provenance/safeguards and references must still be accessed from the original approved project files. No built-in project allowlist enforcement was demonstrated: would require external trust policy and pre-index filtering.

**Codex:** README documents Codex **CLI** registration under `~/.codex/config.toml`; absolute executable path plus `--data-dir /absolute/path serve` are required. Hosted Codex ability to launch this particular local Python server is **UNVERIFIED**; do not assert parity. `init` can modify global agent settings; not run. Model starts are nontrivial on 4 GB RAM; no actual footprint benchmark performed. The README's 374-skill corpus and millisecond retrieval claims are upstream measurements, not independently reproduced here. Native three project skills have fewer packages, no model corpus, no Docker, lower exposure risk; the six-task bench shows no issue-detection benefit from extra retrieval.

**Verdict: DEFER.** Revisit only if approved skill count/selection tasks grow materially, with allowlisted corpus, dependency hash review, reference-file retrieval plan and actual resource and native/hosted compatibility measurements. No MCP install, corpus download or user/global Codex settings change.

## 6. Acceptance harness and operations

`tests/skill-acceptance.test.mjs` uses Node's built-in test/assert/fs only. It checks exactly the three required skill identifiers, valid frontmatter, unique names, pinned versions and original SHA provenance, MIT notices, explicit-only activation flags, present referenced Markdown, required RLS and privileged-function warnings, with negative regression cases for missing refs, duplicate IDs, altered pinned source, missing safety preface and implicit activation. No network, credentials, dependencies, schema or runtime changes. Existing core safety workflow already calls `node --test tests/*.test.mjs`, so the harness is included automatically.

Suggested independent execution:
```sh
node --test tests/skill-acceptance.test.mjs
node --test tests/*.test.mjs
# Disposable PostgreSQL tests require the existing ephemeral CI service; do NOT target hosted DB.
```

**Rollback:** revert only the Phase 3.4 test/documentation commit using the existing branch in a reviewed follow-up commit. No force push, migrations, secrets, runtime changes, PR merge, new GitHub workflow, paid services or automation.

**Gate:** Acceptance harness outcome must be confirmed by exact-HEAD GitHub Actions; historical 4/4 CI is not a substitute. Independent security acceptance, hosted A/B/C signed JWT checks, active session verification, legacy-function privilege retirement and pilot readiness remain BLOCKED/OPEN.

## 7. Controlled next block

A separate, explicitly authorised security remediation should first decide the API exposure model and provider-supported session introspection, then implement *only* source-level fail-closed catalog regression tests and an independently reviewed migration design. Do not enable direct Data API access, checkout privileges, privileged session helper, or legacy rights changes until real synthetic hosted approval evidence exists.
