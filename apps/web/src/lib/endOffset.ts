import * as THREE from 'three';
import {clipDeformationPolygon,deformRenderedShape,type MeshDeformation} from '@/lib/axialStretch';
import {faceGeometryKey} from '@/lib/faceAnnotations';
import type {FaceAnnotation,WorkplaneShape} from '@/types/scketch3dweb';
type Point=[number,number,number];
export type EndOffsetOptions={axis:'x'|'y'|'z';fixedEnd:'min'|'max';keepFixed:number;keepMoving:number;offsetU:number;offsetV:number};
export type ConnectionAnchor = 'min'|'center'|'max';
export type ConnectionOffsetOptions={fixedFaceId:string;movingFaceId:string;keepFixed:number;keepMoving:number;offsetU:number;offsetV:number;mode?:'offset'|'center'|'position';coordinateSystem?:'local'|'floor';fixedAnchorU?:ConnectionAnchor;movingAnchorU?:ConnectionAnchor;fixedAnchorV?:ConnectionAnchor;movingAnchorV?:ConnectionAnchor};
export type EndConnection={id:string;name:string;axis:'x'|'y'|'z';side:'min'|'max';localNormal:Point;localPoints:Point[];worldPoints:Point[];localCenter:Point;worldCenter:Point;worldNormal:Point;localBounds:{min:Point;max:Point};axisSizeMm:number;shapeId:string};
const axes=['x','y','z'] as const;
/** A transverse shear with rigid plateaus. Its Jacobian determinant is 1; the original channel is carried with its walls. */
export function offsetEndTriangles(source:number[],options:EndOffsetOptions):MeshDeformation{
 if(!source.length||source.length%9||source.some(v=>!Number.isFinite(v)))throw new Error('Некорректная сетка детали.');
 const axis=axes.indexOf(options.axis),{keepFixed,keepMoving,offsetU,offsetV}=options;
 if(axis<0||!['min','max'].includes(options.fixedEnd)||![keepFixed,keepMoving,offsetU,offsetV].every(Number.isFinite)||Math.min(keepFixed,keepMoving)<0)throw new Error('Проверьте ось, отступы и величину смещения.');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];source.forEach((v,i)=>{min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v);});
 const low=min[axis]+(options.fixedEnd==='min'?keepFixed:keepMoving),high=max[axis]-(options.fixedEnd==='min'?keepMoving:keepFixed);
 if(high-low<.01)throw new Error('Между защищёнными фланцами должно оставаться минимум 0,01 мм перехода.');
 if(Math.max(Math.abs(offsetU),Math.abs(offsetV))>10000)throw new Error('Смещение слишком велико: максимум 10000 мм.');
 const[u,v]=[0,1,2].filter(a=>a!==axis);
 const mapRaw=(p:Point):Point=>{const t=Math.min(1,Math.max(0,(p[axis]-low)/(high-low))),weight=options.fixedEnd==='min'?t:1-t;const next=[...p] as Point;next[u]+=weight*offsetU;next[v]+=weight*offsetV;return next;};
 const raw:number[]=[],sourceTriangles:number[]=[];
 for(let i=0;i<source.length;i+=9){let regions=[ [source.slice(i,i+3),source.slice(i+3,i+6),source.slice(i+6,i+9)] as Point[] ];
  for(const plane of [low,high])regions=regions.flatMap(poly=>{const values=poly.map(p=>p[axis]);return Math.min(...values)>=plane||Math.max(...values)<=plane?[poly]:[clipDeformationPolygon(poly,axis,plane,true),clipDeformationPolygon(poly,axis,plane,false)];});
  for(const poly of regions)for(let j=1;j+1<poly.length;j++){const t=[poly[0],poly[j],poly[j+1]].map(mapRaw);const[a,b,c]=t.map(p=>new THREE.Vector3(...p));if(new THREE.Triangle(a,b,c).getArea()<1e-12)continue;t.forEach(p=>raw.push(...p));sourceTriangles.push(i/9);}
  if(raw.length>3_000_000)throw new Error('После разделения сетка превышает миллион вершин.');
 }
 const nextMin=[Infinity,Infinity,Infinity],nextMax=[-Infinity,-Infinity,-Infinity];raw.forEach((v,i)=>{nextMin[i%3]=Math.min(nextMin[i%3],v);nextMax[i%3]=Math.max(nextMax[i%3],v);});
 const nextSize=nextMax.map((n,i)=>n-nextMin[i]);const center=nextMin.map((n,i)=>(n+nextMax[i])/2) as Point;
 const normalize=(p:Point)=>p.map((n,i)=>n-(i===1?nextMin[i]:center[i])) as Point;
 const positions=raw.map((n,i)=>Math.fround(n-(i%3===1?nextMin[1]:center[i%3])));
 return{positions,sourceTriangles,nextSize,rootShift:center,mapPoint:p=>normalize(mapRaw(p))};
}
function connectionSurface(root:THREE.Object3D){const surfaces:THREE.Mesh<THREE.BufferGeometry>[]=[];root.updateWorldMatrix(true,true);root.traverse(c=>{if(c instanceof THREE.Mesh&&c.userData.shapeSurface)surfaces.push(c);});if(surfaces.length!==1)throw new Error('Выберите одну деталь с сеткой.');return surfaces[0];}
export function readEndConnections(shape:WorkplaneShape,root:THREE.Object3D):EndConnection[]{
 const surface=connectionSurface(root),geometry=surface.geometry,key=faceGeometryKey(geometry),a=geometry.getAttribute('position'),ix=geometry.getIndex(),matrix=root.matrixWorld.clone().invert().multiply(surface.matrixWorld);
 const box=new THREE.Box3();for(let i=0;i<a.count;i++)box.expandByPoint(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(matrix));
 return(shape.faceAnnotations??[]).flatMap((label:FaceAnnotation)=>{
  if(label.geometryKey!==key)return[];
  const normal=new THREE.Vector3(...label.localNormal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix));const axis=normal.toArray().reduce((best,n,i,all)=>Math.abs(n)>Math.abs(all[best])?i:best,0);
  const bounds=new THREE.Box3(),points:Point[]=[];for(const i of label.triangleIndices)for(let k=0;k<3;k++){const n=ix?ix.getX(i*3+k):i*3+k;if(n>=a.count)return[];const p=new THREE.Vector3().fromBufferAttribute(a,n).applyMatrix4(matrix);bounds.expandByPoint(p);points.push(p.toArray() as Point);}
  if(bounds.isEmpty())return[];
  const plane=normal.dot(new THREE.Vector3(...points[0]));if(points.some(p=>Math.abs(normal.dot(new THREE.Vector3(...p))-plane)>.001))return[];
  const center=bounds.getCenter(new THREE.Vector3());center.addScaledVector(normal,plane-normal.dot(center));const coordinate=center.getComponent(axis);const side=coordinate<(box.min.getComponent(axis)+box.max.getComponent(axis))/2?'min':'max';
  return[{id:label.id,name:label.name,shapeId:shape.id,axis:axes[axis],side,localNormal:normal.toArray() as Point,localPoints:points,worldPoints:points.map(p=>root.localToWorld(new THREE.Vector3(...p)).toArray() as Point),axisSizeMm:box.max.getComponent(axis)-box.min.getComponent(axis),localCenter:center.toArray() as Point,worldCenter:root.localToWorld(center.clone()).toArray() as Point,worldNormal:new THREE.Vector3(...label.localNormal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(surface.matrixWorld)).toArray() as Point,localBounds:{min:bounds.min.toArray() as Point,max:bounds.max.toArray() as Point}}];
 });
}
export type ConnectionFrame={direction:Point;u:Point;v:Point;low:number;high:number;centerU:number;centerV:number};
/** Choose a separating slab that contains neither selected face. Adjacent/shared faces cannot remain rigid under different translations. */
export function connectionOffsetFrame(connections:EndConnection[],options:Pick<ConnectionOffsetOptions,'fixedFaceId'|'movingFaceId'|'keepFixed'|'keepMoving'>):ConnectionFrame{
 const fixed=connections.find(f=>f.id===options.fixedFaceId),moving=connections.find(f=>f.id===options.movingFaceId);
 if(!fixed||!moving||fixed.id===moving.id)throw new Error('Выберите две разные плоские грани одной детали.');
 if(![options.keepFixed,options.keepMoving].every(n=>Number.isFinite(n)&&n>=0))throw new Error('Защищённые зоны должны быть неотрицательными.');
 const centerDelta=new THREE.Vector3(...moving.localCenter).sub(new THREE.Vector3(...fixed.localCenter));
 const candidates:THREE.Vector3[]=[];
 const addCandidate=(v:THREE.Vector3)=>{if(v.lengthSq()<1e-12)return;v.normalize();if(!candidates.some(n=>Math.abs(n.dot(v))>1-1e-10))candidates.push(v);};
 addCandidate(new THREE.Vector3(...fixed.localNormal));addCandidate(new THREE.Vector3(...moving.localNormal));addCandidate(centerDelta.clone());
 // Face edge cross products supply separating axes for slanted, nonparallel polygons.
 const edges=(face:EndConnection)=>{const values:THREE.Vector3[]=[];for(let i=0;i<face.localPoints.length;i+=3)for(let j=0;j<3;j++){const e=new THREE.Vector3(...face.localPoints[i+(j+1)%3]).sub(new THREE.Vector3(...face.localPoints[i+j])).normalize();if(e.lengthSq()>.5&&!values.some(v=>Math.abs(v.dot(e))>.99999))values.push(e);if(values.length>=24)return values;}return values;};
 for(const a of edges(fixed))for(const b of edges(moving)){const cross=a.clone().cross(b);if(cross.lengthSq()>1e-8)addCandidate(cross);}
 let best:{n:THREE.Vector3;low:number;high:number}|undefined;
 for(const candidate of candidates){if(candidate.lengthSq()<1e-12)continue;const n=candidate.clone().normalize();if(n.dot(centerDelta)<0)n.negate();let low=-Infinity,high=Infinity;for(const p of fixed.localPoints)low=Math.max(low,(n.x*p[0]+n.y*p[1]+n.z*p[2]));for(const p of moving.localPoints)high=Math.min(high,(n.x*p[0]+n.y*p[1]+n.z*p[2]));low+=options.keepFixed;high-=options.keepMoving;if(high-low>=.01&&(!best||high-low>best.high-best.low+1e-6))best={n,low,high};}
 if(!best)throw new Error('Эти грани или их защищённые зоны соприкасаются: их нельзя сдвинуть независимо, сохранив обе жёсткими. Выберите разнесённые грани или уменьшите зоны защиты.');
 const {n,low,high}=best;const u=new THREE.Vector3(...(Math.abs(n.y)<.9?[0,1,0]:[1,0,0]) as Point);u.addScaledVector(n,-u.dot(n)).normalize();const v=n.clone().cross(u).normalize();const dominant=v.toArray().reduce((a,x,i,all)=>Math.abs(x)>Math.abs(all[a])?i:a,0);if(v.getComponent(dominant)<0)v.negate();
 const delta=new THREE.Vector3(...fixed.localCenter).sub(new THREE.Vector3(...moving.localCenter));
 return{direction:n.toArray() as Point,u:u.toArray() as Point,v:v.toArray() as Point,low,high,centerU:delta.dot(u),centerV:delta.dot(v)};
}
export function floorConnectionFrame(connections:EndConnection[],fixedId:string,movingId:string){
 const fixed=connections.find(c=>c.id===fixedId),moving=connections.find(c=>c.id===movingId);
 if(!fixed||!moving||fixed.id===moving.id)throw new Error('Выберите две разные грани.');
 let direction=new THREE.Vector3(...fixed.worldNormal);
 if(Math.hypot(direction.x,direction.z)<1e-6)direction=new THREE.Vector3(...moving.worldNormal);
 const horizontal=new THREE.Vector3(-direction.z,0,direction.x);
 if(horizontal.lengthSq()<1e-12)horizontal.set(1,0,0);else horizontal.normalize();
 const dominant=Math.abs(horizontal.x)>=Math.abs(horizontal.z)?0:2;if(horizontal.getComponent(dominant)<0)horizontal.negate();
 const delta=new THREE.Vector3(...fixed.worldCenter).sub(new THREE.Vector3(...moving.worldCenter));
 const horizontalAxis=Math.abs(horizontal.x)>.99999?'X':Math.abs(horizontal.z)>.99999?'Z':'XZ';
 return {horizontal:horizontal.toArray() as Point,horizontalAxis,centerVertical:delta.y,centerHorizontal:delta.dot(horizontal)};
}
export function connectionPositionGaps(connections:EndConnection[],options:ConnectionOffsetOptions) {
 const fixed=connections.find(c=>c.id===options.fixedFaceId),moving=connections.find(c=>c.id===options.movingFaceId);
 if(!fixed||!moving||fixed===moving)throw Error('Select two different faces.');
 const floor=options.coordinateSystem==='floor',frame=floor?floorConnectionFrame(connections,fixed.id,moving.id):connectionOffsetFrame(connections,options);
 const directions=floor?[[0,1,0],(frame as ReturnType<typeof floorConnectionFrame>).horizontal]:[(frame as ConnectionFrame).u,(frame as ConnectionFrame).v];
 const anchor=(face:EndConnection,direction:number[],kind:ConnectionAnchor='min')=>{
  if(!['min','center','max'].includes(kind))throw Error('Invalid reference edge.');
  const values=(floor?face.worldPoints:face.localPoints).map(p=>p.reduce((s,n,i)=>s+n*direction[i],0));
  let min=Infinity,max=-Infinity;for(const n of values){min=Math.min(min,n);max=Math.max(max,n);}
  return kind==='min'?min:kind==='max'?max:(min+max)/2;
 };
 return {vertical:anchor(moving,directions[0],options.movingAnchorU)-anchor(fixed,directions[0],options.fixedAnchorU),horizontal:anchor(moving,directions[1],options.movingAnchorV)-anchor(fixed,directions[1],options.fixedAnchorV)};
}
function offsetAlongFrame(source:number[],frame:ConnectionFrame,offsetU:number,offsetV:number,displacement?:Point):MeshDeformation{
 if(![offsetU,offsetV].every(Number.isFinite)||Math.max(Math.abs(offsetU),Math.abs(offsetV))>10000)throw new Error('Смещение должно быть конечным числом в пределах 10000 мм.');
 const n=new THREE.Vector3(...frame.direction),u=new THREE.Vector3(...frame.u),v=new THREE.Vector3(...frame.v),delta=displacement?new THREE.Vector3(...displacement):u.clone().multiplyScalar(offsetU).addScaledVector(v,offsetV);
 if(frame.high-frame.low+delta.dot(n)<.01)throw new Error("Смещение сближает защищённые грани до пересечения. Уменьшите смещение или зоны защиты.");
 const project=(p:Point):Point=>{const q=new THREE.Vector3(...p);return[q.dot(n),q.dot(u),q.dot(v)];};
 const unproject=(p:Point):Point=>n.clone().multiplyScalar(p[0]).addScaledVector(u,p[1]).addScaledVector(v,p[2]).toArray() as Point;
 const mapRaw=(p:Point):Point=>{const weight=THREE.MathUtils.clamp((new THREE.Vector3(...p).dot(n)-frame.low)/(frame.high-frame.low),0,1);return p.map((x,i)=>x+weight*delta.getComponent(i)) as Point;};
 const raw:number[]=[],sourceTriangles:number[]=[];
 for(let i=0;i<source.length;i+=9){let regions=[[project(source.slice(i,i+3) as Point),project(source.slice(i+3,i+6) as Point),project(source.slice(i+6,i+9) as Point)]];
  for(const plane of [frame.low,frame.high])regions=regions.flatMap(poly=>{const values=poly.map(p=>p[0]);return Math.min(...values)>=plane||Math.max(...values)<=plane?[poly]:[clipDeformationPolygon(poly,0,plane,true),clipDeformationPolygon(poly,0,plane,false)];});
  for(const poly of regions)for(let j=1;j+1<poly.length;j++){const triangle=[poly[0],poly[j],poly[j+1]].map(p=>mapRaw(unproject(p)));if(new THREE.Triangle(...triangle.map(p=>new THREE.Vector3(...p)) as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).getArea()<1e-12)continue;triangle.forEach(p=>raw.push(...p));sourceTriangles.push(i/9);}
  if(raw.length>3_000_000)throw new Error('После разделения сетка превышает миллион вершин.');
 }
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];raw.forEach((x,i)=>{min[i%3]=Math.min(min[i%3],x);max[i%3]=Math.max(max[i%3],x);});const center=min.map((x,i)=>(x+max[i])/2) as Point,nextSize=max.map((x,i)=>x-min[i]);const normalize=(p:Point)=>p.map((x,i)=>x-(i===1?min[i]:center[i])) as Point;
 return{positions:raw.map((x,i)=>Math.fround(x-(i%3===1?min[1]:center[i%3]))),sourceTriangles,nextSize,rootShift:center,mapPoint:p=>normalize(mapRaw(p)),rulerMap:{direction:frame.direction,delta:delta.toArray() as Point,center,low:frame.low,high:frame.high}};
}
export function offsetConnection(shape:WorkplaneShape,root:THREE.Object3D,options:ConnectionOffsetOptions){
 const connections=readEndConnections(shape,root),frame=connectionOffsetFrame(connections,options);
 if(options.coordinateSystem==='floor'){
  const floor=floorConnectionFrame(connections,options.fixedFaceId,options.movingFaceId);
  const gaps=options.mode==='position'?connectionPositionGaps(connections,options):null;
  const vertical=options.mode==='center'?floor.centerVertical:options.offsetU-(gaps?.vertical??0),horizontal=options.mode==='center'?floor.centerHorizontal:options.offsetV-(gaps?.horizontal??0);
  const delta=new THREE.Vector3(...floor.horizontal).multiplyScalar(horizontal).add(new THREE.Vector3(0,vertical,0)).applyMatrix3(new THREE.Matrix3().setFromMatrix4(root.matrixWorld.clone().invert()));
  return deformRenderedShape(shape,root,source=>offsetAlongFrame(source,frame,vertical,horizontal,delta.toArray() as Point));
 }
 const gaps=options.mode==='position'?connectionPositionGaps(connections,options):null;
 return deformRenderedShape(shape,root,source=>offsetAlongFrame(source,frame,options.mode==='center'?frame.centerU:options.offsetU-(gaps?.vertical??0),options.mode==='center'?frame.centerV:options.offsetV-(gaps?.horizontal??0)));
}
