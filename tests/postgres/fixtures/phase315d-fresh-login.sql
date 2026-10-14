-- Disposable PG17 fixture only. NO hosted migration.
-- Must be executed after phase315c-private-sessions.sql.
CREATE TABLE growth_starter_private.fresh_login_flows (
 state_hash text PRIMARY KEY CHECK(state_hash ~ '^[0-9a-f]{64}$'),
 binding_hash text NOT NULL CHECK(binding_hash ~ '^[0-9a-f]{64}$'),
 pkce_verifier text NOT NULL CHECK(pkce_verifier ~ '^[A-Za-z0-9_-]{43}$'),
 one_time_grant_id text NOT NULL UNIQUE CHECK(one_time_grant_id ~ '^[A-Za-z0-9_-]{43}$'),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz
);
REVOKE ALL ON growth_starter_private.fresh_login_flows FROM PUBLIC;
ALTER TABLE growth_starter_private.fresh_login_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter_private.fresh_login_flows FORCE ROW LEVEL SECURITY;
-- The CI administrator owns this table. A hosted private LOGIN and
-- per-client tenant RLS model are NOT validated by this fixture.
