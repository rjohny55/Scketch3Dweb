import {createHash,randomUUID} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {NextResponse} from 'next/server';
import {inspectSkfProjectPackage,SKF_LIMITS,SKF_MEDIA_TYPE} from '@/lib/skfProject';
import {accountDb,accountDirectory,accountError,accountJson,requireAccount,recordActivity,type AccountUser} from '@/lib/serverAccounts';
export const runtime='nodejs';export const dynamic='force-dynamic';
type ProjectRow={id:string;owner_id:string;name:string;shared:number;revision:string;size:number;updated_at:number;has_thumbnail:number;owner_name?:string;category:string;version:number;draft_of:string|null;base_revision:string|null};
const files=()=>path.join(accountDirectory(),'files');
const safeId=(id:string)=>/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const projectId=(request:Request)=>new URL(request.url).searchParams.get('fileName')?.replace(/\.skf$/,'')??'';
const getProject=(id:string)=>accountDb().prepare('SELECT p.*,u.display_name AS owner_name FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.id=?').get(id) as ProjectRow|undefined;
const mayRead=(row:ProjectRow,user:AccountUser)=>row.shared||row.owner_id===user.id||user.role==='admin';
const mayManage=(row:ProjectRow,user:AccountUser)=>row.owner_id===user.id||user.role==='admin';
const record=(p:ProjectRow,user:AccountUser)=>({fileName:p.id+'.skf',name:p.name,updatedAt:p.updated_at,size:p.size,revision:p.revision,ownerId:p.owner_id,ownerName:p.owner_name??user.displayName,shared:!!p.shared,category:p.category,version:p.version,draftOf:p.draft_of,baseRevision:p.base_revision,canManage:mayManage(p,user),...accountDb().prepare('SELECT (SELECT count(*) FROM project_likes WHERE project_id=?) AS likes, EXISTS(SELECT 1 FROM project_likes WHERE project_id=? AND user_id=?) AS liked').get(p.id,p.id,user.id),...(p.has_thumbnail?{thumbnailUrl:`/api/shared-projects?fileName=${encodeURIComponent(p.id+'.skf')}&thumbnail=1&v=${p.revision}`}:{})});
const etag=(request:Request)=>request.headers.get('if-match')?.replace(/^W\//,'').replace(/^"|"$/g,'')??null;
const filePath=(row:Pick<ProjectRow,'id'|'revision'>,thumbnail=false)=>path.join(files(),`${row.id}.${row.revision}.${thumbnail?'png':'skf'}`);
export async function GET(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;
 try{
  await importLegacyProjects(user);
  const id=projectId(request),url=new URL(request.url);
  if(id){
   if(!safeId(id))return accountError('Invalid project id.');const row=getProject(id);if(!row||!mayRead(row,user))return accountError('Project was not found.',404);
   if(url.searchParams.get('metadata')==='1')return accountJson({project:record(row,user)});
   const thumbnail=url.searchParams.get('thumbnail')==='1';if(thumbnail&&!row.has_thumbnail)return accountError('Thumbnail not found.',404);
   const bytes=await fs.readFile(filePath(row,thumbnail));return new Response(bytes,{headers:{'Cache-Control':'no-store, private','Content-Type':thumbnail?'image/png':SKF_MEDIA_TYPE,'Content-Length':String(bytes.byteLength),'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.name+(thumbnail?'.png':'.skf'))}`,ETag:`"${row.revision}"`,'X-Content-Type-Options':'nosniff'}});
  }
  const mine=url.searchParams.get('scope')==='mine';
  const rows=(mine?accountDb().prepare('SELECT p.*,u.display_name AS owner_name FROM projects p JOIN users u ON u.id=p.owner_id WHERE owner_id=? ORDER BY updated_at DESC').all(user.id):accountDb().prepare('SELECT p.*,u.display_name AS owner_name FROM projects p JOIN users u ON u.id=p.owner_id WHERE shared=1 ORDER BY updated_at DESC').all()) as ProjectRow[];
  return accountJson({enabled:true,projects:rows.map(p=>record(p,user))});
 }catch{return accountError('Could not read project storage.',500);}
}
export async function POST(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;
 const max=SKF_LIMITS.archiveBytes+6*1024*1024;if(Number(request.headers.get('content-length')??0)>max)return accountError('Project upload is too large.',413);
 let pending:ProjectRow|null=null,committed=false;
 try{
  let bytes:Uint8Array,thumbnail:Uint8Array|null=null;
  if(request.headers.get('content-type')?.startsWith('multipart/form-data')){const form=await request.formData(),project=form.get('project'),image=form.get('thumbnail');if(!(project instanceof Blob))return accountError('Project file is required.');bytes=new Uint8Array(await project.arrayBuffer());if(image instanceof Blob)thumbnail=new Uint8Array(await image.arrayBuffer());}
  else bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.byteLength>SKF_LIMITS.archiveBytes)return accountError('Project upload is too large.',413);
  if(thumbnail&&(thumbnail.byteLength>5*1024*1024||![137,80,78,71,13,10,26,10].every((v,i)=>thumbnail![i]===v)))return accountError('Invalid PNG thumbnail.');
  const summary=await inspectSkfProjectPackage(bytes),requested=projectId(request),id=requested||randomUUID();if(!safeId(id))return accountError('Invalid project id.');
  const current=getProject(id),expected=etag(request);
  if(current&&!mayRead(current,user))return accountError('Project was not found.',404);
  if(current?.shared&&request.headers.get('x-scketch-publish')!=='true')return accountError('Publish an explicit shared version; autosave belongs in your private draft.',400);
  if(current&&(!expected||expected!==current.revision))return accountError('The server project changed. Your local edits are preserved; export SKF before reopening the latest server version.',409);
  if(!current&&expected)return accountError('The server project no longer exists. Your local copy is preserved.',409);
  const draftOf=new URL(request.url).searchParams.get('draftOf');const source=draftOf&&safeId(draftOf)?getProject(draftOf):null;
  const personalDraftOf=current?current.draft_of:(source?.shared&&mayRead(source,user)?draftOf:null);
  pending={id,owner_id:current?.owner_id??user.id,name:summary.projectName.trim().slice(0,200)||'Untitled project',shared:current?.shared??0,revision:randomUUID(),size:bytes.byteLength,updated_at:Date.now(),has_thumbnail:thumbnail?1:0,category:current?.category??'general',version:current?.shared?(current.version+1):(current?.version??0),draft_of:personalDraftOf,base_revision:personalDraftOf?(request.headers.get('x-base-revision')??current?.base_revision??null):null};
  await fs.mkdir(files(),{recursive:true,mode:0o700});await fs.writeFile(filePath(pending),bytes,{flag:'wx',mode:0o600});if(thumbnail)await fs.writeFile(filePath(pending,true),thumbnail,{flag:'wx',mode:0o600});
  const db=accountDb();db.exec('BEGIN IMMEDIATE');try{
   const latest=getProject(id);if(current?(!latest||latest.revision!==expected||!mayRead(latest,user)):!!latest)throw Error('conflict');
   if(pending.draft_of){const parent=getProject(pending.draft_of);if(!parent?.shared||!mayRead(parent,user)||latest&&latest.draft_of===null){pending.draft_of=null;pending.base_revision=null;}}
   if(current)db.prepare('UPDATE projects SET name=?,revision=?,size=?,updated_at=?,has_thumbnail=?,version=?,base_revision=?,draft_of=? WHERE id=?').run(pending.name,pending.revision,pending.size,pending.updated_at,pending.has_thumbnail,pending.version,pending.base_revision,pending.draft_of,id);
   else db.prepare('INSERT INTO projects(id,owner_id,name,shared,revision,size,updated_at,has_thumbnail,version,draft_of,base_revision) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,user.id,pending.name,0,pending.revision,pending.size,pending.updated_at,pending.has_thumbnail,0,pending.draft_of,pending.base_revision);
   if(current?.shared){db.prepare('INSERT INTO project_versions VALUES(?,?,?,?,?,?,?)').run(id,pending.version,pending.revision,user.id,pending.updated_at,pending.size,pending.has_thumbnail);recordActivity(id,user.id,'version',pending.version);}
   db.exec('COMMIT');committed=true;
  }catch(e){db.exec('ROLLBACK');if(e instanceof Error&&e.message==='conflict')return accountError('The server project changed while saving. Your local copy is preserved.',409);throw e;}
  // Keep the previous content revision as a recovery copy, and remove older versions.
  const historical=accountDb().prepare('SELECT revision FROM project_versions WHERE project_id=?').all(id) as {revision:string}[];const keep=new Set([pending.revision,current?.revision,...historical.map(r=>r.revision)]);const entries=await fs.readdir(files()).catch(()=>[]);await Promise.all(entries.filter(name=>name.startsWith(id+'.')&&!keep.has(name.split('.')[1])).map(async name=>{const full=path.join(files(),name);const stat=await fs.stat(full).catch(()=>null);if(stat&&stat.mtimeMs<Date.now()-5*60*1000)await fs.unlink(full).catch(()=>{});}));
  return accountJson({project:record(getProject(id)!,user)},current?200:201);
 }catch{return accountError('Could not save the project. Check the SKF file and storage.',400);}
 finally{if(pending&&!committed){await fs.unlink(filePath(pending)).catch(()=>{});await fs.unlink(filePath(pending,true)).catch(()=>{});}}
}
export async function PATCH(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;
 try{const id=projectId(request),row=safeId(id)?getProject(id):undefined;if(!row||!mayManage(row,user))return accountError('Only the owner or an administrator can change sharing.',403);
  const body=await request.json();
  if (typeof body.thumbnailDataUrl==='string') {
   if(etag(request)!==row.revision)return accountError('The project changed.',409);
   if(body.thumbnailDataUrl.length>7*1024*1024||!body.thumbnailDataUrl.startsWith('data:image/png;base64,'))return accountError('Invalid PNG thumbnail.');
   const bytes=Buffer.from(body.thumbnailDataUrl.slice(22),'base64');if(bytes.length>5*1024*1024||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return accountError('Invalid PNG thumbnail.');
   await fs.writeFile(filePath(row,true),bytes,{flag:'wx',mode:0o600}).catch(e=>{if(e.code!=='EEXIST')throw e;});
   const result=accountDb().prepare('UPDATE projects SET has_thumbnail=1 WHERE id=? AND revision=?').run(id,row.revision);if(!result.changes)return accountError('The project changed.',409);
   accountDb().prepare('UPDATE project_versions SET has_thumbnail=1 WHERE project_id=? AND revision=?').run(id,row.revision);return accountJson({project:record(getProject(id)!,user)});
  }
  if(body.shared!==undefined&&typeof body.shared!=='boolean')return accountError('Choose whether the project is shared.');if(body.name!==undefined&&(typeof body.name!=='string'||!body.name.trim()||body.name.length>200))return accountError('Enter a project name.');if(body.category!==undefined&&!['general','mechanical','enclosures','robotics','decor','tools'].includes(body.category))return accountError('Invalid project category.');if(body.shared===undefined&&body.name===undefined&&body.category===undefined)return accountError('Choose a project action.');
  if(etag(request)!==row.revision)return accountError('The project changed. Refresh before changing sharing.',409);
  const next=randomUUID(),db=accountDb();
  // Permissions have their own revision too: an editor cannot save a stale private/shared state.
  await fs.copyFile(filePath(row),filePath({...row,revision:next}));if(row.has_thumbnail)await fs.copyFile(filePath(row,true),filePath({...row,revision:next},true));
  const now=Date.now(),shared=body.shared===undefined?row.shared:body.shared?1:0,newVersion=body.shared===true&&!row.shared?row.version+1:row.version;
  db.exec('BEGIN IMMEDIATE');let updated;try{
   updated=db.prepare('UPDATE projects SET shared=?,name=?,category=?,revision=?,updated_at=?,version=? WHERE id=? AND revision=?').run(shared,body.name?.trim()??row.name,body.category??row.category,next,now,newVersion,id,row.revision);
   if(updated.changes&&row.shared&&!shared)db.prepare('UPDATE projects SET draft_of=NULL,base_revision=NULL WHERE draft_of=?').run(id);
   if(updated.changes&&newVersion>row.version){db.prepare('INSERT INTO project_versions VALUES(?,?,?,?,?,?,?)').run(id,newVersion,next,user.id,now,row.size,row.has_thumbnail);recordActivity(id,user.id,'published',newVersion);}else if(updated.changes&&row.shared&&body.category&&body.category!==row.category)recordActivity(id,user.id,'category',row.version);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  if(!updated.changes){await fs.unlink(filePath({...row,revision:next})).catch(()=>{});await fs.unlink(filePath({...row,revision:next},true)).catch(()=>{});return accountError('The project changed. Refresh before changing sharing.',409);}
  return accountJson({project:record(getProject(id)!,user)});
 }catch{return accountError('Could not change sharing.',400);}
}
export async function DELETE(request:Request){
 const user=requireAccount(request);if(user instanceof NextResponse)return user;
 const id=projectId(request),row=safeId(id)?getProject(id):undefined;if(!row)return accountError('Project was not found.',404);if(!mayManage(row,user))return accountError('Only the owner or an administrator can delete a server project.',403);
 if(etag(request)!==row.revision)return accountError('The project changed. Refresh before deleting.',409);
 const db=accountDb();db.exec('BEGIN IMMEDIATE');let result;try{result=db.prepare('DELETE FROM projects WHERE id=? AND revision=?').run(id,row.revision);if(result.changes)db.prepare('UPDATE projects SET draft_of=NULL,base_revision=NULL WHERE draft_of=?').run(id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}if(!result.changes)return accountError('The project changed. Refresh before deleting.',409);
 const entries=await fs.readdir(files()).catch(()=>[]);await Promise.all(entries.filter(n=>n.startsWith(id+'.')).map(n=>fs.unlink(path.join(files(),n)).catch(()=>{})));
 return accountJson({deleted:true,fileName:id+'.skf'});
}

async function importLegacyProjects(user:AccountUser){
 if(!user.legacyOwner)return;const db=accountDb();if(db.prepare("SELECT 1 FROM app_metadata WHERE key='legacy-projects-imported'").get())return;
 const root=process.env.SCKETCH3DWEB_SHARED_PROJECTS_DIR;if(!root)return;
 await fs.mkdir(files(),{recursive:true,mode:0o700});
 const entries=await fs.readdir(root,{withFileTypes:true});
 for(const entry of entries.filter(e=>e.isFile()&&/\.skf$/i.test(e.name))){
  const id='legacy-'+createHash('sha256').update(entry.name).digest('hex').slice(0,32);if(getProject(id))continue;
  const stat=await fs.stat(path.join(root,entry.name)),revision=randomUUID(),row={id,revision};
  await fs.link(path.join(root,entry.name),filePath(row));
  try{db.prepare('INSERT INTO projects(id,owner_id,name,shared,revision,size,updated_at,has_thumbnail,version,draft_of,base_revision) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,user.id,entry.name.replace(/\.skf$/i,''),0,revision,stat.size,stat.mtimeMs,0,0,null,null);}catch(e){await fs.unlink(filePath(row)).catch(()=>{});if(!getProject(id))throw e;}
 }
 db.prepare("INSERT OR IGNORE INTO app_metadata VALUES('legacy-projects-imported','1')").run();
}
