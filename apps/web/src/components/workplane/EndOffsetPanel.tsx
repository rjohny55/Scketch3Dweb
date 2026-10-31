"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronUp,ChevronDown,ChevronLeft,ChevronRight,RotateCcw} from 'lucide-react';
import {L,T} from '@/components/Localization';
import {connectionOffsetFrame,floorConnectionFrame,connectionPositionGaps,type ConnectionOffsetOptions,type ConnectionAnchor,type EndConnection} from '@/lib/endOffset';
type Props={
 connections:EndConnection[];currentConnections?:EndConnection[];locked:boolean;sessionVersion?:number;openRequest?:number;
 onPairChange:()=>void;onReset:(fixedId:string,movingId:string)=>void;onClear:()=>void;
 onPreview:(options:ConnectionOffsetOptions)=>void|Promise<void>;
 onApply:(options:ConnectionOffsetOptions)=>void|Promise<void>;
};
const numeric=(value:string)=>value.trim()?Number(value.replace(',','.')):NaN;
export function EndOffsetPanel({connections,currentConnections,locked,onPreview,onApply,onClear,onReset,onPairChange,sessionVersion=0,openRequest=0}:Props){
 const [open,setOpen]=useState(false),[fixedId,setFixedId]=useState(''),[movingId,setMovingId]=useState('');
 const [keepFixed,setKeepFixed]=useState('2'),[keepMoving,setKeepMoving]=useState('2');
 const [vertical,setVertical]=useState('0'),[horizontal,setHorizontal]=useState('0'),[step,setStep]=useState('0.1');
 const [error,setError]=useState(''),[preview,setPreview]=useState(false);
 const [positionMode,setPositionMode]=useState(false);
 const [fixedAnchorU,setFixedAnchorU]=useState<ConnectionAnchor>('min'),[movingAnchorU,setMovingAnchorU]=useState<ConnectionAnchor>('min');
 const [fixedAnchorV,setFixedAnchorV]=useState<ConnectionAnchor>('min'),[movingAnchorV,setMovingAnchorV]=useState<ConnectionAnchor>('min');
 const requestRef=useRef(0);
 const resetFields=()=>{requestRef.current++;setVertical('0');setHorizontal('0');setPreview(false);setError('');};
 useEffect(()=>{resetFields();},[sessionVersion]);
 useEffect(()=>{if(openRequest)setOpen(true);},[openRequest]);
 useEffect(()=>{
  if(connections.some(c=>c.id===fixedId))return;
  const fan=connections.find(c=>/вент|fan/i.test(c.name))??connections.find(c=>c.side==='max')??connections[0];
  setFixedId(fan?.id??'');
  setMovingId((connections.find(c=>c.id!==fan?.id&&/видео|крат|карт|gpu/i.test(c.name))??connections.find(c=>c.id!==fan?.id))?.id??'');
 },[connections,fixedId]);
 const floor=useMemo(()=>{if(!open)return null;try{return floorConnectionFrame(connections,fixedId,movingId);}catch{return null;}},[open,connections,fixedId,movingId]);
 const clear=()=>{requestRef.current++;onClear();setPreview(false);setError('');};
 const options=(y=vertical,h=horizontal):ConnectionOffsetOptions=>({fixedFaceId:fixedId,movingFaceId:movingId,keepFixed:numeric(keepFixed),keepMoving:numeric(keepMoving),offsetU:numeric(y),offsetV:numeric(h),coordinateSystem:'floor',mode:positionMode?'position':'offset',fixedAnchorU,movingAnchorU,fixedAnchorV,movingAnchorV});
 let currentGaps:ReturnType<typeof connectionPositionGaps>|null=null;
 try{currentGaps=connectionPositionGaps(currentConnections??connections,options());}catch{}
 const run=async(apply:boolean,next=options())=>{
  const request=++requestRef.current;
  if(!apply)setPreview(true);
  try{
   await (apply?onApply(next):onPreview(next));
   if(request!==requestRef.current)return;
   if(apply)setPreview(false);setError('');
  }catch(e){if(request===requestRef.current&&!(e instanceof Error&&e.name==='AbortError')){setPreview(false);setError(e instanceof Error?e.message:String(e));}}
 };
 const stepOffset=(axis:'vertical'|'horizontal',sign:number)=>{
  const amount=numeric(step);
  if(!Number.isFinite(amount)||amount<=0){setError('Step must be a positive number.');return;}
  const next=String(Number((numeric(axis==='vertical'?vertical:horizontal)+sign*amount).toFixed(6)));
  (axis==='vertical'?setVertical:setHorizontal)(next);
  void run(false,options(axis==='vertical'?next:vertical,axis==='horizontal'?next:horizontal));
 };
 const selectPair=(id:string,fixed:boolean)=>{
  clear();onPairChange();resetFields();
  if(fixed){setFixedId(id);if(id===movingId)setMovingId(connections.find(c=>c.id!==id)?.id??'');}else setMovingId(id);
 };
 const fields=[{axis:'vertical' as const,name:'Y',value:vertical,set:setVertical,description:'Vertical — relative to floor',increase:ChevronUp,decrease:ChevronDown},
  {axis:'horizontal' as const,name:floor?.horizontalAxis??'XZ',value:horizontal,set:setHorizontal,description:'Horizontal — along floor',increase:ChevronRight,decrease:ChevronLeft}];
 return <div className={`property-card end-offset-panel ${open?'':'collapsed'}`}>
  <L><button className="property-card-header" type="button" aria-label="Offset duct connection" aria-expanded={open} onClick={()=>{clear();setOpen(value=>!value);}}><span><T text="Offset duct connection"/></span><ChevronUp className={open?'':'collapsed'} size={25} strokeWidth={2.8}/></button></L>
  {open&&<form className="property-list" onSubmit={e=>{e.preventDefault();void run(true);}}>
   <p className="stretch-hint"><T text="Keep one flange fixed, move the other, and reshape the transition together with its inner channel. Protected flanges keep their shape."/></p>
   <p className="stretch-hint"><T text="Choose any two separated named planar faces on one model. Adjacent faces sharing an edge cannot move independently while both stay rigid."/></p>
   {connections.length<2?<p className="stretch-hint"><T text="Label two separated planar faces using Face labels. They may be inclined and need not be opposite ends."/></p>:<>
    <label className="text-property"><span><T text="Fixed flange"/></span><L><select aria-label="Fixed flange" disabled={locked} value={fixedId} onChange={e=>selectPair(e.target.value,true)}>{connections.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></L></label>
    <label className="text-property"><span><T text="Moving flange"/></span><L><select aria-label="Moving flange" disabled={locked} value={movingId} onChange={e=>selectPair(e.target.value,false)}>{connections.filter(c=>c.id!==fixedId).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></L></label>
    <label className="text-property"><span><T text="Positioning mode"/></span><L><select aria-label="Positioning mode" disabled={locked} value={positionMode?'position':'offset'} onChange={e=>{clear();onPairChange();const next=e.target.value==='position';setPositionMode(next);setVertical(String(Number((next?(currentGaps?.vertical??0):0).toFixed(6))));setHorizontal(String(Number((next?(currentGaps?.horizontal??0):0).toFixed(6))));}}><option value="offset"><T text="Shift by"/></option><option value="position"><T text="Set position from reference"/></option></select></L></label>
    {positionMode&&<p className="stretch-hint"><T text="Choose reference edges, then enter the required signed distance. 0 aligns the edges; +7 places the moving edge 7 mm above or to the right of the fixed edge."/></p>}
    {fields.map(({axis,name,value,set,description,increase:Increase,decrease:Decrease})=><div className="text-property offset-direction-property" key={axis}>
     <label htmlFor={`offset-${axis}`}><span><T text={`${positionMode?'Target':'Offset'} ${name} (mm)`}/></span><small><T text={description}/></small></label>
     {positionMode&&<div className="offset-reference-controls">
      {[{label:'Fixed reference edge',value:axis==='vertical'?fixedAnchorU:fixedAnchorV,set:axis==='vertical'?setFixedAnchorU:setFixedAnchorV},{label:'Moving reference edge',value:axis==='vertical'?movingAnchorU:movingAnchorV,set:axis==='vertical'?setMovingAnchorU:setMovingAnchorV}].map(control=><label className="text-property" key={control.label}><span><T text={control.label}/></span><L><select aria-label={`${control.label} ${name}`} value={control.value} disabled={locked} onChange={e=>{clear();control.set(e.target.value as ConnectionAnchor);}}><option value="min"><T text={axis==='vertical'?'Bottom edge':'Left edge'}/></option><option value="center"><T text="Center"/></option><option value="max"><T text={axis==='vertical'?'Top edge':'Right edge'}/></option></select></L></label>)}
      <p className="stretch-hint"><T text="Current distance"/>: <output data-offset-gap={axis}>{currentGaps?Number(currentGaps[axis].toFixed(3)):'—'}</output> <T text="mm"/></p>
      <L><button type="button" className="inspector-action-button" disabled={locked} onClick={()=>{clear();set('0');}}><T text="Align reference edges (0 mm)"/></button></L>
     </div>}
     <div className="offset-step-field"><L><input id={`offset-${axis}`} inputMode="decimal" aria-label={`${positionMode?'Target':'Offset'} ${name} (mm)`} value={value} disabled={locked} onChange={e=>{clear();set(e.target.value);}} onKeyDown={e=>{
      const plus=axis==='vertical'?'ArrowUp':'ArrowRight',minus=axis==='vertical'?'ArrowDown':'ArrowLeft';
      if(e.key===plus||e.key===minus){e.preventDefault();stepOffset(axis,e.key===plus?1:-1);}
     }}/></L><div className={`range-step-buttons ${axis==='horizontal'?'horizontal-step-buttons':''}`}>
      {axis==='horizontal'&&<L><button type="button" aria-label={`Decrease offset ${name}`} title="Move left along floor" disabled={locked} onClick={()=>stepOffset(axis,-1)}><Decrease size={15}/></button></L>}
      <L><button type="button" aria-label={`Increase offset ${name}`} title={axis==='vertical'?'Move up from floor':'Move right along floor'} disabled={locked} onClick={()=>stepOffset(axis,1)}><Increase size={15}/></button></L>
      {axis==='vertical'&&<L><button type="button" aria-label={`Decrease offset ${name}`} title="Move down towards floor" disabled={locked} onClick={()=>stepOffset(axis,-1)}><Decrease size={15}/></button></L>}
     </div></div>
    </div>)}
    <p className="stretch-hint"><T text="Up/down moves in world Y. Left/right moves along the floor across the connection. The floor axes remain fixed when the model rotates."/></p>
    <label className="text-property"><span><T text="Offset step (mm)"/></span><L><input aria-label="Offset step (mm)" inputMode="decimal" value={step} disabled={locked} onChange={e=>setStep(e.target.value)}/></L></label>
    {[{label:'Fixed protected region (mm)',value:keepFixed,set:setKeepFixed},{label:'Moving protected region (mm)',value:keepMoving,set:setKeepMoving}].map(({label,value,set})=><label className="text-property" key={label}><span><T text={label}/></span><L><input inputMode="decimal" aria-label={label} value={value} disabled={locked} onChange={e=>{clear();set(e.target.value);}}/></L></label>)}
    <L><button type="button" className="inspector-action-button" aria-label="Reset connection position" disabled={locked} onClick={()=>{try{onReset(fixedId,movingId);resetFields();}catch(e){setError(e instanceof Error?e.message:String(e));}}}><RotateCcw size={16}/><T text="Reset to initial position"/></button></L>
    <L><button type="button" className="inspector-action-button" disabled={locked||!floor} onClick={()=>{clear();try{connectionOffsetFrame(connections,{fixedFaceId:fixedId,movingFaceId:movingId,keepFixed:numeric(keepFixed),keepMoving:numeric(keepMoving)});if(floor){if(positionMode){setFixedAnchorU('center');setMovingAnchorU('center');setFixedAnchorV('center');setMovingAnchorV('center');setVertical('0');setHorizontal('0');}else{setVertical(String(Number(floor.centerVertical.toFixed(6))));setHorizontal(String(Number(floor.centerHorizontal.toFixed(6))));}}}catch(e){setError(e instanceof Error?e.message:String(e));}}}><T text="Align flange centers"/></button></L>
    <p className="stretch-hint"><T text={positionMode?'Target distances are measured between the selected reference edges, not added to the previous shift. Preview first, then Apply.':'Offsets are measured from the initial position of this editing session. Arrow steps show a preview; Apply saves the result. Reset restores the original geometry, including previously applied offsets.'}/></p>
    <div className="stretch-actions"><L><button type="button" className="inspector-action-button" disabled={locked} onClick={()=>void run(false)}><T text="Preview connection"/></button></L><L><button type="submit" className="inspector-action-button" disabled={locked}><T text={positionMode?'Apply target position':'Apply connection offset'}/></button></L></div>
    {preview&&<><p role="status" className="stretch-hint"><T text="Preview only. Apply to keep this change."/></p><L><button type="button" className="inspector-action-button" onClick={clear}><T text="Cancel preview"/></button></L></>}
    <p className="stretch-hint"><T text="Large offsets can reduce transition wall thickness. Check the resulting model in the slicer. Ctrl+Z restores the previous shape."/></p>
   </>}
   {error&&<p className="face-annotation-error" role="alert"><T text={error}/></p>}
  </form>}
 </div>;
}
