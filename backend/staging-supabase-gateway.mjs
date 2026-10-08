import {createRestrictedStagingPool} from './staging-restricted-runtime.mjs';
import {createStagingGateway} from './staging-gateway.mjs';
import {createSupabaseStagingIdentity} from './supabase-staging-identity.mjs';

const liveSQL = 'SELECT growth_starter.staging_session_active($1,$2,$3) AS active';

/**
 * Connection-to-auth composition for a SEPARATELY DEPLOYED staging service.
 * It cannot open a gateway unless the database login is verified least-
 * privilege and every request receives an online Auth /user confirmation plus
 * a live auth.sessions PostgreSQL lookup. No service_role key is used.
 */
export async function createSupabaseStagingGateway({
  rawPool, projectUrl, publishableKey, allowedOrigin, fetchImpl
}) {
  const pool=await createRestrictedStagingPool({rawPool});
  const verifier=createSupabaseStagingIdentity({
    projectUrl,publishableKey,fetchImpl,
    checkSession:async actor=>{
      const response=await pool.query(liveSQL,[actor.userId,actor.sessionId,actor.email]);
      return response.rows?.length===1 && response.rows[0].active===true;
    }
  });
  return createStagingGateway({pool,identityVerifier:verifier,allowedOrigin});
}
