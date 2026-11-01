import * as THREE from 'three';
import type {SerializedBVH} from 'three-mesh-bvh';
import type {WorkplaneShape} from '@/types/scketch3dweb';
import type {AxialStretchOptions} from '@/lib/axialStretch';
import type {ConnectionOffsetOptions} from '@/lib/endOffset';
import type {FacePullOptions} from '@/lib/facePull';
export type DeformationOperation = {kind:'stretch';options:AxialStretchOptions}|{kind:'offset';options:ConnectionOffsetOptions}|{kind:'pull-face';options:FacePullOptions};
export type ModelingJob = {id:number;shape:WorkplaneShape;operation:DeformationOperation;positions:Float32Array;index:Uint32Array|null;rootMatrix:number[];surfaceMatrix:number[]};
export type ModelingReply = {id:number;error:string}|{id:number;shape:WorkplaneShape;positions:Float32Array;normals:Float32Array;bvh:SerializedBVH;computeMs:number};
export type ModelingResult = Exclude<ModelingReply,{error:string}>;

/** Copy only the rendered surface, never detach buffers still owned by the renderer. */
export function snapshotModelingJob(shape:WorkplaneShape,root:THREE.Object3D,operation:DeformationOperation):Omit<ModelingJob,'id'>{
 if(shape.locked)throw new Error('Сначала разблокируйте деталь.');
 if(shape.groupedShapes?.length)throw new Error('Сначала объедините группу или выберите отдельную деталь.');
 root.updateWorldMatrix(true,true);
 const surfaces:THREE.Mesh<THREE.BufferGeometry>[]=[];
 root.traverse(c=>{if(c instanceof THREE.Mesh&&c.userData.shapeSurface)surfaces.push(c);});
 if(surfaces.length!==1)throw new Error('Выберите одну деталь с сеткой.');
 const surface=surfaces[0],attr=surface.geometry.getAttribute('position'),index=surface.geometry.getIndex();
 const positions=new Float32Array(attr.count*3);
 for(let i=0;i<attr.count;i++){positions[i*3]=attr.getX(i);positions[i*3+1]=attr.getY(i);positions[i*3+2]=attr.getZ(i);}
 return {shape:{...shape,importedMesh:undefined,cadBrep:undefined,cadDisplayEdges:undefined,edgeTreatmentHistory:undefined},operation,positions,index:index?Uint32Array.from(index.array):null,rootMatrix:root.matrixWorld.toArray(),surfaceMatrix:root.matrixWorld.clone().invert().multiply(surface.matrixWorld).toArray()};
}
