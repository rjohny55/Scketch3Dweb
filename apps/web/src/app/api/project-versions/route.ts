import {randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {accountDb,accountDirectory,accountError,accountJson,requireAccount,recordActivity} from '@/lib/serverAccounts';
import {SKF_MEDIA_TYPE} from '@/lib/skfProject';
export const runtime='nodejs';export const dynamic='force-dynamic';
type Row={id:string;owner_id:string;shared:number;revision:string;version:number;name:string};
type Version={version:number;revision:string;size:number;has_thumbnail:number};
const content=(id:string,revision:string,thumbnail=false)=>path.join(accountDirectory(),'files',`${id}.${revision}.${thumbnail?'png':'skf'}`);
function find(request:Request){const id=new URL(request.url).searchParams.get('fileName')?.replace(/\.skf$/,'')??'';return accountDb().prepare('SELECT * FROM projects WHERE id=?').get(id) as Row|undefined;}
export async function GET(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;const project=find(request);if(!project||(!project.shared&&project.owner_id!==user.id&&user.role!=='admin'))return accountError('Project was not found.',404);
 const version=Number(new URL(request.url).searchParams.get('version')??0);
 if(version){const row=accountDb().prepare('SELECT * FROM project_versions WHERE project_id=? AND version=?').get(project.id,version) as Version|undefined;if(!row)return accountError('Version was not found.',404);const bytes=await fs.readFile(content(project.id,row.revision));return new Response(bytes,{headers:{'Content-Type':SKF_MEDIA_TYPE,'Cache-Control':'no-store, private','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(project.name+'-v'+version+'.skf')}`}});}
 const versions=accountDb().prepare('SELECT v.version,v.revision,v.saved_at AS savedAt,v.size,u.display_name AS authorName,u.username AS authorLogin FROM project_versions v JOIN users u ON u.id=v.author_id WHERE project_id=? ORDER BY version DESC').all(project.id);
 return accountJson({versions,currentRevision:project.revision,currentVersion:project.version});
}
export async function POST(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;const project=find(request);if(!project||(!project.shared&&project.owner_id!==user.id&&user.role!=='admin'))return accountError('Project was not found.',404);
 let revision='';
 try{
  const body=await request.json(),expected=request.headers.get('if-match')?.replace(/^"|"$/g,'');if(expected!==project.revision)return accountError('The project changed. Refresh its history first.',409);
  const source=accountDb().prepare('SELECT * FROM project_versions WHERE project_id=? AND version=?').get(project.id,Number(body.version)) as Version|undefined;if(!source)return accountError('Version was not found.',404);
  revision=randomUUID();await fs.copyFile(content(project.id,source.revision),content(project.id,revision));if(source.has_thumbnail)await fs.copyFile(content(project.id,source.revision,true),content(project.id,revision,true));
  const db=accountDb(),now=Date.now(),next=project.version+1;db.exec('BEGIN IMMEDIATE');try{
   const latest=find(request);if(!latest||latest.revision!==expected||(!latest.shared&&latest.owner_id!==user.id&&user.role!=='admin'))throw Error('conflict');
   db.prepare('UPDATE projects SET revision=?,version=?,updated_at=?,size=?,has_thumbnail=? WHERE id=?').run(revision,next,now,source.size,source.has_thumbnail,project.id);db.prepare('INSERT INTO project_versions VALUES(?,?,?,?,?,?,?)').run(project.id,next,revision,user.id,now,source.size,source.has_thumbnail);if(project.shared)recordActivity(project.id,user.id,'restored',next);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  return accountJson({ok:true,version:next,revision});
 }catch(e){if(revision){await fs.unlink(content(project.id,revision)).catch(()=>{});await fs.unlink(content(project.id,revision,true)).catch(()=>{});}return accountError(e instanceof Error&&e.message==='conflict'?'The project changed. Refresh its history first.':'Could not restore this version.',409);}
}
