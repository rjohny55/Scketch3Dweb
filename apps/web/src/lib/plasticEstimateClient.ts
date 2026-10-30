import type {PlasticEstimate,PlasticGeometry,PlasticSettings,PlasticOptions} from '@/lib/plasticEstimate';
/** Explicit request only. No background subscription or automatic retries. */
export function estimatePlasticInWorker(geometry:PlasticGeometry,settings:PlasticSettings,signal?:AbortSignal,expiresAt=Date.now()+120000,options:PlasticOptions={}):Promise<PlasticEstimate>{
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DOMException('Расчёт отменён.','AbortError'));return;}
  if(Date.now()>=expiresAt){reject(new Error('Срок расчёта истёк.'));return;}
  const worker=new Worker(new URL('../workers/plasticEstimate.worker.ts',import.meta.url),{type:'module'});
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();};
  const abort=()=>{cleanup();reject(new DOMException('Расчёт отменён.','AbortError'));};
  const fail=(error:Error)=>{cleanup();reject(error);};
  const timer=setTimeout(()=>fail(new Error('Расчёт занял слишком много времени. Выберите меньше деталей.')),Math.min(120000,Math.max(1,expiresAt-Date.now())));
  signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=(event:MessageEvent<{result?:PlasticEstimate;error?:string}>)=>{
   if(event.data.error)fail(new Error(event.data.error));else if(event.data.result){cleanup();resolve(event.data.result);}else fail(new Error('Не удалось получить результат расчёта.'));
  };
  worker.onerror=e=>{e.preventDefault();fail(new Error('Не удалось выполнить расчёт в Worker.'));};
  worker.onmessageerror=()=>fail(new Error('Ошибка передачи результата расчёта.'));
  try{worker.postMessage({geometry,settings,options},geometry.bodies.map(body=>body.positions.buffer));}catch(error){fail(error instanceof Error?error:new Error(String(error)));}
 });
}
