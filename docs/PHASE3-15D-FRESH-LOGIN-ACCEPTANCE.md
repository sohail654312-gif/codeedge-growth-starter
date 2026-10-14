# Phase 3.15D — Fresh provider-login bridge, test-only security acceptance

## Delivered (synthetic / disposable only)
- Added a **server-held PKCE S256** flow with cryptographic state, random browser binding, private one-use login flow record, 5-minute expiry and SHA-256 stored state/binding digests.
- The flow consumes matching state AND browser binding atomically before network/provider exchange. On invalid code/provider timeout the original authorization flow cannot be replayed.
- Exchange interface takes the auth code and server-held PKCE verifier. An independent \`verifyUser\` interface must verify the **exact returned bearer** with the provider. Locally its behavior is a synthetic mock; nothing is networked.
- Verify JWT claims only after provider verification, including issuer, audience, user ID, unique Supabase session ID, token age and expiration. Require verified non-anonymous non-banned user.
- Bridge mints a one-time in-process proof consumed by the existing Codeedge session service; Codeedge issues only its opaque session, never the Supabase access/refresh token. It cannot use a still-valid old bearer for a fresh Codeedge login.
- Integrated disposable PG17 tests for forged binding/state, stale code/JWT, replay, cross-client reads, logout revocation, and mismatched user.

## Security boundaries still blocking hosted activation
1. **No real provider exchange.** The two injected interfaces have mock implementations in CI only; the hosted constructor unconditionally throws. Production requires a pinned, audited version of the Supabase server-side PKCE SDK (or vetted protocol flow). Verify correct SSR PKCE storage/redirect behavior and exchange code single-use semantics.
2. **No web cookie or callback handler.** Only a reviewed HTTPS server may place the binding and Codeedge session into \`Secure; HttpOnly; SameSite\` cookies with \`Path\`, exact Origin restrictions and CSRF protection. Do not send the binding in a query string, expose it to JS, or return provider tokens to browsers.
3. **No hosted DB migration/roles.** The disposable CI admin owns the fixture and bypasses RLS. A restricted per-tenant database principal, exact RLS policy verification and direct REST bypass denial must be independently demonstrated. Existing Growth Starter staging \`NOLOGIN\` checker and legacy function paths are unchanged.
4. **No provider-wide revocation contract.** Immediate Codeedge logout/revocation is proved in CI; an independent Supabase logout, global admin session revocation or password reset does not automatically revoke Codeedge's separate session. Owner security-contract decision and/or separately verified synchronization are mandatory.
5. **No patient/real-customer data.** Use fictional accounts A/B/C only after specific approval for actual hosted credentials and deployment. Maintain draft PR #2 and no paid infrastructure.

## Next mandatory security test
- Build a production-shaped HTTPS callback with cookie/CSRF checks as **source-only** and prove server credential isolation.
- Independently verify Supabase Data API effective exposed schemas from the Dashboard and perform direct REST denied-access probes with fictional users.
- Model a genuinely least-privileged DB principal that has no shared cross-tenant direct SELECT, cannot \`SET ROLE\`, cannot alter tenant identity and has no old SECURITY DEFINER actor-parameterized path.
- Obtain supported provider integration and explicit hosted staging cutover approval before any live mutation.

## Sources
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession
- https://supabase.com/docs/guides/auth/server-side/advanced-guide

## Scope
No Supabase migration, Auth object changes, customer sessions, secrets, production deployment, merge, or additional spending. Codeedge Growth Starter repository only.
