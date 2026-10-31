/** Durable ruler data uses world coordinates plus optional object-local attachments. */
export type RulerAttachment = {
  deformationAnchor?: [number, number, number];
  faceAnchor?: { faceId: string; offset: [number, number, number] };
  localNormal?: [number, number, number];
  shapeId: string;
  normalized: [number, number, number];
  kind?: "vertex" | "edge" | "surface";
  topologyKey?: string;
};
export type RulerPoint = { id: string; x: number; y: number; z: number; attachment?: RulerAttachment };
export type RulerEdgeAttachment = { key: string; shapeId: string; normalizedPoints: Array<[number, number, number]>; deformationPoints?: Array<[number, number, number]>; topologyKey?: string };
export type RulerSegment = { id: string; startId: string; endId: string; edge?: RulerEdgeAttachment };
export type RulerState = { points: RulerPoint[]; segments: RulerSegment[] };

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid ruler data");
  return value as Record<string, unknown>;
};
const text = (value: unknown, limit = 500): string => {
  if (typeof value !== "string" || !value || value.length > limit) throw new Error("Invalid ruler identifier");
  return value;
};
const number = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e9) throw new Error("Invalid ruler coordinate");
  return value;
};
const vector = (value: unknown): [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) throw new Error("Invalid ruler vector");
  return value.map(number) as [number, number, number];
};

/** Strict at the file boundary; old projects have no rulers and restore an empty state. */
export function restoreRulerState(value?: unknown): RulerState {
  if (value === undefined) return { points: [], segments: [] };
  const data = record(value);
  if (!Array.isArray(data.points) || !Array.isArray(data.segments) || data.points.length > 10000 || data.segments.length > 10000) throw new Error("Invalid ruler collection");
  const pointIds = new Set<string>(), segmentIds = new Set<string>();
  const points = data.points.map(raw => {
    const p = record(raw), id = text(p.id);
    if (pointIds.has(id)) throw new Error("Duplicate ruler point");
    pointIds.add(id);
    const result: RulerPoint = { id, x: number(p.x), y: number(p.y), z: number(p.z) };
    if (p.attachment !== undefined) {
      const a = record(p.attachment);
      if (a.kind !== undefined && !["vertex", "edge", "surface"].includes(String(a.kind))) throw new Error("Invalid ruler attachment");
      result.attachment = { shapeId: text(a.shapeId), normalized: vector(a.normalized),
        ...(a.deformationAnchor !== undefined ? { deformationAnchor: vector(a.deformationAnchor) } : {}),
        ...(a.faceAnchor !== undefined ? { faceAnchor: { faceId: text(record(a.faceAnchor).faceId), offset: vector(record(a.faceAnchor).offset) } } : {}),
        ...(a.localNormal !== undefined ? { localNormal: vector(a.localNormal) } : {}),
        ...(a.kind !== undefined ? { kind: a.kind as RulerAttachment["kind"] } : {}),
        ...(a.topologyKey !== undefined ? { topologyKey: text(a.topologyKey, 1_000_000) } : {}) };
    }
    return result;
  });
  let edgePoints = 0;
  const segments = data.segments.map(raw => {
    const s = record(raw), id = text(s.id), startId = text(s.startId), endId = text(s.endId);
    if (segmentIds.has(id) || startId === endId || !pointIds.has(startId) || !pointIds.has(endId)) throw new Error("Invalid ruler segment references");
    segmentIds.add(id);
    const result: RulerSegment = { id, startId, endId };
    if (s.edge !== undefined) {
      const e = record(s.edge);
      if (!Array.isArray(e.normalizedPoints) || e.normalizedPoints.length < 2 || (edgePoints += e.normalizedPoints.length) > 100000) throw new Error("Invalid ruler edge");
      result.edge = { key: text(e.key), shapeId: text(e.shapeId), normalizedPoints: e.normalizedPoints.map(vector), ...(e.topologyKey !== undefined ? { topologyKey: text(e.topologyKey, 1_000_000) } : {}) };
      if (e.deformationPoints !== undefined) {
        if (!Array.isArray(e.deformationPoints) || e.deformationPoints.length !== e.normalizedPoints.length || (edgePoints += e.deformationPoints.length) > 200000) throw Error('Invalid ruler deformation edge');
        result.edge.deformationPoints = e.deformationPoints.map(vector);
      }
    }
    return result;
  });
  // An unfinished first click and pointer hover are drawing state, not a measurement.
  const used = new Set(segments.flatMap(s => [s.startId, s.endId]));
  return { points: points.filter(p => used.has(p.id)), segments };
}
