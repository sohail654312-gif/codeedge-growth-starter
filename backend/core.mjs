// Domain security rules intentionally independent of AppDeploy for deterministic tests.
// These rules are NOT proof of runtime auth, tenant isolation, or production suitability.
export const ROLES = Object.freeze(['owner', 'agency_admin', 'staff', 'client']);
export const ACTIONS = Object.freeze([
  'overview:read', 'profile:write', 'enquiry:create', 'enquiry:update',
  'request:create', 'request:review', 'request:decide', 'asset:upload', 'asset:delete', 'members:manage'
]);
const permissions = Object.freeze({
  owner: ACTIONS,
  agency_admin: ACTIONS.filter(action => action !== 'members:manage' && action !== 'request:decide'),
  staff: ['overview:read','profile:write','enquiry:create','enquiry:update','request:create','request:review','asset:upload'],
  client: ['overview:read','profile:write','enquiry:create','request:create','request:decide','asset:upload']
});

export class DomainError extends Error {
  constructor(message, status=400) {
    super(message);
    this.name='DomainError';
    this.status=status;
  }
}

export function textField(input, label, max=150, required=true) {
  if (input == null || input === '') {
    if (required) throw new DomainError(label+' is required.');
    return '';
  }
  if (typeof input !== 'string') throw new DomainError(label+' must be text.');
  const value=input.trim();
  if (required && !value) throw new DomainError(label+' is required.');
  if (value.length>max) throw new DomainError(label+' is too long.');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) throw new DomainError(label+' contains invalid characters.');
  return value;
}
export function objectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DomainError('A JSON object is required.');
  return body;
}
export function enumField(input, label, choices) {
  const value=textField(input,label,60);
  if(!choices.includes(value)) throw new DomainError('Invalid '+label+'.');
  return value;
}
export function validatedWebsite(input) {
  const value=textField(input,'Website URL',250,false);
  if (!value) return '';
  let url;
  try { url=new URL(value); } catch { throw new DomainError('Website must be a valid HTTPS URL.'); }
  if(url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hostname==='localhost' || url.hostname.endsWith('.local')) {
    throw new DomainError('Website must be a public HTTPS URL.');
  }
  return url.toString();
}
export function profileInput(body) {
  const input=objectBody(body);
  return {
    name:textField(input.name,'Business name',90),
    industry:textField(input.industry,'Industry',60),
    city:textField(input.city,'City',90),
    website:validatedWebsite(input.website),
    goal:textField(input.goal,'Goal',240,false)
  };
}
export function enquiryInput(body) {
  const input=objectBody(body);
  return {
    name:textField(input.name,'Enquirer name',100),
    service:textField(input.service,'Service',100),
    channel:input.channel==null||input.channel===''?'Website':enumField(input.channel,'channel',['Website','WhatsApp','Instagram','Google','Phone','Other'])
  };
}
export function requestInput(body) {
  const input=objectBody(body);
  return {
    title:textField(input.title,'Request title',100),
    kind:enumField(input.kind,'request type',['Social content','Website update','Local SEO','Other']),
    notes:textField(input.notes,'Notes',600,false)
  };
}
export function statusInput(body) {
  return enumField(objectBody(body).status,'status',['New','Contacted','Booked','Won','Lost']);
}
function principalId(user) {
  const uid=user?.userId;
  if(typeof uid!=='string'||! /^[a-zA-Z0-9_-]{8,128}$/.test(uid)) throw new DomainError('Unrecognized authenticated principal.',403);
  return uid;
}
export function ownerWorkspaceId(userId) {
  return 'ws_'+principalId({userId});
}
export function tableFor(kind,ownerUserId) {
  if(!['profiles','enquiries','requests','assets','memberships'].includes(kind)) throw new DomainError('Unknown record type.',500);
  return 'gs_'+kind+'_'+principalId({userId:ownerUserId});
}
export function authorize(role,action) {
  if(!ROLES.includes(role)||!ACTIONS.includes(action)||!permissions[role]?.includes(action)) {
    throw new DomainError('Permission denied.',403);
  }
  return true;
}
export function requestedWorkspace(ctx) {
  const query=ctx.query?.workspaceId;
  const body=ctx.body && typeof ctx.body === 'object' && !Array.isArray(ctx.body)?ctx.body.workspaceId:undefined;
  if(query != null && body != null && query!==body) throw new DomainError('Conflicting workspace selection.');
  const value=query ?? body;
  if(value == null || value === '') return null;
  if(typeof value!=='string'||! /^ws_[a-zA-Z0-9_-]{8,128}$/.test(value)) throw new DomainError('Invalid workspace ID.');
  return value;
}
export function validGrant(grant,uid,requested) {
  if(!grant || typeof grant!=='object' || typeof grant.ownerUserId!=='string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(grant.ownerUserId)) return false;
  return grant.userId===uid &&
    grant.workspaceId===requested &&
    grant.workspaceId===ownerWorkspaceId(grant.ownerUserId ?? '') &&
    grant.state==='active' &&
    ROLES.includes(grant.role) &&
    grant.role!=='owner';
}
export async function resolveWorkspace(ctx,db,action,trustedMembership) {
  const uid=principalId(ctx.user);
  const own=ownerWorkspaceId(uid);
  const selected=requestedWorkspace(ctx) || own;
  if(selected===own) {
    authorize('owner',action);
    return {workspaceId:own,ownerUserId:uid,role:'owner'};
  }
  // Legacy per-user grant tables alone are NOT an authoritative membership source.
  // Foreign workspaces remain disabled until a transaction-backed, verified
  // membership provider is explicitly wired into the runtime.
  if(!trustedMembership?.capabilities?.authoritativeRead) throw new DomainError('Workspace access denied.',403);
  const proof=await trustedMembership.authorize({userId:uid,workspaceId:selected});
  if(!validGrant(proof,uid,selected)) throw new DomainError('Workspace access denied.',403);
  authorize(proof.role,action);
  return {workspaceId:selected,ownerUserId:proof.ownerUserId,role:proof.role};
}
export function pageArgs(query={}) {
  let limit=20;
  if(query.limit!=null) {
    if(!/^(?:[1-9]|[1-4][0-9]|50)$/.test(query.limit)) throw new DomainError('Page size must be from 1 to 50.');
    limit=Number(query.limit);
  }
  const nextToken=query.cursor;
  if(nextToken==null||nextToken==='') return {limit};
  if(typeof nextToken!=='string'||nextToken.length>1024||/\s|[\u0000-\u001F]/.test(nextToken)) throw new DomainError('Invalid cursor.');
  return {limit,nextToken};
}
function signatureMatches(mime,bytes) {
  if(mime==='image/png') return bytes.length>24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16)==='IHDR';
  if(mime==='image/jpeg') return bytes.length>20 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes[bytes.length-2]===255 && bytes[bytes.length-1]===217;
  if(mime==='image/webp') return bytes.length>20 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' && ['VP8 ','VP8L','VP8X'].includes(bytes.toString('ascii',12,16));
  return false;
}
export function validateImageUpload(body) {
  const input=objectBody(body);
  const mime=enumField(input.mime,'media type',['image/png','image/jpeg','image/webp']);
  const original=textField(input.filename,'Filename',110);
  if(/[\\/]/.test(original)||original==='.'||original==='..'||original.startsWith('.')) throw new DomainError('Unsafe filename.');
  const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
  const extension=original.toLowerCase().split('.').pop();
  if(!(extension===extensions[mime] || (mime==='image/jpeg'&&extension==='jpeg'))) throw new DomainError('File extension and media type disagree.');
  if(!/^[\p{L}\p{N}._ -]+$/u.test(original)) throw new DomainError('Unsafe filename.');
  if(typeof input.content!=='string'||!input.content||input.content.length>4194304||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.content)) {
    throw new DomainError('Invalid base64 image.');
  }
  const bytes=Buffer.from(input.content,'base64');
  if(bytes.length>3*1024*1024||bytes.length<21||bytes.toString('base64')!==input.content) throw new DomainError('Invalid image size or encoding.');
  if(!signatureMatches(mime,bytes)) throw new DomainError('Image bytes do not match declared format.');
  return {filename:original,mime,base64:input.content,extension:extensions[mime],size:bytes.length};
}

// Client approval transitions cannot mark any public channel as published.
export function reviewRequestTransition(current,desired,role) {
  authorize(role,'request:review');
  const allowed={
    'Requested':['In progress'],
    'Changes requested':['In progress'],
    'In progress':['Awaiting approval'],
    'Approved':['Completed']
  };
  if(!allowed[current]?.includes(desired)) throw new DomainError('Invalid agency review transition.',409);
  return desired;
}
export function clientRequestDecision(current,decision,role) {
  authorize(role,'request:decide');
  if(current!=='Awaiting approval') throw new DomainError('Request is not awaiting client approval.',409);
  return enumField(decision,'decision',['Approved','Changes requested']);
}
export function validRecordId(id) {
  if(typeof id!=='string'||id.length>128||! /^[a-zA-Z0-9_-]+$/.test(id)) throw new DomainError('Invalid record ID.');
  return id;
}
