import {it,expect} from 'vitest';
import * as THREE from 'three';
import {estimatePlastic,DEFAULT_PLASTIC_SETTINGS} from '@/lib/plasticEstimate';
import {capturePlasticGeometry} from '@/lib/plasticGeometry';
import type {WorkplaneShape} from '@/types/scketch3dweb';
function fixture(size=10){
 const shape:WorkplaneShape={id:'box',name:'Box',kind:'box',width:size,height:size,depth:size,size,x:0,z:0,elevation:0,rotation:0,color:'#123456'};
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(size,size,size));mesh.userData.shapeSurface=true;root.add(mesh);return{shape,root,mesh};
}
it('computes exact solid mass, material volume and filament length for a 1 cm³ cube',()=>{
 const{shape,root}=fixture(),g=capturePlasticGeometry([shape],[shape.id],()=>root,'selected');
 const r=estimatePlastic(g,{...DEFAULT_PLASTIC_SETTINGS,infill:100});
 expect(r.volumeCm3).toBeCloseTo(1,8);expect(r.massG).toBeCloseTo(1.24,8);expect(r.solidMassG).toBeCloseTo(1.24,8);
 expect(r.filamentM).toBeCloseTo(1/(Math.PI*(1.75/2)**2),8);
});
it('uses displayed scale and mirrors without mutating the rendered buffers',()=>{
 const{shape,root,mesh}=fixture(),before=Array.from(mesh.geometry.getAttribute('position').array);
 root.scale.set(-2,3,4);root.position.set(1e6,2e6,-1e6);root.rotation.set(.2,.3,.4);
 const r=estimatePlastic(capturePlasticGeometry([shape],[shape.id],()=>root,'selected'),{...DEFAULT_PLASTIC_SETTINGS,infill:100});
 expect(r.volumeCm3).toBeCloseTo(24,5);expect(r.massG).toBeCloseTo(29.76,5);
 expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(before);
});
it('accounts for a hollow model instead of using its bounding box',()=>{
 const{shape,root,mesh}=fixture(20),outer=mesh.geometry.toNonIndexed(),inner=new THREE.BoxGeometry(10,10,10).toNonIndexed();
 const values=Array.from(outer.getAttribute('position').array),inside=inner.getAttribute('position');
 for(let i=0;i<inside.count;i+=3)for(const k of [0,2,1])values.push(inside.getX(i+k),inside.getY(i+k),inside.getZ(i+k));
 mesh.geometry=new THREE.BufferGeometry();mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
 const r=estimatePlastic(capturePlasticGeometry([shape],[shape.id],()=>root,'selected'),{...DEFAULT_PLASTIC_SETTINGS,infill:100});expect(r.volumeCm3).toBeCloseTo(7,7);
});
it('handles shells, infill and reserve in bounded, monotone estimates',()=>{
 const{shape,root}=fixture(50),g=capturePlasticGeometry([shape],[shape.id],()=>root,'selected');
 const hollow=estimatePlastic(g,{...DEFAULT_PLASTIC_SETTINGS,infill:0}),filled=estimatePlastic(g,{...DEFAULT_PLASTIC_SETTINGS,infill:30}),solid=estimatePlastic(g,{...DEFAULT_PLASTIC_SETTINGS,infill:100});
 expect(hollow.massG).toBeGreaterThan(0);expect(filled.massG).toBeGreaterThan(hollow.massG);expect(filled.massG).toBeLessThan(solid.massG);
 expect(estimatePlastic(g,{...DEFAULT_PLASTIC_SETTINGS,infill:100,extraPercent:10}).massG).toBeCloseTo(solid.massG*1.1,7);
 expect(estimatePlastic(g,{...DEFAULT_PLASTIC_SETTINGS,wallThickness:100}).massG).toBeCloseTo(solid.massG,7);
});
it('rejects an open mesh and invalid settings',()=>{
 const{shape,root,mesh}=fixture();mesh.geometry=new THREE.PlaneGeometry(10,10);
 const g=capturePlasticGeometry([shape],[shape.id],()=>root,'selected');expect(()=>estimatePlastic(g,DEFAULT_PLASTIC_SETTINGS)).toThrow(/сетк/);
 for(const patch of [{density:0},{diameter:NaN},{infill:101},{wallThickness:-1},{extraPercent:Infinity},{costPerKg:-1},{costPerKg:Infinity},{costPerKg:NaN},{costPerKg:1e13}])expect(()=>estimatePlastic(g,{...DEFAULT_PLASTIC_SETTINGS,...patch})).toThrow(/Проверьте/);
});
it('excludes hidden objects and scene cutters, but supports explicitly selected cutter geometry',()=>{
 const{shape,root}=fixture();const hidden={...shape,id:'hidden',hidden:true},cutter={...shape,id:'cutter',hole:true};
 const all=capturePlasticGeometry([shape,hidden,cutter],[],()=>root,'all');expect(all.bodies).toHaveLength(1);expect(all.warnings.join(' ')).toContain('не вычтены');
 const selected=capturePlasticGeometry([shape,cutter],['cutter'],()=>root,'selected');expect(selected.bodies[0].id).toBe('cutter');expect(selected.warnings.join(' ')).toContain('помечен как вырез');
 expect(()=>capturePlasticGeometry([hidden],['hidden'],()=>root,'selected')).toThrow(/видимую/);
});
it('adds independent object volumes and explicitly warns about unresolved overlaps',()=>{
 const{shape,root}=fixture(),g=capturePlasticGeometry([shape,{...shape,id:'second'}],[],()=>root,'all');
 const r=estimatePlastic(g,{...DEFAULT_PLASTIC_SETTINGS,infill:100});expect(r.volumeCm3).toBeCloseTo(2,8);expect(r.objectCount).toBe(2);expect(r.warnings.join(' ')).toContain('пересечений');
});

