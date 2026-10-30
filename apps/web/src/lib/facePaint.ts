import * as THREE from "three";
import type { FacePaint } from "@/types/scketch3dweb";
import { createFaceSelectionHighlight } from "@/lib/faceSelectionHighlight";

/** Rendering-only colored patch; the original mesh remains the sole pick/export geometry. */
export function createFacePaint(surface: THREE.Mesh<THREE.BufferGeometry>, paint: FacePaint) {
  const group=createFaceSelectionHighlight(surface,paint,false);group.name="PaintedFace";
  for(const child of [...group.children]) {
    if(child instanceof THREE.LineSegments) {group.remove(child);child.geometry.dispose();(child.material as THREE.Material).dispose();}
    else if(child instanceof THREE.Mesh) {
      (child.material as THREE.Material).dispose();child.geometry.computeVertexNormals();
      child.material=new THREE.MeshStandardMaterial({color:paint.color,roughness:.65,side:THREE.DoubleSide,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});child.renderOrder=10;
    }
  }
  return group;
}
