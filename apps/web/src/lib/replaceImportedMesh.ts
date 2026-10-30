import { projectShapesFingerprint } from "@/lib/editorHistory";
import { canonicalizeShape } from "@/lib/workplaneShapes";
import type { FaceAnnotation, WorkplaneShape } from "@/types/scketch3dweb";

export function meshReplacementFingerprint(shape: WorkplaneShape) {
  return projectShapesFingerprint([canonicalizeShape(shape)]);
}
export function replaceImportedMesh(target: WorkplaneShape, params: Record<string, unknown>): WorkplaneShape {
  if (!target.importedMesh || target.locked) throw new Error("A writable imported mesh is required");
  if (typeof params.expectedFingerprint !== "string" || meshReplacementFingerprint(target) !== params.expectedFingerprint) throw new Error("Object changed since preparation. Read the scene again before replacing geometry.");
  const positions = params.positions;
  if (!Array.isArray(positions) || positions.length < 9 || positions.length > 3_000_000 || positions.length % 9 || positions.some(v => typeof v !== "number" || !Number.isFinite(v))) throw new Error("Invalid triangle positions");
  const number = (key: string) => { const value=params[key]; if(typeof value!=="number" || !Number.isFinite(value))throw new Error(`Invalid ${key}`);return value; };
  const width=number("width"),height=number("height"),depth=number("depth");
  if(Math.min(width,height,depth)<=0)throw new Error("Dimensions must be positive");
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  positions.forEach((v,i)=>{const a=i%3;min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);});
  if([width,height,depth].some((n,i)=>Math.abs(max[i]-min[i]-n)>0.001)||Math.abs(min[0]+max[0])>0.001||Math.abs(min[2]+max[2])>0.001||Math.abs(min[1])>0.001)throw new Error("Mesh must be centered on X/Z, based at Y=0 and match the supplied dimensions");
  const annotations=params.faceAnnotations;
  if(!Array.isArray(annotations) || annotations.some(a=>!a || typeof a.id!=="string" || typeof a.name!=="string" || !a.name.trim() || typeof a.geometryKey!=="string" || !Array.isArray(a.triangleIndices)||!a.triangleIndices.length||a.triangleIndices.some((i:unknown)=>!Number.isInteger(i)||(i as number)<0||(i as number)>=positions.length/9)||[a.localPoint,a.localNormal].some(v=>!Array.isArray(v)||v.length!==3||v.some((n:unknown)=>typeof n!=="number"||!Number.isFinite(n)))))throw new Error("Invalid face annotations");
  return canonicalizeShape({...target,x:number("x"),z:number("z"),elevation:number("elevation"),width,height,depth,size:Math.max(width,depth),
    importedMesh:{positions,baseWidth:width,baseDepth:depth,baseHeight:height,triangleCount:positions.length/9,sourceFormat:"json"},
    faceAnnotations:annotations as FaceAnnotation[],cadBrep:undefined,cadBrepFrame:undefined,cadPrimitiveFrame:undefined,cadDisplayEdges:undefined,cadDisplayEdgesVersion:undefined,edgeTreatments:undefined,edgeTreatmentHistory:undefined,groupedShapes:undefined});
}
