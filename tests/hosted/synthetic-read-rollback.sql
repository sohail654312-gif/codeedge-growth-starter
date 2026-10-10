-- Growth Starter hosted Supabase: reversible synthetic read-boundary inspection.
-- Run ONLY on isolated staging project dbppeymhsemvghbvuvof as privileged
-- administrator, and NEVER as a substitute for verified two-user HTTP tests.
-- Must end in ROLLBACK; no patient/client data is used.
BEGIN;
INSERT INTO growth_starter.workspaces(id,owner_user_id)
VALUES
 ('ws_qa_synthetic_alpha_001','qa_synthetic_alpha_001'),
 ('ws_qa_synthetic_beta_002','qa_synthetic_beta_002');
INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind)
VALUES
 ('ws_qa_synthetic_alpha_001','qaAlphaRequest01','Synthetic workspace A','Website update'),
 ('ws_qa_synthetic_beta_002','qaBetaRequest01','Synthetic workspace B','Local SEO');
DO $check$
DECLARE
 a_ws int;
 b_ws int;
 ab_ws int;
 a_own int;
 b_own int;
 ab_cross int;
 ba_cross int;
 unknown_count int;
BEGIN
 SELECT count(*) INTO a_ws FROM growth_starter.staging_list_workspaces('qa_synthetic_alpha_001');
 SELECT count(*) INTO b_ws FROM growth_starter.staging_list_workspaces('qa_synthetic_beta_002');
 SELECT count(*) INTO ab_ws FROM growth_starter.staging_list_workspaces('qa_synthetic_unknown_003');
 SELECT count(*) INTO a_own FROM growth_starter.staging_list_requests(
  'qa_synthetic_alpha_001','ws_qa_synthetic_alpha_001',20);
 SELECT count(*) INTO b_own FROM growth_starter.staging_list_requests(
  'qa_synthetic_beta_002','ws_qa_synthetic_beta_002',20);
 SELECT count(*) INTO ab_cross FROM growth_starter.staging_list_requests(
  'qa_synthetic_alpha_001','ws_qa_synthetic_beta_002',20);
 SELECT count(*) INTO ba_cross FROM growth_starter.staging_list_requests(
  'qa_synthetic_beta_002','ws_qa_synthetic_alpha_001',20);
 SELECT count(*) INTO unknown_count FROM growth_starter.staging_list_requests(
  'qa_synthetic_unknown_003','ws_qa_synthetic_alpha_001',20);
 IF (a_ws,b_ws,ab_ws,a_own,b_own,ab_cross,ba_cross,unknown_count)
   IS DISTINCT FROM (1,1,0,1,1,0,0,0) THEN
  RAISE EXCEPTION 'Hosted synthetic read isolation assertions failed';
 END IF;
END $check$;
ROLLBACK;
