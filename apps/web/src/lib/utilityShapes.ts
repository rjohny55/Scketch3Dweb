import * as THREE from 'three';
import {createLocalId} from '@/lib/localIds';
import type {ShapeAsset,ShapeCustomization,WorkplaneShape} from '@/types/scketch3dweb';

export const UTILITY_SHAPES = [
 {id:'utility-rounded-plate',name:'Rounded plate',width:40,depth:24,height:4},
 {id:'utility-capsule',name:'Capsule',width:40,depth:16,height:8},
 {id:'utility-hex-prism',name:'Hexagonal prism',width:24,depth:12*Math.sqrt(3),height:12},
 {id:'utility-oct-prism',name:'Octagonal prism',width:24,depth:24,height:12},
 {id:'utility-frustum',name:'Truncated pyramid',width:24,depth:24,height:20},
 {id:'utility-rect-tube',name:'Rectangular tube',width:30,depth:20,height:30},
 {id:'utility-u-channel',name:'U-channel',width:30,depth:40,height:20},
 {id:'utility-angle',name:'Angle bracket',width:24,depth:24,height:24},
 {id:'utility-flange',name:'Mounting flange',width:40,depth:40,height:5},
 {id:'utility-countersunk-washer',name:'Countersunk washer',width:24,depth:24,height:4},
] as const;
export type UtilityShapeId=(typeof UTILITY_SHAPES)[number]['id'];
export const utilityShapeAssets=UTILITY_SHAPES.map(preset=>({id:preset.id,name:preset.name,kind:'mesh' as const,color:'#4a9cff',src:`assets/scketch3dweb/utility-shapes/${preset.id}.svg`,menuIcon:`assets/scketch3dweb/utility-shapes/${preset.id}.svg`}));

function polygon(points:[number,number][]) {
 const shape=new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();return shape;
}
function vertical(profile:THREE.Shape,height:number) {
 const geometry=new THREE.ExtrudeGeometry(profile,{depth:height,bevelEnabled:false,curveSegments:24,steps:1});geometry.rotateX(-Math.PI/2);return geometry;
}
function roundPlate() {
 const s=new THREE.Shape(),r=4;
 s.moveTo(-16,-12);s.lineTo(16,-12);s.absarc(16,-8,r,-Math.PI/2,0,false);s.lineTo(20,8);s.absarc(16,8,r,0,Math.PI/2,false);s.lineTo(-16,12);s.absarc(-16,8,r,Math.PI/2,Math.PI,false);s.lineTo(-20,-8);s.absarc(-16,-8,r,Math.PI,Math.PI*1.5,false);s.closePath();return vertical(s,4);
}
function shapeGeometry(id:UtilityShapeId):THREE.BufferGeometry {
 switch(id){
  case 'utility-rounded-plate':return roundPlate();
  case 'utility-capsule':{
   const s=new THREE.Shape();s.moveTo(-12,-8);s.lineTo(12,-8);s.absarc(12,0,8,-Math.PI/2,Math.PI/2,false);s.lineTo(-12,8);s.absarc(-12,0,8,Math.PI/2,Math.PI*1.5,false);s.closePath();return vertical(s,8);
  }
  case 'utility-hex-prism':case 'utility-oct-prism':{
   const sides=id==='utility-hex-prism'?6:8;
   return vertical(polygon(Array.from({length:sides},(_,i)=>[12*Math.cos(i*2*Math.PI/sides),12*Math.sin(i*2*Math.PI/sides)])),12);
  }
  case 'utility-frustum':{
   const g=new THREE.CylinderGeometry(.5,1,1,4,1);g.rotateY(Math.PI/4);return g;
  }
  case 'utility-rect-tube':{
   const s=polygon([[-15,-10],[15,-10],[15,10],[-15,10]]),hole=new THREE.Path();hole.moveTo(-12,-7);hole.lineTo(-12,7);hole.lineTo(12,7);hole.lineTo(12,-7);hole.closePath();s.holes.push(hole);return vertical(s,30);
  }
  case 'utility-u-channel':return new THREE.ExtrudeGeometry(polygon([[-15,0],[15,0],[15,20],[12,20],[12,3],[-12,3],[-12,20],[-15,20]]),{depth:40,steps:1,bevelEnabled:false});
  case 'utility-angle':return new THREE.ExtrudeGeometry(polygon([[0,0],[24,0],[24,3],[3,3],[3,24],[0,24]]),{depth:24,steps:1,bevelEnabled:false});
  case 'utility-flange':{
   const s=new THREE.Shape();s.absarc(0,0,20,0,Math.PI*2,false);
   for(const[x,y,r]of [[0,0,8],[-12,-12,2],[-12,12,2],[12,-12,2],[12,12,2]]){const hole=new THREE.Path();hole.absarc(x,y,r,0,Math.PI*2,true);s.holes.push(hole);}return vertical(s,5);
  }
  case 'utility-countersunk-washer':return new THREE.LatheGeometry([[3,0],[12,0],[12,4],[6,4],[3,1],[3,0]].map(([x,y])=>new THREE.Vector2(x,y)),96);
 }
}
/** Mesh presets use the editor's existing mesh path for resize, Boolean editing and SKF/STL. */
export function makeUtilityShape(asset:ShapeAsset,point?:{x:number;z:number;elevation?:number},customization:ShapeCustomization={}):WorkplaneShape|null {
 const preset=UTILITY_SHAPES.find(p=>p.id===asset.id);if(!preset)return null;
 const dimensions={width:customization.width??preset.width,depth:customization.depth??preset.depth,height:customization.height??preset.height};
 for(const value of Object.values(dimensions))if(!Number.isFinite(value)||value<.01||value>2000)throw new Error('Shape dimensions must be between 0.01 and 2000 mm');
 const original=shapeGeometry(preset.id),geometry=original.index?original.toNonIndexed():original;
 try{
  geometry.computeBoundingBox();const bounds=geometry.boundingBox!,span=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(dimensions.width/span.x,dimensions.height/span.y,dimensions.depth/span.z);
  const positions=Array.from(geometry.getAttribute('position').array),normals=Array.from(geometry.getAttribute('normal').array);
  return {id:createLocalId(preset.id),name:asset.name,kind:'mesh',color:asset.color,hole:asset.hole,x:point?.x??0,z:point?.z??0,elevation:point?.elevation??0,size:Math.max(dimensions.width,dimensions.depth),...dimensions,rotation:0,rotationX:0,rotationZ:0,locked:false,hidden:false,importedMesh:{positions,normals,baseWidth:dimensions.width,baseDepth:dimensions.depth,baseHeight:dimensions.height,triangleCount:positions.length/9,sourceFormat:'json'}};
 }finally{geometry.dispose();if(geometry!==original)original.dispose();}
}
