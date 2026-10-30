import {it,expect} from 'vitest';
import {meshReplacementFingerprint,replaceImportedMesh} from '@/lib/replaceImportedMesh';
import type {WorkplaneShape} from '@/types/scketch3dweb';
const positions=[-1,0,-1,1,0,-1,0,2,1];
const shape:WorkplaneShape={id:'mesh',name:'Duct',kind:'mesh',color:'#123456',x:0,z:0,elevation:0,width:2,height:2,depth:2,size:2,rotation:0,importedMesh:{positions,baseWidth:2,baseHeight:2,baseDepth:2,triangleCount:1,sourceFormat:'stl',assetId:'original-file'}};
const params=()=>({expectedFingerprint:meshReplacementFingerprint(shape),positions:positions.map((v,i)=>i%3===0?v*2:v),width:4,height:2,depth:2,x:1,z:0,elevation:0,faceAnnotations:[]});
it('replaces geometry immutably, preserving object identity and clearing old source references',()=>{const updated=replaceImportedMesh(shape,params());expect(updated.id).toBe(shape.id);expect(updated.name).toBe(shape.name);expect(updated.color).toBe(shape.color);expect(updated.width).toBe(4);expect(updated.importedMesh?.assetId).toBeUndefined();expect(shape.importedMesh?.positions).toBe(positions);expect(shape.width).toBe(2);});
it('rejects a concurrent edit and a locked mesh',()=>{expect(()=>replaceImportedMesh({...shape,name:'User edit'},params())).toThrow(/changed/);expect(()=>replaceImportedMesh({...shape,locked:true},params())).toThrow(/writable/);});
it('rejects malformed geometry, incorrect dimensions and invalid face bindings',()=>{expect(()=>replaceImportedMesh(shape,{...params(),positions:[NaN,0,1]})).toThrow();expect(()=>replaceImportedMesh(shape,{...params(),width:5})).toThrow(/match/);expect(()=>replaceImportedMesh(shape,{...params(),faceAnnotations:[{name:'bad'}]})).toThrow(/annotations/);});
