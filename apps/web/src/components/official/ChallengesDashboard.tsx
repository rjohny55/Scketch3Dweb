"use client";
import {useEffect,useState} from 'react';
import {ArrowUpRight,BookOpen,Box,Check,Clock3,Container,Drill} from 'lucide-react';
import {T} from '@/components/Localization';
import {TUTORIAL_LESSONS} from '@/lib/tutorialLessons';
import type {ChallengeTutorialId} from '@/lib/challenges';
const icons=[Box,Drill,Container];
export default function ChallengesDashboard({onStartChallenge}:{onStartChallenge:(id:ChallengeTutorialId)=>void}) {
 const [completed,setCompleted]=useState<string[]>([]);
 useEffect(()=>{setCompleted(TUTORIAL_LESSONS.filter(l=>localStorage.getItem(`scketch3dweb.lessonCompleted.${l.id}`)).map(l=>l.id));},[]);
 return <div className="dashboard-lessons-page">
  <header className="dashboard-welcome dashboard-section-welcome"><div><span className="dashboard-eyebrow"><span aria-hidden="true"/><T text="Learn by making"/></span><h1><T text="Challenges"/></h1><p><T text="From your first shape to a finished model, one step at a time."/></p></div><span className="dashboard-section-symbol" aria-hidden="true"><BookOpen size={27}/></span></header>
  <div className="dashboard-section-meta"><span><T text="Three practical guided projects"/></span><span><T text="Step by step"/></span></div>
  <div className="dashboard-lesson-grid">{TUTORIAL_LESSONS.map((lesson,index)=>{const Icon=icons[index];return <article className={`dashboard-lesson-card lesson-${lesson.id}`} key={lesson.id}>
   <div className="dashboard-lesson-visual" aria-hidden="true"><span className="lesson-number">0{index+1}</span><Icon size={76} strokeWidth={1}/><span className="lesson-visual-grid"/></div>
   <div className="dashboard-lesson-content"><span className="dashboard-lesson-duration"><Clock3 size={13}/><T text={lesson.duration}/>{completed.includes(lesson.id)&&<span className="lesson-completed"><Check size={13}/><T text="Lesson completed"/></span>}</span><h2><T text={lesson.title}/></h2><p><T text={lesson.description}/></p><div className="dashboard-lesson-skills">{lesson.skills.map(skill=><span key={skill}><T text={skill}/></span>)}</div><button type="button" data-start-lesson={lesson.id} onClick={()=>onStartChallenge(lesson.id)}><T text="Start lesson"/><ArrowUpRight size={17}/></button></div>
  </article>;})}</div>
 </div>;
}
