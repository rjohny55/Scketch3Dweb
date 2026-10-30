import {expect,it} from "vitest";
import {SessionActionHistory} from "@/lib/sessionActionHistory";
it("interleaves ruler and model undo/redo in chronological order, including older persisted model actions",()=>{
 const h=new SessionActionHistory();let ruler=1;h.recordModel();h.recordTransient({undo:()=>ruler=0,redo:()=>ruler=1});h.recordModel();
 expect(h.undoTransient()).toBe(false);h.modelUndone();expect(h.undoTransient()).toBe(true);expect(ruler).toBe(0);
 expect(h.undoTransient()).toBe(false);h.modelUndone();expect(h.redoTransient()).toBe(false);h.modelRedone();expect(h.redoTransient()).toBe(true);expect(ruler).toBe(1);
 expect(h.redoTransient()).toBe(false);h.modelRedone();h.clear();h.modelUndone();expect(h.redoTransient()).toBe(false);h.modelRedone();
});
it("invalidates redo after a new ruler or model action and clears callbacks on project change",()=>{
 const h=new SessionActionHistory();let ruler=1;const action={undo:()=>ruler=0,redo:()=>ruler=1};h.recordTransient(action);h.undoTransient();expect(h.canRedoTransient).toBe(true);
 h.recordModel();expect(h.canRedoTransient).toBe(false);h.modelUndone();h.recordTransient(action);expect(h.redoTransient()).toBe(false);h.clear();expect(h.undoTransient()).toBe(false);expect(ruler).toBe(0);
});
