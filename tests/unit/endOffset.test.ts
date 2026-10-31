import {it,expect} from 'vitest';import * as THREE from 'three';import {computeBoundsTree} from 'three-mesh-bvh';import {offsetEndTriangles,offsetConnection,readEndConnections} from '@/lib/endOffset';import {annotatePlanarFace,measureAnnotatedFace} from '@/lib/faceAnnotations';import {holeMeshReport} from '@/lib/meshHoleEditing';import type {WorkplaneShape} from '@/types/scketch3dweb';
import { bindRulerFace, resolveRulerFace } from '@/lib/rulerFaceAnchor';
import { rulerInclinationDegrees } from '@/lib/rulerMeasurements';
import { deformRulerPoint, undeformRulerPoint } from '@/lib/rulerDeformation';
import {connectionPositionGaps} from '@/lib/endOffset';
function fixture(){const shape:WorkplaneShape={id:'duct',name:'Duct',kind:'mesh',color:'#0098c7',width:20,height:10,depth:12,size:20,x:30,z:40,elevation:2,rotation:0};const g=new THREE.BoxGeometry(20,10,12).toNonIndexed();g.translate(0,5,0);shape.importedMesh={positions:Array.from(g.getAttribute('position').array),baseWidth:20,baseHeight:10,baseDepth:12,triangleCount:12,sourceFormat:'json'};const surface=new THREE.Mesh(g);surface.position.y=-5;surface.userData.shapeSurface=true;const root=new THREE.Group();root.position.set(30,7,40);root.add(surface);root.updateMatrixWorld(true);shape.faceAnnotations=[{...annotatePlanarFace(surface,0,new THREE.Vector3(40,7,40)),name:'Fan'},{...annotatePlanarFace(surface,2,new THREE.Vector3(20,7,40)),name:'GPU'}];return{shape,root,surface};}
function after(shape:WorkplaneShape,root:THREE.Group){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(shape.importedMesh!.positions,3));computeBoundsTree.call(g,{targetLeafSize:12});const mesh=new THREE.Mesh(g);mesh.position.y=-shape.height/2;mesh.userData.shapeSurface=true;const object=new THREE.Group();object.position.set(shape.x,shape.elevation!+shape.height/2,shape.z);object.rotation.copy(root.rotation);object.scale.copy(root.scale);object.add(mesh);object.updateMatrixWorld(true);return{object,mesh};}
it.each([-3,3])('carries unnamed side-wall ruler points through a rotated floor offset of %s mm',offset=>{
 const {shape,root}=fixture();shape.rotationX=90;root.rotation.x=Math.PI/2;root.updateMatrixWorld(true);
 const faces=readEndConnections(shape,root),a=new THREE.Vector3(9,5,1),b=new THREE.Vector3(-9,5,1);
 expect(bindRulerFace(a,faces)).toBeUndefined();expect(bindRulerFace(b,faces)).toBeUndefined();
 const size=new THREE.Vector3(shape.width,shape.height,shape.depth),baseA=a.clone().divide(size).toArray(),baseB=b.clone().divide(size).toArray();
 const next=offsetConnection(shape,root,{fixedFaceId:faces[0].id,movingFaceId:faces[1].id,keepFixed:2,keepMoving:2,coordinateSystem:'floor',offsetU:offset,offsetV:0});
 const {object}=after(next,root),nextSize=new THREE.Vector3(next.width,next.height,next.depth);
 const move=(base:number[])=>object.localToWorld(new THREE.Vector3(...deformRulerPoint(base,next.rulerDeformations)).multiply(nextSize));
 const worldA=root.localToWorld(a.clone()),worldB=root.localToWorld(b.clone());
 expect(move(baseA).distanceTo(worldA)).toBeLessThan(1e-5);
 expect(move(baseB).y-worldB.y).toBeCloseTo(offset,5);
 const rebound=undeformRulerPoint(deformRulerPoint(baseB,next.rulerDeformations),next.rulerDeformations);
 rebound.forEach((n,i)=>expect(n).toBeCloseTo(baseB[i],10));
 const second=offsetConnection(next,object,{fixedFaceId:faces[0].id,movingFaceId:faces[1].id,keepFixed:2,keepMoving:2,coordinateSystem:'floor',offsetU:offset,offsetV:0});
 const again=after(second,object).object.localToWorld(new THREE.Vector3(...deformRulerPoint(baseB,second.rulerDeformations)).multiply(new THREE.Vector3(second.width,second.height,second.depth)));
 expect(again.y-worldB.y).toBeCloseTo(offset*2,5);
});
it('sets absolute edge-to-edge distances instead of adding the requested value to the old offset',()=>{
 const {shape,root}=fixture();root.rotation.set(.15,.3,.1);shape.rotationX=.15*180/Math.PI;shape.rotation=.3*180/Math.PI;shape.rotationZ=.1*180/Math.PI;root.updateMatrixWorld(true);
 const faces=readEndConnections(shape,root),options={fixedFaceId:faces[0].id,movingFaceId:faces[1].id,keepFixed:2,keepMoving:2,coordinateSystem:'floor' as const,mode:'position' as const,offsetU:7,offsetV:-4,fixedAnchorU:'max' as const,movingAnchorU:'min' as const,fixedAnchorV:'min' as const,movingAnchorV:'max' as const};
 const next=offsetConnection(shape,root,options),object=after(next,root).object;
 const changed=readEndConnections(next,object),gaps=connectionPositionGaps(changed,options);
 expect(gaps.vertical).toBeCloseTo(7,4);expect(gaps.horizontal).toBeCloseTo(-4,4);
 expect(new THREE.Vector3(...changed[0].worldCenter).distanceTo(new THREE.Vector3(...faces[0].worldCenter))).toBeLessThan(1e-4);
 const repeat=offsetConnection(next,object,options),repeated=connectionPositionGaps(readEndConnections(repeat,after(repeat,object).object),options);
 expect(repeated.vertical).toBeCloseTo(7,4);expect(repeated.horizontal).toBeCloseTo(-4,4);
 const aligned={...options,offsetU:0,offsetV:0},zero=offsetConnection(next,object,aligned);
 const zeroGap=connectionPositionGaps(readEndConnections(zero,after(zero,object).object),aligned);
 expect(zeroGap.vertical).toBeCloseTo(0,4);expect(zeroGap.horizontal).toBeCloseTo(0,4);
});
it('uses the ruler as a live level while raising and lowering a labeled flange',()=>{
 const {shape,root}=fixture(),faces=readEndConnections(shape,root);
 const start=new THREE.Vector3(10,0,1),end=new THREE.Vector3(-10,.115,1);
 const a=bindRulerFace(start,faces)!,b=bindRulerFace(end,faces)!;
 expect(a.faceId).toBe(faces[0].id);expect(b.faceId).toBe(faces[1].id);
 const angle=(object:THREE.Group,ends:ReturnType<typeof readEndConnections>)=>rulerInclinationDegrees(object.localToWorld(resolveRulerFace(a,ends)!).toArray(),object.localToWorld(resolveRulerFace(b,ends)!).toArray());
 expect(angle(root,faces)).toBeCloseTo(.32945,4);
 for(const offset of [-.115,3,-4]){
  const next=offsetConnection(shape,root,{fixedFaceId:a.faceId,movingFaceId:b.faceId,keepFixed:2,keepMoving:2,offsetU:offset,offsetV:0,coordinateSystem:'floor'});
  const {object}=after(next,root),changed=readEndConnections(next,object);
  const p=object.localToWorld(resolveRulerFace(a,changed)!),q=object.localToWorld(resolveRulerFace(b,changed)!);
  expect(p.distanceTo(root.localToWorld(start.clone()))).toBeLessThan(1e-5);
  expect(q.y-p.y).toBeCloseTo(.115+offset,5);
  expect(angle(object,changed)).toBeCloseTo(Math.atan2(Math.abs(.115+offset),20)*180/Math.PI,5);
 }
 expect(angle(root,faces)).toBeCloseTo(.32945,4); // Undo/reset resolves against the original face again.
 expect(bindRulerFace(new THREE.Vector3(10,100,100),faces)).toBeUndefined();
 expect(resolveRulerFace(b,faces.filter(f=>f.id!==b.faceId))).toBeNull();
});
it.each(['x','y','z']as const)('splits crossing triangles and preserves a closed solid and volume for %s offset',axis=>{const source=Array.from(new THREE.BoxGeometry(20,20,20).toNonIndexed().getAttribute('position').array);for(const fixedEnd of ['min','max']as const){const r=offsetEndTriangles(source,{axis,fixedEnd,keepFixed:2,keepMoving:3,offsetU:17,offsetV:-9});const report=holeMeshReport(r.positions);expect(report.basicChecksPass,JSON.stringify(report)).toBe(true);expect(report.signedVolumeMm3).toBeCloseTo(8000,3);expect(r.positions.length).toBeGreaterThan(source.length);const a=['x','y','z'].indexOf(axis),[u,v]=[0,1,2].filter(i=>i!==a);for(const sign of [-1,1]){const p:[number,number,number]=[0,0,0];p[a]=sign*10;const mapped=r.mapPoint(p);mapped[1]-=r.nextSize[1]/2;const world=mapped.map((n,i)=>n+r.rootShift[i]);const moving=sign===(fixedEnd==='min'?1:-1);expect(world[a]).toBeCloseTo(p[a],8);expect(world[u]).toBeCloseTo(p[u]+(moving?17:0),8);expect(world[v]).toBeCloseTo(p[v]+(moving?-9:0),8);}}});
it('keeps the fan fixed, translates the GPU flange, and keeps both labels valid with identical areas',()=>{const{shape,root}=fixture();const before=readEndConnections(shape,root),fixed=before.find(f=>f.name==='Fan')!,moving=before.find(f=>f.name==='GPU')!;const next=offsetConnection(shape,root,{fixedFaceId:fixed.id,movingFaceId:moving.id,keepFixed:2,keepMoving:2,offsetU:9,offsetV:-5});const{object,mesh}=after(next,root),end=readEndConnections(next,object);expect(new THREE.Vector3(...end.find(f=>f.name==='Fan')!.worldCenter).distanceTo(new THREE.Vector3(...fixed.worldCenter))).toBeLessThan(1e-6);const actual=end.find(f=>f.name==='GPU')!.worldCenter;expect(actual).toEqual([moving.worldCenter[0],moving.worldCenter[1]+9,moving.worldCenter[2]-5]);expect(next.faceAnnotations!.map(a=>measureAnnotatedFace(mesh,a)).every(r=>r.status==='valid'&&Math.abs(r.areaMm2-120)<1e-6)).toBe(true);expect(shape.width).toBe(20);});
it('retains the world anchor even with rotation, mirror and downward movement',()=>{const{shape,root}=fixture();shape.rotation=31;shape.rotationX=23;shape.mirrorZ=true;root.rotation.set(23*Math.PI/180,31*Math.PI/180,0);root.scale.z=-1;root.updateMatrixWorld(true);const ends=readEndConnections(shape,root),fixed=ends.find(e=>e.name==='Fan')!,moving=ends.find(e=>e.name==='GPU')!;const next=offsetConnection(shape,root,{fixedFaceId:fixed.id,movingFaceId:moving.id,keepFixed:2,keepMoving:2,offsetU:-18,offsetV:7});const{object}=after(next,root),actual=readEndConnections(next,object).find(e=>e.id===fixed.id)!;expect(new THREE.Vector3(...actual.worldCenter).distanceTo(new THREE.Vector3(...fixed.worldCenter))).toBeLessThan(1e-5);expect(next.elevation).not.toBe(0);});
it('rejects overlapping protection and selecting one face twice',()=>{expect(()=>offsetEndTriangles(Array.from(new THREE.BoxGeometry(20,20,20).toNonIndexed().getAttribute('position').array),{axis:'x',fixedEnd:'max',keepFixed:10,keepMoving:10,offsetU:1,offsetV:1})).toThrow();const{shape,root}=fixture();const id=shape.faceAnnotations![0].id;expect(()=>offsetConnection(shape,root,{fixedFaceId:id,movingFaceId:id,keepFixed:2,keepMoving:2,offsetU:1,offsetV:1})).toThrow();});
it('supports inclined planar faces without axis-aligned end faces',()=>{
 const {shape,root,surface}=fixture(),g=surface.geometry.clone();surface.geometry=g;g.translate(0,-5,0);g.rotateZ(.37);g.computeBoundingBox();const box=g.boundingBox!,size=box.getSize(new THREE.Vector3());g.translate(0,-box.min.y,0);shape.height=size.y;shape.width=size.x;shape.depth=size.z;shape.importedMesh={...shape.importedMesh!,positions:Array.from(g.getAttribute('position').array),baseWidth:size.x,baseHeight:size.y,baseDepth:size.z};surface.position.y=-size.y/2;root.position.y=2+size.y/2;root.updateMatrixWorld(true);
 const point=(triangle:number)=>{const a=g.getAttribute('position'),p=new THREE.Vector3();for(let i=0;i<3;i++)p.add(new THREE.Vector3().fromBufferAttribute(a,triangle*3+i));return surface.localToWorld(p.multiplyScalar(1/3));};shape.faceAnnotations=[{...annotatePlanarFace(surface,0,point(0)),name:'Fixed inclined'},{...annotatePlanarFace(surface,2,point(2)),name:'Moving inclined'}];
 const before=readEndConnections(shape,root);expect(before).toHaveLength(2);const fixed=before[0],moving=before[1],next=offsetConnection(shape,root,{fixedFaceId:fixed.id,movingFaceId:moving.id,keepFixed:2,keepMoving:2,offsetU:7,offsetV:-3}),{object,mesh}=after(next,root),ends=readEndConnections(next,object);
 expect(ends).toHaveLength(2);expect(new THREE.Vector3(...ends[0].worldCenter).distanceTo(new THREE.Vector3(...fixed.worldCenter))).toBeLessThan(1e-5);expect(new THREE.Vector3(...ends[1].worldCenter).distanceTo(new THREE.Vector3(...moving.worldCenter))).toBeCloseTo(Math.hypot(7,3),4);expect(holeMeshReport(next.importedMesh!.positions).basicChecksPass).toBe(true);expect(measureAnnotatedFace(mesh,next.faceAnnotations![0]).status).toBe('valid');
});
it('exposes all labeled planar faces and rejects adjacent faces sharing an edge',()=>{const{shape,root,surface}=fixture();shape.faceAnnotations!.push({...annotatePlanarFace(surface,4,new THREE.Vector3(30,12,40)),name:'Top'});const faces=readEndConnections(shape,root);expect(faces).toHaveLength(3);expect(()=>offsetConnection(shape,root,{fixedFaceId:faces[0].id,movingFaceId:faces[2].id,keepFixed:0,keepMoving:0,offsetU:1,offsetV:1})).toThrow(/соприкасаются/);});
it('can use separated faces inside the model bounds rather than extreme end faces',()=>{
 const {shape,root,surface}=fixture(),outline=new THREE.Shape();const points=[[-10,-10],[10,-10],[10,-4],[4,-4],[4,4],[10,4],[10,10],[-10,10],[-10,4],[-4,4],[-4,-4],[-10,-4]];outline.moveTo(...points[0] as [number,number]);points.slice(1).forEach(p=>outline.lineTo(...p as [number,number]));outline.closePath();const g=new THREE.ExtrudeGeometry(outline,{depth:12,bevelEnabled:false,steps:1,curveSegments:1});g.translate(0,10,-6);surface.geometry=g;surface.position.y=-10;root.position.y=12;shape.height=20;shape.width=20;shape.importedMesh={...shape.importedMesh!,positions:Array.from(g.getAttribute('position').array),baseWidth:20,baseHeight:20,triangleCount:g.getAttribute('position').count/3};root.updateMatrixWorld(true);
 const attr=g.getAttribute('position');shape.faceAnnotations=[-4,4].map(x=>{let triangle=-1;for(let i=0;i<attr.count;i+=3)if([0,1,2].every(k=>Math.abs(attr.getX(i+k)-x)<1e-6)){triangle=i/3;break;}expect(triangle).toBeGreaterThanOrEqual(0);const p=new THREE.Vector3();for(let j=0;j<3;j++)p.add(new THREE.Vector3().fromBufferAttribute(attr,triangle*3+j));return{...annotatePlanarFace(surface,triangle,surface.localToWorld(p.multiplyScalar(1/3))),name:`Interior ${x}`};});
 const ends=readEndConnections(shape,root);expect(ends).toHaveLength(2);expect(ends.map(c=>c.localCenter[0])).toEqual([-4,4]);const next=offsetConnection(shape,root,{fixedFaceId:ends[0].id,movingFaceId:ends[1].id,keepFixed:1,keepMoving:1,offsetU:2,offsetV:3}),{object}=after(next,root),changed=readEndConnections(next,object);expect(holeMeshReport(next.importedMesh!.positions).basicChecksPass).toBe(true);expect(new THREE.Vector3(...changed[0].worldCenter).distanceTo(new THREE.Vector3(...ends[0].worldCenter))).toBeLessThan(1e-5);expect(changed[1].worldCenter).toEqual(ends[1].worldCenter.map((x,i)=>x+[0,2,3][i]));
});

