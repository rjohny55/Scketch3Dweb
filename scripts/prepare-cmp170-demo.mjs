// One-time import of the owner's fitted model. Geometry payloads stay unchanged.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';

const [sourceSkf,sourceStl]=process.argv.slice(2);
if(!sourceSkf||!sourceStl)throw Error('Usage: node scripts/prepare-cmp170-demo.mjs <fitted.skf> <fitted.stl>');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const skf=fs.readFileSync(sourceSkf),stl=fs.readFileSync(sourceStl);
if(sha(skf)!=='90db3257104ba7c2210b5816c05c8f74a039df7ffc53e39982b99fc00cb86a78'||sha(stl)!=='9cd05faf01ac19ee86cbd0cf46f0bc197760eba39b9ba5c910188ca2c36a732d')throw Error('Input is not the verified final 74.4 mm model');
const entries=unzipSync(skf),project=JSON.parse(strFromU8(entries['project.json']));
project.schema='com.scketch3dweb.project';
project.createdWithVersion='1.0.11';
project.metadata.projectId='demo-cmp170-120mm-fan-adapter';
project.metadata.projectName='CMP 170 · 120 mm fan adapter';
project.metadata.modifiedAt='2026-10-31T00:00:00.000Z';
for(const asset of project.assets)asset.mediaType=asset.mediaType.replace('sketchforge','scketch3dweb');
for(const state of project.states)for(const node of state.nodes){
 const shape=node.definition;
 if(!shape)continue;
 shape.name='CMP 170 · 120 mm fan adapter';
 for(const annotation of shape.faceAnnotations??[])annotation.name=annotation.localNormal[0]<0?'NVIDIA CMP 170 flange':'120 mm fan flange';
}
const shape=project.states.find(s=>s.id===project.sceneStateId).nodes[0].definition;
const points=[{id:'fan-end',x:51.58233483656251,y:13,z:50},{id:'gpu-end',x:-22,y:13,z:39}];
project.editor.rulers={points:points.map(p=>({...p,attachment:{shapeId:shape.id,kind:'surface',normalized:[(p.x-shape.x)/shape.width,(p.y-shape.height/2-(shape.elevation||0))/shape.height,(p.z-shape.z)/shape.depth]}})),segments:[{id:'fitted-distance',startId:'fan-end',endId:'gpu-end'}]};
entries['project.json']=strToU8(JSON.stringify(project).replaceAll(shape.id,'cmp170-fan-adapter-mesh'));
const normalizedStl=Buffer.from(stl);
normalizedStl.fill(0,0,80);
normalizedStl.write('Scketch3Dweb | CMP 170 120 mm fan adapter | millimeters | Z-up',0,'ascii');
if(!normalizedStl.subarray(80).equals(stl.subarray(80)))throw Error('STL geometry changed');
const output=path.resolve('examples/cmp170-fan-adapter');fs.mkdirSync(output,{recursive:true});
const targetSkf=zipSync(entries,{level:9});
fs.writeFileSync(path.join(output,'cmp170-120mm-fan-adapter.skf'),targetSkf);
fs.writeFileSync(path.join(output,'cmp170-120mm-fan-adapter.stl'),normalizedStl);
const manifest={id:'cmp170-fan-adapter',name:'CMP 170 · 120 mm fan adapter',description:'Flange adapter connecting a 120 × 120 mm fan to an NVIDIA CMP 170 graphics card.',units:'mm',fanSizeMm:[120,120],rulerDistanceMm:74.4,lateralOffsetMm:11,axialSpanMm:73.58233483656251,boundsZUpMm:[73.58233642578125,120,133],triangleCount:37256,geometrySha256:sha(stl.subarray(80)),files:{project:'cmp170-120mm-fan-adapter.skf',mesh:'cmp170-120mm-fan-adapter.stl',preview:'preview.png'},sha256:{project:sha(targetSkf),mesh:sha(normalizedStl)},sourceSha256:{project:sha(skf),mesh:sha(stl)}};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,trianglePayload:'unchanged',meshAssets:'unchanged',triangleCount:manifest.triangleCount}));
