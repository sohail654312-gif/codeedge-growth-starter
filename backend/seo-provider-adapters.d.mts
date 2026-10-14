import type {SeoBusiness} from './seo-growth.mjs';
import type {SearchManifest,SearchEvidence} from './seo-search-data.mjs';
export const PROVIDER_READ_PERMISSIONS:Record<string,{scope:string;requiresPropertyGrant?:boolean;requiresLocationGrant?:boolean}>;
export function createDisabledProviderPort(kind:string):{kind:string;status:'not_connected';discover:()=>never;read:()=>never;connect:()=>never;publish:()=>never};
export function createSyntheticReadOnlyGscPort(input:{
 grants:Array<{workspaceId:string;property:string}>;
 fixtures:Array<{workspaceId:string;property:string;startDate:string;endDate:string;dimensions:string[];csv:string}>;
}):{
 kind:'search_console';mode:'mock_synthetic_no_network';status:'mock_only';
 discover(input:{workspaceId:string}):Array<{workspaceId:string;property:string;verification:string}>;
 read(input:{workspaceId:string;business:SeoBusiness;manifest:SearchManifest}):SearchEvidence;
 connect():never;publish():never
};
export const CONNECTOR_VERSION:'codeedge.search-provider-read.v1';
