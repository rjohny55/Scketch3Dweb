"use client";
import {ChevronLeft,ChevronRight,type LucideIcon} from 'lucide-react';
import {useLayoutEffect,useRef,useState} from 'react';
import {L,T} from '@/components/Localization';
export type QuickModelingAction={id:string;label:string;short:string;icon:LucideIcon;run:()=>void;disabled?:boolean;active?:boolean};
export type InspectorSectionRequest={section:string;sequence:number;shapeId:string};
export function ModelingQuickTools({actions,mode}:{actions:QuickModelingAction[];mode:string}){
 const list=useRef<HTMLDivElement>(null),navigation=useRef<HTMLDivElement>(null);const [overflow,setOverflow]=useState(false);
 useLayoutEffect(()=>{const element=list.current,nav=navigation.current;if(!element||!nav)return;const update=()=>setOverflow(element.scrollWidth>nav.clientWidth+1);update();const observer=new ResizeObserver(update);observer.observe(element);observer.observe(nav);return()=>observer.disconnect();},[actions.length,mode]);
 return <L><section className="toolbar-section modeling-quick-tools" aria-label="Quick modeling tools"><div className="toolbar-section-label"><T text={mode}/></div><div ref={navigation} className="modeling-quick-navigation">{overflow&&<L><button type="button" className="quick-scroll" aria-label="Previous editing tools" onClick={()=>list.current?.scrollBy({left:-180,behavior:'smooth'})}><ChevronLeft size={13}/></button></L>}<div ref={list} className="toolbar-section-tools modeling-quick-list">{actions.map(({id,label,short,icon:Icon,run,disabled,active})=><L key={id}><button type="button" className={`toolbar-icon modeling-quick-button ${active?'active':''}`} data-modeling-action={id} aria-label={`Quick: ${label}`} title={label} disabled={disabled} aria-pressed={active===undefined?undefined:active} onClick={run}><Icon size={23} strokeWidth={1.8}/><span><T text={short}/></span></button></L>)}</div>{overflow&&<L><button type="button" className="quick-scroll" aria-label="Next editing tools" onClick={()=>list.current?.scrollBy({left:180,behavior:'smooth'})}><ChevronRight size={13}/></button></L>}</div></section></L>;
}
