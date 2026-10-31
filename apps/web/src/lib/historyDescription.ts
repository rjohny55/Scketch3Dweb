import type {WorkplaneShape} from '@/types/scketch3dweb';
export function describeHistoryChange(before:WorkplaneShape[],after:WorkplaneShape[]):string{
 const old=new Map(before.map(s=>[s.id,s]));
 if(after.some(s=>!old.has(s.id)))return 'Create object';
 if(before.some(s=>!after.some(n=>n.id===s.id)))return 'Delete object';
 for(const next of after){const previous=old.get(next.id);if(!previous)continue;
  if(['x','z','elevation'].some(k=>previous[k as keyof WorkplaneShape]!==next[k as keyof WorkplaneShape]))return 'Move object';
  if(['width','height','depth'].some(k=>previous[k as keyof WorkplaneShape]!==next[k as keyof WorkplaneShape]))return 'Resize object';
  if(['rotationX','rotationY','rotationZ','rotation'].some(k=>previous[k as keyof WorkplaneShape]!==next[k as keyof WorkplaneShape]))return 'Rotate object';
  if(previous.hidden!==next.hidden)return 'Change object visibility';
  if(previous.locked!==next.locked)return 'Change object lock';
  if(previous.name!==next.name)return 'Rename object';
  if(previous.faceAnnotations!==next.faceAnnotations)return 'Edit face label';
  if(previous.facePaints!==next.facePaints)return 'Paint face';
 }
 return 'Edit model';
}
