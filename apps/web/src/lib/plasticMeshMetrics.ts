/** Bounded triangle-soup analysis: no expanded vertex/face arrays. Runs in the estimate Worker. */
export const MAX_PLASTIC_COORDINATES=27_000_000; // 3 million triangles / 216 MB transferred Float64 data.
export function plasticMeshMetrics(p:Float64Array){
 if(p.length<36||p.length%9)throw Error('Некорректная сетка: недостаточно треугольников.');
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<p.length;i++){const n=p[i];if(!Number.isFinite(n))throw Error('Сетка содержит некорректные координаты.');const axis=i%3;min[axis]=Math.min(min[axis],n);max[axis]=Math.max(max[axis],n);}
 const origin=min.map((n,i)=>n+(max[i]-n)/2),vertexIds=new Map<string,number>(),edges=new Map<number,number>(),stride=p.length/3+1;
 let area=0,volume=0,compensation=0,degenerate=0;const flux=[0,0,0];
 const vertex=(x:number,y:number,z:number)=>{const key=`${Math.round(x/1e-5)},${Math.round(y/1e-5)},${Math.round(z/1e-5)}`;let id=vertexIds.get(key);if(id===undefined){id=vertexIds.size;vertexIds.set(key,id);}return id;};
 const edge=(from:number,to:number)=>{const key=Math.min(from,to)*stride+Math.max(from,to),direction=from<to?1:-1,previous=edges.get(key);edges.set(key,previous===undefined?direction:Math.abs(previous)===1?previous+direction:3);};
 for(let i=0;i<p.length;i+=9){
  const ax=p[i]-origin[0],ay=p[i+1]-origin[1],az=p[i+2]-origin[2],bx=p[i+3]-origin[0],by=p[i+4]-origin[1],bz=p[i+5]-origin[2],cx=p[i+6]-origin[0],cy=p[i+7]-origin[1],cz=p[i+8]-origin[2];
  const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz);
  if(length<=1e-10){degenerate++;continue;}
  const a=vertex(ax,ay,az),b=vertex(bx,by,bz),c=vertex(cx,cy,cz);if(a===b||b===c||a===c){degenerate++;continue;}
  area+=length/2;flux[0]+=nx;flux[1]+=ny;flux[2]+=nz;
  const term=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6-compensation,next=volume+term;compensation=(next-volume)-term;volume=next;
  edge(a,b);edge(b,c);edge(c,a);
 }
 let boundary=0,nonManifold=0,winding=0;for(const state of edges.values()){if(Math.abs(state)===1)boundary++;else if(state===3)nonManifold++;else if(Math.abs(state)===2)winding++;}
 const originSensitivityMm3=flux.reduce((n,f,i)=>n+Math.abs(f)*(max[i]-min[i])/12,0);
 return {areaMm2:area,signedVolumeMm3:volume,boundaryEdges:boundary,nonManifoldEdges:nonManifold,inconsistentWindingEdges:winding,degenerateTriangles:degenerate,originSensitivityMm3,basicChecksPass:!boundary&&!nonManifold&&!winding&&!degenerate&&volume>0};
}
