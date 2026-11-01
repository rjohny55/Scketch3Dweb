import * as THREE from 'three';
import {computeBoundsTree,MeshBVH} from 'three-mesh-bvh';
import {stretchShape} from '@/lib/axialStretch';
import {offsetConnection} from '@/lib/endOffset';
import {pullFaceShape} from '@/lib/facePull';
import type {ModelingJob,ModelingResult} from '@/lib/modelingWorkerProtocol';
/** Shared with regression tests: no DOM, GPU or application state is used here. */
export function computeModelingJob(job:ModelingJob):ModelingResult{
 const start=performance.now(),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(job.positions,3));
 if(job.index)geometry.setIndex(new THREE.BufferAttribute(job.index,1));
 const surface=new THREE.Mesh(geometry),root=new THREE.Group();
 root.matrixAutoUpdate=false;root.matrix.fromArray(job.rootMatrix);
 surface.matrixAutoUpdate=false;surface.matrix.fromArray(job.surfaceMatrix);surface.userData.shapeSurface=true;root.add(surface);
 const prepared=new THREE.BufferGeometry();
 try{
  const shape=job.operation.kind==='stretch'?stretchShape(job.shape,root,job.operation.options):job.operation.kind==='pull-face'?pullFaceShape(job.shape,root,job.operation.options):offsetConnection(job.shape,root,job.operation.options);
  const positions=Float32Array.from(shape.importedMesh!.positions);
  prepared.setAttribute('position',new THREE.BufferAttribute(positions,3));prepared.computeVertexNormals();
  const tree=computeBoundsTree.call(prepared,{targetLeafSize:12});
  const bvh=MeshBVH.serialize(tree as MeshBVH,{cloneBuffers:false});
  return {id:job.id,shape:{...shape,importedMesh:{...shape.importedMesh!,positions:[]}},positions,normals:prepared.getAttribute('normal').array as Float32Array,bvh,computeMs:performance.now()-start};
 }finally{geometry.dispose();prepared.dispose();(surface.material as THREE.Material).dispose();}
}
