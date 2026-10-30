import * as THREE from "three";
import type { FaceAnnotation } from "@/types/scketch3dweb";

const cache = new WeakMap<THREE.BufferGeometry, { key: string; triangles: THREE.Vector3[][]; edges: Map<string, number[]> }>();
const vertexKey = (p: THREE.Vector3) => p.toArray().map(v => Math.round(v * 1e5)).join(",");
const edgeKey = (a: THREE.Vector3, b: THREE.Vector3) => [vertexKey(a), vertexKey(b)].sort().join("|");
function topology(g: THREE.BufferGeometry) {
  const previous = cache.get(g);
  if (previous) return previous;
  const pos = g.getAttribute("position");
  const index = g.getIndex();
  const triangles: THREE.Vector3[][] = [];
  const edges = new Map<string, number[]>();
  let hash = 2166136261;
  const count = Math.floor((index?.count ?? pos.count) / 3);
  for (let i = 0; i < count; i++) {
    const t = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i * 3 + j) : i * 3 + j));
    triangles.push(t);
    for (const ch of t.map(vertexKey).join(";")) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
    for (let j = 0; j < 3; j++) {
      const key = edgeKey(t[j], t[(j + 1) % 3]);
      const list = edges.get(key) ?? [];
      list.push(i); edges.set(key, list);
    }
  }
  const result = { key: `${count}:${hash >>> 0}`, triangles, edges };
  cache.set(g, result);
  return result;
}
export const faceGeometryKey = (g: THREE.BufferGeometry) => topology(g).key;
const normalOf = (t: THREE.Vector3[]) => t[1].clone().sub(t[0]).cross(t[2].clone().sub(t[0])).normalize();

