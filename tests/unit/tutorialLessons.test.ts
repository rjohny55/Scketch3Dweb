import {describe,it,expect} from 'vitest';
import {lessonStepSatisfied,TUTORIAL_LESSONS} from '../../apps/web/src/lib/tutorialLessons';
import {isChallengeTutorialId} from '../../apps/web/src/lib/challenges';
import type {WorkplaneShape} from '../../apps/web/src/types/scketch3dweb';
const box=(patch:Partial<WorkplaneShape>={}):WorkplaneShape=>({id:'part',name:'Part',kind:'box',color:'#4488ee',x:0,z:0,size:30,width:20,depth:30,height:5,rotation:0,...patch});
describe('guided lesson scene checks',()=>{
 it('requires exact dimensions and rejects cutters as the solid base',()=>{
  expect(lessonStepSatisfied('block-size',[box()])).toBe(true);
  expect(lessonStepSatisfied('block-size',[box({height:6})])).toBe(false);
  expect(lessonStepSatisfied('block-size',[box({hole:true})])).toBe(false);
  expect(lessonStepSatisfied('block-size',[box({width:NaN})])).toBe(false);
 });
 it('requires the cavity to leave a 3 mm floor',()=>{
  const cavity=box({width:34,depth:44,height:20,elevation:3,hole:true});
  expect(lessonStepSatisfied('cutter-box',[cavity])).toBe(true);
  expect(lessonStepSatisfied('cutter-box',[{...cavity,elevation:0}])).toBe(false);
  expect(lessonStepSatisfied('inner-size',[{...cavity,elevation:4}])).toBe(false);
 });
 it('checks cylinder size, cutter state and grouping independently',()=>{
  const drill=box({kind:'cylinder',width:6,depth:6,height:8});
  expect(lessonStepSatisfied('drill-size',[drill])).toBe(true);
  expect(lessonStepSatisfied('cutter-cylinder',[drill])).toBe(false);
  expect(lessonStepSatisfied('cutter-cylinder',[{...drill,hole:true}])).toBe(true);
  expect(lessonStepSatisfied('grouped',[box(),drill])).toBe(false);
  expect(lessonStepSatisfied('grouped',[box({groupedShapes:[box(),drill]})])).toBe(true);
 });
 it('offers three new lessons with no stale tutorial identifiers',()=>{
  expect(TUTORIAL_LESSONS).toHaveLength(3);
  expect(TUTORIAL_LESSONS.every(l=>isChallengeTutorialId(l.id)&&l.steps.length>=6)).toBe(true);
  expect(isChallengeTutorialId('key-tag')).toBe(false);
  expect(isChallengeTutorialId('nameplate')).toBe(false);
 });
});
