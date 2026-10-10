import { db, storage, router, json, error, requireAuth } from '@appdeploy/sdk';
import { makeGrowthStarterRoutes } from './routes.mjs';

// Keep auth token verification and all persistence/storage within the AppDeploy
// server runtime. This file intentionally has no browser-facing credentials.
export const handler=router(makeGrowthStarterRoutes({
  db,storage,json,error,requireAuth,
  cryptoRandomUUID:()=>crypto.randomUUID()
}));
