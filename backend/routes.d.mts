export declare function makeGrowthStarterRoutes(deps:{
db:{list:(table:string,options?:Record<string,unknown>)=>Promise<{items:any[];nextToken?:string}>;add:(table:string,records:Record<string,unknown>[])=>Promise<(string|null)[]>;get:(table:string,ids:string[])=>Promise<(any|null)[]>;update:(table:string,items:{id:string;record:Record<string,unknown>}[])=>Promise<boolean[]>;delete:(table:string,ids:string[])=>Promise<boolean[]>};
storage:{url:(paths:string[])=>Promise<{url:string}[]>;write:(files:{path:string;content:string;contentType:string}[])=>Promise<boolean[]>;delete:(paths:string[])=>Promise<boolean[]>};
requireAuth:()=>any;
json:(data:unknown,status?:number)=>any;
error:(message:string,status?:number)=>any;
cryptoRandomUUID:()=>string;
trustedMembership?:{capabilities:{authoritativeRead:boolean};authorize:(params:{userId:string;workspaceId:string})=>Promise<unknown>;list:(params:{userId:string})=>Promise<unknown[]>}|null;
workflowMutations?:{capabilities:{atomicTransitions:boolean};review:(args:any)=>Promise<any>;decision:(args:any)=>Promise<any>}|null;
mediaLifecycle?:{capabilities:{durableDeletion:boolean};remove:(args:any)=>Promise<any>}|null;
}): Record<string,any[]>;
