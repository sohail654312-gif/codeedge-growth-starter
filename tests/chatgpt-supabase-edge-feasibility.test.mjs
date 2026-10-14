import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Source-only compatibility alarms. No Supabase credentials, database access,
// Deno runtime, HTTP listener or hosted Edge Function are launched by this test.
const source=path=>readFileSync(path,'utf8');

test('existing private gateway cannot be re-labelled as a Deno Edge entrypoint',()=>{
 const server=source('staging/phase315m-server.mjs');
 assert.match(server,/from 'node:https'/);
 assert.match(server,/from 'node:http'/);
 assert.match(server,/server\.listen\(/);
 assert.match(server,/from 'node:fs'/);
 const bootstrap=source('staging/phase315m-bootstrap.mjs');
 assert.match(bootstrap,/readFileSync/);
 assert.match(bootstrap,/GS315M_AUTHORITY_MODULE/);
});

test('exact provider authority is not presented as hosted verified',()=>{
 const authority=source('backend/exact-session-authority.mjs');
 assert.match(authority,/hostedVerified:false/);
 const runtime=source('backend/phase315m-private-runtime.mjs');
 assert.match(runtime,/typeof checkProviderSession!=='function'/);
 assert.match(runtime,/async function transaction\(pool,run\)/);
 assert.match(runtime,/BEGIN ISOLATION LEVEL READ COMMITTED/);
});

test('cross-site cookie and image-normalization blockers remain explicit',()=>{
 const cookie=source('backend/phase315e-https-cookies.mjs');
 assert.match(cookie,/__Host-ce_session/);
 assert.match(cookie,/SameSite=Lax/);
 const media=source('backend/image-inspector.mjs');
 assert.match(media,/sharpFactory/);
});

test('review-only audit cannot be mistaken for Edge deployment acceptance',()=>{
 const review=source('docs/CHATGPT-SUPABASE-EDGE-FEASIBILITY-20261014.md');
 assert.match(review,/NOT drop-in/);
 assert.match(review,/hostedVerified/);
 assert.match(review,/No Edge function is deployed/);
 assert.match(review,/No.*Auth URLs changed/);
 assert.match(review,/500,000 Edge Function invocations/);
});