/** Connected, coplanar patch. Does not cross gaps or follow a curved surface. */
export function annotatePlanarFace(mesh: THREE.Mesh<THREE.BufferGeometry>, triangleIndex: number, worldPoint: THREE.Vector3): FaceAnnotation {
  const data = topology(mesh.geometry);
  const seed = data.triangles[triangleIndex];
  if (!seed) throw new Error("Не удалось определить треугольник грани");
  const normal = normalOf(seed);
  if (normal.lengthSq() < 0.5) throw new Error("Вырожденная грань");
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, seed[0]);
  const seen = new Set<number>([triangleIndex]);
  const accepted: number[] = [];
  const queue = [triangleIndex];
  while (queue.length) {
    const i = queue.pop()!;
    const t = data.triangles[i];
    if (normal.dot(normalOf(t)) < 1 - 1e-7 || t.some(p => Math.abs(plane.distanceToPoint(p)) > 1e-4)) continue;
    accepted.push(i);
    for (let j = 0; j < 3; j++) for (const next of data.edges.get(edgeKey(t[j], t[(j + 1) % 3])) ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  mesh.updateWorldMatrix(true, false);
  return { id: crypto.randomUUID(), name: "", geometryKey: data.key, triangleIndices: accepted,
    localPoint: mesh.worldToLocal(worldPoint.clone()).toArray() as [number, number, number],
    localNormal: normal.toArray() as [number, number, number] };
}

function computeAnnotatedFace(mesh: THREE.Mesh<THREE.BufferGeometry>, annotation: FaceAnnotation) {
  const data = topology(mesh.geometry);
  if (data.key !== annotation.geometryKey || annotation.triangleIndices.some(i => !data.triangles[i])) {
    return { id: annotation.id, name: annotation.name, status: "stale" as const, reason: "Геометрия изменилась. Укажите грань заново." };
  }
  mesh.updateWorldMatrix(true, false);
  const point = mesh.localToWorld(new THREE.Vector3(...annotation.localPoint));
  const normal = new THREE.Vector3(...annotation.localNormal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
  // Normal of transformed triangle also accounts for reflections.
  const triangles = annotation.triangleIndices.map(i => data.triangles[i].map(p => p.clone().applyMatrix4(mesh.matrixWorld)));
  if (triangles.length) normal.copy(normalOf(triangles[0]));
  // A deformed logical region may now span several planes. Keep its full binding,
  // but do not present a rectangle on one patch as the dimensions of the whole wall.
  const plane = triangles.length ? new THREE.Plane().setFromNormalAndCoplanarPoint(normal, triangles[0][0]) : null;
  if (!plane || triangles.some(t => normal.dot(normalOf(t)) < 1 - 1e-7 || t.some(p => Math.abs(plane.distanceToPoint(p)) > 1e-4))) {
    return { id: annotation.id, name: annotation.name, status: "stale" as const,
      reason: "После деформации отмеченная область больше не плоская. Полная область сохранена; для размеров выберите плоскую грань заново." };
  }
  const basisU = new THREE.Vector3(Math.abs(normal.x) < 0.8 ? 1 : 0, Math.abs(normal.x) < 0.8 ? 0 : 1, 0).projectOnPlane(normal).normalize();
  const basisV = normal.clone().cross(basisU).normalize();
  const vertices = new Map<string, THREE.Vector3>();
  const boundary = new Map<string, { count: number; length: number }>();
  let areaMm2 = 0;
  for (const t of triangles) {
    areaMm2 += t[1].clone().sub(t[0]).cross(t[2].clone().sub(t[0])).length() / 2;
    for (let j = 0; j < 3; j++) {
      vertices.set(vertexKey(t[j]), t[j]);
      const key = edgeKey(t[j], t[(j + 1) % 3]);
      const old = boundary.get(key);
      boundary.set(key, { count: (old?.count ?? 0) + 1, length: t[j].distanceTo(t[(j + 1) % 3]) });
    }
  }
  const points = [...vertices.values()].map(p => ({ x: p.dot(basisU), y: p.dot(basisV) })).sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: typeof points[number], b: typeof a, c: typeof a) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half = (items: typeof points) => { const h: typeof points = []; for (const p of items) { while (h.length > 1 && cross(h[h.length-2], h[h.length-1], p) <= 1e-10) h.pop(); h.push(p); } h.pop(); return h; };
  const hull = [...half(points), ...half([...points].reverse())];
  let best = { area: Infinity, lengthMm: 0, widthMm: 0, angle: 0 };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i+1)%hull.length];
    const angle = Math.atan2(b.y-a.y, b.x-a.x), c = Math.cos(angle), s = Math.sin(angle);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of hull) { const x = p.x*c+p.y*s, y = -p.x*s+p.y*c; minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); }
    const x = maxX-minX, y = maxY-minY;
    if (x*y < best.area - 1e-8) best = { area:x*y, lengthMm:Math.max(x,y), widthMm:Math.min(x,y), angle: angle+(y>x ? Math.PI/2 : 0) };
  }
  const lengthAxis = basisU.clone().multiplyScalar(Math.cos(best.angle)).addScaledVector(basisV, Math.sin(best.angle));
  const widthAxis = normal.clone().cross(lengthAxis);
  const perimeterMm = [...boundary.values()].filter(e => e.count===1).reduce((sum,e)=>sum+e.length,0);
  const zUp = (v: THREE.Vector3) => [v.x, -v.z, v.y];
  return { id: annotation.id, name: annotation.name, status: "valid" as const, units: "mm", coordinateSystem: "Y-up",
    point: point.toArray(), pointZUp: zUp(point), normal: normal.toArray(), normalZUp: zUp(normal),
    lengthMm: best.lengthMm, widthMm: best.widthMm, areaMm2, perimeterMm,
    lengthAxis: lengthAxis.toArray(), widthAxis: widthAxis.toArray(), triangleCount: triangles.length,
    dimensionMethod: "minimum_area_enclosing_rectangle_in_face_plane", planarToleranceLocalUnits: 0.0001,
    label: `${annotation.name} · ${best.lengthMm.toFixed(2)} × ${best.widthMm.toFixed(2)} мм · ${areaMm2.toFixed(2)} мм²` };
}
const measurementCache = new WeakMap<THREE.Mesh<THREE.BufferGeometry>, Map<string, { annotation: FaceAnnotation; geometry: THREE.BufferGeometry; matrix: string; result: ReturnType<typeof computeAnnotatedFace> }>>();
export function measureAnnotatedFace(mesh: THREE.Mesh<THREE.BufferGeometry>, annotation: FaceAnnotation) {
  mesh.updateWorldMatrix(true, false);
  const matrix = mesh.matrixWorld.elements.join(",");
  const entries = measurementCache.get(mesh) ?? new Map();
  const previous = entries.get(annotation.id);
  if (previous && previous.annotation === annotation && previous.geometry === mesh.geometry && previous.matrix === matrix) return previous.result;
  const result = computeAnnotatedFace(mesh, annotation);
  entries.set(annotation.id, { annotation, geometry: mesh.geometry, matrix, result });
  measurementCache.set(mesh, entries);
  return result;
}
export type FaceMeasurement = ReturnType<typeof measureAnnotatedFace> & { shapeId: string; shapeName: string; screen?: { x: number; y: number; visible: boolean } };
export type FaceAnnotationsSnapshot = { available: true; labelsVisible?: boolean; annotations: FaceMeasurement[] };
