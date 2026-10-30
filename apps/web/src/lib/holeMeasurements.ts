import * as THREE from "three";
export type CircularHole = { localCenter: [number,number,number]; localNormal: [number,number,number]; localRim: [number,number,number][]; circularityErrorMm: number };
const cache = new WeakMap<THREE.BufferGeometry, CircularHole[]>();
const keyOf = (p: THREE.Vector3) => p.toArray().map(n=>Math.round(n*1e5)).join(',');
/** Sharp circular rims adjacent to an inward-facing wall; exterior cylinders are excluded. */
export function detectCircularHoles(g: THREE.BufferGeometry): CircularHole[] {
  const cached=cache.get(g); if(cached) return cached;
  const p=g.getAttribute('position'), ix=g.getIndex();
  const vertices=new Map<string,THREE.Vector3>();
  const edges=new Map<string,{a:string;b:string; normals:THREE.Vector3[]; thirds:THREE.Vector3[]}>();
  for(let i=0;i<Math.floor((ix?.count??p.count)/3);i++){
    const t=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(3*i+j):3*i+j));
    const n=t[1].clone().sub(t[0]).cross(t[2].clone().sub(t[0])).normalize();
    for(let j=0;j<3;j++){const a=keyOf(t[j]),b=keyOf(t[(j+1)%3]); vertices.set(a,t[j]); vertices.set(b,t[(j+1)%3]); const k=[a,b].sort().join('|');const edge=edges.get(k)??{a,b,normals:[],thirds:[]}; edge.normals.push(n);edge.thirds.push(t[(j+2)%3]);edges.set(k,edge);}
  }
  const graph=new Map<string,Set<string>>();
  for(const e of edges.values()) if(e.normals.length===2 && e.normals[0].dot(e.normals[1])<Math.cos(Math.PI/6)){
    for(const [a,b] of [[e.a,e.b],[e.b,e.a]]){const neighbors=graph.get(a)??new Set<string>();neighbors.add(b);graph.set(a,neighbors);}
  }
  const visited=new Set<string>(), result:CircularHole[]=[];
  for(const start of graph.keys()){
    if(visited.has(start))continue;
    const component:string[]=[], pending=[start];
    while(pending.length){const k=pending.pop()!;if(visited.has(k))continue; visited.add(k);component.push(k);for(const next of graph.get(k)??[])if(!visited.has(next))pending.push(next);}
    if(component.length<8||component.some(k=>graph.get(k)!.size!==2))continue;
    const ordered=[start];let prev='',cur=start;
    do {const next=[...graph.get(cur)!].find(k=>k!==prev)!;prev=cur;cur=next;if(cur!==start)ordered.push(cur);}while(cur!==start&&ordered.length<=component.length);
    if(ordered.length!==component.length)continue;
    const rim=ordered.map(k=>vertices.get(k)!);
    const a=rim[0];
    const b=rim.reduce((best,p)=>p.distanceToSquared(a)>best.distanceToSquared(a)?p:best,rim[1]);
    const ab=b.clone().sub(a);
    const c=rim.reduce((best,p)=>ab.clone().cross(p.clone().sub(a)).lengthSq()>ab.clone().cross(best.clone().sub(a)).lengthSq()?p:best,rim[2]);
    const ac=c.clone().sub(a), n=ab.clone().cross(ac), denominator=2*n.lengthSq();
    if(denominator<1e-16)continue;
    const center=a.clone().add(ac.clone().cross(n).multiplyScalar(ab.lengthSq()).add(n.clone().cross(ab).multiplyScalar(ac.lengthSq())).divideScalar(denominator));
    const normal=n.clone().normalize();
    if(normal.lengthSq()<0.5)continue;
    const radii=rim.map(p=>p.distanceTo(center));const radius=radii.reduce((a,b)=>a+b,0)/radii.length;
    const error=Math.max(...radii.map(r=>Math.abs(r-radius)));
    if(radius<1e-5||error>Math.max(0.01,radius*0.002)||rim.some(p=>Math.abs(p.clone().sub(center).dot(normal))>Math.max(0.001,radius*1e-4)))continue;
    const first=edges.get([ordered[0],ordered[1]].sort().join('|'))!;
    const inward=first.normals.some((n,i)=>{const radial=first.thirds[i].clone().sub(center).projectOnPlane(normal).normalize();return n.dot(radial)<-0.6;});
    if(!inward)continue;
    result.push({localCenter:center.toArray() as [number,number,number],localNormal:normal.toArray() as [number,number,number],localRim:rim.map(p=>p.toArray() as [number,number,number]),circularityErrorMm:error});
  }
  cache.set(g,result);return result;
}
export function measureCircularHole(mesh:THREE.Mesh<THREE.BufferGeometry>,hole:CircularHole){
  mesh.updateWorldMatrix(true,false);
  const center=mesh.localToWorld(new THREE.Vector3(...hole.localCenter));
  const rim=hole.localRim.map(p=>mesh.localToWorld(new THREE.Vector3(...p)));
  const distances=rim.map(p=>p.distanceTo(center));const radius=distances.reduce((a,b)=>a+b,0)/distances.length;
  const error=Math.max(...distances.map(r=>Math.abs(r-radius)));
  const circular=error<=Math.max(0.01,radius*0.002);
  const normal=new THREE.Vector3(...hole.localNormal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
  return {status:circular?'circular':'non_circular',diameterMm:circular?radius*2:null,minSpanMm:Math.min(...distances)*2,maxSpanMm:Math.max(...distances)*2,circularityErrorMm:error,
    center:center.toArray(),centerZUp:[center.x,-center.z,center.y],normal:normal.toArray(),rim:rim.map(p=>p.toArray()),
    label:circular?`⌀ ${(radius*2).toFixed(2)} мм`:'Некруглое отверстие',method:'sharp_circular_rim_with_inward_wall',units:'mm'};
}
