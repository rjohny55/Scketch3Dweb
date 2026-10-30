/// <reference lib="webworker" />
import {computeModelingJob} from '@/lib/modelingWorkerCompute';
import type {ModelingJob,ModelingReply} from '@/lib/modelingWorkerProtocol';
self.onmessage=(event:MessageEvent<ModelingJob>)=>{
 try{
  const result=computeModelingJob(event.data);
  const transfer=[result.positions.buffer,result.normals.buffer,result.bvh.index!.buffer,...result.bvh.roots];
  self.postMessage(result,{transfer:[...new Set(transfer)]});
 }catch(error){self.postMessage({id:event.data.id,error:error instanceof Error?error.message:String(error)} satisfies ModelingReply);}
};
