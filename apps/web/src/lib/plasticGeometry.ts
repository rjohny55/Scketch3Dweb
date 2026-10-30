import * as THREE from 'three';
import {MAX_PLASTIC_COORDINATES} from '@/lib/plasticMeshMetrics';
import type {WorkplaneShape} from '@/types/scketch3dweb';
import type {PlasticGeometry} from '@/lib/plasticEstimate';
export type PlasticScope='selected'|'all';
/** Snapshot only when Calculate is pressed. Includes displayed scale, taper, rotation and mirrors. */
export function capturePlasticGeometry(shapes:WorkplaneShape[],selectedIds:string[],rootForShape:(id:string)=>THREE.Object3D|null,scope:PlasticScope):PlasticGeometry{
 const targets=shapes.filter(s=>!s.hidden&&(scope==='selected'?selectedIds.includes(s.id):!s.hole));
 if(!targets.length)throw new Error(scope==='selected'?'Выберите видимую деталь.':'Нет видимых тел для расчёта.');
 const warnings:string[]=[];let count=0;
 if(scope==='selected'&&targets.some(s=>s.hole))warnings.push('Выбранный объект помечен как вырез. Оценка относится к печати его собственной геометрии отдельно.');
 if(shapes.some(s=>s.hole&&!s.hidden)&&scope==='all')warnings.push('Объекты-вырезы не вычтены из тел. Перед расчётом готовой детали выполните объединение/вычитание.');
 let surfaces=0;
 const bodies=targets.map(shape=>{
  const root=rootForShape(shape.id);if(!root)throw new Error('Деталь ещё не отображена. Повторите расчёт после загрузки.');root.updateWorldMatrix(true,true);
  const meshes:THREE.Mesh<THREE.BufferGeometry>[]=[];root.traverse(c=>{if(c instanceof THREE.Mesh&&c.userData.shapeSurface)meshes.push(c);});
  if(!meshes.length)throw new Error(`«${shape.name}»: нет поверхности для расчёта.`);
  surfaces+=meshes.length;
  const size=meshes.reduce((n,m)=>n+(m.geometry.getIndex()?.count??m.geometry.getAttribute('position').count)*3,0);count+=size;
  if(count>MAX_PLASTIC_COORDINATES)throw new Error('Лимит расчёта — 3 миллиона треугольников. Выберите часть сборки.');
  const positions=new Float64Array(size);let offset=0;const point=new THREE.Vector3();
  for(const mesh of meshes){const attr=mesh.geometry.getAttribute('position'),index=mesh.geometry.getIndex(),length=index?.count??attr.count,mirrored=mesh.matrixWorld.determinant()<0;
   for(let i=0;i<length;i+=3)for(const corner of mirrored?[0,2,1]:[0,1,2]){const vertex=index?index.getX(i+corner):i+corner;point.fromBufferAttribute(attr,vertex).applyMatrix4(mesh.matrixWorld);positions[offset++]=point.x;positions[offset++]=point.y;positions[offset++]=point.z;}
  }
  return{id:shape.id,name:shape.name,positions};
 });
 if(targets.length>1||surfaces>1)warnings.push('Объёмы тел суммируются без вычитания пересечений. Для единого изделия сначала объедините пересекающиеся тела.');
 return{bodies,warnings};
}
