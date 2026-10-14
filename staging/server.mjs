/**
 * PHASE 3.3B — LEGACY DIRECT-POSTGRES GATEWAY ENTRYPOINT SEALED.
 *
 * The old actor-ID SECURITY DEFINER reader is vulnerable to substitution
 * by a compromised direct PostgreSQL gateway. This Node entrypoint is now
 * intentionally non-runnable. It must NOT accept synthetic or real clients.
 *
 * The existing AppDeploy demonstration is a separate application and is
 * unaffected. Source-only replacements live in backend/authenticated-read-
 * gateway.mjs; that gateway has NO hosted entrypoint or authorization for
 * production activation. See docs/PHASE3-2-CUTOVER-RUNBOOK.md.
 *
 * Do not re-enable this file as a shortcut for hosted acceptance.
 */
process.stderr.write('Legacy Growth Starter direct-PostgreSQL gateway disabled pending independent security cutover.\n');
process.exitCode=1;
