import {expect,it} from "vitest";
import * as THREE from "three";
import {cameraPanReturnBaseline,armCameraPanReturn,updateCameraPanReturn} from "@/lib/cameraPanReturn";
it("keeps a zoomed pan and returns the old center progressively when zooming out",()=>{
 const camera=new THREE.PerspectiveCamera(40,1,1,1000),target=new THREE.Vector3();camera.position.set(0,0,100);const state=cameraPanReturnBaseline(camera,target);
 camera.position.z=30;armCameraPanReturn(state,camera,target);camera.position.x=20;target.x=20;
 expect(updateCameraPanReturn(state,camera,target)).toBe(false);expect(target.x).toBe(20);
 camera.position.z=65;expect(updateCameraPanReturn(state,camera,target)).toBe(true);expect(target.x).toBeCloseTo(10);
 camera.position.z=100;updateCameraPanReturn(state,camera,target);expect(target.length()).toBeCloseTo(0);expect(camera.position.x).toBeCloseTo(0);
});
it("returns an orthographic pan at its original zoom without changing model geometry",()=>{
 const camera=new THREE.OrthographicCamera(-50,50,50,-50,1,1000),target=new THREE.Vector3();camera.position.z=100;const state=cameraPanReturnBaseline(camera,target);
 camera.zoom=4;armCameraPanReturn(state,camera,target);target.set(20,10,0);camera.position.add(target);camera.zoom=1;
 expect(updateCameraPanReturn(state,camera,target)).toBe(true);expect(target.length()).toBeCloseTo(0);expect(camera.position.toArray()).toEqual([0,0,100]);
});
