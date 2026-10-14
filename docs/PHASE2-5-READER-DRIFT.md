# Phase 2.5 — restricted reader privilege drift acceptance

The standalone gateway previously checked whether the **network login** was non-superuser, non-owner and lacked base-table permissions. Because the network LOGIN can `SET LOCAL ROLE growth_starter_reader`, an operator could later accidentally grant `growth_starter_reader` direct table privileges or additional routines while the old gateway would still pass startup.

This increment checks both roles:
- The real LOGIN must retain its existing restrictive flags, zero direct base-table grants and only SET membership.
- The `growth_starter_reader` group must stay NOLOGIN, non-superuser, NOBYPASSRLS, NOINHERIT, cannot CREATE in the `growth_starter` schema, and may not SELECT/INSERT/UPDATE/DELETE protected base relations.
- Only three exact allowlisted `growth_starter` function signatures may have EXECUTE privileges: `staging_list_workspaces(text)`, `staging_list_requests(text,text,integer)`, `staging_session_active(text,text,text)`. A newly introduced routine granted through PUBLIC is also detected.
- If either group or LOGIN has excessive privileges, **startup fails closed before creating any HTTP listener**.
- Disposable PostgreSQL tests deliberately GRANT table SELECT and extra function EXECUTE to the reader, assert that startup fails, REVOKE them, and confirm recovery. **No drift grants were made in the hosted Supabase project**.

This does not cryptographically bind function actor parameters to hosted Auth sessions. The privileged `SECURITY DEFINER` identity-substitution risk stays OPEN/HIGH. Hosted restricted LOGIN, trust configuration and real two-user HTTPS acceptance remain BLOCKED.
