-- REVIEW ONLY. Never apply automatically to hosted Supabase.
-- Rehearsal baseline: 0001_growth_starter.sql on disposable PostgreSQL 17.
-- Existing rows must satisfy these invariants before cutover; no data repair here.
BEGIN;
ALTER TABLE growth_starter.workspaces ADD CONSTRAINT gs_workspace_owner_pair UNIQUE(id,owner_user_id);
ALTER TABLE growth_starter.memberships ADD CONSTRAINT gs_membership_owner_reference
  FOREIGN KEY(workspace_id,owner_user_id) REFERENCES growth_starter.workspaces(id,owner_user_id);
ALTER TABLE growth_starter.media ADD CONSTRAINT gs_media_exact_reference UNIQUE(workspace_id,id,storage_key);
ALTER TABLE growth_starter.media_delete_outbox ADD CONSTRAINT gs_outbox_exact_media_reference
  FOREIGN KEY(workspace_id,media_id,storage_key) REFERENCES growth_starter.media(workspace_id,id,storage_key);
ALTER TABLE growth_starter.work_requests
  ADD COLUMN notes text NOT NULL DEFAULT '' CHECK(length(notes)<=600),
  ADD COLUMN assigned_to text CHECK(assigned_to ~ '^[A-Za-z0-9_-]{8,128}$'),
  ADD COLUMN due_date text CHECK(due_date ~ '^\d{4}-\d{2}-\d{2}$'),
  ADD COLUMN created_by text CHECK(created_by ~ '^[A-Za-z0-9_-]{8,128}$');
CREATE TABLE growth_starter.business_profiles (
  workspace_id text PRIMARY KEY REFERENCES growth_starter.workspaces(id),
  fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='object' AND octet_length(fields::text)<=4096),
  version integer NOT NULL CHECK(version>=1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE growth_starter.request_notes (
  id bigserial PRIMARY KEY,
  workspace_id text NOT NULL,
  request_id text NOT NULL,
  actor_user_id text NOT NULL CHECK(actor_user_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  note text NOT NULL CHECK(length(note) BETWEEN 1 AND 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(workspace_id,request_id) REFERENCES growth_starter.work_requests(workspace_id,id)
);
CREATE TABLE growth_starter.operation_receipts (
  workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id),
  actor_user_id text NOT NULL CHECK(actor_user_id ~ '^[A-Za-z0-9_-]{8,128}$'),
  idempotency_key text NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9_-]{16,80}$'),
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL CHECK(octet_length(result::text)<=8192),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(workspace_id,actor_user_id,idempotency_key)
);
CREATE INDEX gs_requests_workspace_order ON growth_starter.work_requests(workspace_id,updated_at DESC,id DESC);
CREATE INDEX gs_requests_workspace_status ON growth_starter.work_requests(workspace_id,status,updated_at DESC,id DESC);
CREATE INDEX gs_requests_workspace_assignee ON growth_starter.work_requests(workspace_id,assigned_to,updated_at DESC,id DESC);
CREATE INDEX gs_notes_by_request ON growth_starter.request_notes(workspace_id,request_id,id DESC);
ALTER TABLE growth_starter.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.business_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.request_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.request_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.operation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.operation_receipts FORCE ROW LEVEL SECURITY;
-- No allow policies or browser/runtime grants. Source store must be rehearsed
-- with a disposable administrative test role; this is not production authority.
REVOKE ALL ON growth_starter.business_profiles,growth_starter.request_notes,growth_starter.operation_receipts FROM PUBLIC;
REVOKE ALL ON SEQUENCE growth_starter.request_notes_id_seq FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON growth_starter.business_profiles,growth_starter.request_notes,growth_starter.operation_receipts FROM %I',r);
      EXECUTE format('REVOKE ALL ON SEQUENCE growth_starter.request_notes_id_seq FROM %I',r);
    END IF;
  END LOOP;
END $$;
COMMIT;
