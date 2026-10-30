import type { StlExportMesh } from "@/lib/stlExport";
import { scketch3DwebToZUp } from "@/lib/meshCoordinates";

/** Basic mesh checks only: no self-intersection, wall thickness, or slicer checks. */
export function meshPrintReport(meshes: readonly StlExportMesh[]) {
  const toleranceMm = 0.00001;
  const vertices = new Map<string, number>();
  const edges = new Map<string, { count: number; direction: number }>();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangleCount = 0, degenerateTriangles = 0, nonFiniteTriangles = 0, signedVolume = 0;
  for (const mesh of meshes) {
    for (const face of mesh.faces) {
      triangleCount++;
      const points = face.map((i) => scketch3DwebToZUp(mesh.vertices[i]));
      if (points.some((point) => point.some((v) => !Number.isFinite(v)))) {
        nonFiniteTriangles++;
        continue;
      }
      const ids = points.map((point) => {
        point.forEach((v, axis) => { min[axis] = Math.min(min[axis], v); max[axis] = Math.max(max[axis], v); });
        const key = point.map((v) => Math.round(v / toleranceMm)).join(",");
        if (!vertices.has(key)) vertices.set(key, vertices.size);
        return vertices.get(key)!;
      });
      const [a, b, c] = points;
      const cross = [
        (b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),
        (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),
        (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),
      ];
      if (new Set(ids).size < 3 || Math.hypot(...cross) <= toleranceMm * toleranceMm) degenerateTriangles++;
      signedVolume += (a[0]*(b[1]*c[2]-b[2]*c[1]) + a[1]*(b[2]*c[0]-b[0]*c[2]) + a[2]*(b[0]*c[1]-b[1]*c[0])) / 6;
      for (let i=0; i<3; i++) {
        const from = ids[i], to = ids[(i+1)%3];
        const key = from < to ? `${from}:${to}` : `${to}:${from}`;
        const edge = edges.get(key) ?? { count: 0, direction: 0 };
        edge.count++; edge.direction += from < to ? 1 : -1;
        edges.set(key, edge);
      }
    }
  }
  const allEdges = [...edges.values()];
  const boundaryEdges = allEdges.filter((e) => e.count === 1).length;
  const nonManifoldEdges = allEdges.filter((e) => e.count > 2).length;
  const inconsistentWindingEdges = allEdges.filter((e) => e.count === 2 && e.direction !== 0).length;
  const basicChecksPass = triangleCount > 0 && !boundaryEdges && !nonManifoldEdges && !inconsistentWindingEdges && !degenerateTriangles && !nonFiniteTriangles && signedVolume > 0;
  return {
    units: "mm", coordinateSystem: "Z-up", triangleCount, weldedVertexCount: vertices.size,
    toleranceMm, boundaryEdges, nonManifoldEdges, inconsistentWindingEdges,
    degenerateTriangles, nonFiniteTriangles,
    bounds: vertices.size ? { min, max, size: max.map((v,i) => v-min[i]) } : null,
    signedVolumeMm3: signedVolume, basicChecksPass,
    notChecked: ["self-intersections", "wall thickness", "overhangs/supports", "printer tolerances", "material", "slicer validation"],
  };
}
