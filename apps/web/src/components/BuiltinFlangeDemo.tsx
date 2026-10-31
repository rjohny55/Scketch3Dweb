"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Download,Fan,LoaderCircle,X} from 'lucide-react';
import {T} from '@/components/Localization';

const base='/assets/demos/cmp170-fan-adapter';
type Props={onOpen:(file:File,signal:AbortSignal)=>Promise<{ok:boolean;message:string}>};
export function BuiltinFlangeDemo({onOpen}:Props){
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function open(){
  if(request.current)return;
  const controller=new AbortController();request.current=controller;setLoading(true);setError('');
  try{
   const response=await fetch(`${base}/cmp170-120mm-fan-adapter.skf`,{signal:controller.signal});
   if(!response.ok)throw Error('Could not load the demo project');
   const bytes=await response.arrayBuffer();if(controller.signal.aborted)return;
   const result=await onOpen(new File([bytes],'cmp170-120mm-fan-adapter.skf',{type:'application/vnd.scketch3dweb.project+zip'}),controller.signal);
   if(!result.ok&&!controller.signal.aborted)setError(result.message);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
  finally{if(request.current===controller){request.current=null;setLoading(false);}}
 }
 return <article className="builtin-robot-demo builtin-flange-demo" data-builtin-demo="cmp170-fan-adapter">
  <div className="builtin-robot-demo-visual"><img src={`${base}/preview.png`} alt="120 mm fan flange adapter for NVIDIA CMP 170" loading="lazy"/><span>CMP 170</span></div>
  <div className="builtin-robot-demo-copy"><small><T text="Built-in demo project"/></small><h2>CMP 170 · <T text="120 mm fan adapter"/></h2>
   <div className="builtin-robot-demo-tags"><span>120 × 120 mm</span><span><T text="Editable SKF + STL"/></span><span><T text="Named flanges and ruler"/></span></div>
   <p><T text="Flange adapter connecting a 120 × 120 mm fan to an NVIDIA CMP 170 graphics card. Open an editable copy; the built-in original stays intact."/></p>
   <div className="builtin-robot-demo-actions"><button type="button" onClick={()=>void open()} disabled={loading} data-open-demo="cmp170-fan-adapter">{loading?<LoaderCircle size={18} className="spinning"/>:<Fan size={18}/>}<T text={loading?'Opening demo…':'Open fan adapter demo'}/>{!loading&&<ArrowUpRight size={16} aria-hidden="true"/>}</button>
    {loading&&<button type="button" className="builtin-robot-demo-cancel" onClick={()=>request.current?.abort()}><X size={15}/><T text="Cancel"/></button>}
    <a href={`${base}/cmp170-120mm-fan-adapter.skf`} download><Download size={15} aria-hidden="true"/><T text="Download SKF"/></a>
    <a href={`${base}/cmp170-120mm-fan-adapter.stl`} download><Download size={15} aria-hidden="true"/><T text="Download STL"/></a>
   </div>
   <span className="builtin-robot-demo-detail"><T text="Fitted model · 74.4 mm ruler distance · check fit and slicer settings before printing"/></span>
   {error&&<p role="alert"><T text={error}/></p>}
  </div>
 </article>;
}
