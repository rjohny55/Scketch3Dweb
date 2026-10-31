import {it,expect} from 'vitest';
import {restoreRulerState} from '@/lib/rulerState';
import {assertMcpCommandActive} from '@/lib/scketch3dwebMcpProtocol';
it('persists face-level anchors and rejects malformed attachment coordinates',()=>{
 const state={points:[{id:'a',x:0,y:0,z:0,attachment:{shapeId:'part',normalized:[0,0,0],faceAnchor:{faceId:'flange',offset:[1,2,3]}}},{id:'b',x:1,y:0,z:0}],segments:[{id:'s',startId:'a',endId:'b'}]};
 const restored=restoreRulerState(state);expect(restored).toEqual(state);
 restored.points[0].attachment!.faceAnchor!.offset[0]=9;
 expect(state.points[0].attachment!.faceAnchor!.offset[0]).toBe(1);
 state.points[0].attachment!.faceAnchor!.offset[0]=NaN;
 expect(()=>restoreRulerState(state)).toThrow(/coordinate/);
});
it('rejects duplicate points, nonfinite coordinates and oversized ruler state',()=>{
 const p={id:'a',x:0,y:0,z:0};
 expect(()=>restoreRulerState({points:[p,p],segments:[]})).toThrow(/Duplicate/);
 expect(()=>restoreRulerState({points:[{...p,x:NaN}],segments:[]})).toThrow(/coordinate/);
 expect(()=>restoreRulerState({points:Array(10001).fill(p),segments:[]})).toThrow(/collection/);
});
it('round-trips edge rulers without sharing mutable arrays',()=>{
 const state={points:[{id:'a',x:0,y:0,z:0},{id:'b',x:1,y:0,z:0}],segments:[{id:'line',startId:'a',endId:'b',edge:{key:'edge',shapeId:'box',topologyKey:'nested-group-'.repeat(100),normalizedPoints:[[0,0,0],[1,0,0]]}}]};
 const restored=restoreRulerState(state);
 expect(restored).toEqual(state);
 restored.segments[0].edge!.normalizedPoints[0][0]=9;
 expect(state.segments[0].edge.normalizedPoints[0][0]).toBe(0);
});
it('refuses a stale command at the browser mutation boundary',()=>{
 expect(()=>assertMcpCommandActive({createdAt:Date.now()-2000,expiresAt:Date.now()-1})).toThrow(/expired/);
 expect(()=>assertMcpCommandActive({createdAt:Date.now(),expiresAt:Date.now()+1000})).not.toThrow();
});
