type Point = [number, number, number];
export type RulerDeformationMap = { direction: Point; low: number; high: number; delta: Point; center: Point };
export type RulerDeformationStep = RulerDeformationMap & { sourceSize: Point; targetSize: Point };
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Normalized coordinates avoid drift when the part is resized between operations. */
export function deformRulerPoint(point: readonly number[], steps: readonly RulerDeformationStep[] = []): Point {
  let p = [...point] as Point;
  for (const step of steps) {
    const local = p.map((n, i) => n * step.sourceSize[i]);
    const weight = clamp((dot(local, step.direction) - step.low) / (step.high - step.low));
    p = local.map((n, i) => (n + weight * step.delta[i] - step.center[i]) / step.targetSize[i]) as Point;
  }
  return p;
}

/** Binding after an edit still resolves correctly after undo, reset and subsequent edits. */
export function undeformRulerPoint(point: readonly number[], steps: readonly RulerDeformationStep[] = []): Point {
  let p = [...point] as Point;
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i], local = p.map((n, axis) => n * step.targetSize[axis] + step.center[axis]);
    const projected = dot(local, step.direction), axialDelta = dot(step.delta, step.direction);
    const weight = clamp((projected - step.low) / (step.high - step.low + axialDelta));
    p = local.map((n, axis) => (n - weight * step.delta[axis]) / step.sourceSize[axis]) as Point;
  }
  return p;
}

/** Split edge paths at rigid-zone boundaries, just like the triangle deformation. */
export function deformRulerPolyline(points: readonly Point[], steps: readonly RulerDeformationStep[] = []): Point[] {
  let path = points.map(p => [...p] as Point);
  for (const step of steps) {
    const split: Point[] = [];
    for (let i = 0; i < path.length; i++) {
      const a = path[i]; split.push(a);
      const b = path[i + 1]; if (!b) continue;
      const da = dot(a.map((v, k) => v * step.sourceSize[k]), step.direction);
      const db = dot(b.map((v, k) => v * step.sourceSize[k]), step.direction);
      if (Math.abs(db - da) < 1e-12) continue;
      for (const t of [step.low, step.high].map(plane => (plane - da) / (db - da)).filter(t => t > 1e-9 && t < 1 - 1e-9).sort((x,y)=>x-y)) {
        split.push(a.map((v,k)=>v+t*(b[k]-v)) as Point);
      }
    }
    path = split.map(p => deformRulerPoint(p, [step]));
  }
  return path;
}

export function validateRulerDeformations(value: unknown): asserts value is RulerDeformationStep[] {
  if (!Array.isArray(value) || value.length > 1024) throw Error('Invalid ruler deformation history');
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e9;
  for (const step of value) {
    if (!step || typeof step !== 'object') throw Error('Invalid ruler deformation');
    for (const key of ['direction', 'delta', 'center', 'sourceSize', 'targetSize']) {
      if (!Array.isArray(step[key]) || step[key].length !== 3 || !step[key].every(finite)) throw Error('Invalid ruler deformation vector');
    }
    if (!finite(step.low) || !finite(step.high) || step.high - step.low < .009 ||
      Math.abs(dot(step.direction, step.direction) - 1) > 1e-6 ||
      step.high - step.low + dot(step.delta, step.direction) < .009 ||
      [...step.sourceSize, ...step.targetSize].some(n => n <= 0)) throw Error('Invalid ruler deformation bounds');
  }
}
