import {NextResponse} from 'next/server';
import {accountDb,accountError,accountJson,createAccount,passwordHash,requireAccount,validatePassword} from '@/lib/serverAccounts';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){const user=requireAccount(request,true);if(user instanceof NextResponse)return user;return accountJson({users:accountDb().prepare('SELECT id,username,display_name AS displayName,role,active,mcp_allowed AS mcpAllowed,created_at AS createdAt FROM users ORDER BY created_at').all()});}
export async function POST(request:Request){const user=requireAccount(request,true);if(user instanceof NextResponse)return user;if(Number(request.headers.get('content-length')??0)>4096)return accountError('Request is too large.',413);try{return accountJson({user:await createAccount(await request.json())},201);}catch(e){return accountError(e instanceof Error?e.message:'Could not create user.');}}
export async function PATCH(request:Request){
 const user=requireAccount(request,true);if(user instanceof NextResponse)return user;
 if(Number(request.headers.get('content-length')??0)>4096)return accountError('Request is too large.',413);
 try{
  const body=await request.json();if(typeof body.id!=='string')return accountError('User id is required.');
  const encoded=body.password===undefined?undefined:await passwordHash(validatePassword(body.password));
  const db=accountDb();db.exec('BEGIN IMMEDIATE');try{
   const existing=db.prepare('SELECT role,active,mcp_allowed FROM users WHERE id=?').get(body.id) as {role:string;active:number;mcp_allowed:number}|undefined;if(!existing)throw Error('User was not found.');
   if(body.mcpAllowed!==undefined&&typeof body.mcpAllowed!=='boolean')throw Error('Choose whether MCP access is allowed.');
   const allowed=body.mcpAllowed===undefined?existing.mcp_allowed:body.mcpAllowed?1:0;
   const role=body.role===undefined?existing.role:body.role;if(!['admin','user'].includes(role))throw Error('Invalid role.');
   const active=body.active===undefined?existing.active:body.active===true?1:0;
   if(existing.role==='admin'&&existing.active&&(!active||role!=='admin')&&(db.prepare("SELECT count(*) AS n FROM users WHERE role='admin' AND active=1").get() as {n:number}).n<=1)throw Error('Keep at least one active administrator.');
   if(body.id===user.id&&(!active||role!=='admin'))throw Error('You cannot disable or demote your own administrator account.');
   db.prepare('UPDATE users SET role=?,active=?,mcp_allowed=? WHERE id=?').run(role,active,allowed,body.id);
   if(encoded)db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(encoded,body.id);
   if(encoded||!active||!allowed)db.prepare('UPDATE mcp_keys SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(Date.now(),body.id);
   if(encoded||!active||role!==existing.role)db.prepare('DELETE FROM sessions WHERE user_id=?').run(body.id);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  return accountJson({ok:true});
 }catch(e){return accountError(e instanceof Error?e.message:'Could not update user.');}
}