it('prices the estimated grams in kilograms including reserve, without rounding intermediate weight',()=>{
 const{shape,root}=fixture(),g=capturePlasticGeometry([shape],[shape.id],()=>root,'selected');
 const settings={...DEFAULT_PLASTIC_SETTINGS,infill:100,costPerKg:1234.56};
 const r=estimatePlastic(g,settings);expect(r.materialCost).toBeCloseTo(1.24/1000*1234.56,10);
 expect(estimatePlastic(g,{...settings,extraPercent:10}).materialCost).toBeCloseTo(r.materialCost*1.1,10);
 expect(estimatePlastic(g,{...settings,costPerKg:0}).materialCost).toBe(0);
});

it('returns an explicit partial total when another object has defective geometry',()=>{
 const{shape,root}=fixture(),valid=capturePlasticGeometry([shape],[shape.id],()=>root,'selected').bodies[0],invalid={id:'open',name:'Open panel',positions:new Float64Array(36)};
 const result=estimatePlastic({bodies:[valid,invalid],warnings:[]},{...DEFAULT_PLASTIC_SETTINGS,infill:100});
 expect(result).toMatchObject({objectCount:1,requestedObjectCount:2,excludedObjectCount:1,approximateObjectCount:0,isPartial:true});expect(result.volumeCm3).toBeCloseTo(1,8);expect(result.bodyResults[1]).toMatchObject({id:'open',status:'excluded'});expect(result.warnings.join(' ')).toContain('Частичный');
});
it('requires opt-in before estimating a non-closed body and labels its result approximate',()=>{
 const{shape,root}=fixture(),body=capturePlasticGeometry([shape],[shape.id],()=>root,'selected').bodies[0];
 // Remove one entire face (two triangles), leaving a five-sided cube.
 const open={...body,positions:body.positions.slice(18)};const geometry={bodies:[open],warnings:[]};
 expect(()=>estimatePlastic(geometry,DEFAULT_PLASTIC_SETTINGS)).toThrow(/сетк/i);
 const result=estimatePlastic(geometry,{...DEFAULT_PLASTIC_SETTINGS,infill:100},{allowApproximateMeshes:true});
 expect(result).toMatchObject({objectCount:1,approximateObjectCount:1,excludedObjectCount:0,isPartial:false});expect(result.volumeCm3).toBeCloseTo(5/6,8);expect(result.bodyResults[0].status).toBe('approximate');expect(result.bodyResults[0].originSensitivityCm3).toBeGreaterThan(0);expect(result.warnings.join(' ')).toContain('дефектами');
});
it('does not invent a volume for a flat surface even in approximate mode',()=>{
 const flat={id:'flat',name:'Flat surface',positions:new Float64Array([0,0,0,10,0,0,10,10,0,0,0,0,10,10,0,0,10,0,0,0,0,10,0,0,10,10,0,0,0,0,10,10,0,0,10,0])};
 expect(()=>estimatePlastic({bodies:[flat],warnings:[]},DEFAULT_PLASTIC_SETTINGS,{allowApproximateMeshes:true})).toThrow(/ненулевой объём/);
});
it('allows a consistently reversed closed shell only as an explicitly marked estimate',()=>{
 const{shape,root}=fixture(),body=capturePlasticGeometry([shape],[shape.id],()=>root,'selected').bodies[0],positions=body.positions.slice();
 for(let i=0;i<positions.length;i+=9)for(let j=0;j<3;j++)[positions[i+3+j],positions[i+6+j]]=[positions[i+6+j],positions[i+3+j]];
 const r=estimatePlastic({bodies:[{...body,positions}],warnings:[]},{...DEFAULT_PLASTIC_SETTINGS,infill:100},{allowApproximateMeshes:true});expect(r.volumeCm3).toBeCloseTo(1,8);expect(r.approximateObjectCount).toBe(1);
});
