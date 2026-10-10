import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { DomainError } from './core.mjs';

function fail(message = 'Invalid or expired identity token.', status = 401) {
  throw new DomainError(message, status);
}

function decodePart(raw) {
  if (typeof raw !== 'string' || raw.length < 2 || raw.length > 9000 ||
      !/^[A-Za-z0-9_-]+$/.test(raw)) fail();
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail();
    return parsed;
  } catch {
    fail();
  }
}

/**
 * Separate staging auth boundary. Key material must originate from trusted,
 * server-only IdP configuration, never from JWT header URLs/embedded JWKs.
 * checkSession must query a trusted revocation/session registry on EVERY call.
 */
export function createStagingIdentityVerifier({
  issuer, audience, keys, checkSession, clock = () => Date.now(),
  maxLifetimeSeconds = 900,
}) {
  if (typeof issuer !== 'string' || !issuer.startsWith('https://') ||
      typeof audience !== 'string' || !audience ||
      !Array.isArray(keys) || !keys.length || keys.length > 8 ||
      typeof checkSession !== 'function') {
    throw new DomainError('Trusted identity configuration unavailable.', 503);
  }
  const ring = new Map();
  for (const entry of keys) {
    if (!entry || typeof entry.kid !== 'string' ||
        !/^[A-Za-z0-9_-]{4,100}$/.test(entry.kid) || ring.has(entry.kid)) {
      throw new DomainError('Identity key set invalid.', 503);
    }
    let key;
    try {
      key = createPublicKey(entry.publicKeyPem);
    } catch {
      throw new DomainError('Identity public key invalid.', 503);
    }
    if (key.asymmetricKeyType !== 'rsa' || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048)
      throw new DomainError('Identity RSA key too weak.', 503);
    ring.set(entry.kid, key);
  }
  if (!Number.isInteger(maxLifetimeSeconds) || maxLifetimeSeconds < 30 ||
      maxLifetimeSeconds > 3600) throw new DomainError('Token lifetime policy invalid.', 503);

  return Object.freeze({
    async verifyAuthorization(authorization) {
      if (typeof authorization !== 'string' || authorization.length > 12000 ||
          !authorization.startsWith('Bearer ')) fail('Authentication required.', 401);
      const raw = authorization.slice(7);
      const parts = raw.split('.');
      if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[2])) fail();
      const header = decodePart(parts[0]);
      if (header.alg !== 'RS256' || header.typ !== 'JWT' ||
          typeof header.kid !== 'string' ||
          header.jwk !== undefined || header.jku !== undefined ||
          header.x5u !== undefined || header.crit !== undefined) fail();
      const key = ring.get(header.kid);
      if (!key) fail('Unknown identity signing key.', 401);
      const claims = decodePart(parts[1]);
      const signature = Buffer.from(parts[2], 'base64url');
      if (signature.length < 256 ||
          !verifySignature('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), key, signature)) fail();

      const now = Math.floor(clock() / 1000);
      if (claims.iss !== issuer || !(claims.aud === audience ||
          Array.isArray(claims.aud) && claims.aud.includes(audience)) ||
          (Array.isArray(claims.aud) && claims.aud.length !== 1 && claims.azp !== audience) ||
          !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) ||
          claims.exp <= now || claims.iat > now + 30 ||
          now - claims.iat > maxLifetimeSeconds ||
          claims.exp - claims.iat > maxLifetimeSeconds ||
          (claims.nbf != null && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))) fail();
      if (typeof claims.sub !== 'string' ||
          !/^[A-Za-z0-9_-]{8,128}$/.test(claims.sub)) fail();
      if (claims.email_verified !== true || typeof claims.email !== 'string' ||
          claims.email.length > 254) fail('Verified email required.', 403);
      const email = claims.email.toLowerCase().trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Verified email required.', 403);
      if (typeof claims.sid !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(claims.sid) ||
          typeof claims.jti !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(claims.jti)) fail();
      const actor = Object.freeze({
        userId: claims.sub, email, emailVerified: true, sessionId: claims.sid,
        tokenId: claims.jti, issuer, keyId: header.kid,
      });
      // No local cache: immediate session/identity revocation is a staging gate.
      let active = false;
      try { active = await checkSession(actor); }
      catch { throw new DomainError('Session verification unavailable.', 503); }
      if (active !== true) fail('Session expired or revoked.', 401);
      return actor;
    }
  });
}
