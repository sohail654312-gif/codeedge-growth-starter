-- Source-only post-cutover assertion, run inside an operator-controlled
-- transaction after 0007 revocations and before COMMIT. No DDL or writes.
-- Raises P0001 if either legacy actor-ID routine is still callable by a
-- restricted role. Must never be mistaken for JWT/RLS acceptance.
DO $audit$
DECLARE actor_role text;
BEGIN
 FOREACH actor_role IN ARRAY ARRAY['growth_starter_reader','growth_starter_runtime'] LOOP
  IF has_function_privilege(actor_role,'growth_starter.staging_list_workspaces(text)','EXECUTE')
    OR has_function_privilege(actor_role,'growth_starter.staging_list_requests(text,text,integer)','EXECUTE') THEN
     RAISE EXCEPTION 'Legacy actor-reader privilege remains: %',actor_role;
  END IF;
  IF to_regprocedure('growth_starter.staging_session_active(text,text,text)') IS NOT NULL THEN
   IF has_function_privilege(actor_role,'growth_starter.staging_session_active(text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Legacy session-probe privilege remains: %',actor_role;
   END IF;
  END IF;
 END LOOP;
END $audit$;