it('preserves the whole wall label across bent regions and requires a new planar selection for dimensions',()=>{
 const {shape,root,surface}=fixture();
 shape.faceAnnotations!.push({...annotatePlanarFace(surface,4,new THREE.Vector3(30,12,40)),name:'Whole top'});
 const ends=readEndConnections(shape,root);
 const next=offsetConnection(shape,root,{fixedFaceId:ends[0].id,movingFaceId:ends[1].id,keepFixed:2,keepMoving:2,offsetU:3,offsetV:0});
 const {mesh,object}=after(next,root),label=next.faceAnnotations![2];
 const ix=mesh.geometry.getIndex()!,position=mesh.geometry.getAttribute('position');
 let area=0;
 for(const i of label.triangleIndices){const t=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(position,ix.getX(i*3+k)));area+=new THREE.Triangle(t[0],t[1],t[2]).getArea();}
 expect(area).toBeCloseTo(48+12*Math.hypot(16,3),4);
 expect(measureAnnotatedFace(mesh,label)).toMatchObject({status:'stale',reason:expect.stringContaining('больше не плоская')});
 expect(readEndConnections(next,object)).toHaveLength(2);
 const again=offsetConnection(next,object,{fixedFaceId:ends[0].id,movingFaceId:ends[1].id,keepFixed:2,keepMoving:2,offsetU:-3,offsetV:0});
 expect(again.faceAnnotations![2].id).toBe(label.id);
 expect(holeMeshReport(again.importedMesh!.positions).basicChecksPass).toBe(true);
});

