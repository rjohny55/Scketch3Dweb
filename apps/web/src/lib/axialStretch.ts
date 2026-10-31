import * as THREE from "three";
import { computeBoundsTree } from "three-mesh-bvh";
import { meshPrintReport } from "@/lib/meshPrintReport";
import { annotatePlanarFace, faceGeometryKey } from "@/lib/faceAnnotations";
import type { FaceAnnotation, FacePaint, WorkplaneShape } from "@/types/scketch3dweb";
import type { RulerDeformationMap } from '@/lib/rulerDeformation';

export type AxialStretchOptions = {
  axis: "x" | "y" | "z";
  target: number;
  keepStart: number;
  keepEnd: number;
  anchor: "start" | "center" | "end";
};
type Point = [number, number, number];
const axes = { x: 0, y: 1, z: 2 } as const;

/** A continuous, strictly increasing map. End regions move rigidly; only the middle changes length. */
export function axialStretchMap(length: number, options: AxialStretchOptions) {
  const { target, keepStart, keepEnd } = options;
  if (![length, target, keepStart, keepEnd].every(Number.isFinite) || length <= 0 || target <= 0 || keepStart < 0 || keepEnd < 0) throw new Error("Введите положительный размер и неотрицательные отступы.");
  const middle = length - keepStart - keepEnd;
  const nextMiddle = target - keepStart - keepEnd;
  if (middle < 0.01 || nextMiddle < 0.01) throw new Error("Между защищёнными концами должно оставаться минимум 0,01 мм до и после изменения.");
  const delta = target - length;
  return (distance: number) => distance <= keepStart ? distance : distance >= length - keepEnd ? distance + delta : keepStart + (distance - keepStart) * nextMiddle / middle;
}

export function clipDeformationPolygon(poly: Point[], axis: number, plane: number, below: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const insideA = below ? a[axis] <= plane : a[axis] >= plane;
    const insideB = below ? b[axis] <= plane : b[axis] >= plane;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      // Canonical ordering gives shared edges exactly the same intersection on both triangles.
      const [lo, hi] = a[axis] < b[axis] ? [a, b] : [b, a];
      const t = (plane - lo[axis]) / (hi[axis] - lo[axis]);
      const p = lo.map((v, k) => v + t * (hi[k] - v)) as Point;
      p[axis] = plane;
      result.push(p);
    }
  }
  return result;
}

/** Split BEFORE deforming: triangles crossing the fixed-region boundaries must bend at those boundaries. */
export function stretchTriangles(source: readonly number[], options: AxialStretchOptions) {
  if (!source.length || source.length % 9 || source.some(v => !Number.isFinite(v))) throw new Error("Некорректная треугольная сетка.");
  if (!(options.axis in axes) || !["start", "center", "end"].includes(options.anchor)) throw new Error("Некорректная ось или опорный конец.");
  const axis = axes[options.axis], min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  source.forEach((v, i) => { min[i % 3] = Math.min(min[i % 3], v); max[i % 3] = Math.max(max[i % 3], v); });
  const size = max.map((v, i) => v - min[i]);
  const mapDistance = axialStretchMap(size[axis], options);
  const low = min[axis] + options.keepStart, high = max[axis] - options.keepEnd;
  const center = min.map((v, i) => (v + max[i]) / 2);
  const nextSize = [...size]; nextSize[axis] = options.target;
  const mapPoint = (p: Point): Point => p.map((v, i) => {
    const d = i === axis ? mapDistance(v - min[i]) : v - min[i];
    return d - (i === 1 ? 0 : nextSize[i] / 2);
  }) as Point;
  const positions: number[] = [], sourceTriangles: number[] = [];
  for (let i = 0; i < source.length; i += 9) {
    const triangle = [source.slice(i, i + 3), source.slice(i + 3, i + 6), source.slice(i + 6, i + 9)] as Point[];
    let regions = [triangle];
    for (const plane of [low, high]) {
      regions = regions.flatMap(poly => {
        const values = poly.map(p => p[axis]);
        if (Math.min(...values) >= plane || Math.max(...values) <= plane) return [poly];
        return [clipDeformationPolygon(poly, axis, plane, true), clipDeformationPolygon(poly, axis, plane, false)];
      });
    }
    for (const poly of regions) for (let j = 1; j + 1 < poly.length; j++) {
      const t = [poly[0], poly[j], poly[j + 1]].map(p => mapPoint(p).map(Math.fround) as Point);
      const [a, b, c] = t.map(p => new THREE.Vector3(...p));
      if (b.sub(a).cross(c.sub(a)).lengthSq() <= 1e-20) continue;
      t.forEach(p => positions.push(...p)); sourceTriangles.push(i / 9);
    }
    if (positions.length > 3_000_000) throw new Error("После разделения сетка превышает миллион вершин. Упростите деталь или уменьшите защищённые участки.");
  }
  return { positions, sourceTriangles, mapPoint, size, nextSize, center, axis };
}

