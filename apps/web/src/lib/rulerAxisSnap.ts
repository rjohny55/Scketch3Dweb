import * as THREE from "three";

/** Level the bearing toward the picked target, crossing gaps and ignoring surfaces behind the fixed endpoint. */
export function snapRulerAxisToSurface(origin: THREE.Vector3, candidate: THREE.Vector3, meshes: THREE.Mesh[], plane?: THREE.Plane) {
  const direction = new THREE.Vector3(candidate.x-origin.x,0,candidate.z-origin.z);
  if(direction.lengthSq()<1e-12)return null;
  direction.normalize();
  const bounds = new THREE.Box3();
  for (const mesh of meshes) { mesh.updateWorldMatrix(true, false); bounds.union(new THREE.Box3().setFromObject(mesh)); }
  if (bounds.isEmpty()) return null;
  const reach = origin.distanceTo(bounds.getCenter(new THREE.Vector3())) + bounds.getSize(new THREE.Vector3()).length() + 1;
  const ray = new THREE.Raycaster();ray.layers.enableAll();ray.far = reach * 2;
  const hits: THREE.Intersection[] = [];
  const tolerance = 1e-4;
  const leveled = new THREE.Vector3(candidate.x,origin.y,candidate.z);
  // If leveling stays in the target plane, test the actual patch perpendicular to it.
  // A ray along a coplanar face would otherwise jump to its outer boundary.
  if(plane && Math.abs(plane.distanceToPoint(leveled))<=tolerance) {
    for(const sign of [-1,1]) {
      ray.set(leveled.clone().addScaledVector(plane.normal,-sign*reach),plane.normal.clone().multiplyScalar(sign));
      if(ray.intersectObjects(meshes,false).some(hit=>hit.point.distanceToSquared(leveled)<=tolerance*tolerance))return leveled;
    }
  }
  // Both directions also handle one-sided meshes when the start is inside a solid.
  for (const sign of [-1, 1]) {
    ray.set(origin.clone().addScaledVector(direction, -sign * reach), direction.clone().multiplyScalar(sign));
    hits.push(...ray.intersectObjects(meshes, false));
  }
  const candidates = hits.filter(hit => (!plane || Math.abs(plane.distanceToPoint(hit.point)) <= tolerance)
    && hit.point.clone().sub(origin).dot(direction) > tolerance);
  candidates.sort((a, b) => a.point.distanceToSquared(candidate) - b.point.distanceToSquared(candidate));
  return candidates[0]?.point.clone() ?? null;
}
