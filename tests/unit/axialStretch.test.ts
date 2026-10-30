import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { computeBoundsTree } from 'three-mesh-bvh';
import { axialStretchMap, stretchShape, stretchTriangles, type AxialStretchOptions } from '@/lib/axialStretch';
import { meshPrintReport } from '@/lib/meshPrintReport';
import { annotatePlanarFace, faceGeometryKey, measureAnnotatedFace } from '@/lib/faceAnnotations';
import { exportSkfProject, importSkfProject } from '@/lib/skfProject';
import { editorHistoryEntry } from '@/lib/editorHistory';
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from '@/lib/workplaneSettings';
import type { WorkplaneShape } from '@/types/scketch3dweb';
const settings:AxialStretchOptions={axis:'x',target:34,keepStart:3,keepEnd:4,anchor:'start'};
const report=(p:number[])=>meshPrintReport([{vertices:Array.from({length:p.length/3},(_,i)=>p.slice(3*i,3*i+3) as [number,number,number]),faces:Array.from({length:p.length/9},(_,i)=>[3*i,3*i+1,3*i+2])}]);
function fixture(){
 const shape:WorkplaneShape={id:'a',name:'Box',kind:'box',color:'#0098c7',width:20,height:10,depth:12,size:20,x:30,z:40,elevation:2,rotation:0};
 const geometry=new THREE.BoxGeometry(20,10,12);geometry.translate(0,5,0);
 const root=new THREE.Group();root.position.set(30,7,40);const surface=new THREE.Mesh(geometry);surface.position.y=-5;surface.userData.shapeSurface=true;root.add(surface);root.updateMatrixWorld(true);
 return {shape,root,surface};
}
describe('protected-end axial stretch',()=>{
 it('splits large triangles at both boundaries and preserves a closed, consistently oriented solid',()=>{
  const raw=Array.from(new THREE.BoxGeometry(20,10,12).toNonIndexed().getAttribute('position').array);
  const result=stretchTriangles(raw,settings),r=report(result.positions);
  expect(r.basicChecksPass,JSON.stringify(r)).toBe(true);expect(r.bounds!.size).toEqual([34,12,10]);
  expect(result.positions.length).toBeGreaterThan(raw.length);
  const map=axialStretchMap(20,settings);expect(map(0)).toBe(0);expect(map(3)).toBe(3);expect(map(16)).toBe(30);expect(map(20)).toBe(34);
  expect(map(2)-map(1)).toBe(1);expect(map(19)-map(18)).toBe(1);
 });
 it.each(['x','y','z'] as const)('supports contraction and repeated expansion along %s without seams',axis=>{
  let p=Array.from(new THREE.BoxGeometry(20,20,20).toNonIndexed().getAttribute('position').array);
  for(const target of [12,32,18]){const result=stretchTriangles(p,{...settings,axis,target});p=result.positions;expect(report(p).basicChecksPass).toBe(true);expect(result.nextSize[['x','y','z'].indexOf(axis)]).toBe(target);}
 });
 it('rejects inversion, empty input, invalid numbers and a collapsed middle',()=>{
  for(const target of [0,-1,7,NaN])expect(()=>axialStretchMap(20,{...settings,target})).toThrow();
  expect(()=>axialStretchMap(20,{...settings,keepStart:17})).toThrow();
  expect(()=>stretchTriangles([],settings)).toThrow();
 });
 it.each(['start','center','end'] as const)('keeps the selected %s reference even with rotation and mirrors',anchor=>{
  const {shape,root}=fixture();shape.rotation=37;shape.rotationX=23;shape.mirrorX=true;root.rotation.set(23*Math.PI/180,37*Math.PI/180,0);root.scale.x=-1;root.updateMatrixWorld(true);
  const point=new THREE.Vector3(anchor==='start'?-10:anchor==='end'?10:0,0,0).applyMatrix4(root.matrixWorld);
  const updated=stretchShape(shape,root,{...settings,anchor});
  const next=new THREE.Object3D();next.position.set(updated.x,updated.elevation!+updated.height/2,updated.z);next.rotation.copy(root.rotation);next.scale.copy(root.scale);next.updateMatrixWorld();
  const same=new THREE.Vector3(anchor==='start'?-17:anchor==='end'?17:0,0,0).applyMatrix4(next.matrixWorld);
  expect(same.distanceTo(point)).toBeLessThan(1e-8);expect(shape.width).toBe(20);expect(updated.width).toBe(34);
 });
 it('bakes actual mesh scale and preserves end labels, painted regions and SKF serialization',async()=>{
  const {shape,root,surface}=fixture();computeBoundsTree.call(surface.geometry,{targetLeafSize:12});
  const label={...annotatePlanarFace(surface,0,new THREE.Vector3(40,7,40)),name:'Mount'};shape.faceAnnotations=[label];shape.facePaints=[{...label,id:'paint',color:'#ff0000'}];
  const old=measureAnnotatedFace(surface,label);const updated=stretchShape(shape,root,settings);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(updated.importedMesh!.positions,3));computeBoundsTree.call(geometry,{targetLeafSize:12});const next=new THREE.Mesh(geometry);next.updateMatrixWorld();
  const reading=measureAnnotatedFace(next,updated.faceAnnotations![0]);expect(reading.status).toBe('valid');if(reading.status==='valid' && old.status==='valid')expect(reading.areaMm2).toBeCloseTo(old.areaMm2,5);
  expect(updated.facePaints![0].geometryKey).toBe(faceGeometryKey(geometry));expect(updated.facePaints![0].color).toBe('#ff0000');expect(updated.facePaints![0].triangleIndices.length).toBeGreaterThan(0);expect(report(updated.importedMesh!.positions).basicChecksPass).toBe(true);
  const file=await exportSkfProject({projectId:'stretch',projectName:'Stretch',createdAt:1,modifiedAt:2,shapes:[updated],history:[editorHistoryEntry([updated],[])],historyIndex:0,assets:[],workspace:DEFAULT_WORKPLANE_WORKSPACE,snapGrid:DEFAULT_SNAP_GRID,placementElevation:0});
  expect((await importSkfProject(file)).shapes[0].importedMesh!.positions).toEqual(updated.importedMesh!.positions);
 });
});
