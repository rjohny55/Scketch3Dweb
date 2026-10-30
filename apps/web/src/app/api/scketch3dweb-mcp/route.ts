import {NextResponse} from 'next/server';
import {accountError,accountJson} from '@/lib/serverAccounts';
import {requireMcpBrowserAccount,requireMcpKey} from '@/lib/serverMcpAccounts';
import type {Scketch3DwebMcpApiPayload} from '@/lib/scketch3dwebMcpProtocol';
import {completeScketch3DwebMcpCommand,dispatchScketch3DwebMcpCommand,listScketch3DwebMcpEditors,registerScketch3DwebMcpEditor,waitForScketch3DwebMcpCommand} from '@/lib/scketch3dwebMcpStore';
import {SCKETCH3DWEB_MCP_LONG_POLL_TIMEOUT_MS} from '@/lib/scketch3dwebMcpProtocol';
import {mcpAccessError} from '@/lib/scketch3dwebMcpAccess';
export const runtime='nodejs';export const dynamic='force-dynamic';export const revalidate=false;
function blocked(request:Request){const error=mcpAccessError(request);return error?accountError(error.error,error.status):null;}
function isObject(value:unknown):value is Record<string,unknown>{return Boolean(value&&typeof value==='object'&&!Array.isArray(value));}
const editorIdValid=(id:unknown):id is string=>typeof id==='string'&&id.length>0&&id.length<=200;
function ownedEditors(userId:string){const prefix=userId+':';return listScketch3DwebMcpEditors().filter(e=>e.editorId.startsWith(prefix)).map(e=>({...e,editorId:e.editorId.slice(prefix.length)}));}
export async function GET(request:Request){
 const error=blocked(request);if(error)return error;const user=requireMcpKey(request);if(user instanceof NextResponse)return user;
 return accountJson({editors:ownedEditors(user.id)});
}
export async function POST(request:Request){
 const error=blocked(request);if(error)return error;
 if(Number(request.headers.get('content-length')??0)>2*1024*1024)return accountError('Request is too large.',413);
 let body:Scketch3DwebMcpApiPayload;try{body=await request.json();}catch{return accountError('Invalid Scketch3Dweb MCP request.');}
 if(!isObject(body)||typeof body.type!=='string')return accountError('Invalid Scketch3Dweb MCP request.');
 const user=body.type==='command'?requireMcpKey(request):requireMcpBrowserAccount(request);if(user instanceof NextResponse)return user;
 const scoped=(id:string)=>user.id+':'+id;
 if(body.type==='heartbeat'){
  if(!isObject(body.editor)||!editorIdValid(body.editor.editorId)||!Number.isInteger(body.editor.editorNumber)||typeof body.editor.projectName!=='string')return accountError('Invalid editor heartbeat.');
  registerScketch3DwebMcpEditor({...body.editor,editorId:scoped(body.editor.editorId)});return accountJson({ok:true,editors:ownedEditors(user.id)});
 }
 if(body.type==='poll'){
  if(!editorIdValid(body.editorId)||!ownedEditors(user.id).some(e=>e.editorId===body.editorId))return accountError('Editor was not found.',404);
  const command=await waitForScketch3DwebMcpCommand(scoped(body.editorId),{timeoutMs:SCKETCH3DWEB_MCP_LONG_POLL_TIMEOUT_MS,signal:request.signal});
  // A permission change during a long poll must not deliver the command.
  const current=requireMcpBrowserAccount(request);if(current instanceof NextResponse)return current;
  return accountJson({command});
 }
 if(body.type==='result'){
  if(!editorIdValid(body.editorId)||!isObject(body.result)||typeof body.result.commandId!=='string'||typeof body.result.ok!=='boolean')return accountError('Invalid command result.');
  return accountJson({ok:completeScketch3DwebMcpCommand(scoped(body.editorId),body.result)});
 }
 if(body.type==='command'){
  if(typeof body.action!=='string')return accountError('Invalid command action.');
  const editors=ownedEditors(user.id),editor=typeof body.editorId==='string'?editors.find(e=>e.editorId===body.editorId):typeof body.editorNumber==='number'?editors.find(e=>e.editorNumber===body.editorNumber):editors.length===1?editors[0]:undefined;
  if(!editor||(typeof body.editorNumber==='number'&&editor.editorNumber!==body.editorNumber))return accountError('No matching editor in your account.',404);
  const result=await dispatchScketch3DwebMcpCommand({editorId:scoped(editor.editorId),action:body.action,params:isObject(body.params)?body.params:{},timeoutMs:typeof body.timeoutMs==='number'?body.timeoutMs:undefined});
  return accountJson(result,result.ok?200:504);
 }
 return accountError('Unknown Scketch3Dweb MCP request.');
}
