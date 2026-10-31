import {expect,it} from 'vitest';
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,LineBasicMaterial,LineSegments,LineLoop,Mesh,PerspectiveCamera,Vector3} from 'three';
import {chainRulerSegments,pickRulerLine,rulerCornerIndices,rulerSurfaceEdges} from '@/lib/rulerEdgePicking';
it('derives true surface edges without a visible wireframe and refreshes on geometry replacement',()=>{
 const mesh=new Mesh(new BoxGeometry(20,20,20));mesh.position.x=8;mesh.updateMatrixWorld();
 const edges=rulerSurfaceEdges(mesh);expect(edges.geometry.getAttribute('position').count).toBe(24);expect(edges.matrixWorld.elements[12]).toBe(8);
 expect(rulerSurfaceEdges(mesh)).toBe(edges);
 mesh.geometry=new BoxGeometry(40,20,20);expect(rulerSurfaceEdges(mesh)).not.toBe(edges);
});
it('recognizes outer and reentrant corners of a closed contour, but not collinear points',()=>{
 const points=[[0,0],[3,0],[6,0],[6,3],[3,3],[3,6],[0,6],[0,0]].map(([x,y])=>new Vector3(x,y,0));
 expect(rulerCornerIndices(points)).toEqual([0,2,3,4,5,6]);
});
it('does not invent a corner at the seam of a smooth circular contour',()=>{
 const points=Array.from({length:65},(_,i)=>new Vector3(Math.cos(i*Math.PI/32),Math.sin(i*Math.PI/32),0));
 expect(rulerCornerIndices(points)).toEqual([]);
});
it('snaps close to each closed-loop corner and releases to an edge outside the small capture radius',()=>{
 const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([-10,-10,0,10,-10,0,10,10,0,-10,10,0],3)),line=new LineLoop(geometry,new LineBasicMaterial()),camera=new PerspectiveCamera(40,1,.1,1000);
 camera.position.z=100;camera.updateMatrixWorld();line.updateMatrixWorld();
 for(const point of [new Vector3(-10,-10,0),new Vector3(10,-10,0),new Vector3(10,10,0),new Vector3(-10,10,0)]){
  const screen=point.clone().project(camera),hit=pickRulerLine(line,camera,800,800,(screen.x+1)*400+7,(1-screen.y)*400);
  expect(hit.vertex!.point.distanceTo(point)).toBeLessThan(1e-6);
 }
 const p=new Vector3(10,10,0).project(camera),hit=pickRulerLine(line,camera,800,800,(p.x+1)*400,(1-p.y)*400+15);
 expect(hit.vertex).toBeUndefined();expect(hit.edge).toBeDefined();
});
it('joins a long shuffled polyline without losing segments and keeps corners distinct',()=>{
 const segments:Array<[Vector3,Vector3]>=Array.from({length:5000},(_,i)=>[new Vector3(i,0,0),new Vector3(i+1,0,0)]);segments.reverse();
 const paths=chainRulerSegments(segments);expect(paths).toHaveLength(1);expect(paths[0]).toHaveLength(5001);
 const corners=chainRulerSegments([[new Vector3(0,0,0),new Vector3(1,0,0)],[new Vector3(1,0,0),new Vector3(1,1,0)]]);expect(corners).toHaveLength(2);
});
it('finds edges and endpoints, then invalidates projected data after a transform or geometry edit',()=>{
 const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([-10,0,0,10,0,0],3)),line=new LineSegments(geometry,new LineBasicMaterial()),camera=new PerspectiveCamera(40,1,.1,1000);camera.position.z=100;camera.lookAt(0,0,0);camera.updateMatrixWorld();line.updateMatrixWorld();
 expect(pickRulerLine(line,camera,800,800,400,400).edge!.point.x).toBeCloseTo(0,6);expect(pickRulerLine(line,camera,800,800,400,700).edge).toBeUndefined();
 line.position.y=10;line.updateMatrixWorld();expect(pickRulerLine(line,camera,800,800,400,400).edge).toBeUndefined();line.position.y=0;line.updateMatrixWorld();
 const p=geometry.getAttribute('position');p.setY(0,10);p.setY(1,10);p.needsUpdate=true;expect(pickRulerLine(line,camera,800,800,400,400).edge).toBeUndefined();
});
it('maps a perspective screen hit back to the correct 3D edge position',()=>{
 const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([-10,0,0,10,0,60],3)),line=new LineSegments(geometry,new LineBasicMaterial()),camera=new PerspectiveCamera(40,1,.1,1000);camera.position.z=100;camera.updateMatrixWorld();line.updateMatrixWorld();
 const target=new Vector3(0,0,30),screen=target.clone().project(camera),hit=pickRulerLine(line,camera,800,800,(screen.x+1)*400,(1-screen.y)*400).edge!;expect(hit.point.distanceTo(target)).toBeLessThan(1e-6);
});
it('captures an edge only nearby and retains it in a slightly wider release zone',()=>{
 const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([-10,0,0,10,0,0],3)),line=new LineSegments(geometry,new LineBasicMaterial()),camera=new PerspectiveCamera(40,1,.1,1000);camera.position.z=100;camera.updateMatrixWorld();line.updateMatrixWorld();
 expect(pickRulerLine(line,camera,800,800,400,405).edge).toBeDefined();
 expect(pickRulerLine(line,camera,800,800,400,408).edge).toBeUndefined();
 expect(pickRulerLine(line,camera,800,800,400,408,0).edge).toBeDefined();
 expect(pickRulerLine(line,camera,800,800,400,411,0).edge).toBeUndefined();
});