it('floor controls move the selected end in world Y and along the floor after rotation and mirroring',()=>{
 const{shape,root}=fixture();root.rotation.set(.3,.55,.2);root.scale.z=-1;shape.rotationX=.3*180/Math.PI;shape.rotation=.55*180/Math.PI;shape.rotationZ=.2*180/Math.PI;shape.mirrorZ=true;root.updateMatrixWorld(true);
 const ends=readEndConnections(shape,root),fixed=ends[0],moving=ends[1];
 const next=offsetConnection(shape,root,{fixedFaceId:fixed.id,movingFaceId:moving.id,keepFixed:2,keepMoving:2,offsetU:3,offsetV:0,coordinateSystem:'floor'});
 const{object}=after(next,root),changed=readEndConnections(next,object);
 expect(new THREE.Vector3(...changed[0].worldCenter).distanceTo(new THREE.Vector3(...fixed.worldCenter))).toBeLessThan(1e-5);
 const delta=new THREE.Vector3(...changed[1].worldCenter).sub(new THREE.Vector3(...moving.worldCenter));
 expect(delta.x).toBeCloseTo(0,5);expect(delta.y).toBeCloseTo(3,5);expect(delta.z).toBeCloseTo(0,5);
 const horizontal=offsetConnection(shape,root,{fixedFaceId:fixed.id,movingFaceId:moving.id,keepFixed:2,keepMoving:2,offsetU:0,offsetV:4,coordinateSystem:'floor'});
 const again=readEndConnections(horizontal,after(horizontal,root).object),h=new THREE.Vector3(...again[1].worldCenter).sub(new THREE.Vector3(...moving.worldCenter));
 expect(h.y).toBeCloseTo(0,5);expect(h.length()).toBeCloseTo(4,5);expect(holeMeshReport(horizontal.importedMesh!.positions).basicChecksPass).toBe(true);
});
