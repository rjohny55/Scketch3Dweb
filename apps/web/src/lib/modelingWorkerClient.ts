import type {ModelingJob,ModelingReply,ModelingResult} from '@/lib/modelingWorkerProtocol';
type Task={job:ModelingJob;resolve:(result:ModelingResult)=>void;reject:(error:Error)=>void};
export const canceledModelingJob=()=>new DOMException('Расчёт отменён.','AbortError');
/** One running task and only the latest pending task: slider input cannot grow an unbounded queue. */
export class ModelingWorkerClient{
 private worker:Worker|null=null;
 private active:Task|null=null;
 private pending:Task|null=null;
 private nextId=0;
 constructor(private readonly createWorker=()=>new Worker(new URL('../workers/modeling.worker.ts',import.meta.url),{type:'module'})){}
 request(job:Omit<ModelingJob,'id'>):Promise<ModelingResult>{
  return new Promise((resolve,reject)=>{
   const task={job:{...job,id:++this.nextId},resolve,reject};
   if(this.active){this.active.reject(canceledModelingJob());this.pending?.reject(canceledModelingJob());this.pending=task;}
   else this.start(task);
  });
 }
 private start(task:Task){
  try{
   this.worker??=this.createWorker();this.active=task;
   this.worker.onmessage=(event:MessageEvent<ModelingReply>)=>{
    const message=event.data,current=this.active;
    if(!current||message.id!==current.job.id)return;
    this.active=null;
    if('error'in message)current.reject(new Error(message.error));else current.resolve(message);
    const pending=this.pending;this.pending=null;if(pending)this.start(pending);
   };
   this.worker.onerror=(event)=>{event.preventDefault();this.fail(new Error('Не удалось выполнить расчёт в Worker. '+event.message));};
   this.worker.onmessageerror=()=>this.fail(new Error('Не удалось получить результат расчёта Worker.'));
   this.worker.postMessage(task.job,[task.job.positions.buffer,...(task.job.index?[task.job.index.buffer]:[])]);
  }catch(error){this.fail(error instanceof Error?error:new Error(String(error)));}
 }
 private fail(error:Error){this.active?.reject(error);this.pending?.reject(error);this.active=null;this.pending=null;this.worker?.terminate();this.worker=null;}
 cancel(){this.fail(canceledModelingJob());}
 dispose(){this.cancel();}
}
