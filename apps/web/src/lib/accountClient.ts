export type ClientAccount={id:string;username:string;displayName:string;role:'admin'|'user';legacyOwner:boolean;mcpAllowed?:boolean};
export type AccountProject={likes?:number;liked?:number;fileName:string;name:string;updatedAt:number;size:number;revision:string;thumbnailUrl?:string;ownerId:string;ownerName:string;shared:boolean;canManage:boolean;version:number;category:string;draftOf?:string|null;baseRevision?:string|null;draft?:AccountProject};
let account:ClientAccount|null=null;
export function setClientAccount(next:ClientAccount|null){account=next;}
export function getClientAccount(){return account;}
export function accountStorageKey(key:string){return account?`${key}.account.${account.id}`:key;}
export function accountDatabaseName(key:string){return account?.legacyOwner?key:accountStorageKey(key);}
const linksKey=()=>accountStorageKey('scketch3d.serverLinks');
export function accountProjectLinks():Record<string,AccountProject>{try{return JSON.parse(localStorage.getItem(linksKey())??'{}');}catch{return {};}}
export function linkAccountProject(localId:string,project:AccountProject){const links=accountProjectLinks();links[localId]=project;localStorage.setItem(linksKey(),JSON.stringify(links));}
const pausedProjects=new Set<string>();
const queues=new Map<string,Promise<void>>(),blocked=new Set<string>(),snapshots=new Map<string,Uint8Array>();
export function announceAccountStatus(message:string,error=false,projectId?:string){window.dispatchEvent(new CustomEvent('account-sync-status',{detail:{message,error,projectId}}));}
export function downloadPendingSnapshot(projectId:string){const bytes=snapshots.get(projectId);if(!bytes)return;const url=URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer],{type:'application/vnd.scketch3dweb.project+zip'}));const a=document.createElement('a');a.href=url;a.download='local-recovery.skf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function saveAccountSnapshot(projectId:string,bytes:Uint8Array){
 if(!account||pausedProjects.has(projectId)||isAccountProjectDeleted(projectId))return;
 snapshots.set(projectId,bytes);
 const previous=queues.get(projectId)??Promise.resolve();
 const pending=previous.catch(()=>{}).then(async()=>{
  if(blocked.has(projectId)||pausedProjects.has(projectId)||isAccountProjectDeleted(projectId))return;
  const link=accountProjectLinks()[projectId],target=link?.shared?link.draft:link,fileName=target?.fileName??`${link?.shared?'draft-':''}${projectId}.skf`;
  announceAccountStatus('Saving to your account…');
  const headers:Record<string,string>={'Content-Type':'application/vnd.scketch3dweb.project+zip'};if(target)headers['If-Match']=`"${target.revision}"`;else headers['If-None-Match']='*';
  if(link?.shared)headers['X-Base-Revision']=link.revision;
  try{
   const response=await fetch(`/api/shared-projects?fileName=${encodeURIComponent(fileName)}${link?.shared?'&draftOf='+encodeURIComponent(link.fileName.replace(/\.skf$/,'')):''}`,{method:'POST',headers,body:bytes.slice().buffer as ArrayBuffer});
   const payload=await response.json();if(!response.ok){if(response.status===409||response.status===404)blocked.add(projectId);throw Error(payload.error??'Could not save to your account.');}
   linkAccountProject(projectId,link?.shared&&payload.project.draftOf?{...link,draft:payload.project}:payload.project);snapshots.delete(projectId);announceAccountStatus(link?.shared?'Private draft saved. Publish a shared version when ready.':'Saved to your account');
  }catch(e){announceAccountStatus(e instanceof Error?e.message:'Could not save to your account.',true,projectId);}
 });queues.set(projectId,pending);await pending;if(queues.get(projectId)===pending)queues.delete(projectId);
}
export async function flushAccountProject(id:string){await queues.get(id);if(isAccountProjectDeleted(id)||pausedProjects.has(id))throw Error('This personal copy was deleted.');if(blocked.has(id))throw Error('The server project changed. Export your local SKF before reopening the latest server version.');}
export async function setAccountProjectSharing(id:string,shared:boolean){await flushAccountProject(id);const current=accountProjectLinks()[id];if(!current)throw Error('Wait for the project to finish saving.');const response=await fetch(`/api/shared-projects?fileName=${encodeURIComponent(current.fileName)}`,{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':`"${current.revision}"`},body:JSON.stringify({shared})});const payload=await response.json();if(!response.ok)throw Error(payload.error??'Could not change sharing.');linkAccountProject(id,payload.project);return payload.project as AccountProject;}

export async function publishAccountSnapshot(projectId:string,bytes:Uint8Array){
 await flushAccountProject(projectId);const link=accountProjectLinks()[projectId];
 if(!link?.shared){await saveAccountSnapshot(projectId,bytes);return setAccountProjectSharing(projectId,true);}
 snapshots.set(projectId,bytes);
 const r=await fetch(`/api/shared-projects?fileName=${encodeURIComponent(link.fileName)}`,{method:'POST',headers:{'Content-Type':'application/vnd.scketch3dweb.project+zip','If-Match':`"${link.revision}"`,'X-Scketch-Publish':'true'},body:bytes.slice().buffer as ArrayBuffer});const body=await r.json();
 if(!r.ok){announceAccountStatus(body.error??'Could not publish this version.',true,projectId);throw Error(body.error??'Could not publish this version.');}
 const updated={...body.project,draft:link.draft};linkAccountProject(projectId,updated);snapshots.delete(projectId);await saveAccountSnapshot(projectId,bytes);announceAccountStatus('Shared version published');return updated as AccountProject;
}

export async function updateAccountThumbnail(localId:string,dataUrl:string,published=false){
 await queues.get(localId);if(pausedProjects.has(localId)||isAccountProjectDeleted(localId))return;const link=accountProjectLinks()[localId],target=link?.shared&&!published?link.draft:link;if(!target)return;
 try{const r=await fetch(`/api/shared-projects?fileName=${encodeURIComponent(target.fileName)}`,{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':`"${target.revision}"`},body:JSON.stringify({thumbnailDataUrl:dataUrl})});if(r.ok){const body=await r.json(),latest=accountProjectLinks()[localId];if(latest?.revision===link.revision)linkAccountProject(localId,link.shared&&!published?{...latest,draft:body.project}:{...body.project,draft:latest.draft});}}catch{/* Local preview is retained until a later snapshot can retry. */}
}

export async function pauseAccountProjectForDeletion(localId:string){
 markAccountProjectDeleted(localId,true);
 pausedProjects.add(localId);
 await queues.get(localId);
}
export function resumeAccountProject(localId:string){pausedProjects.delete(localId);markAccountProjectDeleted(localId,false);}
export function forgetAccountProject(localId:string){
 const links=accountProjectLinks();delete links[localId];
 localStorage.setItem(linksKey(),JSON.stringify(links));
 blocked.delete(localId);snapshots.delete(localId);
}

export function reconcileAccountProjectLinks(mine:AccountProject[],shared:AccountProject[]){
 const links=accountProjectLinks();let changed=false;
 for(const [localId,link] of Object.entries(links)){
  if(!link.shared)continue;
  const draft=mine.find(project=>project.fileName===link.draft?.fileName);
  const stillShared=shared.some(project=>project.fileName===link.fileName);
  if(stillShared&&(!draft||draft.draftOf))continue;
  const personal=draft??mine.find(project=>project.fileName===link.fileName);
  if(personal)links[localId]=personal;else delete links[localId];
  blocked.delete(localId);changed=true;
 }
 if(changed)localStorage.setItem(linksKey(),JSON.stringify(links));
 return changed;
}

function deletedProjectIds():string[]{try{const value=JSON.parse(localStorage.getItem(accountStorageKey('scketch3d.deletedProjects'))??'[]');return Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'):[];}catch{return [];}}
export function isAccountProjectDeleted(localId:string){return deletedProjectIds().includes(localId);}
function markAccountProjectDeleted(localId:string,deleted:boolean){const ids=new Set(deletedProjectIds());if(deleted)ids.add(localId);else ids.delete(localId);localStorage.setItem(accountStorageKey('scketch3d.deletedProjects'),JSON.stringify([...ids]));}
