import {expect,it} from "vitest";
import * as THREE from "three";
import {annotatePlanarFace} from "@/lib/faceAnnotations";
import {createFacePaint} from "@/lib/facePaint";
import {disposeFaceSelectionHighlight} from "@/lib/faceSelectionHighlight";
import {exportSkfProject,importSkfProject} from "@/lib/skfProject";
import {editorHistoryEntry} from "@/lib/editorHistory";
import {DEFAULT_SNAP_GRID,DEFAULT_WORKPLANE_WORKSPACE} from "@/lib/workplaneSettings";
import type {WorkplaneShape} from "@/types/scketch3dweb";
it("renders a separate colored face without modifying the model geometry/material and saves it in SKF",async()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(20,20,20),new THREE.MeshStandardMaterial({color:'#0098c7'}));mesh.updateMatrixWorld();
 const before=Array.from(mesh.geometry.getAttribute('position').array);const paint={...annotatePlanarFace(mesh,0,new THREE.Vector3(10,0,0)),color:'#ef5350'};
 const overlay=createFacePaint(mesh,paint);expect(overlay.children.length).toBe(1);expect((overlay.children[0] as THREE.Mesh).geometry.getAttribute('position').count).toBe(6);
 expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('0098c7');expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(before);
 const shape:WorkplaneShape={id:'box',name:'Painted',kind:'box',color:'#0098c7',width:20,height:20,depth:20,size:20,x:0,z:0,facePaints:[paint]};
 const history=[editorHistoryEntry([shape],[])];
 const restored=await importSkfProject(await exportSkfProject({projectId:'paint-test',projectName:'Paint',createdAt:1,modifiedAt:2,shapes:[shape],history,historyIndex:0,assets:[],workspace:DEFAULT_WORKPLANE_WORKSPACE,snapGrid:DEFAULT_SNAP_GRID,placementElevation:0}));
 expect(restored.shapes[0].facePaints).toEqual([paint]);disposeFaceSelectionHighlight(overlay);
});
