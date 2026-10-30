import * as THREE from 'three';
import type {WorkplaneShape} from '@/types/scketch3dweb';

/** Rotate about world Y, or align an outward face normal down; then place the actual lowest vertex on Y=0. */
export function floorRotation(shape:WorkplaneShape,root:THREE.Object3D,degrees:number,faceNormal?:THREE.Vector3,facePoint?:THREE.Vector3):Partial<WorkplaneShape>{
 if(shape.locked)throw new Error('Сначала разблокируйте деталь.');
 if(!Number.isFinite(degrees))throw new Error('Введите угол поворота.');
 root.updateWorldMatrix(true,true);
 const rotation=root.quaternion.clone();
 if(faceNormal){if(faceNormal.lengthSq()<.5)throw new Error('Не удалось определить плоскость грани.');rotation.premultiply(new THREE.Quaternion().setFromUnitVectors(faceNormal.clone().normalize(),new THREE.Vector3(0,-1,0)));}
 rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(degrees)));
 const euler=new THREE.Euler().setFromQuaternion(rotation,'XYZ');
 const angle=(r:number)=>Number((((THREE.MathUtils.radToDeg(r)%360)+360)%360).toFixed(8));
 const angles={rotationX:angle(euler.x),rotation:angle(euler.y),rotationZ:angle(euler.z)};
 // Use exactly the angles that will be saved, including rounding, when calculating the floor contact.
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(),new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(angles.rotationX),THREE.MathUtils.degToRad(angles.rotation),THREE.MathUtils.degToRad(angles.rotationZ),'XYZ')),root.scale.clone());
 const inverse=root.matrixWorld.clone().invert();let min=Infinity;
 root.traverse(child=>{if(!(child instanceof THREE.Mesh)||!child.userData.shapeSurface)return;const attr=child.geometry.getAttribute('position');if(!attr)return;const transform=inverse.clone().multiply(child.matrixWorld).premultiply(matrix);for(let i=0;i<attr.count;i++)min=Math.min(min,new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix4(transform).y);});
 if(!Number.isFinite(min))throw new Error('Не найдена поверхность детали.');
 if(facePoint){const local=root.worldToLocal(facePoint.clone()).applyMatrix4(matrix);if(local.y-min>0.001)throw new Error('На эту грань нельзя опереть всю деталь: другая часть окажется ниже неё. Выберите внешнюю опорную грань.');}
 return {...angles,preciseRotation:true,elevation:-min-shape.height/2};
}
