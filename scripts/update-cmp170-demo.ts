// Refresh the public example from an owner-selected local project. No accounts or old history are copied.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {importSkfProject,exportSkfProject} from '../apps/web/src/lib/skfProject';
import {resizedImportedMeshPositions,meshYawDegrees,shapeHasTaper,mirroredAxisCount} from '../apps/web/src/lib/workplaneShapes';
import {exportMeshesToStl} from '../apps/web/src/lib/stlExport';
import {meshPrintReport} from '../apps/web/src/lib/meshPrintReport';

async function main(){
 const source=fs.readFileSync(process.argv[2]),buffer=source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength) as ArrayBuffer;
 const project=await importSkfProject(buffer);if(project.shapes.length!==1)throw Error('Expected one owner-approved flange');
 const shape=project.shapes[0];if(!shape.importedMesh||shapeHasTaper(shape)||mirroredAxisCount(shape))throw Error('Only a complete unmirrored mesh is supported by this import script');
 shape.id='cmp170-fan-adapter-mesh';shape.name='CMP 170 · 120 mm fan adapter';shape.locked=false;
 for(const face of shape.faceAnnotations??[])face.name=face.localNormal[0]<0?'NVIDIA CMP 170 flange':'120 mm fan flange';
 const data=await exportSkfProject({projectId:'demo-cmp170-120mm-fan-adapter',projectName:shape.name,createdAt:Date.parse('2026-10-28T06:51:33.533Z'),modifiedAt:Date.parse('2026-10-31T18:10:37.360Z'),shapes:[shape],history:[],historyIndex:0,assets:[],workspace:project.workspace,snapGrid:project.snapGrid,placementElevation:project.placementElevation,placementWorkplane:project.placementWorkplane,sketchPlacementWorkplane:project.sketchPlacementWorkplane,rulers:project.rulers});
 const positions=resizedImportedMeshPositions(shape),vertices:[number,number,number][]=[],faces:[number,number,number][]=[];
 const rotation=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...[shape.rotationX??0,meshYawDegrees(shape),shape.rotationZ??0].map(THREE.MathUtils.degToRad) as [number,number,number],'XYZ'));
 for(let i=0;i<positions.length;i+=3){const v=new THREE.Vector3(positions[i],positions[i+1]-shape.height/2,positions[i+2]).applyMatrix4(rotation);vertices.push([v.x+shape.x,v.y+(shape.elevation??0)+shape.height/2,v.z+shape.z]);}
 for(let i=0;i<vertices.length;i+=3)faces.push([i,i+1,i+2]);
 const report=meshPrintReport([{vertices,faces}]);if(report.nonFiniteTriangles)throw Error('Non-finite owner mesh');
 const stl=Buffer.from(exportMeshesToStl([{vertices,faces}])),sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
 const first=project.rulers.segments[0],a=project.rulers.points.find(p=>p.id===first?.startId),b=project.rulers.points.find(p=>p.id===first?.endId);
 const distance=a&&b?Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z):null;
 const dir='examples/cmp170-fan-adapter';fs.writeFileSync(dir+'/cmp170-120mm-fan-adapter.skf',data);fs.writeFileSync(dir+'/cmp170-120mm-fan-adapter.stl',stl);
 const sizes=report.bounds!.size;
 const manifest={id:'cmp170-fan-adapter',name:shape.name,description:'Owner-fitted flange adapter for a 120 × 120 mm fan and NVIDIA CMP 170, in its editing orientation.',units:'mm',fanSizeMm:[120,120],rulerDistanceMm:distance,rulerCount:project.rulers.segments.length,axialSpanMm:sizes[0],boundsZUpMm:sizes,triangleCount:faces.length,orientation:{rotationX:shape.rotationX??0,rotationY:meshYawDegrees(shape),rotationZ:shape.rotationZ??0},geometrySha256:sha(stl.subarray(80)),basicMeshChecksPass:report.basicChecksPass,files:{project:'cmp170-120mm-fan-adapter.skf',mesh:'cmp170-120mm-fan-adapter.stl',preview:'preview.png'},sha256:{project:sha(data),mesh:sha(stl)},sourceSha256:{project:sha(source)}};
 fs.writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({orientation:manifest.orientation,triangleCount:manifest.triangleCount,bounds:manifest.boundsZUpMm,rulerCount:manifest.rulerCount,basicChecks:report}));
}
void main();
