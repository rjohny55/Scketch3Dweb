import {NextResponse} from 'next/server';
import {accountDb,accountError,accountJson,consumeLoginAttempt,createAccount,currentUser,hash,passwordMatches,publicUser,sameOrigin,sessionResponse,SESSION_COOKIE,validateUsername} from '@/lib/serverAccounts';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){return accountJson({user:currentUser(request),setupRequired:(accountDb().prepare('SELECT count(*) AS n FROM users').get() as {n:number}).n===0});}
export async function POST(request:Request){
 if(!sameOrigin(request))return accountError('Cross-origin requests are forbidden.',403);
 if(Number(request.headers.get('content-length')??0)>4096)return accountError('Request is too large.',413);
 try{
  const body=await request.json();if(body.action==='setup')return sessionResponse(request,await createAccount(body,true));
  if(body.action!=='login')return accountError('Unknown authentication action.');
  const username=validateUsername(body.username);if(typeof body.password!=='string'||body.password.length>256)return accountError('Incorrect login or password.',401);
  if(!consumeLoginAttempt(request,username))return accountError('Too many sign-in attempts. Try again in 15 minutes.',429);
  const row=accountDb().prepare('SELECT * FROM users WHERE username=?').get(username) as Parameters<typeof publicUser>[0]|undefined;
  const dummy='scrypt:00000000000000000000000000000000:'+ '00'.repeat(64);
  const valid=await passwordMatches(body.password,row?.password_hash??dummy);
  if(!row||!row.active||!valid)return accountError('Incorrect login or password.',401);
  return sessionResponse(request,publicUser(row));
 }catch(e){return accountError(e instanceof Error?e.message:'Could not sign in.');}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return accountError('Cross-origin requests are forbidden.',403);
 const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 if(token)accountDb().prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
 const response=NextResponse.json({ok:true});response.cookies.set(SESSION_COOKIE,'',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});response.headers.set('Cache-Control','no-store');return response;
}
