-- Growth Starter Phase 2.1: disposable PostgreSQL schema (NOT applied to live Supabase).
-- Requires PostgreSQL 15+. No external extensions or public grants.
BEGIN;
CREATE SCHEMA IF NOT EXISTS growth_starter;
CREATE TABLE IF NOT EXISTS growth_starter.workspaces (
  id text PRIMARY KEY CHECK (id ~ '^ws_[A-Za-z0-9_-]{8,128}$'),
  owner_user_id text NOT NULL CHECK (owner_user_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_workspace_id CHECK (id = 'ws_' || owner_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS gs_owner_workspace_unique ON growth_starter.workspaces(owner_user_id);
CREATE TABLE IF NOT EXISTS growth_starter.memberships (
  workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id),
  user_id text NOT NULL CHECK (user_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  owner_user_id text NOT NULL,
  role text NOT NULL CHECK(role IN ('agency_admin','staff','client')),
  state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
  created_by text NOT NULL,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,user_id),
  CONSTRAINT distinct_owner_member CHECK (user_id <> owner_user_id)
);
CREATE INDEX IF NOT EXISTS gs_user_memberships ON growth_starter.memberships(user_id,state);
CREATE TABLE IF NOT EXISTS growth_starter.invitations (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id),
  email text NOT NULL CHECK (email=lower(email) AND length(email)<=254),
  role text NOT NULL CHECK (role IN ('agency_admin','staff','client')),
  secret_digest text NOT NULL CHECK (secret_digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','consumed','revoked')),
  created_by text NOT NULL,
  accepted_by text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gs_pending_invites ON growth_starter.invitations(workspace_id,state,expires_at);
CREATE TABLE IF NOT EXISTS growth_starter.work_requests (
  workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id),
  id text NOT NULL CHECK (id ~ '^[A-Za-z0-9_-]{1,128}$'),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
  kind text NOT NULL CHECK(kind IN ('Website update','Social content','Local SEO','Other')),
  status text NOT NULL DEFAULT 'Requested' CHECK(status IN ('Requested','In progress','Awaiting approval','Approved','Changes requested','Completed')),
  version integer NOT NULL DEFAULT 0 CHECK(version>=0),
  reviewed_by text,
  decided_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS growth_starter.media (
  workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id),
  id text NOT NULL CHECK (id ~ '^[A-Za-z0-9_-]{1,128}$'),
  storage_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
  declared_rights boolean NOT NULL DEFAULT false,
  consent_state text NOT NULL DEFAULT 'pending' CHECK(consent_state IN ('pending','approved','rejected','withdrawn')),
  scan_state text NOT NULL DEFAULT 'pending' CHECK(scan_state IN ('pending','clean','unsafe')),
  lifecycle text NOT NULL DEFAULT 'stored' CHECK(lifecycle IN ('stored','delete_pending','deleted')),
  size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 3145728),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,id),
  CONSTRAINT ws_storage_key CHECK(storage_key LIKE ('growth-starter/' || workspace_id || '/%'))
);
CREATE TABLE IF NOT EXISTS growth_starter.media_delete_outbox (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL,
  media_id text NOT NULL,
  storage_key text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','done')),
  attempts integer NOT NULL DEFAULT 0,
  queued_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(workspace_id,media_id),
  FOREIGN KEY(workspace_id,media_id) REFERENCES growth_starter.media(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS growth_starter.audit_events (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id),
  actor_user_id text NOT NULL,
  action text NOT NULL,
  target text NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gs_audit_by_workspace ON growth_starter.audit_events(workspace_id,id);
-- This schema intentionally has no authenticated/public REST grants.
REVOKE ALL ON SCHEMA growth_starter FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA growth_starter FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA growth_starter FROM PUBLIC;
COMMIT;
