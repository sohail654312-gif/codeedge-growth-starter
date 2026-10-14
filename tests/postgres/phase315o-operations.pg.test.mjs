import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createPostgresStore} from '../../backend/postgres-store.mjs';
import {createWorkspaceOperations} from '../../backend/workspace-operations.mjs';
import {createTransactionalWorkspaceService,createTransactionalWorkflowService} from '../../backend/transactional.mjs';
import {ownerWorkspaceId} from '../../backend/core.mjs';

// This suite owns ONLY a generated database on a local disposable PG service.
const url=new URL(process.env.TEST_DATABASE_URL||'http://missing.invalid');
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/gs_test')
 throw Error('Local disposable gs_test PostgreSQL service required.');
const dbName='gs_o_'+randomUUID().replaceAll('-','');
if(!/^gs_o_[a-f0-9]{32}$/.test(dbName))throw Error('Invalid isolated database name.');
const admin=new pg.Pool({connectionString:url.href,max:2}),isolated=new URL(url);isolated.pathname='/'+dbName;
const pool=new pg.Pool({connectionString:isolated.href,max:12,connectionTimeoutMillis:5000});
const owner={userId:'ops_owner_A_111',email:'owner-a@fiction.invalid',emailVerified:true};
const other={userId:'ops_owner_B_222',email:'owner-b@fiction.invalid',emailVerified:true};
const staff={userId:'ops_staff_C_333',email:'staff-c@fiction.invalid',emailVerified:true};
const client={userId:'ops_client_D_444',email:'client-d@fiction.invalid',emailVerified:true};
const ws=ownerWorkspaceId(owner.userId),wsB=ownerWorkspaceId(other.userId);
let created=false,service,members,workflow,store,requestId,clock=Date.now();
const key=n=>'ops_idempotent_'+String(n).padStart(16,'0');
const context={workspaceId:ws,actor:owner.userId};
before(async()=>{
 await admin.query(`CREATE DATABASE ${dbName}`);created=true;
 const version=await pool.query('SHOW server_version_num');assert.ok(Number(version.rows[0].server_version_num)>=170000&&Number(version.rows[0].server_version_num)<180000);
 await pool.query(readFileSync('db/migrations/0001_growth_starter.sql','utf8'));
 await pool.query('INSERT INTO growth_starter.workspaces(id,owner_user_id) VALUES($1,$2),($3,$4)',[ws,owner.userId,wsB,other.userId]);
 await pool.query(`INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind,updated_at)
  SELECT CASE WHEN n%2=0 THEN $1 ELSE $2 END,'bench_'||n,'Fictional benchmark','Other',now()-n*interval '1 second' FROM generate_series(1,10000)n`,[ws,wsB]);
 await pool.query('ANALYZE growth_starter.work_requests');
 const explain=async()=> (await pool.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM growth_starter.work_requests WHERE workspace_id=$1 ORDER BY updated_at DESC,id DESC LIMIT 20`,[ws])).rows[0]['QUERY PLAN'][0];
 const baseline=[];for(let i=0;i<5;i++)baseline.push(await explain());
 await pool.query(readFileSync('db/drafts/phase315o_operations_REVIEW_ONLY.sql','utf8'));
 await pool.query('ANALYZE growth_starter.work_requests');
 const indexed=[];for(let i=0;i<5;i++)indexed.push(await explain());
 assert.match(JSON.stringify(indexed[0].Plan),/gs_requests_workspace_order/);
 assert.doesNotMatch(JSON.stringify(indexed[0].Plan),/"Node Type":"Sort"/);
 mkdirSync('work',{recursive:true});writeFileSync('work/phase315o-pg-performance.json',JSON.stringify({rows:10000,tenantRows:5000,repeats:5,baseline,indexed},null,2));
 console.log('PHASE315O_PERFORMANCE '+JSON.stringify({rows:10000,baselineMs:baseline.map(x=>x['Execution Time']),indexedMs:indexed.map(x=>x['Execution Time']),baselinePlan:baseline[0].Plan,indexedPlan:indexed[0].Plan}));
 await pool.query("DELETE FROM growth_starter.work_requests WHERE id LIKE 'bench_%'");
 store=createPostgresStore({pool});service=createWorkspaceOperations({store,cursorKey:'disposable-only-cursor-signing-key-123456789',now:()=>clock});
 members=createTransactionalWorkspaceService({store,pepper:'disposable-only-invitation-pepper-123456789'});workflow=createTransactionalWorkflowService({store});
 for(const [actor,role] of [[staff,'staff'],[client,'client']]){
  const invitation=await members.issue({actor:owner,workspaceId:ws,email:actor.email,role});await members.accept({actor,token:invitation.token});
 }
});
after(async()=>{await pool.end();if(created)await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);await admin.end();});

test('profile onboarding, optimistic versions, idempotency and cross-tenant denial persist in PG17',async()=>{
 const fields={name:'Fictional Clinic A',industry:'Clinic',city:'Karachi',website:'https://fiction.invalid/',goal:'Review content'};
 const input={...context,key:key(1),fields,expectedVersion:0};
 assert.equal((await service.saveProfile(input)).version,1);
 assert.deepEqual(await service.saveProfile(input),await service.saveProfile(input));
 await assert.rejects(service.saveProfile({...input,fields:{...fields,city:'Lahore'}}),e=>e.status===409);
 await assert.rejects(service.saveProfile({...input,key:key(2)}),e=>e.status===409);
 await assert.rejects(service.saveProfile({...input,key:key(3),actor:other.userId}),e=>e.status===403);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM growth_starter.business_profiles')).rows[0].n,1);
});
test('concurrent identical create commits one request, one receipt and one audit event',async()=>{
 const input={...context,key:key(10),fields:{title:'Review a website draft',kind:'Website update',notes:'Fictional brief'}};
 const result=await Promise.all([service.createRequest(input),service.createRequest(input)]);assert.equal(result[0].id,result[1].id);requestId=result[0].id;
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM growth_starter.audit_events WHERE action='request.created'")).rows[0].n,1);
 await assert.rejects(service.createRequest({...input,actor:other.userId,key:key(11)}),e=>e.status===403);
});
test('live roles enforce assignment, review, client correction, version conflicts and rollback',async()=>{
 const args={...context,key:key(20),id:requestId,assignedTo:staff.userId,dueDate:'2026-12-01',expectedVersion:0};
 await assert.rejects(service.assign({...args,actor:staff.userId}),e=>e.status===403);
 await assert.rejects(service.assign({...args,assignedTo:client.userId}),e=>e.status===403);
 await assert.rejects(service.assign({...args,dueDate:'2026-02-30'}),e=>e.status===400);
 assert.equal((await service.assign(args)).version,1);
 assert.equal((await service.detail({...context,id:requestId})).assignedTo,staff.userId);
 await workflow.review({workspace:{workspaceId:ws,role:'owner'},actor:staff.userId,id:requestId,requested:'In progress',expectedVersion:1});
 await workflow.review({workspace:{workspaceId:ws,role:'owner'},actor:staff.userId,id:requestId,requested:'Awaiting approval',expectedVersion:2});
 const correction={...context,actor:client.userId,key:key(21),id:requestId,note:'Revise the supplied draft headline.',expectedVersion:3};
 await assert.rejects(service.correction({...correction,actor:staff.userId}),e=>e.status===403);
 assert.equal((await service.correction(correction)).status,'Changes requested');
 assert.equal((await service.detail({...context,id:requestId})).notesHistory[0].note,correction.note);
 const count=async()=>Number((await pool.query('SELECT count(*) AS n FROM growth_starter.audit_events')).rows[0].n),old=await count();
 await assert.rejects(service.assign({...args,key:key(22)}),e=>e.status===409);assert.equal(await count(),old);
 await assert.rejects(store.transaction(async tx=>{await tx.audit({workspaceId:ws,actorId:owner.userId,action:'forced.failure',target:'test',at:clock});throw Error('rollback');}),/rollback/);
 assert.equal(await count(),old);
});
test('keyset pages preserve microsecond boundaries, filters and tenant/actor/cursor binding',async()=>{
 await pool.query(`INSERT INTO growth_starter.work_requests(workspace_id,id,title,kind,updated_at)
  SELECT $1,'paged_'||lpad(n::text,3,'0'),'Fictional page','Other','2027-01-01T00:00:00.123456Z' FROM generate_series(1,7)n`,[ws]);
 const seen=[];let cursor=null;
 do{const page=await service.list({...context,query:{kind:'Other',limit:2,cursor}});seen.push(...page.items.map(x=>x.id));cursor=page.nextCursor;
  if(cursor){await assert.rejects(service.list({...context,actor:other.userId,query:{kind:'Other',limit:2,cursor}}),e=>e.status===400);
   await assert.rejects(service.list({...context,query:{kind:'Local SEO',limit:2,cursor}}),e=>e.status===400);
   await assert.rejects(service.list({...context,query:{kind:'Other',limit:2,cursor:cursor.slice(0,-1)+'!'}}),e=>e.status===400);}
 }while(cursor);
 assert.equal(seen.length,7);assert.equal(new Set(seen).size,7);
 const first=await service.list({...context,query:{kind:'Other',limit:1}});clock+=900001;
 await assert.rejects(service.list({...context,query:{kind:'Other',limit:1,cursor:first.nextCursor}}),e=>e.status===400);
 const history=await service.history({...context,query:{limit:2}});assert.equal(history.items.length,2);assert.ok(history.nextCursor);
 const next=await service.history({...context,query:{limit:2,cursor:history.nextCursor}});assert.ok(BigInt(next.items[0].id)<BigInt(history.items[1].id));
 await assert.rejects(service.history({...context,actor:staff.userId}),e=>e.status===403);
 await assert.rejects(service.list({...context,workspaceId:wsB}),e=>e.status===403);
});
test('committed revocation denies later reads, transitions, assignment and idempotent replay',async()=>{
 const fields={title:'Fictional staff task',kind:'Other',notes:''},args={workspaceId:ws,actor:staff.userId,key:key(40),fields};
 const record=await service.createRequest(args);await members.revoke({actor:owner,workspaceId:ws,userId:staff.userId});
 await assert.rejects(service.list({workspaceId:ws,actor:staff.userId}),e=>e.status===403);
 await assert.rejects(service.createRequest(args),e=>e.status===403);
 await assert.rejects(workflow.review({workspace:{workspaceId:ws,role:'owner'},actor:staff.userId,id:record.id,requested:'In progress',expectedVersion:0}),e=>e.status===403);
 await assert.rejects(service.assign({...context,key:key(41),id:record.id,assignedTo:staff.userId,expectedVersion:0}),e=>e.status===403);
});
test('database constraints reject owner mismatch and foreign media outbox references; new tables force default-deny RLS',async()=>{
 await assert.rejects(pool.query(`INSERT INTO growth_starter.memberships(workspace_id,user_id,owner_user_id,role,created_by) VALUES($1,'rogue_actor_555',$2,'staff',$2)`,[ws,other.userId]),e=>e.code==='23503');
 await pool.query(`INSERT INTO growth_starter.media(workspace_id,id,storage_key,filename,content_type,size_bytes) VALUES($1,'img','growth-starter/'||$1||'/img.png','img.png','image/png',100)`,[ws]);
 await assert.rejects(pool.query(`INSERT INTO growth_starter.media_delete_outbox(workspace_id,media_id,storage_key) VALUES($1,'img','growth-starter/'||$2||'/img.png')`,[ws,wsB]),e=>e.code==='23503');
 const flags=(await pool.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('growth_starter.business_profiles'::regclass,'growth_starter.request_notes'::regclass,'growth_starter.operation_receipts'::regclass)`)).rows;
 assert.equal(flags.length,3);assert.ok(flags.every(x=>x.relrowsecurity&&x.relforcerowsecurity));
 await pool.query('CREATE ROLE gs_o_denied NOLOGIN');
 await pool.query('GRANT USAGE ON SCHEMA growth_starter TO gs_o_denied');
 await pool.query('GRANT SELECT ON growth_starter.business_profiles,growth_starter.request_notes,growth_starter.operation_receipts TO gs_o_denied');
 const connection=await pool.connect();try{await connection.query('SET ROLE gs_o_denied');assert.equal((await connection.query('SELECT * FROM growth_starter.business_profiles')).rowCount,0);}finally{await connection.query('RESET ROLE');connection.release();}
});
