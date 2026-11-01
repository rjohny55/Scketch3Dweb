import * as THREE from 'three';
import {deformRenderedShape} from '@/lib/axialStretch';
import {offsetAlongFrame,readEndConnections,type ConnectionFrame} from '@/lib/endOffset';
import type {FaceAnnotation,WorkplaneShape} from '@/types/scketch3dweb';

export type FacePullOptions={face:FaceAnnotation;distance:number;keepFixed:number;keepMoving:number;transitionLength?:number};
type Point=[number,number,number];

/** Move a protected end rigidly along its face normal, stretching only the
 * separating slab. This is not face extrusion: the original shell is carried
 * along, including holes, and no coincident cap is inserted. */
export function facePullTriangles(source:number[],normal:Point,plane:number,options:Pick<FacePullOptions,'distance'|'keepFixed'|'keepMoving'|'transitionLength'>){
 const {distance,keepFixed,keepMoving}=options;
 if(!source.length||source.length%9||source.some(n=>!Number.isFinite(n)))throw Error('Invalid triangle mesh.');
 if(![...normal,plane,distance,keepFixed,keepMoving].every(Number.isFinite)||Math.min(keepFixed,keepMoving)<0||Math.abs(distance)>10000)throw Error('Check the pull distance and protected regions.');
 const n=new THREE.Vector3(...normal);
 if(Math.abs(n.length()-1)>1e-5)throw Error('Invalid face normal.');
 let min=Infinity,max=-Infinity;
 for(let i=0;i<source.length;i+=3){const d=source[i]*n.x+source[i+1]*n.y+source[i+2]*n.z;min=Math.min(min,d);max=Math.max(max,d);}
 // Interior/side faces are deliberately refused: moving them would also drag
 // unrelated protrusions, unlike moving a genuine end of the part.
 if(Math.abs(max-plane)>.01)throw Error('Choose an outer end face. Side and recessed faces cannot be pulled with this tool.');
 const high=plane-keepMoving;
 // A local flange stand-off must not re-profile the rest of the duct.
 // Bound the deformable collar explicitly; never silently enlarge it to the
 // whole connecting body. Omitting transitionLength retains the old stretch.
 const localLength=options.transitionLength;
 if(localLength!==undefined&&(!Number.isFinite(localLength)||localLength<.01))throw Error('The local transition must be at least 0.01 mm long.');
 if(localLength!==undefined&&high-localLength<min+keepFixed-1e-8)throw Error('The local transition overlaps the fixed end. Reduce its length or the protected regions.');
 const low=localLength===undefined?min+keepFixed:high-localLength;
 if(high-low<.01||high-low+distance<.01)throw Error('Leave at least 0.01 mm between the protected ends before and after pulling.');
 const u=new THREE.Vector3(...(Math.abs(n.y)<.9?[0,1,0]:[1,0,0]) as Point);u.addScaledVector(n,-u.dot(n)).normalize();
 const frame:ConnectionFrame={direction:normal,u:u.toArray() as Point,v:n.clone().cross(u).toArray() as Point,low,high,centerU:0,centerV:0};
 return offsetAlongFrame(source,frame,0,0,n.multiplyScalar(distance).toArray() as Point);
}

export function pullFaceShape(shape:WorkplaneShape,root:THREE.Object3D,options:FacePullOptions){
 const connection=readEndConnections({...shape,faceAnnotations:[options.face]},root)[0];
 if(!connection)throw Error('The selected face is stale. Pick it again.');
 const normal=connection.localNormal;
 const plane=connection.localPoints[0].reduce((sum,n,i)=>sum+n*normal[i],0);
 return deformRenderedShape(shape,root,source=>facePullTriangles(source,normal,plane,options));
}
