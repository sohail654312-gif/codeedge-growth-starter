import { createServer } from 'node:http';
import { DomainError } from './core.mjs';

function reply(res, status, value, origin = null) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'",
    ...(origin ? {'access-control-allow-origin': origin, 'vary': 'origin'} : {}),
  });
  res.end(JSON.stringify(value));
}

/**
 * Separate provider-neutral, READ ONLY staging gateway.
 * The supplied pool must use a restricted non-owner DB login granted ONLY
 * growth_starter_reader; a superuser/table-owner connection is unsafe.
 * The supplied verifier must verify signatures, email and fresh revocation.
 */
export function createStagingGateway({ pool, identityVerifier, allowedOrigin = null }) {
  if (!pool || typeof pool.query !== 'function' ||
      !identityVerifier || typeof identityVerifier.verifyAuthorization !== 'function' ||
      (allowedOrigin !== null && (typeof allowedOrigin !== 'string' ||
        !allowedOrigin.startsWith('https://')))) {
    throw new DomainError('Safe staging gateway dependencies unavailable.', 503);
  }
  const handler = async (req, res) => {
    const origin = req.headers.origin;
    const corsOrigin = origin && origin === allowedOrigin ? allowedOrigin : null;
    try {
      if (origin && !corsOrigin) return reply(res, 403, { error: 'Origin denied.' });
      const uri = new URL(req.url || '/', 'http://gateway.invalid');
      // Browser requests with Authorization are preflighted cross-origin.
      // A preflight grants only the specified GET + Authorization combination;
      // it never authenticates the user or runs a database query.
      if (req.method === 'OPTIONS') {
        if (!corsOrigin) return reply(res, 403, { error: 'Origin required.' });
        if (!['/v1/workspaces', '/v1/requests'].includes(uri.pathname))
          return reply(res, 404, { error: 'Not found.' }, corsOrigin);
        if (req.headers['access-control-request-method'] !== 'GET')
          return reply(res, 405, { error: 'Only GET permitted.' }, corsOrigin);
        const requested = (req.headers['access-control-request-headers'] || '')
          .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
        if (requested.length !== 1 || requested[0] !== 'authorization')
          return reply(res, 403, { error: 'Header denied.' }, corsOrigin);
        res.writeHead(204, {
          'access-control-allow-origin': corsOrigin,
          'access-control-allow-methods': 'GET',
          'access-control-allow-headers': 'Authorization',
          'access-control-max-age': '300',
          'vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        return res.end();
      }
      if (req.method !== 'GET') return reply(res, 405, { error: 'Read-only staging API.' }, corsOrigin);
      if (uri.pathname === '/healthz') return reply(res, 200, { status: 'ok', mode: 'staging-read-only' }, corsOrigin);
      if (!['/v1/workspaces', '/v1/requests'].includes(uri.pathname))
        return reply(res, 404, { error: 'Not found.' }, corsOrigin);
      const actor = await identityVerifier.verifyAuthorization(req.headers.authorization);
      const memberships = (await pool.query(
        'SELECT workspace_id, role FROM growth_starter.staging_list_workspaces($1)',
        [actor.userId]
      )).rows;
      if (uri.pathname === '/v1/workspaces') {
        return reply(res, 200, { workspaces: memberships.slice(0, 25) }, corsOrigin);
      }
      const workspaceId = uri.searchParams.get('workspaceId');
      if (!workspaceId || !/^ws_[A-Za-z0-9_-]{8,128}$/.test(workspaceId))
        return reply(res, 400, { error: 'Invalid workspace.' }, corsOrigin);
      if (!memberships.some(m => m.workspace_id === workspaceId))
        return reply(res, 403, { error: 'Workspace access denied.' }, corsOrigin);
      const size = uri.searchParams.get('limit');
      if (size !== null && !/^(?:[1-9]|[1-4][0-9]|50)$/.test(size))
        return reply(res, 400, { error: 'Invalid page size.' }, corsOrigin);
      const items = (await pool.query(
        'SELECT id, workspace_id, title, kind, status, version, updated_at FROM growth_starter.staging_list_requests($1,$2,$3)',
        [actor.userId, workspaceId, size === null ? 20 : Number(size)]
      )).rows;
      return reply(res, 200, { workspaceId, items }, corsOrigin);
    } catch (caught) {
      if (caught instanceof DomainError)
        return reply(res, caught.status, { error: caught.message }, corsOrigin);
      // No SQL, token, email, stack trace or DB server details exposed.
      return reply(res, 503, { error: 'Staging gateway unavailable.' }, corsOrigin);
    }
  };
  return Object.freeze({handler, createServer: () => createServer(handler)});
}
