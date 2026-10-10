-- Phase 2.3: auth.sessions live-revocation probe, read-only.
-- This function is intentionally callable ONLY by the isolated reader role.
-- All three parameters must come from the trusted gateway after Supabase
-- Auth's /auth/v1/user verifies the EXACT bearer token online.
BEGIN;
CREATE OR REPLACE FUNCTION growth_starter.staging_session_active(
  p_user text, p_session text, p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, auth, growth_starter
AS $function$
 SELECT EXISTS (
  SELECT 1
  FROM auth.sessions s
  INNER JOIN auth.users u ON u.id=s.user_id
  WHERE p_user ~* '^[0-9a-f-]{36}$'
    AND p_session ~* '^[0-9a-f-]{36}$'
    AND s.user_id::text=p_user
    AND s.id::text=p_session
    AND u.email IS NOT NULL
    AND lower(u.email)=lower(p_email)
    AND u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL
    AND coalesce(u.is_anonymous,false)=false
    AND (u.banned_until IS NULL OR u.banned_until<=now())
    AND (s.not_after IS NULL OR s.not_after>now())
 )
$function$;
REVOKE ALL ON FUNCTION growth_starter.staging_session_active(text,text,text) FROM PUBLIC;
-- All non-reader roles inherit no EXECUTE from PUBLIC. Supabase role names
-- may be absent in disposable PostgreSQL CI; do not depend on their creation.
GRANT EXECUTE ON FUNCTION growth_starter.staging_session_active(text,text,text)
  TO growth_starter_reader;
COMMIT;
