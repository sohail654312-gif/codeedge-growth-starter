import {readPhase315mConfig} from './phase315m-config.mjs';
// All M gates still apply. P writer is optional and disabled unless exact source
// and migration evidence has passed the independent approved cutover procedure.
export function readPhase315pConfig(env,evidence){
 const base=readPhase315mConfig(env,evidence),fail=()=>{throw Error('Private operations prerequisites unavailable.');};
 if(env.GS315P_ACTIVATE!=='dbppeymhsemvghbvuvof'||evidence.operationsCommitSha!==base.commitSha||
 evidence.operationsMigrationReviewId?.trim?.()==null||!evidence.operationsMigrationReviewId.trim()||
 !env.GS315P_CURSOR_KEY_PATH)fail();
 let u;try{u=new URL(env.GS315P_WRITER_DATABASE_URL);}catch{fail();}
 const direct=u.hostname==='db.dbppeymhsemvghbvuvof.supabase.co',pooler=/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname);
 if(!['postgres:','postgresql:'].includes(u.protocol)||u.pathname!=='/postgres'||u.search||u.hash||(!direct&&!pooler)||
 decodeURIComponent(u.username)!==(direct?'gs315p_writer':'gs315p_writer.dbppeymhsemvghbvuvof')||decodeURIComponent(u.password).length<32||u.port&&u.port!=='5432')fail();
 return Object.freeze({...base,writerUrl:u.href,cursorKeyPath:env.GS315P_CURSOR_KEY_PATH});
}
