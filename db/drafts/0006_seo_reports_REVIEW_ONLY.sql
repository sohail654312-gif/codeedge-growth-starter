-- REVIEW DRAFT ONLY. NOT a migration. DO NOT APPLY to live Supabase or
-- production until independently accepted two-user hosted identity + actor
-- binding + transactional least-privilege approval.
-- If accepted later, reconcile with schema and run exclusively in disposable PG.
-- Minimum versioned report set; no duplicated operational CRM tables.
CREATE TABLE growth_starter.seo_reports (
 id uuid PRIMARY KEY,
 workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id) ON DELETE RESTRICT,
 business_ref text NOT NULL CHECK (business_ref ~ '^biz_[A-Za-z0-9_-]{8,128}$'),
 created_by_verified_subject text NOT NULL CHECK (length(created_by_verified_subject) BETWEEN 8 AND 128),
 created_at timestamptz NOT NULL DEFAULT now(),
 latest_revision integer NOT NULL DEFAULT 1 CHECK (latest_revision >= 1),
 state text NOT NULL DEFAULT 'needs_review' CHECK (state IN ('needs_review','superseded','archived')),
 source_class text NOT NULL CHECK (source_class IN ('offline_supplied_html_only','user_supplied_search_console_export_unverified')),
 retention_class text NOT NULL DEFAULT 'standard_review' CHECK (retention_class IN ('standard_review','legal_hold')),
 UNIQUE(id,workspace_id)
);
CREATE TABLE growth_starter.seo_report_revisions (
 report_id uuid NOT NULL,
 revision integer NOT NULL CHECK (revision >= 1),
 workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id) ON DELETE RESTRICT,
 report_type text NOT NULL,
 source_digest text NOT NULL CHECK (source_digest ~ '^[0-9a-f]{64}$'),
 report_digest text NOT NULL CHECK (report_digest ~ '^[0-9a-f]{64}$'),
 provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
 evidence jsonb NOT NULL,
 created_by_verified_subject text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(report_id,revision),
 FOREIGN KEY (report_id,workspace_id) REFERENCES growth_starter.seo_reports(id,workspace_id) ON DELETE RESTRICT
);
CREATE TABLE growth_starter.seo_review_events (
 id uuid PRIMARY KEY,
 report_id uuid NOT NULL,
 workspace_id text NOT NULL REFERENCES growth_starter.workspaces(id) ON DELETE RESTRICT,
 actor_verified_subject text NOT NULL,
 action text NOT NULL CHECK (action IN ('proposed','correction_requested','reviewed','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 FOREIGN KEY (report_id,workspace_id) REFERENCES growth_starter.seo_reports(id,workspace_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX seo_source_per_workspace_report ON growth_starter.seo_report_revisions(workspace_id,source_digest);
CREATE INDEX seo_reports_workspace_idx ON growth_starter.seo_reports(workspace_id,created_at DESC);
CREATE INDEX seo_review_workspace_idx ON growth_starter.seo_review_events(workspace_id,created_at DESC);
ALTER TABLE growth_starter.seo_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.seo_report_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_starter.seo_review_events ENABLE ROW LEVEL SECURITY;
-- Intentionally ZERO RLS policies and ZERO app/anon/authenticated grants.
REVOKE ALL ON growth_starter.seo_reports,growth_starter.seo_report_revisions,growth_starter.seo_review_events
  FROM PUBLIC,growth_starter_reader,growth_starter_runtime;
-- Inspect Supabase-specific anon/authenticated grants independently if approved.
-- No INSERT/UPDATE/DELETE endpoint, app function or SECURITY DEFINER grant.
