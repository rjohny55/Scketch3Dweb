export type RulerLabelBox={id:string;x:number;y:number;width:number;height:number};
/** Stable vertical lanes using measured DOM sizes, not character-count estimates. */
export function layoutRulerLabels(labels:RulerLabelBox[],width:number,height:number,gap=6,reserved:RulerLabelBox[]=[]):RulerLabelBox[]{
 const placed:RulerLabelBox[]=[...reserved],margin=4;
 for(const label of labels){
  const half=label.height/2,x=Math.max(label.width/2+margin,Math.min(width-label.width/2-margin,label.x));
  const lo=half+margin,hi=Math.max(lo,height-half-margin),clamp=(y:number)=>Math.max(lo,Math.min(hi,y));
  const blockers=placed.filter(p=>Math.abs(p.x-x)<(p.width+label.width)/2+gap);
  const candidates=[clamp(label.y),...blockers.flatMap(p=>[clamp(p.y-(p.height+label.height)/2-gap),clamp(p.y+(p.height+label.height)/2+gap)])];
  candidates.sort((a,b)=>Math.abs(a-label.y)-Math.abs(b-label.y)||a-b);
  // If the viewport is genuinely full, keep labels separate rather than hide a reading.
  const y=candidates.find(y=>blockers.every(p=>Math.abs(y-p.y)>=(p.height+label.height)/2+gap-.01))
   ??Math.max(lo,...blockers.map(p=>p.y+p.height/2+half+gap));
  placed.push({...label,x,y});
 }
 return placed.slice(reserved.length);
}
