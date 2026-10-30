import {Box3,BufferGeometry,Camera,Line,LineSegments,LineLoop,Matrix4,Vector3} from 'three';
/** Build edge polylines by endpoint adjacency, avoiding a scan of every unused edge. */
export function chainRulerSegments(segments:Array<[Vector3,Vector3]>){
 if(segments.length<=1)return segments.map(s=>[...s]);
 const bounds=new Box3();for(const[a,b]of segments){bounds.expandByPoint(a);bounds.expandByPoint(b);}
 const diagonal=bounds.getSize(new Vector3()).length(),tolerance=Math.max(1e-6,diagonal*1e-5),base=Math.ceil(diagonal/tolerance)+4,base2=base*base,nodes:Vector3[]=[],cells=new Map<number,number[]>(),adjacency:number[][]=[];
 // Relative coordinates occupy at most 100001 cells per axis. The packed key
 // stays below 2^53, avoiding millions of temporary string allocations.
 function node(p:Vector3){
  const x=Math.floor((p.x-bounds.min.x)/tolerance)+1,y=Math.floor((p.y-bounds.min.y)/tolerance)+1,z=Math.floor((p.z-bounds.min.z)/tolerance)+1,key=x*base2+y*base+z;
  for(const id of cells.get(key)??[])if(nodes[id].distanceToSquared(p)<=tolerance*tolerance)return id;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
   if(!dx&&!dy&&!dz)continue;
   const ids=cells.get(key+dx*base2+dy*base+dz);if(ids)for(const id of ids)if(nodes[id].distanceToSquared(p)<=tolerance*tolerance)return id;
  }
  const id=nodes.length;nodes.push(p);adjacency.push([]);const bucket=cells.get(key)??[];bucket.push(id);cells.set(key,bucket);return id;
 }
 const ends=segments.map(([a,b],i)=>{const ids=[node(a),node(b)];adjacency[ids[0]].push(i);adjacency[ids[1]].push(i);return ids;});
 const used=new Uint8Array(segments.length),paths:Vector3[][]=[],limit=Math.cos(Math.PI/9);
 for(let seed=0;seed<segments.length;seed++){
  if(used[seed])continue;used[seed]=1;const chain=[ends[seed][0],ends[seed][1]],before:number[]=[],after:number[]=[];
  const extend=(start:number,previous:number,out:number[])=>{let at=start,prev=previous;while(true){const direction=nodes[at].clone().sub(nodes[prev]).normalize();let best=-1,next=-1,score=limit,examined=0;for(const edge of adjacency[at]){if(used[edge])continue;if(++examined>64)break;const other=ends[edge][0]===at?ends[edge][1]:ends[edge][0];const dot=direction.dot(nodes[other].clone().sub(nodes[at]).normalize());if(dot>=score){best=edge;next=other;score=dot;}}if(best<0)break;used[best]=1;out.push(next);prev=at;at=next;}};
  extend(chain[1],chain[0],after);extend(chain[0],chain[1],before);paths.push([...before.reverse(),...chain,...after].map(id=>nodes[id]));
 }
 return paths;
}
type PathsCache={attribute:unknown;version:number;paths:Vector3[][]};
const pathsCache=new WeakMap<BufferGeometry,PathsCache>();
function pathsForLine(line:Line){
 const g=line.geometry,p=g.getAttribute('position');if(!p)return[];
 const version="version" in p?p.version:p.data.version;
 const previous=pathsCache.get(g);if(previous?.attribute===p&&previous.version===version)return previous.paths;
 let paths:Vector3[][];
 if(line instanceof LineSegments){const segments:Array<[Vector3,Vector3]>=[];for(let i=0;i+1<p.count;i+=2)segments.push([new Vector3().fromBufferAttribute(p,i),new Vector3().fromBufferAttribute(p,i+1)]);paths=chainRulerSegments(segments);}
 else{const path=Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i));if(line instanceof LineLoop&&path.length>2)path.push(path[0]);paths=[path];}
 pathsCache.set(g,{attribute:p,version,paths});return paths;
}
type ScreenCache={key:string;paths:Vector3[][];projected:Float64Array[];segments:Array<[number,number]>;vertices:Array<[number,number]>;edgeGrid:Map<number,number[]>;vertexGrid:Map<number,number[]>;columns:number};
const screenCache=new WeakMap<Line,ScreenCache>(),cellSize=32;
function screenIndex(line:Line,camera:Camera,width:number,height:number){
 const paths=pathsForLine(line),key=[width,height,...line.matrixWorld.elements,...camera.matrixWorldInverse.elements,...camera.projectionMatrix.elements].join(',');
 const prior=screenCache.get(line);if(prior?.key===key&&prior.paths===paths)return prior;
 const matrix=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(line.matrixWorld),columns=Math.max(1,Math.ceil(width/cellSize)),rows=Math.max(1,Math.ceil(height/cellSize));
 const data:ScreenCache={key,paths,columns,projected:[],segments:[],vertices:[],edgeGrid:new Map(),vertexGrid:new Map()};
 const insert=(grid:Map<number,number[]>,id:number,x0:number,y0:number,x1=x0,y1=y0)=>{if(x1<0||x0>width||y1<0||y0>height)return;for(let y=Math.max(0,Math.floor(y0/cellSize));y<=Math.min(rows-1,Math.floor(y1/cellSize));y++)for(let x=Math.max(0,Math.floor(x0/cellSize));x<=Math.min(columns-1,Math.floor(x1/cellSize));x++){const key=y*columns+x,bucket=grid.get(key)??[];bucket.push(id);grid.set(key,bucket);}};
 paths.forEach((path,index)=>{
  const p=new Float64Array(path.length*4);data.projected.push(p);
  path.forEach((point,i)=>{const v=point.clone().applyMatrix4(matrix);p[i*4]=(v.x+1)*width/2;p[i*4+1]=(1-v.y)*height/2;p[i*4+2]=v.z;p[i*4+3]=matrix.elements[3]*point.x+matrix.elements[7]*point.y+matrix.elements[11]*point.z+matrix.elements[15];});
  for(let i=0;i+1<path.length;i++){const a=i*4,b=a+4;if(p[a+3]<=0||p[b+3]<=0||p[a+2]<-1&&p[b+2]<-1||p[a+2]>1&&p[b+2]>1)continue;const id=data.segments.length;data.segments.push([index,i]);insert(data.edgeGrid,id,Math.min(p[a],p[b]),Math.min(p[a+1],p[b+1]),Math.max(p[a],p[b]),Math.max(p[a+1],p[b+1]));}
  const endpoints=path.length>2&&path[0].distanceToSquared(path.at(-1)!)<1e-10?[0]:[0,path.length-1];for(const i of endpoints){const a=i*4;if(p[a+3]<=0||Math.abs(p[a+2])>1)continue;const id=data.vertices.length;data.vertices.push([index,i]);insert(data.vertexGrid,id,p[a],p[a+1]);}
 });screenCache.set(line,data);return data;
}
export type RulerEdgeHit={distance:number;kind:'vertex'|'edge';point:Vector3;path:Vector3[];pathIndex:number};
/** Query only screen cells near the pointer; rebuild projection only after camera/mesh changes. */
export function pickRulerLine(line:Line,camera:Camera,width:number,height:number,x:number,y:number):{vertex?:RulerEdgeHit;edge?:RulerEdgeHit}{
 const data=screenIndex(line,camera,width,height),candidates=(grid:Map<number,number[]>)=>{const ids=new Set<number>();for(let cy=Math.max(0,Math.floor((y-12)/cellSize));cy<=Math.floor((y+12)/cellSize);cy++)for(let cx=Math.max(0,Math.floor((x-12)/cellSize));cx<=Math.min(data.columns-1,Math.floor((x+12)/cellSize));cx++)for(const id of grid.get(cy*data.columns+cx)??[])ids.add(id);return ids;};
 let vertex:RulerEdgeHit|undefined,edge:RulerEdgeHit|undefined;
 for(const id of candidates(data.vertexGrid)){const[pathIndex,i]=data.vertices[id],p=data.projected[pathIndex],distance=Math.hypot(x-p[i*4],y-p[i*4+1]);if(distance<=9&&(!vertex||distance<vertex.distance))vertex={distance,kind:'vertex',point:data.paths[pathIndex][i].clone().applyMatrix4(line.matrixWorld),path:data.paths[pathIndex],pathIndex};}
 for(const id of candidates(data.edgeGrid)){const[pathIndex,i]=data.segments[id],p=data.projected[pathIndex],a=i*4,b=a+4,dx=p[b]-p[a],dy=p[b+1]-p[a+1],length=dx*dx+dy*dy,s=length>.001?Math.max(0,Math.min(1,((x-p[a])*dx+(y-p[a+1])*dy)/length)):0,distance=Math.hypot(x-p[a]-dx*s,y-p[a+1]-dy*s);if(distance<=12&&(!edge||distance<edge.distance)){const t=s*p[a+3]/(p[b+3]*(1-s)+p[a+3]*s);edge={distance,kind:'edge',point:data.paths[pathIndex][i].clone().lerp(data.paths[pathIndex][i+1],t).applyMatrix4(line.matrixWorld),path:data.paths[pathIndex],pathIndex};}}
 return{vertex,edge};
}
