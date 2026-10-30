export type TransientHistoryAction = { undo: () => void; redo: () => void };
type Action = { kind: "model" } | ({ kind: "transient" } & TransientHistoryAction);

/** Orders transient editor actions together with the existing persisted model history. */
export class SessionActionHistory {
  private past: Action[] = [];
  private future: Action[] = [];
  get canUndoTransient() { return this.past.at(-1)?.kind === "transient"; }
  get canRedoTransient() { return this.future.at(-1)?.kind === "transient"; }
  recordModel() { this.record({ kind: "model" }); }
  recordTransient(action: TransientHistoryAction) { this.record({ kind: "transient", ...action }); }
  private record(action: Action) { this.past.push(action); this.future = []; if(this.past.length>5000)this.past.shift(); }
  undoTransient() {
    if(!this.canUndoTransient)return false;
    const action=this.past.pop()! as Action & TransientHistoryAction;action.undo();this.future.push(action);return true;
  }
  redoTransient() {
    if(!this.canRedoTransient)return false;
    const action=this.future.pop()! as Action & TransientHistoryAction;action.redo();this.past.push(action);return true;
  }
  modelUndone() { if(this.past.at(-1)?.kind==="model")this.past.pop();this.future.push({kind:"model"}); }
  modelRedone() { if(this.future.at(-1)?.kind==="model")this.future.pop();this.past.push({kind:"model"}); }
  clear() { this.past=[];this.future=[]; }
}
