import {expect,it} from "vitest";
import {SessionActionHistory,historyMetadata,withHistoryMetadata} from "@/lib/sessionActionHistory";
it("interleaves ruler and model undo/redo in chronological order, including older persisted model actions",()=>{
 const h=new SessionActionHistory();let ruler=1;h.recordModel();h.recordTransient({undo:()=>ruler=0,redo:()=>ruler=1});h.recordModel();
 expect(h.undoTransient()).toBe(false);h.modelUndone();expect(h.undoTransient()).toBe(true);expect(ruler).toBe(0);
 expect(h.undoTransient()).toBe(false);h.modelUndone();expect(h.redoTransient()).toBe(false);h.modelRedone();expect(h.redoTransient()).toBe(true);expect(ruler).toBe(1);
 expect(h.redoTransient()).toBe(false);h.modelRedone();h.clear();h.modelUndone();expect(h.redoTransient()).toBe(false);h.modelRedone();
});
it('keeps row identity, actors and cursor while traversing a mixed timeline',()=>{
 const h=new SessionActionHistory(2,1);let point=0;h.recordTransient({undo:()=>point=0,redo:()=>point=1});
 withHistoryMetadata({actor:'agent',description:'Resize length'},()=>h.recordModel());
 const rows=h.entries;expect(rows.at(-1)).toMatchObject({actor:'agent',description:'Resize length',step:4});expect(h.cursor).toBe(4);
 h.modelUndone();h.undoTransient();expect(h.cursor).toBe(2);expect(point).toBe(0);h.redoTransient();h.modelRedone();expect(h.entries.map(e=>e.id)).toEqual(rows.map(e=>e.id));expect(point).toBe(1);
 expect(h.canTravelTo(0,2,0)).toBe(false);expect(h.canTravelTo(0,3,0)).toBe(true);expect(h.canTravelTo(99,9,9)).toBe(false);
});
it('restores attribution after scoped commits and exceptions',()=>{
 expect(historyMetadata().actor).toBe('user');
 expect(()=>withHistoryMetadata({actor:'agent'},()=>{expect(historyMetadata().actor).toBe('agent');throw Error('failed');})).toThrow('failed');
 expect(historyMetadata().actor).toBe('user');
});
it('removes expired model rows when the configured history limit shrinks',()=>{
 const h=new SessionActionHistory(4,2);h.limitModels(1,1);expect(h.cursor).toBe(1);expect(h.entries).toHaveLength(2);expect(h.canTravelTo(0,1,1)).toBe(true);
});
it("invalidates redo after a new ruler or model action and clears callbacks on project change",()=>{
 const h=new SessionActionHistory();let ruler=1;const action={undo:()=>ruler=0,redo:()=>ruler=1};h.recordTransient(action);h.undoTransient();expect(h.canRedoTransient).toBe(true);
 h.recordModel();expect(h.canRedoTransient).toBe(false);h.modelUndone();h.recordTransient(action);expect(h.redoTransient()).toBe(false);h.clear();expect(h.undoTransient()).toBe(false);expect(ruler).toBe(0);
});
