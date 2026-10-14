import {createPublicKey,verify as verifySignature} from 'node:crypto';
import {DomainError} from './core.mjs';

// Provider-neutral bearer verifier for a separately configured RS256 IdP.
// NOT an AppDeploy JWT verifier; do not bind until issuer, JWKS/key rotation,
// audience, email_verified trust and logout/revocation are independently proven.
function parsePart(raw) {
  if(typeof raw!=='string'||raw.length>10000||!/^[A-Za-z0-9_-]+$/.test(raw))
    throw new DomainError('Invalid identity token.',401);
  try {return JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));}
  catch {throw new DomainError('Invalid identity token.',401);}
}
export function createVerifiedIdentityAdapter({publicKeyPem,issuer,audience,clock=()=>Date.now()}) {
  if(!publicKeyPem||!issuer||!audience)throw new DomainError('Verified identity configuration missing.',503);
  const publicKey=createPublicKey(publicKeyPem);
  return Object.freeze({
    verifyAuthorization(header) {
      if(typeof header!=='string'||!header.startsWith('Bearer '))throw new DomainError('Authentication required.',401);
      const bearer=header.slice(7);
      const parts=bearer.split('.');
      if(parts.length!==3||bearer.length>12000)throw new DomainError('Invalid identity token.',401);
      const protectedHeader=parsePart(parts[0]);
      const claims=parsePart(parts[1]);
      if(protectedHeader.alg!=='RS256'||protectedHeader.typ!=='JWT')
        throw new DomainError('Unsupported identity token.',401);
      let signature;
      try{signature=Buffer.from(parts[2],'base64url');}
      catch{throw new DomainError('Invalid identity token.',401);}
      if(signature.length<128||!verifySignature('RSA-SHA256',
        Buffer.from(parts[0]+'.'+parts[1]),publicKey,signature))
        throw new DomainError('Invalid identity signature.',401);
      const seconds=Math.floor(clock()/1000);
      const audienceValid=claims.aud===audience||Array.isArray(claims.aud)&&claims.aud.includes(audience);
      if(claims.iss!==issuer||!audienceValid||!Number.isSafeInteger(claims.exp)||
         claims.exp<=seconds||claims.exp>seconds+3600||
         (claims.nbf!=null&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>seconds))||
         (claims.iat!=null&&(!Number.isSafeInteger(claims.iat)||claims.iat>seconds+60)))
        throw new DomainError('Identity token expired or out of scope.',401);
      if(typeof claims.sub!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(claims.sub))
        throw new DomainError('Invalid subject.',401);
      if(claims.email_verified!==true || typeof claims.email!=='string')
        throw new DomainError('Verified email required.',403);
      const email=claims.email.trim().toLowerCase();
      if(email.length>254||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        throw new DomainError('Invalid verified email.',403);
      return Object.freeze({userId:claims.sub,email,emailVerified:true,issuer:claims.iss});
    }
  });
}
