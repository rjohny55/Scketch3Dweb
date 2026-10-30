import { scketch3DwebToZUp } from "@/lib/meshCoordinates";
import type { MeasurementAccuracy } from "@/types/scketch3dweb";

export type RulerWorldPoint = {
  id: string;
  position: [number, number, number];
  shapeId?: string;
  attachmentKind?: string;
};
export type RulerWorldSegment = {
  id: string;
  startId: string;
  endId: string;
  edgeShapeId?: string;
  polyline?: Array<[number, number, number]>;
};

/** Absolute inclination of the endpoint chord above the model's horizontal XZ plane. */
export function rulerInclinationDegrees(start: readonly number[], end: readonly number[]) {
  return Math.atan2(Math.abs(end[1] - start[1]), Math.hypot(end[0] - start[0], end[2] - start[2])) * 180 / Math.PI;
}

export function rulerMeasurementLabel(lengthMm: number, start: readonly number[], end: readonly number[], accuracy: MeasurementAccuracy) {
  const length = (Math.abs(lengthMm) < 0.5 * 10 ** -accuracy ? 0 : lengthMm).toFixed(accuracy);
  const angle = Number(rulerInclinationDegrees(start, end).toFixed(2));
  return `${length} (${angle}°)`;
}

/** Uses resolved world coordinates, including live object transforms and curved edge paths. */
export function rulerMeasurementsSnapshot(points: RulerWorldPoint[], segments: RulerWorldSegment[], accuracy: MeasurementAccuracy, mode: "add" | "move" | "delete" | "idle", pendingPointId: string | null, visible = true) {
  const finite = (p: readonly number[]) => p.length === 3 && p.every(Number.isFinite);
  if (points.some((p) => !finite(p.position))) throw new Error("Non-finite ruler point");
  const byId = new Map(points.map((p) => [p.id, p]));
  const unresolvedSegmentIds: string[] = [];
  const measurements = segments.flatMap((segment) => {
    const start = byId.get(segment.startId), end = byId.get(segment.endId);
    if (!start || !end) { unresolvedSegmentIds.push(segment.id); return []; }
    const path = segment.polyline && segment.polyline.length >= 2 ? segment.polyline : [start.position, end.position];
    if (path.some((p) => !finite(p))) throw new Error("Non-finite ruler edge path");
    const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
    let lengthMm = 0;
    for (let i = 1; i < path.length; i++) lengthMm += distance(path[i-1], path[i]);
    return [{
      id: segment.id, startId: start.id, endId: end.id,
      kind: segment.edgeShapeId ? "edge" as const : "point-to-point" as const,
      ...(segment.edgeShapeId ? { edgeShapeId: segment.edgeShapeId } : {}),
      lengthMm, straightDistanceMm: distance(start.position, end.position),
      inclinationDegrees: rulerInclinationDegrees(start.position, end.position),
      label: rulerMeasurementLabel(lengthMm, start.position, end.position, accuracy),
      start: start.position, end: end.position,
      delta: end.position.map((v, axis) => v-start.position[axis]),
      path, pathZUp: path.map(scketch3DwebToZUp),
    }];
  });
  return {
    available: true as const, units: "mm" as const, coordinateSystem: "Y-up" as const,
    alternateCoordinateSystem: "Z-up" as const, accuracy, mode, pendingPointId, visible,
    pointCount: points.length, segmentCount: measurements.length, unresolvedSegmentIds,
    points: points.map((p) => ({ ...p, positionZUp: scketch3DwebToZUp(p.position) })),
    segments: measurements,
  };
}

export type RulerMeasurementsSnapshot = ReturnType<typeof rulerMeasurementsSnapshot>;
