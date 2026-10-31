"use client";
import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {T,L} from '@/components/Localization';
import type {SessionActionHistory} from '@/lib/sessionActionHistory';
export function OperationHistoryDialog({entries,cursor,disabled,canGo,onGo,onClose}:{entries:SessionActionHistory['entries'];cursor:number;disabled:boolean;canGo:(step:number)=>boolean;onGo:(step:number)=>void;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);
 return <dialog ref={ref} className="operation-history-dialog" aria-labelledby="operation-history-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header><h2 id="operation-history-title"><T text="Operation history"/></h2><L><button type="button" aria-label="Close history" onClick={onClose}><X size={20}/></button></L></header>
  <p><T text="Select a row to restore the state after that operation. Later steps can be redone until you make a new change."/></p>
  <small><T text="Authors are recorded for this editor session. Older saved steps may not include author information."/></small>
  <div className="operation-history-rows">
   {[{id:0,step:0,description:'Initial available state',actor:'unknown',timestamp:0,applied:true},...entries].map(entry=><button type="button" key={entry.id} data-history-step={entry.step} aria-current={cursor===entry.step?'step':undefined} className={`${cursor===entry.step?'current ':''}${entry.step>cursor?'undone':''}`} disabled={disabled||!canGo(entry.step)} onClick={()=>onGo(entry.step)}>
    <span className="operation-history-number">{entry.step}</span><span><strong><T text={entry.description}/></strong><small><T text={entry.actor==='agent'?'Agent':entry.actor==='user'?'User':'Saved history'}/>{entry.timestamp>0?' · '+new Date(entry.timestamp).toLocaleTimeString():''}{cursor===entry.step?<> · <T text="Current state"/></>:null}</small></span>
   </button>)}
  </div>
 </dialog>;
}
