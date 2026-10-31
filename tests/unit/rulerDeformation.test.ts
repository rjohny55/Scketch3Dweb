import {it,expect} from 'vitest';
import {deformRulerPoint,undeformRulerPoint,deformRulerPolyline,validateRulerDeformations,type RulerDeformationStep} from '@/lib/rulerDeformation';
const step:RulerDeformationStep={direction:[1,0,0],low:-8,high:8,delta:[-3,4,0],center:[-1.5,2,0],sourceSize:[20,10,12],targetSize:[17,14,12]};
it('round-trips points in rigid ends and the deformed middle, including axial displacement',()=>{
 validateRulerDeformations([step]);
 for(const x of [-.5,-.4,-.2,0,.2,.4,.5]){
  const p=[x,.45,-.2],next=deformRulerPoint(p,[step]);
  undeformRulerPoint(next,[step]).forEach((n,i)=>expect(n).toBeCloseTo(p[i],10));
 }
});
it('splits an edge at the fixed and moving protection boundaries rather than drawing a floating chord',()=>{
 const path=deformRulerPolyline([[-.5,.5,0],[.5,.5,0]],[step]);
 expect(path).toHaveLength(4);
 expect(path[0]).toEqual(deformRulerPoint([-.5,.5,0],[step]));
 expect(path[3]).toEqual(deformRulerPoint([.5,.5,0],[step]));
});
it('rejects malformed, noninvertible and oversized deformation records at the import boundary',()=>{
 expect(()=>validateRulerDeformations([{...step,delta:[-16,0,0]}])).toThrow();
 expect(()=>validateRulerDeformations([{...step,sourceSize:[0,1,1]}])).toThrow();
 expect(()=>validateRulerDeformations([{...step,center:[NaN,0,0]}])).toThrow();
 expect(()=>validateRulerDeformations(Array(1025).fill(step))).toThrow();
});
