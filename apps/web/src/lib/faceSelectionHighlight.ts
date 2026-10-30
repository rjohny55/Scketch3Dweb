import * as THREE from "three";
import type { FaceAnnotation } from "@/types/scketch3dweb";

/** A separate preview mesh: never changes model materials or export geometry. */
export function createFaceSelectionHighlight(surface: THREE.Mesh<THREE.BufferGeometry>, annotation: FaceAnnotation, selected: boolean) {
  const source = surface.geometry.getAttribute("position");
  const index = surface.geometry.getIndex();
  const positions: number[] = [];
  for (const triangle of annotation.triangleIndices) for (let corner = 0; corner < 3; corner++) {
    const i = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
    positions.push(source.getX(i), source.getY(i), source.getZ(i));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.MeshBasicMaterial({
    color: selected ? 0xffb31a : 0x19c9ef, transparent: true, opacity: selected ? 0.58 : 0.38,
    side: THREE.DoubleSide, depthTest: true, depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -4, polygonOffsetUnits: -4, toneMapped: false,
  });
  const fill = new THREE.Mesh(geometry, material);
  fill.renderOrder = 960;
  const boundary = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), new THREE.LineBasicMaterial({
    color: selected ? 0xb85a00 : 0x006c9c, depthTest: true, depthWrite: false, toneMapped: false,
  }));
  boundary.renderOrder = 961;
  const group = new THREE.Group();
  group.name = selected ? "SelectedNamedFace" : "HoveredNamedFace";
  group.add(fill, boundary);
  surface.updateWorldMatrix(true, false);
  group.matrixAutoUpdate = false;
  group.matrix.copy(surface.matrixWorld);
  return group;
}
export function disposeFaceSelectionHighlight(group: THREE.Group) {
  group.removeFromParent();
  group.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    }
  });
}
