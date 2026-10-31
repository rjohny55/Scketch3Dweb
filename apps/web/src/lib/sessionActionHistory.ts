export type HistoryMetadata={actor:'user'|'agent'|'unknown';description:string;timestamp:number};
export type TransientHistoryAction={undo:()=>void;redo:()=>void;metadata?:HistoryMetadata};
type Action={kind:'model'|'transient';id:number;metadata:HistoryMetadata;undo?:()=>void;redo?:()=>void};
let context:Partial<HistoryMetadata>|undefined;
/** Scope only the synchronous commit, never the asynchronous calculation preceding it. */
export function withHistoryMetadata<T>(metadata:Partial<HistoryMetadata>,commit:()=>T):T{const previous=context;context=metadata;try{return commit();}finally{context=previous;}}
export function historyMetadata(description='Edit model'):HistoryMetadata{return{actor:context?.actor??'user',description:context?.description??description,timestamp:context?.timestamp??Date.now()};}
const saved=():HistoryMetadata=>({actor:'unknown',description:'Saved model step',timestamp:0});
/** Orders transient ruler changes with persisted model steps. Cursor is the applied operation count. */
export class SessionActionHistory {
 private past:Action[]=[];private future:Action[]=[];private sequence=0;
 constructor(pastModels=0,futureModels=0){this.resetModels(pastModels,futureModels);}
 private model(metadata=saved()):Action{return{kind:'model',id:++this.sequence,metadata};}
 get cursor(){return this.past.length;}
 get entries(){return [...this.past,...this.future.slice().reverse()].map((a,i)=>({id:a.id,step:i+1,kind:a.kind,...a.metadata,applied:i<this.past.length}));}
 get canUndoTransient(){return this.past.at(-1)?.kind==='transient';}
 get canRedoTransient(){return this.future.at(-1)?.kind==='transient';}
 recordModel(metadata=historyMetadata()){this.record(this.model(metadata));}
 recordTransient(action:TransientHistoryAction){this.record({kind:'transient',id:++this.sequence,metadata:action.metadata??historyMetadata('Edit ruler'),undo:action.undo,redo:action.redo});}
 private record(action:Action){this.past.push(action);this.future=[];if(this.past.length>5000)this.past.shift();}
 undoTransient(){if(!this.canUndoTransient)return false;const a=this.past.at(-1)!;a.undo!();this.past.pop();this.future.push(a);return true;}
 redoTransient(){if(!this.canRedoTransient)return false;const a=this.future.at(-1)!;a.redo!();this.future.pop();this.past.push(a);return true;}
 modelUndone(){this.future.push(this.past.at(-1)?.kind==='model'?this.past.pop()!:this.model());}
 modelRedone(){this.past.push(this.future.at(-1)?.kind==='model'?this.future.pop()!:this.model());}
 resetModels(pastModels=0,futureModels=0){this.past=Array.from({length:pastModels},()=>this.model());this.future=Array.from({length:futureModels},()=>this.model()).reverse();}
 limitModels(pastModels:number,futureModels:number){for(const [actions,limit] of [[this.past,pastModels],[this.future,futureModels]] as const){let count=actions.filter(a=>a.kind==='model').length;while(count>limit){const i=actions.findIndex(a=>a.kind==='model');actions.splice(0,i+1);count--;}}}
 canTravelTo(target:number,pastModels:number,futureModels:number){if(!Number.isInteger(target)||target<0||target>this.past.length+this.future.length)return false;const actions=target<this.cursor?this.past.slice(target):this.future.slice().reverse().slice(0,target-this.cursor);return actions.filter(a=>a.kind==='model').length<=(target<this.cursor?pastModels:futureModels);}
 clear(){this.past=[];this.future=[];}
}
