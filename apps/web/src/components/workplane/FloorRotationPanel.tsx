"use client";
import {useState,useEffect} from 'react';import {ChevronUp} from 'lucide-react';import {L,T} from '@/components/Localization';
export function FloorRotationPanel({locked,picking,onRotate,onPick,openRequest=0}:{openRequest?:number;locked:boolean;picking:boolean;onRotate:(degrees:number)=>void;onPick:()=>void}){
 const [open,setOpen]=useState(false),[angle,setAngle]=useState('90'),[error,setError]=useState('');
 const rotate=(degrees:number)=>{try{onRotate(degrees);setError('');}catch(e){setError(e instanceof Error?e.message:String(e));}};
 useEffect(()=>{if(openRequest)setOpen(true);},[openRequest]);
 return <div className={`property-card floor-rotation-panel ${open?'':'collapsed'}`}><L><button type="button" className="property-card-header" aria-label="Rotate on floor" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span><T text="Rotate on floor"/></span><ChevronUp size={25} strokeWidth={2.8} className={open?'':'collapsed'}/></button></L>{open&&<form className="property-list" onSubmit={e=>{e.preventDefault();rotate(angle.trim()?Number(angle.replace(',','.')):NaN);}}>
 <p className="stretch-hint"><T text="Rotate horizontally around the vertical axis. The lowest point stays on the build plate."/></p>
 <L><label className="text-property"><span><T text="Turn by (degrees)"/></span><L><input aria-label="Turn by (degrees)" inputMode="decimal" value={angle} disabled={locked} onChange={e=>setAngle(e.target.value)}/></L></label></L>
 <div className="stretch-actions"><L><button className="inspector-action-button" type="button" aria-label="Turn left 90 degrees" disabled={locked} onClick={()=>rotate(-90)}>↶ 90°</button></L><L><button className="inspector-action-button" type="submit" disabled={locked}><T text="Turn on floor"/></button></L><L><button className="inspector-action-button" type="button" aria-label="Turn right 90 degrees" disabled={locked} onClick={()=>rotate(90)}>↷ 90°</button></L></div>
 <L><button type="button" className="inspector-action-button" aria-pressed={picking} disabled={locked} onClick={onPick}><T text={picking?'Cancel face placement':'Place face on floor'}/></button></L>
 {picking&&<p role="status" className="stretch-hint"><T text="Click the flat face that should become the bottom. Esc cancels."/></p>}
 <p className="stretch-hint"><T text="To remove a tilt, place a flat face on the floor first. Ctrl+Z cancels the last turn."/></p>{error&&<p role="alert" className="face-annotation-error">{error}</p>}
 </form>}</div>;
}
