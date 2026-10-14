-- PHASE 3.15J — Read-only assertion block after proposed cutover.
-- Execute within the operator's uncommitted staging cutover transaction.
-- This is NOT evidence of the separately configured Data API exposure.
DO $phase315j$
DECLARE name text;
BEGIN
 IF has_schema_privilege('authenticated','growth_starter','USAGE') THEN
  RAISE EXCEPTION 'direct authenticated schema access remains';
 END IF;
 IF has_column_privilege('authenticated','growth_starter.workspaces','id','SELECT')
  OR has_column_privilege('authenticated','growth_starter.memberships','user_id','SELECT')
  OR has_column_privilege('authenticated','growth_starter.work_requests','title','SELECT')
 THEN RAISE EXCEPTION 'direct authenticated column access remains'; END IF;
 IF pg_has_role('growth_starter_runtime','growth_starter_reader','SET') THEN
  RAISE EXCEPTION 'legacy reader SET ROLE edge remains';
 END IF;
 FOREACH name IN ARRAY ARRAY['growth_starter_reader','growth_starter_runtime',
  'anon','authenticated','service_role'] LOOP
  IF has_function_privilege(name,
    'growth_starter.staging_list_workspaces(text)','EXECUTE') OR
   has_function_privilege(name,
    'growth_starter.staging_list_requests(text,text,integer)','EXECUTE') OR
   has_function_privilege(name,
    'growth_starter.staging_session_active(text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'legacy function still executable by %',name; END IF;
 END LOOP;
END $phase315j$;
