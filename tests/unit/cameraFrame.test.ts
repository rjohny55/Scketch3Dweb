import {it,expect} from 'vitest';
import {Box3,Vector3,PerspectiveCamera,OrthographicCamera} from 'three';
import {frameCameraBounds} from '@/lib/cameraFrame';
it.each([.6,1.7])('keeps all corners of a tall, off-center assembly in view at aspect %s',aspect=>{
 const bounds=new Box3(new Vector3(-230,0,-520),new Vector3(1550,1322,720));
 for(const camera of [new PerspectiveCamera(38,aspect,.1,6000),new OrthographicCamera(-100*aspect,100*aspect,100,-100,.1,6000)]){
  const result=frameCameraBounds(camera,bounds,new Vector3(118,96,118))!;expect(result.center.y).toBe(661);
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new Vector3(x,y,z).project(camera);expect(Math.abs(p.x)).toBeLessThan(.9);expect(Math.abs(p.y)).toBeLessThan(.9);expect(Math.abs(p.z)).toBeLessThan(1);}
 }
});
it('does not change a camera for an empty scene',()=>{const camera=new PerspectiveCamera();camera.position.set(1,2,3);expect(frameCameraBounds(camera,new Box3(),new Vector3(1,1,1))).toBeNull();expect(camera.position.toArray()).toEqual([1,2,3]);});
