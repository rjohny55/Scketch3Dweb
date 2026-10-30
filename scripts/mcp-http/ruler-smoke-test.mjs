import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..');
const output=path.join(root,'verification/ruler');await mkdir(output,{recursive:true});
const url=process.env.SCKETCH3DWEB_TEST_WEB_URL||'http://127.0.0.1:31882';
const endpoint=process.env.SCKETCH3DWEB_TEST_MCP_URL||'http://127.0.0.1:31883/mcp';
const browser=await chromium.connectOverCDP(process.env.SCKETCH3DWEB_BROWSER_CDP||'http://127.0.0.1:9239');
const context=await browser.newContext({viewport:{width:1500,height:1050}});
await context.addInitScript(()=>localStorage.setItem('scketch3dweb.language','en'));
const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const client=new Client({name:'ruler-browser-test',version:'1'});const report={checks:[],errors};
async function call(name,args={}){const r=await client.callTool({name,arguments:args},undefined,{timeout:60000});assert(!r.isError,JSON.stringify(r));return JSON.parse(r.content[0].text);}
try{
 await page.goto(url+'/?editor=1',{waitUntil:'domcontentloaded'});await page.locator('canvas').first().waitFor({timeout:120000});
 await client.connect(new StreamableHTTPClientTransport(new URL(endpoint),{requestInit:{headers:{Authorization:`Bearer ${process.env.SCKETCH3DWEB_MCP_TOKEN}`}}}));
 const tools=await client.listTools();assert(tools.tools.some(t=>t.name==='scketch3dweb_read_measurements'));report.toolCount=tools.tools.length;
 let editors;for(let i=0;i<30;i++){editors=(await call('scketch3dweb_list_editors')).editors;if(editors.length)break;await page.waitForTimeout(500);}
 assert(editors.length>=1);editors.sort((a,b)=>b.lastSeen-a.lastSeen);const target={editorNumber:editors[0].editorNumber};
 const empty=await call('scketch3dweb_read_measurements',target);assert(empty.available);assert.equal(empty.segmentCount,0);report.checks.push('Empty ruler is supported, not an unavailable old client');
 await page.getByRole('button',{name:'Ruler tools',exact:true}).click();await page.getByRole('button',{name:'Add measurement',exact:true}).click();
 const rect=await page.locator('canvas').first().boundingBox();assert(rect);
 await page.mouse.click(rect.x+rect.width*.40,rect.y+rect.height*.64);
 await page.mouse.click(rect.x+rect.width*.60,rect.y+rect.height*.64);
 await page.locator('.ruler-label').first().waitFor();
 const labels=await page.locator('.ruler-label').allTextContents();
 const snapshot=await call('scketch3dweb_read_measurements',target);
 assert.equal(snapshot.segmentCount,1);assert.equal(snapshot.units,'mm');assert(snapshot.segments[0].lengthMm>0);
 assert.equal(snapshot.segments[0].label,labels[0].trim());
 const [a,b]=[snapshot.segments[0].start,snapshot.segments[0].end];
 assert(Math.abs(snapshot.segments[0].lengthMm-Math.hypot(...b.map((v,i)=>v-a[i])))<1e-8);
 const scene=await call('scketch3dweb_read_scene',target);assert.deepEqual(scene.measurements,snapshot);
 report.measurements=snapshot;report.checks.push('Real pointer-created ruler: exact MCP label equals the rendered DOM; coordinates reproduce the length; read_scene includes it');
 const firstPoints=JSON.stringify(snapshot.points);
 for(const includeMeasurements of [false,true]){
  const r=await client.callTool({name:'scketch3dweb_capture_image',arguments:{...target,face:'current',includeMeasurements}});assert(!r.isError,JSON.stringify(r));
  const im=r.content.find(c=>c.type==='image');assert(im);await writeFile(path.join(output,includeMeasurements?'with-ruler.png':'without-ruler.png'),Buffer.from(im.data,'base64'));
 }
 const after=await call('scketch3dweb_read_measurements',target);assert.equal(JSON.stringify(after.points),firstPoints);assert.equal(after.segments[0].lengthMm,snapshot.segments[0].lengthMm);
 await page.screenshot({path:path.join(output,'browser-ruler.png')});report.checks.push('MCP captures plain and ruler-composited PNGs without moving points or changing camera');
 await page.getByRole('button',{name:'Move measurement points',exact:true}).click();
 const point=page.locator('.ruler-point').last();const pointRect=await point.boundingBox();assert(pointRect);
 await page.mouse.move(pointRect.x+pointRect.width/2,pointRect.y+pointRect.height/2);await page.mouse.down();await page.mouse.move(pointRect.x+pointRect.width/2+55,pointRect.y+pointRect.height/2,{steps:8});await page.mouse.up();
 const moved=await call('scketch3dweb_read_measurements',target);assert.notEqual(moved.segments[0].lengthMm,snapshot.segments[0].lengthMm);assert.equal(moved.segments[0].label,(await page.locator('.ruler-label').first().innerText()).trim());report.checks.push('Moving a real ruler point refreshes exact values and labels');
 await page.getByRole('button',{name:'Delete measurement part',exact:true}).click();const lineRect=await page.locator('.ruler-segment-hit').first().evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});await page.mouse.click(lineRect.x+lineRect.width/2,lineRect.y+lineRect.height/2);
 const removed=await call('scketch3dweb_read_measurements',target);assert.equal(removed.segmentCount,0);report.checks.push('Deleting the UI measurement removes it from MCP');
 assert.equal(errors.length,0);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;throw e;}
finally{await writeFile(path.join(output,'BROWSER_VALIDATION.json'),JSON.stringify(report,null,2));await client.close();await context.close();await browser.close();}
console.log(JSON.stringify(report,null,2));
