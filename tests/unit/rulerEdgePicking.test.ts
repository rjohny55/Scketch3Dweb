import {expect,it} from 'vitest';
import {BufferGeometry,Float32BufferAttribute,LineBasicMaterial,LineSegments,PerspectiveCamera,Vector3} from 'three';
import {chainRulerSegments,pickRulerLine} from '@/lib/rulerEdgePicking';
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
