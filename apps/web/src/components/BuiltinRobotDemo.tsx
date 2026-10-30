"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Bot,Download,LoaderCircle,X} from 'lucide-react';
import {T} from '@/components/Localization';

type Props={onOpen:(file:File,signal:AbortSignal)=>Promise<{ok:boolean;message:string}>};
export function BuiltinRobotDemo({onOpen}:Props){
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function open(){
  if(request.current)return;
  const controller=new AbortController();request.current=controller;setLoading(true);setError('');
  try{
   const response=await fetch('/assets/robot-rp1/demo/rp1-assembly.skf',{signal:controller.signal});
   if(!response.ok)throw Error('Could not load the demo project');
   const bytes=await response.arrayBuffer();if(controller.signal.aborted)return;
   const result=await onOpen(new File([bytes],'RP1-assembly.skf',{type:'application/vnd.scketch3dweb.project+zip'}),controller.signal);
   if(!result.ok&&!controller.signal.aborted)setError(result.message);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
  finally{if(request.current===controller){request.current=null;setLoading(false);}}
 }
 return <article className="builtin-robot-demo" data-builtin-demo="rp1">
  <div className="builtin-robot-demo-visual"><img src="/assets/robot-rp1/demo/preview.png" alt="RP1 robot assembly" loading="lazy"/><span>RP1</span></div>
  <div className="builtin-robot-demo-copy"><small><T text="Built-in demo project"/></small><h2>RP1 · <T text="Robot assembly"/></h2><div className="builtin-robot-demo-tags"><span><T text="63 editable nodes"/></span><span><T text="51 catalog parts"/></span></div>
   <p><T text="Explore the assembly, measure parts, and make it your own. The original demo stays intact."/></p>
   <div className="builtin-robot-demo-actions"><button type="button" onClick={()=>void open()} disabled={loading} data-open-demo="rp1">{loading?<LoaderCircle size={18} className="spinning"/>:<Bot size={18}/>}<T text={loading?'Opening demo…':'Open robot demo'}/>{!loading&&<ArrowUpRight size={16} aria-hidden="true"/>}</button>
   {loading&&<button type="button" className="builtin-robot-demo-cancel" onClick={()=>request.current?.abort()}><X size={15}/><T text="Cancel"/></button>}
   <a href="/assets/robot-rp1/demo/rp1-assembly.skf" download><Download size={15} aria-hidden="true"/><T text="Download SKF"/></a></div>
   <span className="builtin-robot-demo-detail"><T text="Original URDF pose · millimeters · separate editable objects"/></span>
   {error&&<p role="alert"><T text={error}/></p>}
  </div>
 </article>;
}
