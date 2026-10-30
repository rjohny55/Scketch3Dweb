import data from './tutorialLessonsData.json';
import type {ChallengeTutorialId} from './challenges';
import type {WorkplaneShape} from '@/types/scketch3dweb';
export type LessonStep={title:string;instruction:string;target:string;rule?:string;checkText?:string};
export type TutorialLesson={id:ChallengeTutorialId;title:string;description:string;duration:string;skills:string[];steps:LessonStep[]};
export const TUTORIAL_LESSONS=data as TutorialLesson[];
export const lessonById=(id:ChallengeTutorialId)=>TUTORIAL_LESSONS.find(lesson=>lesson.id===id)!;
const near=(a:number,b:number)=>Number.isFinite(a)&&Math.abs(a-b)<0.05;
const size=(s:WorkplaneShape,depth:number,width:number,height:number)=>near(s.depth,depth)&&near(s.width,width)&&near(s.height,height);
export function lessonStepSatisfied(rule:string|undefined,shapes:readonly WorkplaneShape[]):boolean {
 switch(rule){
  case 'box':return shapes.some(s=>s.kind==='box'&&!s.hole&&!s.groupedShapes?.length);
  case 'block-size':return shapes.some(s=>s.kind==='box'&&!s.hole&&size(s,30,20,5));
  case 'plate-size':return shapes.some(s=>s.kind==='box'&&!s.hole&&size(s,40,30,4));
  case 'drill-size':return shapes.some(s=>s.kind==='cylinder'&&size(s,6,6,8)&&near(s.elevation??0,0));
  case 'cutter-cylinder':return shapes.some(s=>s.kind==='cylinder'&&s.hole&&size(s,6,6,8));
  case 'outer-size':return shapes.some(s=>s.kind==='box'&&!s.hole&&size(s,50,40,20)&&near(s.elevation??0,0));
  case 'inner-size':return shapes.some(s=>s.kind==='box'&&size(s,44,34,20)&&near(s.elevation??0,3));
  case 'cutter-box':return shapes.some(s=>s.kind==='box'&&s.hole&&size(s,44,34,20)&&near(s.elevation??0,3));
  case 'grouped':return shapes.length===1&&(shapes[0].groupedShapes?.length??0)>=2;
  default:return false;
 }
}
