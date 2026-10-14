-- Disposable PostgreSQL 17 CI fixture, NOT a Supabase migration.
CREATE SCHEMA growth_starter_private;
REVOKE ALL ON SCHEMA growth_starter_private FROM PUBLIC;
CREATE TABLE growth_starter_private.codeedge_sessions(
 id uuid PRIMARY KEY,
 secret_sha256 text NOT NULL UNIQUE CHECK(secret_sha256 ~ '^[0-9a-f]{64}$'),
 user_id uuid NOT NULL,
 provider_session_id uuid NOT NULL,
 one_time_grant_id text NOT NULL UNIQUE
  CHECK(one_time_grant_id ~ '^[A-Za-z0-9_-]{24,96}$'),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON ALL TABLES IN SCHEMA growth_starter_private FROM PUBLIC;
ALTER TABLE growth_starter_private.codeedge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter_private.codeedge_sessions FORCE ROW LEVEL SECURITY;
-- No public, authenticated or browser policies/grants.
-- CI admin bypasses RLS; hosted restricted-principal test remains necessary.
