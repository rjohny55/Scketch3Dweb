import * as THREE from 'three';
export type HoleKind='circle'|'rectangle'|'polygon';
export type HoleProfile={id:string;kind:HoleKind;axis:number;u:number;v:number;lower:number;upper:number;centerU:number;centerV:number;width:number;height:number;rimA:number[][];rimB:number[][]};
const cache=new WeakMap<THREE.BufferGeometry,HoleProfile[]>();
/** Closed sharp planar inner rims, paired only across matching straight, axis-aligned bores. */
export function detectHoleProfiles(g:THREE.BufferGeometry):HoleProfile[]{
 const cached=cache.get(g);if(cached)return cached;
 const attr=g.getAttribute('position'),index=g.getIndex(),vertices=new Map<string,THREE.Vector3>(),edges=new Map<string,{a:string;b:string;normals:THREE.Vector3[];thirds:THREE.Vector3[]}>();
 const key=(p:THREE.Vector3)=>p.toArray().map(v=>Math.round(v*1e5)).join(',');
 for(let i=0;i<(index?.count??attr.count);i+=3){const t=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(attr,index?index.getX(i+k):i+k)),n=new THREE.Triangle(t[0],t[1],t[2]).getNormal(new THREE.Vector3());for(let k=0;k<3;k++){const a=key(t[k]),b=key(t[(k+1)%3]);vertices.set(a,t[k]);vertices.set(b,t[(k+1)%3]);const ek=[a,b].sort().join('|'),e=edges.get(ek)??{a,b,normals:[],thirds:[]};e.normals.push(n);e.thirds.push(t[(k+2)%3]);edges.set(ek,e);}}
 const planeGraphs=new Map<string,Map<string,Set<string>>>();
 for(const e of edges.values())if(e.normals.length===2 && e.normals[0].dot(e.normals[1])<.8660254){const pa=vertices.get(e.a)!,pb=vertices.get(e.b)!;for(const axis of [0,1,2]){if(Math.abs(pa.getComponent(axis)-pb.getComponent(axis))>1e-4||!e.normals.some(n=>Math.abs(n.getComponent(axis))>.99999))continue;const key=`${axis}:${Math.round(pa.getComponent(axis)*1e4)}`,graph=planeGraphs.get(key)??new Map<string,Set<string>>();for(const[a,b]of[[e.a,e.b],[e.b,e.a]]){const list=graph.get(a)??new Set<string>();list.add(b);graph.set(a,list);}planeGraphs.set(key,graph);}}
 const rims:Array<Omit<HoleProfile,'id'|'lower'|'upper'|'rimA'|'rimB'> & {plane:number;rim:number[][]}>=[];
 for(const graph of planeGraphs.values()){const seen=new Set<string>();for(const start of graph.keys()){if(seen.has(start))continue;const component:string[]=[],queue=[start];while(queue.length){const k=queue.pop()!;if(seen.has(k))continue;seen.add(k);component.push(k);for(const n of graph.get(k)??[])if(!seen.has(n))queue.push(n);}if(component.length<3 || component.some(k=>graph.get(k)!.size!==2))continue;
 const ordered=[start];let prev='',cur=start;do{const next=[...graph.get(cur)!].find(k=>k!==prev)!;prev=cur;cur=next;if(cur!==start)ordered.push(cur);}while(cur!==start&&ordered.length<=component.length);if(ordered.length!==component.length)continue;
 const points=ordered.map(k=>vertices.get(k)!);const min=[0,1,2].map(a=>Math.min(...points.map(p=>p.getComponent(a)))),max=[0,1,2].map(a=>Math.max(...points.map(p=>p.getComponent(a))));const axis=[0,1,2].find(a=>max[a]-min[a]<1e-4);if(axis===undefined)continue;const[u,v]=[0,1,2].filter(a=>a!==axis);const centerU=(min[u]+max[u])/2,centerV=(min[v]+max[v])/2,width=max[u]-min[u],height=max[v]-min[v];if(Math.min(width,height)<.001)continue;
 const center=new THREE.Vector3().setComponent(axis,min[axis]).setComponent(u,centerU).setComponent(v,centerV),e=edges.get([ordered[0],ordered[1]].sort().join('|'))!;
 const inward=e.normals.some((n,i)=>{const radial=e.thirds[i].clone().sub(center);radial.setComponent(axis,0);return n.dot(radial.normalize())<-.01;});if(!inward)continue;
 const planar=points.map(p=>new THREE.Vector2(p.getComponent(u),p.getComponent(v))),triangulated=THREE.ShapeUtils.triangulateShape(planar,[]);if(!triangulated.length)continue;
 const area=(ids:number[])=>Math.abs(new THREE.Vector2().subVectors(planar[ids[1]],planar[ids[0]]).cross(new THREE.Vector2().subVectors(planar[ids[2]],planar[ids[0]])));const interior=triangulated.reduce((best,ids)=>area(ids)>area(best)?ids:best);const sample=interior.map(i=>points[i]).reduce((a,p)=>a.add(p),new THREE.Vector3()).divideScalar(3);let covered=false;
 for(let i=0;i<(index?.count??attr.count);i+=3){const t=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(attr,index?index.getX(i+k):i+k));if(t.some(p=>Math.abs(p.getComponent(axis)-min[axis])>1e-4))continue;if(new THREE.Triangle(t[0],t[1],t[2]).closestPointToPoint(sample,new THREE.Vector3()).distanceToSquared(sample)<1e-10){covered=true;break;}}if(covered)continue;
 const radii=points.map(p=>Math.hypot(p.getComponent(u)-centerU,p.getComponent(v)-centerV)),mean=radii.reduce((a,b)=>a+b,0)/radii.length;
 const circular=points.length>=8 && Math.max(...radii.map(r=>Math.abs(r-mean)))<Math.max(.01,mean*.002);
 const rectangular=Math.abs(Math.abs(THREE.ShapeUtils.area(planar))-width*height)<.001 && points.every(p=>Math.min(Math.abs(p.getComponent(u)-min[u]),Math.abs(p.getComponent(u)-max[u]),Math.abs(p.getComponent(v)-min[v]),Math.abs(p.getComponent(v)-max[v]))<1e-4);
 rims.push({kind:circular?'circle':rectangular?'rectangle':'polygon',axis,u,v,plane:min[axis],centerU,centerV,width,height,rim:points.map(p=>p.toArray())});}
 }
 const outlineDistance=(p:number[],rim:number[][],u:number,v:number)=>{let distance=Infinity;for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length],x=b[u]-a[u],y=b[v]-a[v],t=Math.max(0,Math.min(1,((p[u]-a[u])*x+(p[v]-a[v])*y)/(x*x+y*y||1)));distance=Math.min(distance,Math.hypot(p[u]-a[u]-t*x,p[v]-a[v]-t*y));}return distance;};
 const used=new Set<number>(),result:HoleProfile[]=[];
 for(let i=0;i<rims.length;i++){if(used.has(i))continue;const a=rims[i];const candidates=rims.map((b,j)=>({b,j})).filter(({b,j})=>j!==i&&!used.has(j)&&a.axis===b.axis&&a.kind===b.kind&&Math.abs(a.plane-b.plane)>.001&&Math.abs(a.centerU-b.centerU)<.001&&Math.abs(a.centerV-b.centerV)<.001&&Math.abs(a.width-b.width)<.001&&Math.abs(a.height-b.height)<.001&&a.rim.every(p=>outlineDistance(p,b.rim,a.u,a.v)<.001)&&b.rim.every(p=>outlineDistance(p,a.rim,a.u,a.v)<.001)).sort((x,y)=>Math.abs(x.b.plane-a.plane)-Math.abs(y.b.plane-a.plane));
 const pair=candidates[0];if(!pair)continue;used.add(i);used.add(pair.j);const b=pair.b;result.push({...a,id:`hole-${result.length}`,lower:Math.min(a.plane,b.plane),upper:Math.max(a.plane,b.plane),rimA:a.plane<b.plane?a.rim:b.rim,rimB:a.plane<b.plane?b.rim:a.rim});}
 cache.set(g,result);return result;
}
