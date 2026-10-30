import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {accountDb,accountError,accountJson,requireAccount} from '@/lib/serverAccounts';
export const runtime='nodejs';export const dynamic='force-dynamic';
function visibleEvent(id:number){return accountDb().prepare('SELECT a.id FROM activity a JOIN projects p ON p.id=a.project_id WHERE a.id=? AND p.shared=1').get(id);}
export async function GET(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;
 const url=new URL(request.url),event=Number(url.searchParams.get('event')??0),db=accountDb();
 if(event){if(!visibleEvent(event))return accountError('Post was not found.',404);return accountJson({comments:db.prepare('SELECT c.id,c.body,c.created_at AS createdAt,u.display_name AS authorName,c.author_id AS authorId FROM activity_comments c JOIN users u ON u.id=c.author_id WHERE event_id=? ORDER BY c.created_at,c.id LIMIT 100').all(event)});}
 const before=Number(url.searchParams.get('before')??0),category=url.searchParams.get('category')??'all';
 const events=db.prepare(`SELECT a.id,a.kind,a.version,a.created_at AS createdAt,p.id||'.skf' AS fileName,p.name AS projectName,p.has_thumbnail AS hasThumbnail,p.revision,p.category,u.display_name AS authorName,u.username AS authorLogin,
 (SELECT count(*) FROM activity_likes l WHERE l.event_id=a.id) AS likes,
 EXISTS(SELECT 1 FROM activity_likes l WHERE l.event_id=a.id AND l.user_id=?) AS liked,
 (SELECT count(*) FROM activity_comments c WHERE c.event_id=a.id) AS comments
 FROM activity a JOIN projects p ON p.id=a.project_id JOIN users u ON u.id=a.author_id WHERE p.shared=1 AND (?=0 OR a.id<?) AND (?='all' OR p.category=?) ORDER BY a.id DESC LIMIT 30`).all(user.id,before,before,category,category);
 return accountJson({events});
}
export async function POST(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;if(Number(request.headers.get('content-length')??0)>12000)return accountError('Request is too large.',413);
 try{
  const body=await request.json(),id=Number(body.eventId);if(!Number.isSafeInteger(id)||!visibleEvent(id))return accountError('Post was not found.',404);
  const db=accountDb();
  if(body.action==='like'&&typeof body.liked==='boolean'){if(body.liked)db.prepare('INSERT OR IGNORE INTO activity_likes VALUES(?,?)').run(id,user.id);else db.prepare('DELETE FROM activity_likes WHERE event_id=? AND user_id=?').run(id,user.id);return accountJson({ok:true});}
  if(body.action==='comment'){if(typeof body.body!=='string'||!body.body.trim()||body.body.length>2000)return accountError('Write a comment between 1 and 2000 characters.');const recent=db.prepare('SELECT count(*) AS n FROM activity_comments WHERE author_id=? AND created_at>?').get(user.id,Date.now()-60000) as {n:number};if(recent.n>=10)return accountError('Please wait before posting more comments.',429);const commentId=randomUUID();db.prepare('INSERT INTO activity_comments VALUES(?,?,?,?,?)').run(commentId,id,user.id,body.body.trim(),Date.now());return accountJson({ok:true,id:commentId},201);}
  if(body.action==='deleteComment'){const comment=db.prepare('SELECT author_id FROM activity_comments WHERE id=? AND event_id=?').get(String(body.commentId),id) as {author_id:string}|undefined;if(!comment||(comment.author_id!==user.id&&user.role!=='admin'))return accountError('You cannot delete this comment.',403);db.prepare('DELETE FROM activity_comments WHERE id=? AND event_id=?').run(String(body.commentId),id);return accountJson({ok:true});}
  return accountError('Unknown activity action.');
 }catch{return accountError('Could not update this post.');}
}
