import {Box3,MathUtils,OrthographicCamera,PerspectiveCamera,Vector3} from 'three';
/** Frame a bounding sphere using the narrower field of view, with breathing room for UI. */
export function frameCameraBounds(camera:PerspectiveCamera|OrthographicCamera,bounds:Box3,direction:Vector3,margin=1.4){
 if(bounds.isEmpty())return null;
 const center=bounds.getCenter(new Vector3()),radius=Math.max(1,bounds.getSize(new Vector3()).length()/2),unit=direction.clone().normalize();
 if(!Number.isFinite(radius)||unit.lengthSq()===0)return null;
 camera.zoom=1;let distance:number;
 if(camera instanceof PerspectiveCamera){
  const halfVertical=MathUtils.degToRad(camera.fov/2),halfHorizontal=Math.atan(Math.tan(halfVertical)*camera.aspect);
  distance=radius/Math.sin(Math.min(halfVertical,halfHorizontal))*margin;
 }else{
  const aspect=(camera.right-camera.left)/(camera.top-camera.bottom),half=radius*margin/Math.min(1,aspect);
  camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;distance=radius*4;
 }
 camera.position.copy(center).addScaledVector(unit,distance);camera.up.set(0,1,0);camera.lookAt(center);camera.far=Math.max(camera.far,distance+radius*3);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 return {center,distance};
}
