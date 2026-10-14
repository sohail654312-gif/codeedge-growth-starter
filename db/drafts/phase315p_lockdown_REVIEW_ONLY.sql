-- REVIEW_ONLY. Recovery closes admission AND already pooled operations.
-- Retains records, receipt/audit history and legacy deny-all cutover grants.
BEGIN;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA growth_starter_private FROM gs315p_writer;
REVOKE USAGE ON SCHEMA growth_starter_private FROM gs315p_writer;
ALTER ROLE gs315p_writer NOLOGIN;
-- Also execute the separately reviewed Phase M lockdown to close issuer/read
-- paths, close private ingress, stop workers and retire affected secrets.
COMMIT;
