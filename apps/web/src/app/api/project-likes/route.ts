import {NextResponse} from 'next/server';
import {accountDb,accountError,accountJson,requireAccount} from '@/lib/serverAccounts';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;
 if(Number(request.headers.get('content-length')??0)>2000)return accountError('Request is too large.',413);
 try{const body=await request.json();if(typeof body.fileName!=='string'||typeof body.liked!=='boolean')return accountError('Invalid project like.');
 const id=body.fileName.replace(/\.skf$/,''),db=accountDb();
 const update=db.prepare(body.liked?'INSERT OR IGNORE INTO project_likes(project_id,user_id) SELECT id,? FROM projects WHERE id=? AND shared=1':'DELETE FROM project_likes WHERE user_id=? AND project_id=? AND EXISTS(SELECT 1 FROM projects WHERE id=? AND shared=1)');
 if(body.liked)update.run(user.id,id);else update.run(user.id,id,id);
 if(!db.prepare('SELECT id FROM projects WHERE id=? AND shared=1').get(id))return accountError('Project was not found.',404);
 return accountJson(db.prepare('SELECT (SELECT count(*) FROM project_likes WHERE project_id=?) AS likes, EXISTS(SELECT 1 FROM project_likes WHERE project_id=? AND user_id=?) AS liked').get(id,id,user.id));
 }catch{return accountError('Could not update the project like.');}
}
