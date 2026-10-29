-- PHASE 3.15S: REVIEW ONLY; never execute against hosted Supabase without separately authorized cutover.
-- Official supported Auth-permission workaround:
-- https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema
-- This is ONLY a narrow data primitive; NOT an original-bearer verifier, complete policy authority,
-- login facility, or permission to activate the Codeedge private runtime.
BEGIN;
DO $preflight$
BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.sessions') IS NULL OR to_regclass('auth.users') IS NULL
 OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='growth_starter_session_checker')
 OR to_regnamespace('growth_starter_auth_bridge') IS NOT NULL
 THEN RAISE EXCEPTION 'Phase 3.15S baseline denied'; END IF;
END $preflight$;
CREATE SCHEMA growth_starter_auth_bridge;
REVOKE ALL ON SCHEMA growth_starter_auth_bridge FROM PUBLIC;
CREATE FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(p_user uuid,p_session uuid)
 RETURNS TABLE(pair_exists boolean,banned boolean,deleted boolean,session_not_after timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
 -- A session row without its matching user is not an authenticated pair.
 SELECT (s.id IS NOT NULL AND u.id IS NOT NULL),
        (u.banned_until IS NOT NULL AND u.banned_until > CURRENT_TIMESTAMP),
        u.deleted_at IS NOT NULL,
        CASE WHEN u.id IS NOT NULL THEN s.not_after ELSE NULL END
 FROM (SELECT 1) AS singleton
 LEFT JOIN auth.sessions s ON s.id=p_session AND s.user_id=p_user
 LEFT JOIN auth.users u ON u.id=s.user_id
$function$;
REVOKE ALL ON FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA growth_starter_auth_bridge TO growth_starter_session_checker;
GRANT EXECUTE ON FUNCTION growth_starter_auth_bridge.exact_pair_snapshot(uuid,uuid) TO growth_starter_session_checker;
COMMIT;
