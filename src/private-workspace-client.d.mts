export class PrivateWorkspaceError extends Error {status:number;}
export type PrivateRequest={id:string;workspaceId:string;title:string;kind:string;notes:string;status:string;version:number;updatedAt:number;assignedTo:string|null;dueDate:string|null;notesHistory?:Array<{id:string;note:string;actorId:string}>};
export type PrivateProfile={name:string;industry:string;city:string;website:string;goal:string};
export type PrivatePage={items:PrivateRequest[];nextCursor:string|null};
export type PrivateClient={
 login(email:string):Promise<unknown>;logout():Promise<unknown>;onboard():Promise<{workspaceId:string;role:string}>;
 workspaces():Promise<{workspaces:Array<{workspaceId:string;role:string;name:string}>}>;
 authorize(ws:string):Promise<{workspaceId:string;role:string}>;profile(ws:string):Promise<{fields:PrivateProfile|null;version:number}>;
 list(ws:string,query?:Record<string,string>):Promise<PrivatePage>;detail(ws:string,id:string):Promise<PrivateRequest>;
 history(ws:string,query?:Record<string,string>):Promise<{items:Array<{id:string;action:string;target:string}>;nextCursor:string|null}>;
 saveProfile(ws:string,fields:PrivateProfile,version:number,key:string):Promise<unknown>;
 createRequest(ws:string,fields:{title:string;kind:string;notes:string},key:string):Promise<unknown>;
 assign(ws:string,id:string,assignedTo:string|null,dueDate:string|null,version:number,key:string):Promise<unknown>;
 review(ws:string,id:string,status:string,version:number,key:string):Promise<unknown>;
 decision(ws:string,id:string,status:string,note:string,version:number,key:string):Promise<unknown>;
 correction(ws:string,id:string,note:string,version:number,key:string):Promise<unknown>;
 revokeMember(ws:string,userId:string,key:string):Promise<unknown>;deleteMedia(ws:string,id:string,key:string):Promise<unknown>;
};
export function createPrivateWorkspaceClient(options?:{origin?:string;fetchImpl?:typeof fetch;getCsrf?:()=>string|null}):PrivateClient;
