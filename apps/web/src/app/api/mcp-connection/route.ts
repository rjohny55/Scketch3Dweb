import {randomBytes,randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {accountDb,accountError,accountJson,hash,requireAccount} from '@/lib/serverAccounts';
import {mcpAccessError} from '@/lib/scketch3dwebMcpAccess';
export const runtime='nodejs';export const dynamic='force-dynamic';
function guard(request:Request){const blocked=mcpAccessError(request);return blocked?accountError(blocked.error,blocked.status):requireAccount(request);}
export async function GET(request:Request){
 const user=guard(request);if(user instanceof NextResponse)return user;
 return accountJson({enabled:process.env.SCKETCH3DWEB_MCP_ENABLED==='true',allowed:user.mcpAllowed,url:process.env.SCKETCH3DWEB_MCP_PUBLIC_URL||'http://127.0.0.1:3001/mcp',transport:'Streamable HTTP',keys:accountDb().prepare('SELECT id,name,prefix,created_at AS createdAt,last_used_at AS lastUsedAt,revoked_at AS revokedAt FROM mcp_keys WHERE user_id=? ORDER BY created_at DESC').all(user.id)});
}
export async function POST(request:Request){
 const user=guard(request);if(user instanceof NextResponse)return user;
 if(!user.mcpAllowed)return accountError('MCP access has not been allowed by an administrator.',403);
 if(Number(request.headers.get('content-length')??0)>2048)return accountError('Request is too large.',413);
 try{const body=await request.json();if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80)return accountError('Enter a key name between 1 and 80 characters.');
 const db=accountDb(),token='s3w_'+randomBytes(32).toString('hex'),id=randomUUID(),now=Date.now();
 db.exec('BEGIN IMMEDIATE');try{
  if((db.prepare('SELECT count(*) AS n FROM mcp_keys WHERE user_id=? AND revoked_at IS NULL').get(user.id) as {n:number}).n>=10)throw Error('Revoke an old key before creating another one (limit: 10).');
  // Recheck permission inside the write transaction.
  if(!db.prepare('SELECT id FROM users WHERE id=? AND active=1 AND mcp_allowed=1').get(user.id))throw Error('MCP access has not been allowed by an administrator.');
  db.prepare('INSERT INTO mcp_keys(id,user_id,name,token_hash,prefix,created_at) VALUES(?,?,?,?,?,?)').run(id,user.id,body.name.trim(),hash(token),token.slice(0,12),now);db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return accountJson({token,key:{id,name:body.name.trim(),prefix:token.slice(0,12),createdAt:now}},201);
 }catch(e){return accountError(e instanceof Error?e.message:'Could not create MCP key.');}
}
export async function DELETE(request:Request){
 const user=guard(request);if(user instanceof NextResponse)return user;
 const id=new URL(request.url).searchParams.get('id');if(!id)return accountError('MCP key id is required.');
 const result=accountDb().prepare('UPDATE mcp_keys SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND user_id=?').run(Date.now(),id,user.id);
 return result.changes?accountJson({ok:true}):accountError('MCP key was not found.',404);
}
