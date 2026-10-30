import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {OcctKernel} from '../../apps/web/public/occt/index.js';
const root=new URL('../../apps/web/public/assets/robot-rp1/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
await mkdir(new URL('meshes/',root),{recursive:true});await mkdir(new URL('previews/',root),{recursive:true});
const requested=process.argv.find(a=>a.startsWith('--part='))?.slice(7);
if(!requested){
 for(const model of manifest.models){const child=spawnSync(process.execPath,[new URL(import.meta.url).pathname,'--part='+model.code],{stdio:'inherit',env:process.env});if(child.status!==0)throw new Error('Conversion failed: '+model.code);Object.assign(model,JSON.parse(await readFile(new URL('meshes/'+model.code+'.metadata.json',root),'utf8')));}
 manifest.conversion='STEP to STL in millimeters; tessellation at 0.06 mm / 0.25 rad; XY recentered, Z bottom moved to zero (translation only, no scaling); zero-area triangles removed. Original STEP files are unchanged.';
 manifest.tessellation={linearDeflectionMm:.06,angularDeflectionRadians:.25};await writeFile(new URL('manifest.json',root),JSON.stringify(manifest,null,2)+'\n');await writeFile(new URL('../../apps/web/src/lib/robotCatalogData.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({status:'PASS',models:manifest.models.length,totalTriangles:manifest.models.reduce((n,m)=>n+m.triangleCount,0)}));process.exit(0);
}
const kernel=await OcctKernel.init({wasm:await readFile(new URL('../../apps/web/public/occt/occt-wasm.wasm',import.meta.url))});
for(const model of manifest.models.filter(m=>m.code===requested)){
 const shape=kernel.importStep(await readFile(new URL('source/'+model.code+'.step',root)));
 try {
  const mesh=kernel.tessellate(shape,{linearDeflection:.06,angularDeflection:.25}),p=mesh.positions,indices=mesh.indices;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++) {const axis=i%3;min[axis]=Math.min(min[axis],p[i]);max[axis]=Math.max(max[axis],p[i]);}
  const triangles=[];let removed=0;
  for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],a=ids.map(id=>Array.from(p.subarray(id*3,id*3+3))),u=a[1].map((v,k)=>v-a[0][k]),v=a[2].map((n,k)=>n-a[0][k]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);
   const keys=a.map(point=>point.map(n=>Math.round(n/1e-5)).join(','));if(new Set(keys).size<3||length<=1e-10){removed++;continue;}triangles.push({a,normal:normal.map(n=>n/length)});
  }
  const buffer=Buffer.alloc(84+triangles.length*50);buffer.write('RoboParty RP1 '+model.code+'; CERN-OHL-W-2.0; original STEP in source/');buffer.writeUInt32LE(triangles.length,80);let offset=84;
  for(const triangle of triangles){for(const n of triangle.normal){buffer.writeFloatLE(n,offset);offset+=4;}for(const point of triangle.a)for(let k=0;k<3;k++){buffer.writeFloatLE(point[k]-(k===2?min[k]:(min[k]+max[k])/2),offset);offset+=4;}offset+=2;}
  await writeFile(new URL('meshes/'+model.code+'.stl',root),buffer);
  const svg=kernel.toSVG(shape,'iso',{width:120,height:100,padding:8,showHidden:false,showGnomon:false,background:'transparent',visibleColor:'#708ca7',strokeWidth:1.2,deflection:.35});
  await writeFile(new URL('previews/'+model.code+'.svg',root),svg);
  Object.assign(model,{triangleCount:triangles.length,removedDegenerateTriangles:removed,meshBytes:buffer.length,meshSha256:createHash('sha256').update(buffer).digest('hex'),width:max[0]-min[0],depth:max[1]-min[1],height:max[2]-min[2]});
  await writeFile(new URL('meshes/'+model.code+'.metadata.json',root),JSON.stringify(model)+'\n');
  console.log(JSON.stringify({code:model.code,triangles:triangles.length,removed}));
 }finally{kernel.releaseAll();}
}
