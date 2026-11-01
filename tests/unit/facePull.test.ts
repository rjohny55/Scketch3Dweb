import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {computeBoundsTree} from 'three-mesh-bvh';
import {facePullTriangles,pullFaceShape} from '@/lib/facePull';
import {annotatePlanarFace,faceGeometryKey} from '@/lib/faceAnnotations';
import {meshPrintReport} from '@/lib/meshPrintReport';
import {snapshotModelingJob} from '@/lib/modelingWorkerProtocol';
import {computeModelingJob} from '@/lib/modelingWorkerCompute';
import {deformRulerPoint,undeformRulerPoint} from '@/lib/rulerDeformation';
import {importSkfProject} from '@/lib/skfProject';
import type {WorkplaneShape} from '@/types/scketch3dweb';
const points=()=>Array.from(new THREE.BoxGeometry(20,10,12).toNonIndexed().getAttribute('position').array);
describe('pull a protected end by its face',()=>{
 it('does not move any original duct vertex beyond the local collar on the shipped CMP170 flange',async()=>{
  const doc=await importSkfProject(readFileSync('examples/cmp170-fan-adapter/cmp170-120mm-fan-adapter.skf'));
  const shape=doc.shapes.find(s=>s.importedMesh)!;
  const face=shape.faceAnnotations!.find(f=>f.name.includes('NVIDIA'))!;
  const source=shape.importedMesh!.positions;
  const normal=new THREE.Vector3(...face.localNormal).normalize().toArray() as [number,number,number];
  const plane=face.localPoint.reduce((sum,n,i)=>sum+n*normal[i],0);
  const result=facePullTriangles(source,normal,plane,{distance:7,keepFixed:2,keepMoving:2,transitionLength:1});
  let fixed=0,moving=0;
  for(let i=0;i<source.length;i+=3){const p=source.slice(i,i+3) as [number,number,number],d=p.reduce((sum,n,k)=>sum+n*normal[k],0);
   if(d>plane-3&&d<plane-2)continue;
   const mapped=result.mapPoint(p).map((n,k)=>n+result.rootShift[k]-(k===1?result.nextSize[1]/2:0));
   const weight=d<=plane-3?0:1;weight?moving++:fixed++;
   mapped.forEach((n,k)=>expect(Math.abs(n-p[k]-7*weight*normal[k])).toBeLessThan(1e-7));
  }
  expect(fixed).toBeGreaterThan(1000);expect(moving).toBeGreaterThan(100);
 });
 it.each([1,-1])('keeps the entire duct outside a 1 mm collar unchanged for end %s',sign=>{
  const r=facePullTriangles(points(),[sign,0,0],10,{distance:7,keepFixed:2,keepMoving:2,transitionLength:1});
  const raw=(p:[number,number,number])=>r.mapPoint(p).map((n,i)=>n+r.rootShift[i]-(i===1?r.nextSize[1]/2:0));
  for(const x of [-10,-8,0,5,7]){const p:[number,number,number]=[sign*x,2,3];const moved=raw(p);moved.forEach((n,i)=>expect(n).toBeCloseTo(p[i],8));}
  expect(raw([sign*7.5,0,0])[0]).toBeCloseTo(sign*11);
  for(const x of [8,9,10])expect(raw([sign*x,0,0])[0]).toBeCloseTo(sign*(x+7));
  expect(r.rulerMap?.high-r.rulerMap!.low).toBe(1);
 });
 it('never silently expands a local collar into the duct and refuses collapse',()=>{
  for(const transitionLength of [0,NaN,Infinity,17])expect(()=>facePullTriangles(points(),[1,0,0],10,{distance:7,keepFixed:2,keepMoving:2,transitionLength})).toThrow();
  expect(()=>facePullTriangles(points(),[1,0,0],10,{distance:-1,keepFixed:2,keepMoving:2,transitionLength:1})).toThrow();
 });
 it('keeps both circular rims and the through-channel intact on a hollow mounting tube',()=>{
  const source:number[]=[],N=24;
  const p=(r:number,y:number,i:number):[number,number,number]=>[r*Math.cos(i*2*Math.PI/N),y,r*Math.sin(i*2*Math.PI/N)];
  const quad=(a:number[],b:number[],c:number[],d:number[])=>source.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<N;i++){const j=i+1;quad(p(5,-10,i),p(5,10,i),p(5,10,j),p(5,-10,j));quad(p(3,-10,j),p(3,10,j),p(3,10,i),p(3,-10,i));quad(p(3,10,i),p(3,10,j),p(5,10,j),p(5,10,i));quad(p(3,-10,j),p(3,-10,i),p(5,-10,i),p(5,-10,j));}
  const result=facePullTriangles(source,[0,1,0],10,{distance:8,keepFixed:2,keepMoving:3});
  for(const r of [3,5])for(const y of [-10,10]){const mapped=result.mapPoint(p(r,y,0));expect(Math.hypot(mapped[0],mapped[2])).toBeCloseTo(r);expect(mapped[1]).toBeCloseTo(y<0?0:28);}
  const report=meshPrintReport([{vertices:Array.from({length:result.positions.length/3},(_,i)=>result.positions.slice(i*3,i*3+3) as [number,number,number]),faces:Array.from({length:result.positions.length/9},(_,i)=>[i*3,i*3+1,i*3+2])}]);
  expect(report.basicChecksPass,JSON.stringify(report)).toBe(true);
 });
 it.each([1,-1])('moves the %s end rigidly while keeping its opposite fixed',sign=>{
  const r=facePullTriangles(points(),[sign,0,0],10,{distance:7,keepFixed:2,keepMoving:3});
  // Undo normalization to compare raw local positions.
  const world=(p:[number,number,number])=>{const q=r.mapPoint(p);return q.map((n,i)=>n+r.rootShift[i]-(i===1?r.nextSize[1]/2:0));};
  expect(world([-10*sign,0,0])[0]).toBeCloseTo(-10*sign);
  expect(world([10*sign,0,0])[0]).toBeCloseTo(17*sign);
  const a=world([8*sign,2,3]),b=world([10*sign,-2,3]);
  expect(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))).toBeCloseTo(Math.sqrt(20));
  expect(r.nextSize).toEqual([27,10,12]);
  const report=meshPrintReport([{vertices:Array.from({length:r.positions.length/3},(_,i)=>r.positions.slice(i*3,i*3+3) as [number,number,number]),faces:Array.from({length:r.positions.length/9},(_,i)=>[i*3,i*3+1,i*3+2])}]);
  expect(report.basicChecksPass,JSON.stringify(report)).toBe(true);
 });
 it('supports shortening and rejects collapse, recessed faces, invalid normals and non-finite inputs',()=>{
  expect(facePullTriangles(points(),[1,0,0],10,{distance:-5,keepFixed:2,keepMoving:3}).nextSize[0]).toBe(15);
  for(const distance of [-15,NaN,Infinity,10001])expect(()=>facePullTriangles(points(),[1,0,0],10,{distance,keepFixed:2,keepMoving:3})).toThrow();
  expect(()=>facePullTriangles(points(),[1,0,0],5,{distance:2,keepFixed:2,keepMoving:2})).toThrow(/outer end/);
  expect(()=>facePullTriangles(points(),[0,0,0],0,{distance:2,keepFixed:2,keepMoving:2})).toThrow();
 });
 it('preserves physical pose, labels, ruler bindings and matches the worker result on a rotated part',()=>{
  const shape:WorkplaneShape={id:'part',name:'Mount',kind:'box',color:'#0098c7',width:20,height:10,depth:12,size:20,x:30,z:40,elevation:2,rotation:37,rotationX:23};
  const root=new THREE.Group();root.position.set(30,7,40);root.rotation.set(23*Math.PI/180,37*Math.PI/180,0);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,10,12));mesh.userData.shapeSurface=true;root.add(mesh);root.updateMatrixWorld(true);computeBoundsTree.call(mesh.geometry,{targetLeafSize:12});
  let index=-1;const ix=mesh.geometry.getIndex()!,a=mesh.geometry.getAttribute('position');for(let i=0;i<ix.count/3;i++){const p=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(a,ix.getX(3*i+k)));if(p.every(v=>Math.abs(v.x-10)<1e-5)){index=i;break;}}
  const face={...annotatePlanarFace(mesh,index,root.localToWorld(new THREE.Vector3(10,0,0))),name:'Mount'};shape.faceAnnotations=[face];shape.facePaints=[{...face,id:'paint',color:'#ff0000'}];
  const options={face,distance:7,keepFixed:2,keepMoving:3};
  const updated=pullFaceShape(shape,root,options);
  const next=new THREE.Object3D();next.position.set(updated.x,updated.elevation!+updated.height/2,updated.z);next.rotation.copy(root.rotation);next.updateMatrixWorld(true);
  expect(next.localToWorld(new THREE.Vector3(-13.5,0,0)).distanceTo(root.localToWorld(new THREE.Vector3(-10,0,0)))).toBeLessThan(1e-6);
  expect(next.localToWorld(new THREE.Vector3(13.5,0,0)).distanceTo(root.localToWorld(new THREE.Vector3(17,0,0)))).toBeLessThan(1e-6);
  expect(updated.faceAnnotations![0].id).toBe(face.id);expect(updated.facePaints![0].color).toBe('#ff0000');
  const p:[number,number,number]=[.5,0,0],deformed=deformRulerPoint(p,updated.rulerDeformations);expect(deformed[0]).toBeCloseTo(.5);expect(undeformRulerPoint(deformed,updated.rulerDeformations)[0]).toBeCloseTo(p[0]);
  const result=computeModelingJob({id:1,...snapshotModelingJob(shape,root,{kind:'pull-face',options})});expect(result.positions.length).toBe(updated.importedMesh!.positions.length);expect(Math.max(...Array.from(result.positions,(v,i)=>Math.abs(v-updated.importedMesh!.positions[i])))).toBeLessThan(1e-6);
  expect(()=>pullFaceShape(shape,root,{...options,face:{...face,geometryKey:'stale'}})).toThrow(/stale/);
  expect(()=>pullFaceShape({...shape,locked:true},root,options)).toThrow();
  expect(face.geometryKey).toBe(faceGeometryKey(mesh.geometry));
 });
});