export type MeshDeformation = { positions:number[]; sourceTriangles:number[]; mapPoint:(p:Point)=>Point; nextSize:number[]; rootShift:Point; rulerMap?: RulerDeformationMap };
/** Common deformation commit: preserve face bindings, paint, pose, and actual mesh geometry. */
export function deformRenderedShape(shape: WorkplaneShape, root: THREE.Object3D, deform:(source:number[])=>MeshDeformation): WorkplaneShape {
  if (shape.locked) throw new Error("Сначала разблокируйте деталь.");
  if (shape.groupedShapes?.length) throw new Error("Сначала объедините группу в одну сетку или выберите отдельную деталь.");
  root.updateWorldMatrix(true, true);
  const surfaces: THREE.Mesh<THREE.BufferGeometry>[] = [];
  root.traverse(child => { if (child instanceof THREE.Mesh && child.userData.shapeSurface) surfaces.push(child); });
  if (surfaces.length !== 1) throw new Error("Выберите одну деталь с треугольной сеткой.");
  const surface = surfaces[0], geometry = surface.geometry, index = geometry.getIndex(), attr = geometry.getAttribute("position");
  const toRoot = root.matrixWorld.clone().invert().multiply(surface.matrixWorld);
  const source: number[] = [];
  for (let i = 0; i < (index?.count ?? attr.count); i++) source.push(...new THREE.Vector3().fromBufferAttribute(attr, index ? index.getX(i) : i).applyMatrix4(toRoot).toArray());
  const result = deform(source);
  const { positions, nextSize, rootShift, mapPoint } = result;
  if ((shape.rulerDeformations?.length ?? 0) >= 1024) throw Error('Too many deformations in one part. Export and reimport the mesh before continuing.');
  const report = (values: number[]) => meshPrintReport([{ vertices: Array.from({length:values.length/3},(_,i)=>values.slice(i*3,i*3+3) as Point), faces:Array.from({length:values.length/9},(_,i)=>[i*3,i*3+1,i*3+2]) }]);
  // Refuse an edit if Float32 rounding or triangle splitting damages a previously closed solid.
  if (report(source).basicChecksPass && !report(positions).basicChecksPass) throw new Error("Этот размер создаёт дефекты сетки. Увеличьте размер середины или измените защищённые участки.");
  const targetGeometry = new THREE.BufferGeometry();
  targetGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  targetGeometry.computeVertexNormals();
  // Same index order and BVH settings as imported geometry in the viewport.
  computeBoundsTree.call(targetGeometry, { targetLeafSize: 12 });
  const targetMesh = new THREE.Mesh(targetGeometry);
  const targetIndex = targetGeometry.getIndex()!;
  const targetPosition = targetGeometry.getAttribute("position");
  const mappedAnchor = (a: FaceAnnotation) => mapPoint(new THREE.Vector3(...a.localPoint).applyMatrix4(toRoot).toArray() as Point);
  const refreshLabel = (a: FaceAnnotation): FaceAnnotation => {
    if (a.geometryKey !== faceGeometryKey(geometry)) throw new Error("Есть устаревшая метка грани. Привяжите её заново перед растяжением.");
    const point = new THREE.Vector3(...mappedAnchor(a)); let seed = -1, best = Infinity;
    const triangleIndices: number[] = [];
    const originalTriangles = new Set(a.triangleIndices);
    for (let i = 0; i < targetIndex.count / 3; i++) {
      const rawTriangle = Math.floor(targetIndex.getX(i * 3) / 3);
      if (!originalTriangles.has(result.sourceTriangles[rawTriangle])) continue;
      triangleIndices.push(i);
      const t = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(targetPosition, targetIndex.getX(i * 3 + k)));
      const distance = new THREE.Triangle(t[0], t[1], t[2]).closestPointToPoint(point, new THREE.Vector3()).distanceToSquared(point);
      if (distance < best) { best = distance; seed = i; }
    }
    if (seed < 0 || best > 1e-6) throw new Error("Не удалось сохранить привязку метки грани.");
    return { ...annotatePlanarFace(targetMesh, seed, point), triangleIndices, id: a.id, name: a.name };
  };
  try {
    const faceAnnotations = (shape.faceAnnotations ?? []).map(refreshLabel);
    const geometryKey = faceGeometryKey(targetGeometry);
    const facePaints: FacePaint[] = (shape.facePaints ?? []).map(paint => {
      if (paint.geometryKey !== faceGeometryKey(geometry)) throw new Error("Есть устаревшая заливка. Удалите её или привяжите грань заново.");
      const old = new Set(paint.triangleIndices), triangleIndices: number[] = [];
      for (let i = 0; i < targetIndex.count / 3; i++) if (old.has(result.sourceTriangles[Math.floor(targetIndex.getX(i * 3) / 3)])) triangleIndices.push(i);
      const first = triangleIndices[0];
      if (first === undefined) throw new Error("Не удалось сохранить заливку грани.");
      const triangle = [0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(targetPosition,targetIndex.getX(first*3+k)));
      const localNormal = new THREE.Triangle(triangle[0],triangle[1],triangle[2]).getNormal(new THREE.Vector3()).toArray() as Point;
      return { ...paint, geometryKey, triangleIndices, localPoint: mappedAnchor(paint), localNormal };
    });
    const shift = new THREE.Vector3(...rootShift);
    shift.applyMatrix3(new THREE.Matrix3().setFromMatrix4(root.matrixWorld));
    const worldCenter = root.getWorldPosition(new THREE.Vector3()).add(shift);
    return { ...shape, rulerDeformations: result.rulerMap ? [...(shape.rulerDeformations ?? []), { ...result.rulerMap, sourceSize: [shape.width, shape.height, shape.depth], targetSize: nextSize as Point }] : shape.rulerDeformations, kind: "mesh", width: nextSize[0], height: nextSize[1], depth: nextSize[2], size: Math.max(nextSize[0], nextSize[2]),
      x: worldCenter.x, z: worldCenter.z, elevation: worldCenter.y - nextSize[1] / 2,
      importedMesh: { positions, baseWidth: nextSize[0], baseHeight: nextSize[1], baseDepth: nextSize[2], triangleCount: positions.length / 9, sourceFormat: "json" },
      faceAnnotations, facePaints, cadBrep: undefined, cadBrepFrame: undefined, cadPrimitiveFrame: undefined,
      cadDisplayEdges: undefined, cadDisplayEdgesVersion: undefined, edgeTreatments: undefined, edgeTreatmentHistory: undefined,
      groupedShapes: undefined, sketchProfile: undefined, sketchRevolve: undefined, sketchOperation: undefined,
      imagePlate: undefined, taperTopWidth: undefined, taperTopDepth: undefined, taperBottomWidth: undefined, taperBottomDepth: undefined, taperTopScale: undefined, taperBottomScale: undefined };
  } finally { targetGeometry.dispose(); }
}

/** Bake current displayed surfaces, including scale/taper, and preserve the chosen axial anchor. */
export function stretchShape(shape:WorkplaneShape,root:THREE.Object3D,options:AxialStretchOptions):WorkplaneShape {
  return deformRenderedShape(shape,root,source=>{
    const result=stretchTriangles(source,options),rootShift=[...result.center] as Point;
    rootShift[result.axis]+=(options.target-result.size[result.axis])*(options.anchor==="start"?.5:options.anchor==="end"?-.5:0);
    const direction:Point=[0,0,0],delta:Point=[0,0,0],center=[...result.center] as Point;
    direction[result.axis]=1;delta[result.axis]=options.target-result.size[result.axis];center[result.axis]+=delta[result.axis]/2;
    return {...result,rootShift,rulerMap:{direction,delta,center,low:result.center[result.axis]-result.size[result.axis]/2+options.keepStart,high:result.center[result.axis]+result.size[result.axis]/2-options.keepEnd}};
  });
}
