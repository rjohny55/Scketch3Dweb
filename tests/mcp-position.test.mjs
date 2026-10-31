import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {callTool,tools,withMcpAccount} from '../scripts/scketch3dweb-mcp-server.mjs';

const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const args={editorNumber:12345,id:'part',expectedFingerprint:'current',fixedFaceId:'fixed',movingFaceId:'moving',horizontalMm:-7,verticalMm:-2.5};
test('absolute positioning tool exposes required dimensions and preview',()=>{
 const tool=tools.find(t=>t.name==='scketch3dweb_set_connection_position');
 assert.ok(tool.inputSchema.required.includes('horizontalMm'));
 assert.ok(tool.inputSchema.required.includes('verticalMm'));
 assert.ok(tool.inputSchema.required.includes('expectedFingerprint'));
 assert.equal(tool.inputSchema.properties.preview.type,'boolean');
});
test('maps human axes to guarded floor targets, never incremental offsets',async()=>{
 let sent;
 globalThis.fetch=async(_url,init)=>{sent=JSON.parse(init.body);return Response.json({ok:true,data:{preview:true}});};
 const result=await withMcpAccount({authorization:'Bearer test',userId:'test'},()=>callTool('scketch3dweb_set_connection_position',{...args,preview:true,fixedHorizontalEdge:'max',mode:'offset',coordinateSystem:'local'}));
 assert.deepEqual(result,{preview:true});
 assert.equal(sent.action,'modeling_command');
 assert.equal(sent.params.operation,'offset_connection');
 assert.equal(sent.params.mode,'position');
 assert.equal(sent.params.coordinateSystem,'floor');
 assert.equal(sent.params.offsetU,-2.5);
 assert.equal(sent.params.offsetV,-7);
 assert.equal(sent.params.fixedAnchorV,'max');
 assert.equal(sent.params.movingAnchorU,'min');
 assert.equal(sent.params.expectedFingerprint,'current');
 assert.equal(sent.params.preview,true);
});
test('rejects missing axes, NaN, strings, excessive distances and invalid edges before issuing commands',async()=>{
 globalThis.fetch=async()=>{throw Error('Must not send a command');};
 for(const bad of [{verticalMm:undefined},{horizontalMm:NaN},{horizontalMm:'-7'},{verticalMm:10001},{movingVerticalEdge:'bottom'}]){
  await assert.rejects(withMcpAccount({authorization:'Bearer test',userId:'test'},()=>callTool('scketch3dweb_set_connection_position',{...args,...bad})),/finite distance|Reference edge/);
 }
});
