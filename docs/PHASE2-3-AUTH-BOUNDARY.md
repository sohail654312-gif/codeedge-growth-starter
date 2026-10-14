# Phase 2.3 — Supabase Auth and live PostgreSQL session verification

**Status:** adapter implemented in existing draft PR #2; **not yet deployed or tested with real hosted user accounts**.

`backend/supabase-staging-identity.mjs` is a provider-specific adapter behind the existing `verifyAuthorization` contract. It requires the trusted HTTPS Supabase project origin, a **publishable** API key (never a service-role or database password), then validates the bearer token by requesting `GET /auth/v1/user` over HTTPS. It accepts only asymmetric ES256/RS256 signed access tokens with `kid`, trusted `iss`, `aud=authenticated`, `role=authenticated`, bounded expiration and `session_id`. It checks that the authentic `/user` response matches the token subject, confirmed email and UUID. Neither JWT workspace nor administrative claims affect authorization.

`db/migrations/0005_staging_auth_session_probe.sql` provides a narrow boolean-only, read-only `SECURITY DEFINER` lookup of `auth.sessions` + `auth.users`, with email confirmation, not-deleted, not-anonymous, not-banned and non-expired session constraints. EXECUTE is granted to `growth_starter_reader` only; it does NOT grant direct access to the underlying `auth` schema/tables. Its `p_user`/ `p_session`/ `p_email` values are supplied ONLY from the bearer token after provider-verification, never from the browser's JSON/params.

`backend/staging-supabase-gateway.mjs` assembles the existing restricted read-only SQL pool, the Supabase identity adapter and the current gateway. It refuses to start if database role capability checks fail, the Auth provider does not verify the token, or the session probe does not return `true`. Unexpected provider outages and DB failures fail closed. Existing RS256 standalone adapter remains intact.

**Limitations / real-world acceptance:**
1. Hosted Supabase Auth signing configuration must use ES256 or RS256; legacy HS256 is intentionally rejected (this is a separate adapter, not weakened RS256 verification).
2. Actual JWT lifetime must be at most one hour. Configure shorter lifetime for clinics if supported.
3. The app must use a real non-owner TLS-verifying runtime LOGIN with server-only credentials. Current `growth_starter_runtime` is `NOLOGIN`; no secret has been provisioned.
4. No real verified users/sessions, dedicated runtime host, TLS session audit or hosted HTTP access have been accepted yet.
5. This narrow definer function is **not** identity-bound at the SQL layer; a compromised gateway process could submit another actor's IDs. Strengthen that boundary in independent security review before production.
6. The patient-photo/media and agency write paths remain disabled. No actual patient data or real client emails during synthetic CI.
