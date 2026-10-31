import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {STLLoader} from 'three/examples/jsm/loaders/STLLoader.js';
import {computeBoundsTree} from 'three-mesh-bvh';
import {importSkfProject} from '@/lib/skfProject';
import {measureAnnotatedFace,faceGeometryKey} from '@/lib/faceAnnotations';
import {meshPrintReport} from '@/lib/meshPrintReport';

const root='examples/cmp170-fan-adapter';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const arrayBuffer=(bytes:Buffer)=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;

describe('CMP 170 fitted fan adapter demo',()=>{
 it('ships the final fitted geometry without changing the STL triangle payload',()=>{
  const bytes=fs.readFileSync(path.join(root,manifest.files.mesh));
  expect(sha(bytes)).toBe(manifest.sha256.mesh);
  expect(sha(bytes.subarray(80))).toBe(manifest.geometrySha256);
  expect(bytes.readUInt32LE(80)).toBe(37256);
  expect(bytes.length).toBe(84+50*37256);
 });
 it('has a closed, consistently wound mesh with the documented dimensions',()=>{
  const geometry=new STLLoader().parse(arrayBuffer(fs.readFileSync(path.join(root,manifest.files.mesh))));
  const p=geometry.getAttribute('position');
  const vertices:Array<[number,number,number]>=Array.from({length:p.count},(_,i)=>[p.getX(i),p.getZ(i),-p.getY(i)]);
  const faces:Array<[number,number,number]>=Array.from({length:p.count/3},(_,i)=>[i*3,i*3+1,i*3+2]);
  const report=meshPrintReport([{vertices,faces}]);
  expect(report.basicChecksPass).toBe(true);
  expect(report.triangleCount).toBe(manifest.triangleCount);
  report.bounds!.size.forEach((size,i)=>expect(size).toBeCloseTo(manifest.boundsZUpMm[i],4));
 });
 it('opens as an editable SKF with two valid named flange faces and the fitted ruler',async()=>{
  const bytes=fs.readFileSync(path.join(root,manifest.files.project));
  expect(sha(bytes)).toBe(manifest.sha256.project);
  const project=await importSkfProject(arrayBuffer(bytes));
  expect(project.projectName).toBe(manifest.name);
  expect(project.shapes).toHaveLength(1);
  const shape=project.shapes[0];
  expect(shape.locked).toBe(false);
  expect(shape.faceAnnotations?.map(a=>a.name)).toEqual(['NVIDIA CMP 170 flange','120 mm fan flange']);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(shape.importedMesh!.positions,3));
  geometry.computeBoundingBox();
  geometry.translate(0,-geometry.boundingBox!.min.y,0);
  const mesh=new THREE.Mesh(geometry);
  // Match the editor's picking topology: BVH construction supplies/reorders indices.
  computeBoundsTree.call(geometry,{targetLeafSize:12});
  expect(faceGeometryKey(geometry)).toBe(shape.faceAnnotations![0].geometryKey);
  expect(shape.faceAnnotations!.every(a=>measureAnnotatedFace(mesh,a).status==='valid')).toBe(true);
  expect(project.rulers.segments).toHaveLength(1);
  const [a,b]=project.rulers.points;
  expect(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)).toBeCloseTo(74.4,7);
  expect(a.attachment?.shapeId).toBe(shape.id);
  expect(b.attachment?.shapeId).toBe(shape.id);
 });
});
