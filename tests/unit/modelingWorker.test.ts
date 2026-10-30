import {it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {computeModelingJob} from '@/lib/modelingWorkerCompute';
import {snapshotModelingJob,type ModelingJob,type ModelingReply} from '@/lib/modelingWorkerProtocol';
import {ModelingWorkerClient} from '@/lib/modelingWorkerClient';
import {annotatePlanarFace,measureAnnotatedFace} from '@/lib/faceAnnotations';
import {stretchShape} from '@/lib/axialStretch';
import {offsetConnection} from '@/lib/endOffset';
import {MeshBVH} from 'three-mesh-bvh';
import type {WorkplaneShape} from '@/types/scketch3dweb';
function fixture(){
 const shape:WorkplaneShape={id:'worker-box',kind:'box',name:'Worker box',width:20,height:10,depth:12,size:20,x:3,z:5,elevation:2,rotation:27,rotationX:13,mirrorZ:true,color:'#123456'};
 const root=new THREE.Group(),surface=new THREE.Mesh(new THREE.BoxGeometry(20,10,12));
 surface.geometry.translate(0,5,0);surface.position.y=-5;surface.userData.shapeSurface=true;root.position.set(3,7,5);root.rotation.set(13*Math.PI/180,27*Math.PI/180,0);root.scale.z=-1;root.add(surface);root.updateMatrixWorld(true);
 shape.faceAnnotations=[0,2].map((triangle,i)=>({...annotatePlanarFace(surface,triangle,surface.localToWorld(new THREE.Vector3(i?-10:10,5,0))),name:String(i)}));
 return{shape,root,surface};
}
it.each(['stretch','offset'] as const)('worker %s matches synchronous geometry, pose and complete face bindings',kind=>{
 const{shape,root,surface}=fixture();const operation=kind==='stretch'?{kind,options:{axis:'x' as const,target:27,keepStart:2,keepEnd:2,anchor:'start' as const}}:{kind,options:{fixedFaceId:shape.faceAnnotations![0].id,movingFaceId:shape.faceAnnotations![1].id,keepFixed:2,keepMoving:2,offsetU:3,offsetV:1}};
 const job={id:1,...snapshotModelingJob(shape,root,operation)},before=Array.from(surface.geometry.getAttribute('position').array);
 const actual=computeModelingJob(job),expected=operation.kind==='stretch'?stretchShape(shape,root,operation.options):offsetConnection(shape,root,operation.options);
 expect(actual.positions.length).toBe(expected.importedMesh!.positions.length);
 actual.positions.forEach((v,i)=>expect(v).toBeCloseTo(expected.importedMesh!.positions[i],5));
 expect(actual.shape.faceAnnotations!.map(a=>[a.id,a.name])).toEqual(expected.faceAnnotations!.map(a=>[a.id,a.name]));
 [actual.shape.x,actual.shape.z,actual.shape.elevation!].forEach((v,i)=>expect(v).toBeCloseTo([expected.x,expected.z,expected.elevation!][i],6));
 expect(Array.from(surface.geometry.getAttribute('position').array)).toEqual(before);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(actual.positions,3));g.boundsTree=MeshBVH.deserialize(actual.bvh,g);
 const mesh=new THREE.Mesh(g);expect(actual.shape.faceAnnotations!.every(a=>measureAnnotatedFace(mesh,a).status==='valid')).toBe(true);
});
it('coalesces repeated requests, never resolves superseded results and cancels on teardown',async()=>{
 const fake={onmessage:null as null|((e:MessageEvent<ModelingReply>)=>void),onerror:null,onmessageerror:null,postMessage:vi.fn(),terminate:vi.fn()};
 const client=new ModelingWorkerClient(()=>fake as unknown as Worker),{shape,root}=fixture();
 const job=()=>snapshotModelingJob(shape,root,{kind:'stretch',options:{axis:'x',target:25,keepStart:2,keepEnd:2,anchor:'start'}});
 const first=client.request(job()).catch(e=>e.name),second=client.request(job()).catch(e=>e.name),last=client.request(job());
 expect(await first).toBe('AbortError');expect(await second).toBe('AbortError');expect(fake.postMessage).toHaveBeenCalledTimes(1);
 const reply=(id:number)=>fake.onmessage!({data:{id,shape,positions:new Float32Array(),normals:new Float32Array(),bvh:{} as never,computeMs:1}} as MessageEvent<ModelingReply>);
 reply(1);expect(fake.postMessage).toHaveBeenCalledTimes(2);expect((fake.postMessage.mock.calls[1][0] as ModelingJob).id).toBe(3);
 reply(3);expect((await last).id).toBe(3);
 const canceled=client.request(job()).catch(e=>e.name);client.dispose();expect(await canceled).toBe('AbortError');expect(fake.terminate).toHaveBeenCalledTimes(1);
});
it('rejects a worker failure and allows a clean restart',async()=>{
 const fake={onmessage:null,onerror:null as null|((e:ErrorEvent)=>void),onmessageerror:null,postMessage:vi.fn(),terminate:vi.fn()};
 const factory=vi.fn(()=>fake as unknown as Worker),client=new ModelingWorkerClient(factory),{shape,root}=fixture();
 const job=()=>snapshotModelingJob(shape,root,{kind:'stretch',options:{axis:'x',target:25,keepStart:2,keepEnd:2,anchor:'start'}});
 const failed=client.request(job());fake.onerror!({message:'test failure',preventDefault(){}} as ErrorEvent);await expect(failed).rejects.toThrow(/test failure/);
 const restarted=client.request(job()).catch(e=>e.name);expect(factory).toHaveBeenCalledTimes(2);client.dispose();await restarted;
});
