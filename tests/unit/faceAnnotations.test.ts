import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { annotatePlanarFace, measureAnnotatedFace } from '@/lib/faceAnnotations';
import { detectCircularHoles, measureCircularHole } from '@/lib/holeMeasurements';
import { workplaneShapesEqual } from '@/lib/workplaneShapes';
import { compactProjectShapeState, hydrateProjectShapeState } from '@/lib/projectShapePersistence';
import { exportSkfProject, importSkfProject } from '@/lib/skfProject';
import { editorHistoryEntry } from '@/lib/editorHistory';
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from '@/lib/workplaneSettings';
import type { WorkplaneShape } from '@/types/scketch3dweb';

const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(40,20,10));
describe('Named planar faces',()=>{
 it('preserves names and bindings in a full SKF archive roundtrip',async()=>{
  const a=annotatePlanarFace(mesh(),4,new THREE.Vector3());a.name='Верхний фланец';
  const shape={id:'s',name:'test',kind:'box',color:'#fff',x:0,z:0,size:40,width:40,depth:10,height:20,rotation:0,faceAnnotations:[a]} as WorkplaneShape;
  const bytes=await exportSkfProject({projectId:'p',projectName:'Метки',createdAt:1,modifiedAt:2,shapes:[shape],history:[editorHistoryEntry([shape],[])],historyIndex:0,assets:[],workspace:DEFAULT_WORKPLANE_WORKSPACE,snapGrid:DEFAULT_SNAP_GRID,placementElevation:0});
  const restored=await importSkfProject(bytes);expect(restored.shapes[0].faceAnnotations).toEqual([a]);
 });
 it('joins face triangles, measures a rotated rectangle without its diagonal and tracks scale',()=>{
  const m=mesh(); const a=annotatePlanarFace(m,4,new THREE.Vector3(0,10,0)); a.name='Фланец';
  expect(a.triangleIndices).toHaveLength(2);
  m.rotation.set(.2,.7,.4);m.scale.set(2,1,3);m.position.set(10,15,30);m.updateMatrixWorld();
  const r=measureAnnotatedFace(m,a);expect(r.status).toBe('valid');if(r.status!=='valid')throw Error();
  expect(r.lengthMm).toBeCloseTo(80);expect(r.widthMm).toBeCloseTo(30);expect(r.areaMm2).toBeCloseTo(2400);expect(r.perimeterMm).toBeCloseTo(220);expect(r.name).toBe('Фланец');
 });
 it('does not join disconnected coplanar islands and flags changed topology',()=>{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,10,0,0,0,10,0,30,0,0,40,0,0,30,10,0],3));
  const m=new THREE.Mesh(g),a=annotatePlanarFace(m,0,new THREE.Vector3(1,1,0));expect(a.triangleIndices).toEqual([0]);
  const r=measureAnnotatedFace(m,a);if(r.status!=='valid')throw Error();expect(r.areaMm2).toBeCloseTo(50);
  m.geometry=new THREE.BoxGeometry(20,20,20);expect(measureAnnotatedFace(m,a).status).toBe('stale');
 });
 it('metadata is a real scene change and survives project compact/hydrate',()=>{
  const shape={id:'s',name:'test',kind:'box',color:'#fff',x:0,z:0,size:40,width:40,depth:10,height:20,rotation:0} as WorkplaneShape;
  const a=annotatePlanarFace(mesh(),4,new THREE.Vector3());const updated={...shape,faceAnnotations:[{...a,name:'Тест'}]};
  expect(workplaneShapesEqual(shape,updated)).toBe(false);
  const compact=compactProjectShapeState([updated],[]);
  const restored=hydrateProjectShapeState(compact.shapes,compact.history,compact.resources);
  expect(restored.shapes[0].faceAnnotations).toEqual(updated.faceAnnotations);
 });
});
function tube(inner=5,outer=10){
 const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
 return new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:8,bevelEnabled:false,curveSegments:32}));
}
describe('Circular hole selection',()=>{
 it('detects inward circular rims, excludes the exterior cylinder, measures diameter',()=>{
  const m=tube();const holes=detectCircularHoles(m.geometry);expect(holes).toHaveLength(2);
  for(const hole of holes){const r=measureCircularHole(m,hole);expect(r.status).toBe('circular');expect(r.diameterMm).toBeCloseTo(10,4);}
 });
 it('does not report boxes or exterior round cylinders as holes',()=>{
  expect(detectCircularHoles(new THREE.BoxGeometry(20,10,5))).toEqual([]);
  expect(detectCircularHoles(new THREE.CylinderGeometry(5,5,10,64))).toEqual([]);
 });
 it('reports a nonuniformly scaled circular rim as noncircular',()=>{
  const m=tube();const h=detectCircularHoles(m.geometry)[0];m.scale.set(2,1,1);
  const r=measureCircularHole(m,h);expect(r.status).toBe('non_circular');expect(r.diameterMm).toBeNull();expect(r.maxSpanMm).toBeCloseTo(20);expect(r.minSpanMm).toBeCloseTo(10);
 });
});
