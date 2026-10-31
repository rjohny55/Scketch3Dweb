import * as THREE from 'three';
import type { EndConnection } from '@/lib/endOffset';

export type RulerFaceAnchor = { faceId: string; offset: [number, number, number] };

/** Bind only to the actual face triangles, not their bounding box or a nearby plane. */
export function bindRulerFace(point: THREE.Vector3, faces: EndConnection[]): RulerFaceAnchor | undefined {
  let best: { face: EndConnection; distance: number } | undefined;
  for (const face of faces) {
    if (point.toArray().some((v, i) => v < face.localBounds.min[i] - .02 || v > face.localBounds.max[i] + .02)) continue;
    for (let i = 0; i + 2 < face.localPoints.length; i += 3) {
      const triangle = new THREE.Triangle(...face.localPoints.slice(i, i + 3).map(p => new THREE.Vector3(...p)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      const distance = triangle.closestPointToPoint(point, new THREE.Vector3()).distanceTo(point);
      if (distance <= .02 && (!best || distance < best.distance)) best = { face, distance };
    }
  }
  return best ? { faceId: best.face.id, offset: point.clone().sub(new THREE.Vector3(...best.face.localCenter)).toArray() as [number, number, number] } : undefined;
}

/** Selected end faces stay rigid during offset; their centers include mesh recentering. */
export function resolveRulerFace(anchor: RulerFaceAnchor, faces: EndConnection[]) {
  const face = faces.find(f => f.id === anchor.faceId);
  return face ? new THREE.Vector3(...face.localCenter).add(new THREE.Vector3(...anchor.offset)) : null;
}
