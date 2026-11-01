"use client";
import {useEffect,useRef,useState} from 'react';
import {ChevronUp,ArrowUp,ArrowDown,MousePointer2} from 'lucide-react';
import {L,T} from '@/components/Localization';
import type {FacePullOptions} from '@/lib/facePull';
import type {FaceAnnotation} from '@/types/scketch3dweb';

export type FacePullDragController={distance:()=>number;preview:(distance:number)=>void};
export function FacePullPanel({face,faces=[],pickError='',onSelectFace,locked,picking,openRequest=0,onPick,onRun,onClear,onDragBind}:{face:FaceAnnotation|null;faces?:FaceAnnotation[];pickError?:string;onSelectFace?:(face:FaceAnnotation)=>void;locked:boolean;picking:boolean;openRequest?:number;onPick:()=>void;onRun:(options:FacePullOptions,preview:boolean)=>Promise<void>;onClear:()=>void;onDragBind?:(controller:FacePullDragController|null)=>void}){
 const [open,setOpen]=useState(false),[distance,setDistance]=useState('5'),[fixed,setFixed]=useState('2'),[moving,setMoving]=useState('2'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false);
 const [local,setLocal]=useState(true),[transition,setTransition]=useState('1');
 const generation=useRef(0);
 const clear=()=>{generation.current++;onClear();setPreview(false);setError('');setBusy(false);};
 useEffect(()=>{if(openRequest)setOpen(true);},[openRequest]);
 useEffect(()=>{generation.current++;setPreview(false);setError('');setBusy(false);},[face]);
 useEffect(()=>()=>{generation.current++;},[]);
 const run=async(preview:boolean,value=distance)=>{
  if(!face)return;const request=++generation.current;setBusy(true);
  try{const number=(s:string)=>s.trim()?Number(s.replace(',','.')):NaN;await onRun({face,distance:number(value),keepFixed:number(fixed),keepMoving:number(moving),transitionLength:local?number(transition):undefined},preview);if(request===generation.current){setError('');setPreview(preview);}}
  catch(e){if(request===generation.current&&!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:String(e));}
  finally{if(request===generation.current)setBusy(false);}
 };
 const step=(sign:number)=>{const n=Number(distance.replace(',','.'));if(!Number.isFinite(n))return;clear();const value=String(Number((n+sign).toFixed(4)));setDistance(value);void run(true,value);};
 useEffect(()=>{onDragBind?.({distance:()=>Number(distance.replace(',','.')),preview:n=>{clear();const value=String(Number(n.toFixed(2)));setDistance(value);void run(true,value);}});return()=>onDragBind?.(null);});
 return <div className={`property-card face-pull-panel ${open?'':'collapsed'}`}>
 <L><button type="button" className="property-card-header" aria-label="Pull end face" aria-expanded={open} onClick={()=>{clear();setOpen(v=>!v);}}><span><T text="Pull end face"/></span><ChevronUp size={25} className={open?'':'collapsed'}/></button></L>
 {open&&<form className="property-list" onSubmit={e=>{e.preventDefault();void run(false);}}>
 <L><label className="select-property"><span><T text="Pull mode"/></span><select aria-label="Pull mode" value={local?'flange':'body'} disabled={locked||busy} onChange={e=>{clear();setLocal(e.target.value==='flange');}}><option value="flange"><T text="Flange stand-off — keep duct fixed"/></option><option value="body"><T text="Stretch entire connection"/></option></select></label></L>
 <p className="stretch-hint"><T text={local?'Move the mounting plate and its holes as one piece. Only a short collar behind the plate changes; the main duct stays in its original position and shape.':'Pick the outer mounting face. Its protected end moves as one piece; the opposite end stays fixed and the connecting walls stretch. This is not whole-object scaling.'}/></p>
 <L><button type="button" className="inspector-action-button" disabled={locked||busy} onClick={()=>{clear();onPick();}}><MousePointer2 size={16}/><T text={picking?'Cancel face picking':face?'Pick another end face':'Pick end face on model'}/></button></L>
 {face&&<p className="stretch-hint" role="status"><T text="End face selected"/></p>}
 {picking&&<p className="stretch-hint"><T text="Click a flat outer end of the selected part. Hover highlights the face."/></p>}
 {picking&&pickError&&<p role="alert" className="face-annotation-error"><T text={pickError}/></p>}
 {faces.length>0&&<L><label className="select-property"><span><T text="Use named end face"/></span><select aria-label="Use named end face" disabled={locked||busy} value={faces.some(f=>f.id===face?.id)?face!.id:''} onChange={e=>{const picked=faces.find(f=>f.id===e.target.value);if(picked){clear();onSelectFace?.(picked);}}}><option value=""><T text="Select a face"/></option>{faces.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label></L>}
 {[['Pull distance (mm)',distance,setDistance],...(local?[['Local transition depth (mm)',transition,setTransition]]:[['Fixed protected region (mm)',fixed,setFixed]]),['Moving protected region (mm)',moving,setMoving]].map(([label,value,set])=><L key={label as string}><label className="text-property"><span><T text={label as string}/></span><input aria-label={label as string} inputMode="decimal" value={value as string} disabled={locked||busy} onChange={e=>{clear();(set as (s:string)=>void)(e.target.value);}}/></label></L>)}
 {local&&<p className="stretch-hint"><T text="Local transition depth is the original strip behind the protected plate that becomes the new neck. Start with 1 mm. Everything farther into the duct remains fixed. Use Preview to check access for the power plug and screwdriver."/></p>}
 <p className="stretch-hint"><T text="Positive distance pulls outward along the face normal; negative distance shortens the part. Keep the mounting plate and screw holes inside the protected end."/></p>
 <div className="stretch-actions"><L><button className="inspector-action-button" type="button" disabled={!face||locked||busy} onClick={()=>step(-1)} aria-label="Shorten end by 1 mm"><ArrowDown size={16}/>−1 mm</button></L><L><button className="inspector-action-button" type="button" disabled={!face||locked||busy} onClick={()=>step(1)} aria-label="Pull end by 1 mm"><ArrowUp size={16}/>+1 mm</button></L></div>
 <div className="stretch-actions"><L><button className="inspector-action-button" type="button" disabled={!face||locked||busy} onClick={()=>void run(true)}><T text="Preview face pull"/></button></L><L><button className="inspector-action-button" type="submit" disabled={!face||locked||busy}><T text="Apply face pull"/></button></L></div>
 {preview&&<L><button className="inspector-action-button" type="button" onClick={clear}><T text="Cancel preview"/></button></L>}
 {error&&<p role="alert" className="face-annotation-error"><T text={error}/></p>}
 <p className="stretch-hint"><T text="Apply creates one undo step. Ctrl+Z restores the previous shape."/></p>
 </form>}
 </div>;
}
