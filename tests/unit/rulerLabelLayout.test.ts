import {expect,it} from 'vitest';
import {layoutRulerLabels,type RulerLabelBox} from '@/lib/rulerLabelLayout';
const label=(id:string,x=200,y=200,width=150,height=28):RulerLabelBox=>({id,x,y,width,height});
const separated=(a:RulerLabelBox,b:RulerLabelBox)=>Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2+5.9;
it('leaves separated readings in place',()=>{const input=[label('a'),label('b',500,200)];expect(layoutRulerLabels(input,1000,800)).toEqual(input);});
it('does not put a shifted reading over a clickable ruler point',()=>{const point=label('point',200,200,16,16),[reading]=layoutRulerLabels([label('reading')],1000,800,6,[point]);expect(separated(reading,point)).toBe(true);});
it('separates nearby parallel ruler readings and the live preview',()=>{const input=[label('a'),label('b',201,203),label('preview',200,201)];const result=layoutRulerLabels(input,1000,800);expect(result[0]).toEqual(input[0]);for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)expect(separated(result[i],result[j])).toBe(true);expect(layoutRulerLabels(input,1000,800)).toEqual(result);});
it('uses measured sizes and keeps a stack inside viewport edges',()=>{const result=layoutRulerLabels(Array.from({length:8},(_,i)=>label(String(i),25,5,180+i*2,24+i)),600,500);for(let i=0;i<result.length;i++){const a=result[i];expect(a.x-a.width/2).toBeGreaterThanOrEqual(4);expect(a.y-a.height/2).toBeGreaterThanOrEqual(4);expect(a.y+a.height/2).toBeLessThanOrEqual(496);for(let j=i+1;j<result.length;j++)expect(separated(a,result[j])).toBe(true);}});
