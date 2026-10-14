import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createStagingIdentityVerifier } from '../backend/staging-identity.mjs';

const key1 = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key2 = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicKeyPem = key => key.publicKey.export({type:'spki',format:'pem'});
const now=1_791_455_000;
function signJwt(key,kid,change={}) {
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const h=encode({typ:'JWT',alg:'RS256',kid});
  const p=encode({iss:'https://issuer.synthetic.invalid',aud:'growth-starter-staging',sub:'synthetic_owner_111',email:'doctor@example.invalid',email_verified:true,iat:now,exp:now+300,sid:'session_test_111',jti:'token_test_111',...change});
  const text=h+'.'+p;
  return 'Bearer '+text+'.'+sign('RSA-SHA256',Buffer.from(text),key.privateKey).toString('base64url');
}
function makeVerifier(keys=[{kid:'rotating_old',publicKeyPem:publicKeyPem(key1)}],checkSession=async()=>true) {
  return createStagingIdentityVerifier({
    issuer:'https://issuer.synthetic.invalid',audience:'growth-starter-staging',
    keys,checkSession,clock:()=>now*1000,
  });
}
test('verified short-lived RS256 identity requires online session confirmation',async()=>{
  let seen;
  const verifier=makeVerifier(undefined,async actor=>{seen=actor;return true;});
  const actor=await verifier.verifyAuthorization(signJwt(key1,'rotating_old'));
  assert.equal(actor.userId,'synthetic_owner_111');
  assert.equal(actor.emailVerified,true);
  assert.equal(seen.sessionId,'session_test_111');
});
test('key rotation accepts registered keys, rejects unknown, wrong-key signatures',async()=>{
  const verifier=makeVerifier([
    {kid:'rotating_old',publicKeyPem:publicKeyPem(key1)},
    {kid:'rotating_new',publicKeyPem:publicKeyPem(key2)}
  ]);
  assert.equal((await verifier.verifyAuthorization(signJwt(key1,'rotating_old'))).keyId,'rotating_old');
  assert.equal((await verifier.verifyAuthorization(signJwt(key2,'rotating_new'))).keyId,'rotating_new');
  await assert.rejects(verifier.verifyAuthorization(signJwt(key1,'absent_key')),e=>e.status===401);
  await assert.rejects(verifier.verifyAuthorization(signJwt(key1,'rotating_new')),e=>e.status===401);
});
test('revoked, unavailable and expired sessions fail closed',async()=>{
  await assert.rejects(makeVerifier(undefined,async()=>false).verifyAuthorization(signJwt(key1,'rotating_old')),e=>e.status===401);
  await assert.rejects(makeVerifier(undefined,async()=>{throw Error('IdP offline');}).verifyAuthorization(signJwt(key1,'rotating_old')),e=>e.status===503);
  await assert.rejects(makeVerifier().verifyAuthorization(signJwt(key1,'rotating_old',{exp:now-1})),e=>e.status===401);
  await assert.rejects(makeVerifier().verifyAuthorization(signJwt(key1,'rotating_old',{iat:now-1800,exp:now+300})),e=>e.status===401);
});
test('email downgrade, wrong audience/issuer, missing session and forged claims denied',async()=>{
  const verifier=makeVerifier();
  for(const claim of [
    {email_verified:false},{iss:'https://fake.invalid'},{aud:'wrong-audience'},
    {sid:''},{jti:''},{exp:now+4000},{sub:'short'},
  ]) await assert.rejects(verifier.verifyAuthorization(signJwt(key1,'rotating_old',claim)),e=>[401,403].includes(e.status));
});
test('identity verifier refuses missing revocation provider and weak key',()=>{
  assert.throws(()=>createStagingIdentityVerifier({issuer:'https://issuer.synthetic.invalid',audience:'staging',keys:[{kid:'test_key',publicKeyPem:publicKeyPem(key1)}]}),e=>e.status===503);
  const weak=generateKeyPairSync('rsa',{modulusLength:1024});
  assert.throws(()=>makeVerifier([{kid:'weak_key',publicKeyPem:publicKeyPem(weak)}]),e=>e.status===503);
});
