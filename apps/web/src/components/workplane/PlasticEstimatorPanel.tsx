"use client";
import {useEffect,useRef,useState} from 'react';
import {Calculator,X} from 'lucide-react';
import {L,T} from '@/components/Localization';
import {DEFAULT_PLASTIC_SETTINGS,validatePlasticSettings,type PlasticEstimate,type PlasticGeometry,type PlasticSettings} from '@/lib/plasticEstimate';
import {estimatePlasticInWorker} from "@/lib/plasticEstimateClient";
import type {PlasticScope} from '@/lib/plasticGeometry';
import type {WorkplaneShape} from '@/types/scketch3dweb';
type Draft={ [K in keyof PlasticSettings]:string };
const initialDraft=()=>Object.fromEntries(Object.entries(DEFAULT_PLASTIC_SETTINGS).map(([k,v])=>[k,String(v)])) as Draft;
const number=(value:string)=>value.trim()?Number(value.replace(',','.')):NaN;
export function PlasticEstimatorPanel({open,onClose,shapes,selectedIds,onCapture}:{open:boolean;onClose:()=>void;shapes:WorkplaneShape[];selectedIds:string[];onCapture:(scope:PlasticScope)=>PlasticGeometry}){
 const [draft,setDraft]=useState<Draft>(initialDraft),[material,setMaterial]=useState('pla'),[scope,setScope]=useState<PlasticScope>(selectedIds.length?'selected':'all');
 const [allowApproximateMeshes,setAllowApproximateMeshes]=useState(false);
 const [result,setResult]=useState<PlasticEstimate|null>(null),[stale,setStale]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),revision=useRef(0),panel=useRef<HTMLElement>(null);
 const previousOpen=useRef(false);
 const cancel=()=>{revision.current++;controller.current?.abort();controller.current=null;setBusy(false);};
 const invalidate=()=>{cancel();setStale(true);setError('');};
 useEffect(()=>{if(open&&!previousOpen.current)setScope(selectedIds.length?'selected':'all');previousOpen.current=open;invalidate();},[open,shapes,selectedIds]); // Invalidate only: never starts geometry work.
 useEffect(()=>()=>{revision.current++;controller.current?.abort();},[]);
 useEffect(()=>{if(open){const id=requestAnimationFrame(()=>panel.current?.scrollIntoView({block:'start',behavior:'smooth'}));return()=>cancelAnimationFrame(id);}},[open]);
 const change=(key:keyof Draft,value:string)=>{invalidate();setDraft(previous=>({...previous,[key]:value}));if(key==='density')setMaterial('custom');};
 const calculate=async()=>{
  cancel();setError('');setResult(null);setStale(false);const run=revision.current;
  try{
   const settings=Object.fromEntries(Object.entries(draft).map(([k,v])=>[k,number(v)])) as PlasticSettings;
   validatePlasticSettings(settings);
   const abort=new AbortController();controller.current=abort;setBusy(true);
   await new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
   abort.signal.throwIfAborted();
   const geometry=onCapture(scope);
   const calculated=await estimatePlasticInWorker(geometry,settings,abort.signal,undefined,{allowApproximateMeshes});
   if(run===revision.current)setResult(calculated);
  }catch(e){if(run===revision.current&&!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:String(e));}
  finally{if(run===revision.current){controller.current=null;setBusy(false);}}
 };
 if(!open)return null;
 const format=(value:number,digits=2)=>value.toLocaleString(undefined,{maximumFractionDigits:digits,minimumFractionDigits:2});
 const fields:{key:keyof Draft;label:string;min:number;max:number;step:number}[]=[
  {key:'density',label:'Density (g/cm³)',min:.01,max:30,step:.01},
  {key:'diameter',label:'Filament diameter (mm)',min:.1,max:10,step:.05},
  {key:'infill',label:'Infill (%)',min:0,max:100,step:1},
  {key:'wallThickness',label:'Shell thickness (mm)',min:0,max:100,step:.1},
  {key:'costPerKg',label:'Cost per kg',min:0,max:1e12,step:1},
  {key:'extraPercent',label:'Extra material (%)',min:0,max:1000,step:1},
 ];
 return <L><aside ref={panel} className="plastic-estimator-panel" aria-label="Plastic estimate">
  <div className="property-card"><header className="plastic-estimator-header"><strong><Calculator size={18}/><T text="Plastic estimate"/></strong><button type="button" className="inspector-header-icon" aria-label="Close plastic estimate" onClick={()=>{cancel();onClose();}}><X size={18}/></button></header>
   <form className="property-list" onSubmit={e=>{e.preventDefault();calculate();}}>
    <label className="select-property"><span><T text="Calculate for"/></span><select aria-label="Calculate for" value={scope} onChange={e=>{invalidate();setScope(e.target.value as PlasticScope);}}><option value="selected"><T text="Selected objects"/></option><option value="all"><T text="All visible bodies"/></option></select></label>
    <p className="stretch-hint"><T text="Hidden objects are excluded. Calculation starts only when you press Calculate."/></p>
    <label className="select-property"><span><T text="Filament material"/></span><select aria-label="Filament material" value={material} onChange={e=>{invalidate();const value=e.target.value;setMaterial(value);if(value!=='custom')setDraft(d=>({...d,density:value==='pla'?'1.24':'1.27'}));}}><option value="pla">PLA</option><option value="petg">PETG</option><option value="custom"><T text="Custom density"/></option></select></label>
    {fields.map(({key,label,min,max,step})=><label className="text-property" key={key}><span><T text={label}/></span><input aria-label={label} inputMode="decimal" value={draft[key]} onChange={e=>change(key,e.target.value)} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const value=number(draft[key]);if(Number.isFinite(value))change(key,String(Number(Math.max(min,Math.min(max,value+(e.key==='ArrowUp'?step:-step))).toFixed(4))));}}}/></label>)}
    <label className="plastic-approximate-option"><input type="checkbox" checked={allowApproximateMeshes} onChange={e=>{invalidate();setAllowApproximateMeshes(e.target.checked);}}/><span><T text="Approximate defective meshes"/></span></label>
    <p className="stretch-hint"><T text="Unchecked: defective parts are excluded and the result is marked partial. Enable for a rough assembly estimate; this does not repair the meshes."/></p>
    <p className="stretch-hint"><T text="Use the density on your spool. PLA/PETG presets use Prusament values."/> <a href="https://prusament.com/materials/" target="_blank" rel="noreferrer"><T text="Material data"/></a></p>
    <p className="stretch-hint"><T text="Shell thickness approximates walls and solid surfaces. Extra material is a manual allowance for supports, brim or waste."/></p>
    <button type="submit" className="inspector-action-button plastic-calculate" disabled={busy}><Calculator size={17}/><T text={busy?'Calculating plastic…':'Calculate plastic'}/></button>
    {busy&&<><p className="stretch-hint" role="status"><T text="Calculating plastic…"/></p><button type="button" className="inspector-action-button" onClick={cancel}><T text="Cancel calculation"/></button></>}
    {error&&<p role="alert" className="face-annotation-error">{error}</p>}
    {stale&&result&&<p className="plastic-stale" role="status"><T text="Settings or model changed. Press Calculate again."/></p>}
    {result&&<div className={`plastic-estimate-results ${stale?'stale':''}`} aria-label="Plastic estimate result" aria-live="polite">
     <strong className="plastic-result-quality"><T text={result.isPartial?"Partial estimate":result.approximateObjectCount?"Approximate mesh estimate":"All requested objects counted"}/></strong>
     <dl>
      <div><dt><T text="Estimated material"/></dt><dd data-plastic="mass">≈ {format(result.massG)} <T text="g"/></dd></div>
      <div><dt><T text="Material cost"/></dt><dd data-plastic="cost">≈ {format(result.materialCost)}</dd></div>
      <div><dt><T text="Filament length"/></dt><dd data-plastic="length">≈ {format(result.filamentM)} <T text="m"/></dd></div>
      <div><dt><T text="Model material volume"/></dt><dd data-plastic="volume">{format(result.volumeCm3)} <T text="cm³"/></dd></div>
      <div><dt><T text="Mass at 100% infill"/></dt><dd data-plastic="solid">{format(result.solidMassG)} <T text="g"/></dd></div>
      <div><dt><T text="Objects counted"/></dt><dd data-plastic="objects">{result.objectCount} / {result.requestedObjectCount}</dd></div>
     </dl>
     {result.approximateObjectCount>0&&<p className="stretch-hint"><T text="Approximate objects"/>: <span data-plastic="approximate">{result.approximateObjectCount}</span></p>}
     {result.excludedObjectCount>0&&<p className="plastic-stale"><T text="Excluded objects"/>: <span data-plastic="excluded">{result.excludedObjectCount}</span></p>}
     {result.bodyResults.some(b=>b.status!=='validated')&&<details className="plastic-body-diagnostics"><summary><T text="Mesh diagnostics by object"/></summary>{result.bodyResults.filter(b=>b.status!=='validated').map(b=><div key={b.id}><strong>{b.name}</strong><small><T text={b.status==='excluded'?'Excluded from total':'Approximate objects'}/></small><p>{b.reason}</p></div>)}</details>}
     {result.warnings.map(w=><p key={w} className="stretch-hint">{w}</p>)}
     <p className="stretch-hint"><T text="Approximate FDM estimate, not sliced toolpaths. Shell volume uses surface area × thickness, capped by material volume. Exact consumption depends on slicing; supports are not generated automatically."/></p>
    </div>}
   </form></div>
 </aside></L>;
}
