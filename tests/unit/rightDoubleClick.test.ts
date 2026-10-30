import {expect,it} from "vitest";
import {RightDoubleClick} from "@/lib/rightDoubleClick";
const right=(x=10,y=10)=>({pointerId:1,button:2,clientX:x,clientY:y});
it("recognizes two nearby right clicks, not single, distant or slow clicks",()=>{
 const g=new RightDoubleClick();g.pointerDown(right(),0);expect(g.pointerUp(right(),40)).toBe(false);g.pointerDown(right(12),100);expect(g.pointerUp(right(12),140)).toBe(true);
 g.pointerDown(right(),200);expect(g.pointerUp(right(),240)).toBe(false);g.pointerDown(right(50),300);expect(g.pointerUp(right(50),340)).toBe(false);g.pointerDown(right(50),1000);expect(g.pointerUp(right(50),1040)).toBe(false);
});
it("excludes drags even when they return to the starting point, long holds, cancellation and intervening left clicks",()=>{
 const g=new RightDoubleClick();g.pointerDown(right(),0);g.pointerMove(right(50));g.pointerMove(right());expect(g.pointerUp(right(),50)).toBe(false);g.pointerDown(right(),100);expect(g.pointerUp(right(),150)).toBe(false);
 g.pointerDown(right(),200);expect(g.pointerUp(right(),800)).toBe(false);g.pointerDown(right(),850);expect(g.pointerUp(right(),900)).toBe(false);
 g.reset();g.pointerDown(right(),1000);g.pointerUp(right(),1050);g.pointerDown({...right(),button:0},1100);g.pointerDown(right(),1150);expect(g.pointerUp(right(),1200)).toBe(false);
 g.reset();g.pointerDown(right(),1250);expect(g.pointerUp(right(),1300)).toBe(false);
});
