import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import {Box3,Vector3} from 'three';
import {importedShapeFromTriangleSoup,importedShapeFromStl} from '@/lib/stlImport';
import {exportSkfProject,importSkfProject} from '@/lib/skfProject';
import {DEFAULT_WORKPLANE_WORKSPACE} from '@/lib/workplaneSettings';
import type {WorkplaneShape} from '@/types/scketch3dweb';
const root=process.cwd(),base=root+'/apps/web/public/assets/robot-rp1',folder=base+'/demo';await mkdir(folder,{recursive:true});
const layout=JSON.parse(await readFile(base+'/assembly/layout.json','utf8')),catalog=JSON.parse(await readFile(base+'/manifest.json','utf8'));
const shapes:WorkplaneShape[]=[],bounds=new Box3(),stl=new STLLoader();
const names:Record<string,string>={base_link:'Таз',waist_yaw_link:'Поясница — поворот',waist_roll_link:'Корпус и голова',hip_pitch:'Тазобедренный узел — наклон',hip_roll:'Тазобедренный узел — крен',hip_yaw:'Бедро — поворот',knee:'Колено',ankle_pitch:'Голеностоп — наклон',ankle_roll:'Стопа',shoulder_pitch:'Плечо — наклон',shoulder_roll:'Плечо — крен',shoulder_yaw:'Плечо — поворот',elbow:'Локоть',wrist_yaw:'Запястье — поворот',wrist_pitch:'Запястье — наклон',wrist_roll:'Кисть'};
for(const model of layout.models){
 const bytes=await readFile(base+'/assembly/'+model.path),geometry=stl.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),positions:number[]=[],p=geometry.getAttribute('position'),box=new Box3();
 for(let i=0;i<p.count;i++){
  const input=[p.getX(i)*model.scale[0],p.getY(i)*model.scale[1],p.getZ(i)*model.scale[2],1],v=model.matrix.slice(0,3).map((row:number[])=>row.reduce((n,x,k)=>n+x*input[k],0)*1000);
  const point=new Vector3(v[1],v[2],v[0]);positions.push(point.x,point.y,point.z);box.expandByPoint(point);
 }
 bounds.union(box);let label=names[model.link];if(model.link.startsWith('lh_')||model.link.startsWith('rh_')){const side=model.link.startsWith('lh_')?'Левая':'Правая',finger=model.link.match(/finger(\d)(\d)_link/);label=side+' кисть · '+(finger?['','Большой','Указательный','Средний','Безымянный','Мизинец'][Number(finger[1])]+' · сегмент '+finger[2]:'Ладонь');}if(!label){const key=model.link.replace(/^(left|right)_/,'').replace(/_link$/,'');label=(model.link.startsWith('left_')?'Левый':'Правый')+' · '+(names[key]??key);}
 const shape=importedShapeFromTriangleSoup(model.link,positions,undefined);Object.assign(shape,{id:'rp1-assembly-'+model.link,name:'RP1 · '+label,x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,elevation:box.min.y,color:/^(left_|lh_)/.test(model.link)?'#559dcc':/^(right_|rh_)/.test(model.link)?'#75b8c5':'#c4cbd2'});shapes.push(shape);geometry.dispose();
}
const floor=-bounds.min.y;for(const s of shapes)s.elevation=(s.elevation??0)+floor;
// Catalog specimens retain full geometry and their original scale. Pack a non-overlapping
// service kit beside the exact URDF assembly rather than guessing CAD mating transforms.
const startX=bounds.max.x+170,startZ=-520,rowWidth=1100,gap=28;let x=startX,z=startZ,rowDepth=0;
for(const model of catalog.models){
 if(x>startX&&x+model.width>startX+rowWidth){x=startX;z+=rowDepth+gap;rowDepth=0;}
 const bytes=await readFile(root+'/apps/web/public'+model.meshUrl),shape=importedShapeFromStl(model.code+'.stl',bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'z-up');
 Object.assign(shape,{id:'rp1-kit-'+model.id,name:'Комплект · '+model.code+' · '+model.ruName,x:x+model.width/2,z:z+model.depth/2,elevation:0,color:'#dfa34d'});shapes.push(shape);x+=model.width+gap;rowDepth=Math.max(rowDepth,model.depth);
}
const now=Date.UTC(2026,9,28),bytes=await exportSkfProject({projectId:'builtin-rp1-assembly-v1',projectName:'RP1 — сборка и комплект деталей',createdAt:now,modifiedAt:now,shapes,history:[],historyIndex:0,assets:[],workspace:{...DEFAULT_WORKPLANE_WORKSPACE,width:2600,depth:2000,sizePreset:'Custom',gridBlockSize:100,gridBlockPreset:'100 mm',showShadows:false},snapGrid:1,placementElevation:0,compressionLevel:6});
await writeFile(folder+'/rp1-assembly.skf',bytes);
const restored=await importSkfProject(bytes);if(restored.shapes.length!==layout.models.length+catalog.models.length)throw Error('Demo does not contain all assembly and catalog objects');
const summary={title:'RP1 — сборка и комплект деталей',file:'/assets/robot-rp1/demo/rp1-assembly.skf',assemblyObjects:layout.models.length,handObjects:layout.models.filter((m:any)=>/^(lh_|rh_)/.test(m.link)).length,catalogObjects:catalog.models.length,totalObjects:shapes.length,triangles:shapes.reduce((n,s)=>n+(s.importedMesh?.triangleCount??0),0),bytes:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex'),assemblyHeightMm:bounds.max.y-bounds.min.y,assemblyBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},assemblySource:'https://github.com/Roboparty/rp1_description/tree/d8c6dd03aeecc7f7ead3d962e09fedba4c8460f0',placement:'Exact zero-pose rp1_hand URDF assembly plus all51 catalog manufacturing parts in a separate, non-overlapping service kit. Manufacturing CAD and URDF versions are not asserted interchangeable.'};
await writeFile(folder+'/manifest.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({status:'PASS',...summary}));
