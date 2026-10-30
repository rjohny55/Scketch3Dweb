import { expect, it } from "vitest";
import * as THREE from "three";
import { snapRulerAxisToSurface } from "@/lib/rulerAxisSnap";

it("snaps to the hovered wall and keeps the measurement horizontal", () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 20, 20));mesh.position.set(74,10,0);mesh.updateMatrixWorld();
  const point = snapRulerAxisToSurface(new THREE.Vector3(0,8,0),new THREE.Vector3(73,13,4),[mesh],new THREE.Plane(new THREE.Vector3(1,0,0),-73));
  expect(point?.x).toBeCloseTo(73);expect(point?.y).toBeCloseTo(8);expect(point?.z).toBeCloseTo(4);
});
it("uses the actual sloped surface instead of retaining the picked point's X coordinate", () => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(40,40));mesh.rotation.y=Math.PI/4;mesh.position.set(74,10,0);mesh.updateMatrixWorld();
  const normal=new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,mesh.position);
  const candidate=new THREE.Vector3(0,3,6).applyMatrix4(mesh.matrixWorld);
  const point=snapRulerAxisToSurface(new THREE.Vector3(0,8,0),candidate,[mesh],plane);
  expect(point).not.toBeNull();expect(point!.x+point!.z).toBeCloseTo(74);expect(point!.y).toBe(8);expect(point!.x/point!.z).toBeCloseTo(candidate.x/candidate.z);
  expect(Math.abs(plane.distanceToPoint(point!))).toBeLessThan(1e-5);
});
it("does not snap to an imaginary plane outside the face or silently switch to a different face", () => {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,10,10));mesh.position.set(74,20,0);mesh.updateMatrixWorld();
  const plane=new THREE.Plane(new THREE.Vector3(1,0,0),-73);
  expect(snapRulerAxisToSurface(new THREE.Vector3(0,0,0),new THREE.Vector3(73,20,0),[mesh],plane)).toBeNull();
  expect(snapRulerAxisToSurface(new THREE.Vector3(0,20,0),new THREE.Vector3(74,25,0),[mesh],new THREE.Plane(new THREE.Vector3(0,1,0),-25))).toBeNull();
});

it("passes the starting wall and an air gap to reach another part of the same mesh",()=>{
 const first=new THREE.BoxGeometry(2,40,50).toNonIndexed();first.translate(0,20,0);
 const second=new THREE.BoxGeometry(2,40,50).toNonIndexed();second.translate(74,20,0);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([...first.getAttribute('position').array,...second.getAttribute('position').array],3));
 const mesh=new THREE.Mesh(geometry);mesh.updateMatrixWorld();
 const point=snapRulerAxisToSurface(new THREE.Vector3(1,12,0),new THREE.Vector3(73,20,11),[mesh],new THREE.Plane(new THREE.Vector3(1,0,0),-73));
 expect(point?.x).toBeCloseTo(73);expect(point?.y).toBeCloseTo(12);expect(point?.z).toBeCloseTo(11);
});
it("never chooses a hit behind the fixed endpoint",()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,40,40));mesh.position.set(-4,20,0);mesh.updateMatrixWorld();
 expect(snapRulerAxisToSurface(new THREE.Vector3(0,12,0),new THREE.Vector3(10,20,3),[mesh])).toBeNull();
});

it("levels within the same wall without jumping to its boundary",()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,40,50));mesh.position.set(0,20,0);mesh.updateMatrixWorld();
 const point=snapRulerAxisToSurface(new THREE.Vector3(1,12,0),new THREE.Vector3(1,20,11),[mesh],new THREE.Plane(new THREE.Vector3(1,0,0),-1));
 expect(point?.toArray()).toEqual([1,12,11]);
});
