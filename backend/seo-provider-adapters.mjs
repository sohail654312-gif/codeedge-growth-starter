/**
 * Provider-neutral Search/Analytics read contracts — no network/OAuth implementation.
 * Synthetic source ports ONLY. Live ports remain disabled until hosted identity,
 * user consent, secret storage, property grants and independent acceptance.
 */
import {validateSearchManifest,importSearchConsoleExport} from './seo-search-data.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const SOURCE_KINDS=Object.freeze(['search_console','ga4','business_profile']);
export const PROVIDER_READ_PERMISSIONS=Object.freeze({
 search_console:{scope:'https://www.googleapis.com/auth/webmasters.readonly',requiresPropertyGrant:true},
 ga4:{scope:'https://www.googleapis.com/auth/analytics.readonly',requiresPropertyGrant:true},
 business_profile:{scope:'https://www.googleapis.com/auth/business.manage',requiresLocationGrant:true}
});
export function createDisabledProviderPort(kind){
 check(SOURCE_KINDS.includes(kind),'Unsupported search provider.');
 const fail=()=>{throw Error('Live Google OAuth integration disabled: tenant identity and permission gates not accepted.');};
 return Object.freeze({kind,status:'not_connected',discover:fail,read:fail,connect:fail,publish:fail});
}
export function createSyntheticReadOnlyGscPort({grants,fixtures}){
 check(Array.isArray(grants)&&Array.isArray(fixtures),'Synthetic provider grants and rows required.');
 // Every mock grant is intentionally marked synthetic. It MUST NOT be passed
 // into a future external HTTP adapter or treated as proof of live OAuth.
 const allowed=grants.map(g=>Object.freeze({workspaceId:g.workspaceId,property:g.property}));
 return Object.freeze({
  kind:'search_console',mode:'mock_synthetic_no_network',status:'mock_only',
  discover({workspaceId}){
   check(typeof workspaceId==='string','Explicit workspace required.');
   return allowed.filter(g=>g.workspaceId===workspaceId).map(g=>({...g,verification:'synthetic_fixture_not_google_verified'}));
  },
  read({workspaceId,business,manifest}){
   check(business?.workspaceId===workspaceId&&manifest.workspaceId===workspaceId,'Foreign workspace denied.');
   check(allowed.some(g=>g.workspaceId===workspaceId&&g.property===manifest.property),'Provider property grant denied.');
   validateSearchManifest(manifest,business);
   const match=fixtures.find(f=>f.workspaceId===workspaceId&&f.property===manifest.property
     &&f.startDate===manifest.startDate&&f.endDate===manifest.endDate
     &&JSON.stringify(f.dimensions)===JSON.stringify(manifest.dimensions));
   check(match,'No matching synthetic provider response.');
   // Import through the SAME strict user-evidence validator. Even mocked
   // responses never gain live-provider-verification status.
   return importSearchConsoleExport({content:match.csv,format:'csv',manifest,business});
  },
  connect(){throw Error('OAuth and token storage disabled.');},
  publish(){throw Error('External publication disabled.');}
 });
}
export const CONNECTOR_VERSION='codeedge.search-provider-read.v1';
