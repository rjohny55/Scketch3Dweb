"use client";
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,ChevronLeft,ChevronRight,LocateFixed,RotateCcw,X} from 'lucide-react';
import {L,T} from '@/components/Localization';
import {lessonById,lessonStepSatisfied} from '@/lib/tutorialLessons';
import type {ChallengeTutorialId} from '@/lib/challenges';
import type {WorkplaneShape} from '@/types/scketch3dweb';
export function GuidedLessonPanel({lessonId,projectId,shapes,onFinish,collapsed,onCollapsedChange}:{lessonId:ChallengeTutorialId;projectId?:string|null;shapes:WorkplaneShape[];onFinish?:()=>void;collapsed:boolean;onCollapsedChange:(value:boolean)=>void}) {
 const lesson=lessonById(lessonId),storageKey=`scketch3dweb.guidedLesson.v1.${lessonId}.${projectId??'local'}`;
 const [index,setIndex]=useState(()=>{if(typeof window==='undefined')return 0;const n=Number(localStorage.getItem(storageKey));return Number.isInteger(n)?Math.max(0,Math.min(lesson.steps.length-1,n)):0;});
 const [confirmed,setConfirmed]=useState(false),[available,setAvailable]=useState(false),target=useRef<HTMLElement|null>(null),body=useRef<HTMLDivElement|null>(null);
 const step=lesson.steps[index],verified=lessonStepSatisfied(step.rule,shapes),ready=step.rule?verified:confirmed;
 useEffect(()=>{setConfirmed(false);body.current?.scrollTo({top:0});localStorage.setItem(storageKey,String(index));},[index,storageKey]);
 useEffect(()=>{
  if(collapsed)return;
  let frame=0;
  const update=()=>{frame=0;const next=Array.from(document.querySelectorAll<HTMLElement>(step.target)).find(e=>e.getClientRects().length>0)??null;if(next!==target.current){target.current?.classList.remove('tutorial-tool-target');target.current=next;}if(next&&!next.classList.contains('tutorial-tool-target'))next.classList.add('tutorial-tool-target');setAvailable(Boolean(next&&!next.matches(':disabled')));};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};update();const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','class']});window.addEventListener('resize',schedule);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);target.current?.classList.remove('tutorial-tool-target');target.current=null;};
 },[step.target,collapsed]);
 const next=()=>{if(!ready)return;if(index===lesson.steps.length-1){localStorage.setItem(`scketch3dweb.lessonCompleted.${lessonId}`,new Date().toISOString());onFinish?.();}else setIndex(index+1);};
 if(collapsed)return <L><aside className="key-tag-tutorial-panel key-tag-tutorial-panel-collapsed guided-lesson-panel" aria-label="Guided lesson"><button type="button" aria-label="Expand challenge instructions" onClick={()=>onCollapsedChange(false)}><ChevronLeft size={19}/></button><span className="key-tag-tutorial-collapsed-label"><T text={lesson.title}/></span><span>{index+1}/{lesson.steps.length}</span></aside></L>;
 return <L><aside className="key-tag-tutorial-panel guided-lesson-panel" aria-label="Guided lesson" data-lesson-id={lessonId} onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
  <header className="guided-lesson-header"><div><span><T text="Guided lesson"/> · {index+1}/{lesson.steps.length}</span><strong><T text={lesson.title}/></strong></div><div><button type="button" aria-label="Minimize challenge instructions" onClick={()=>onCollapsedChange(true)}><ChevronRight size={18}/></button><button type="button" aria-label="Exit lesson" onClick={onFinish}><X size={18}/></button></div></header>
  <div ref={body} className="guided-lesson-body"><div className="guided-lesson-progress" role="progressbar" aria-label="Guided lesson" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={index}><span style={{width:`${index/lesson.steps.length*100}%`}}/></div><span className="guided-lesson-step-number">0{index+1}</span><h2><T text={step.title}/></h2><p><T text={step.instruction}/></p><button className="guided-lesson-locate" type="button" disabled={!available} onClick={()=>{target.current?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});target.current?.focus({preventScroll:true});}}><LocateFixed size={16}/><T text="Show tool"/></button>
   {!available&&<p className="guided-lesson-hint" role="status"><T text="Select the object or open the required toolbar mode to reveal this tool."/></p>}
   {step.rule?<div className={`guided-lesson-check ${verified?'verified':''}`} role="status"><CheckCircle2 size={20}/><div><strong><T text={verified?'Step verified in the scene':'Waiting for the scene to match this step.'}/></strong><span><T text={step.checkText??''}/></span></div></div>:<label className="guided-lesson-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span><T text="I have completed this step"/></span></label>}
   <details className="guided-lesson-outline"><summary><T text="Step by step"/></summary><ol>{lesson.steps.map((s,i)=><li key={s.title} aria-current={i===index?'step':undefined}><T text={s.title}/></li>)}</ol></details>
  </div>
  <footer className="guided-lesson-footer"><button type="button" aria-label="Restart lesson" onClick={()=>{setIndex(0);setConfirmed(false);}}><RotateCcw size={15}/></button><button type="button" disabled={index===0} onClick={()=>setIndex(index-1)}><ChevronLeft size={15}/><T text="Back"/></button><button type="button" className="primary" disabled={!ready} onClick={next}><T text={index===lesson.steps.length-1?'Finish lesson':'Next'}/><ChevronRight size={15}/></button></footer>
 </aside></L>;
}
