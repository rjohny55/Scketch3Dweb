import * as THREE from "three";
type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera;
export type CameraPanReturn = { target: THREE.Vector3; overview: number; start: number; progress: number; active: boolean; previous: number };
export function cameraViewScale(camera: Camera, target: THREE.Vector3) {
  return camera instanceof THREE.PerspectiveCamera ? camera.position.distanceTo(target) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom : (camera.top-camera.bottom)/2/camera.zoom;
}
export function cameraPanReturnBaseline(camera: Camera, target: THREE.Vector3): CameraPanReturn {
  const scale=cameraViewScale(camera,target);return {target:target.clone(),overview:scale,start:scale,progress:0,active:false,previous:scale};
}
export function armCameraPanReturn(state: CameraPanReturn, camera: Camera, target: THREE.Vector3) {
  state.start=cameraViewScale(camera,target);state.previous=state.start;state.progress=0;state.active=true;
}
export function updateCameraPanReturn(state: CameraPanReturn, camera: Camera, target: THREE.Vector3) {
  const scale=cameraViewScale(camera,target),outward=scale>state.previous+1e-6;state.previous=scale;
  if(!state.active || !outward)return false;
  const progress=state.overview<=state.start+1e-6 ? 1 : THREE.MathUtils.clamp((scale-state.start)/(state.overview-state.start),0,1);
  if(progress<=state.progress)return false;
  const shift=state.target.clone().sub(target).multiplyScalar((progress-state.progress)/Math.max(1e-9,1-state.progress));
  camera.position.add(shift);target.add(shift);state.progress=progress;if(progress>=1)state.active=false;return true;
}
