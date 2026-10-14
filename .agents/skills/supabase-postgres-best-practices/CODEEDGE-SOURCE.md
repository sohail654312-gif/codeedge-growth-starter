# Codeedge Growth Starter — official Supabase skill source

- Original repository: https://github.com/supabase/agent-skills
- Original folder: skills/supabase-postgres-best-practices/
- Exact pinned upstream Git SHA: c9be0e931b7930f7d02126d04774d904c381e7d7
- Original skill metadata version: 1.1.1
- License: MIT (retain LICENSE)
- Scope: project-local at .agents/skills/supabase-postgres-best-practices/
- Installation purpose: PostgreSQL grants, RLS, indexing, schema quality, queries and performance
- Imported all Markdown source files under the original skill directory from the pinned upstream tree, including changelog/reference assets.
- Codeedge alterations: added mandatory safety preface to SKILL.md; added explicit Codeedge warnings to generic SQL examples in the postgres security references; added CODEEDGE-SOURCE.md, LICENSE and agents/openai.yaml metadata.
- Installation is documentation-only. It does not install Supabase CLI, MCP, npm/pnpm tooling, database migrations, runtime packages, or client-facing features.
- Initial usage: explicitly invoke $supabase-postgres-best-practices in Codex on the Growth Starter development branch; maintain read-only mode until separately authorised.
- Upgrade policy: pinned SHAs only; review all upstream changes, references and licence before updating.
- Rollback: revert the skill-only commit. Do not reset or force-push active security remediation changes.
