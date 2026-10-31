import {_electron as electron} from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

const base=process.env.FLANGE_DEMO_URL||'http://127.0.0.1:3002';
const executablePath=path.resolve('node_modules/electron/dist/electron');
const env={...process.env,SCKETCH3DWEB_DESKTOP_DEV_URL:base};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath,args:[path.resolve('apps/desktop/main.cjs'),'--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],env,timeout:60000});
try{
 const page=await app.firstWindow({timeout:60000});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1600,height:1000});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{localStorage.setItem('scketch3dweb.language','en');localStorage.setItem('scketch3Dweb.theme','blue-violet-dark');});
 const password=randomBytes(24).toString('hex');
 const setup=await page.request.post(base+'/api/auth',{data:{action:'setup',username:'flange-demo',displayName:'Demo Studio',password}});
 if(!setup.ok()){
  const current=await page.request.get(base+'/api/auth');
  if(!(await current.json()).user)throw Error('Screenshot account is not authenticated: '+setup.status());
 }
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('[data-open-demo="cmp170-fan-adapter"]').click();
 await page.getByRole('textbox',{name:'Project name',exact:true}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Face labels',exact:true}).waitFor();
 await page.waitForFunction(()=>typeof window.scketch3dwebReadFaceAnnotations==='function');
 await page.locator('canvas').first().click({position:{x:20,y:20}});
 await page.keyboard.press('Home');
 await page.waitForTimeout(2500);
 const faces=await page.evaluate(()=>window.scketch3dwebReadFaceAnnotations());
 const rulers=await page.evaluate(()=>window.scketch3dwebReadRulerMeasurements());
 if(faces.annotations.length!==2||faces.annotations.some(a=>a.status!=='valid'))throw Error('Demo flange labels are invalid');
 if(Math.abs(rulers.segments[0]?.lengthMm-74.4)>.001)throw Error('Fitted ruler is wrong');
 const output=path.resolve('examples/cmp170-fan-adapter');
 await page.screenshot({path:path.join(output,'editor-preview.png')});
 await page.screenshot({path:path.join(output,'preview.png'),clip:{x:400,y:250,width:760,height:650}});
 fs.mkdirSync('dist/desktop',{recursive:true});
 fs.writeFileSync('dist/desktop/flange-demo-browser-proof.json',JSON.stringify({openedFromDashboard:true,faces,rulers,pageErrors:errors},null,2));
 if(errors.length)throw Error('Browser errors: '+errors.join('; '));
 console.log(JSON.stringify({openedFromDashboard:true,editableMesh:true,validFlanges:2,rulerMm:rulers.segments[0].lengthMm,pageErrors:errors,screenshot:path.join(output,'editor-preview.png')}));
}finally{await app.close();}
