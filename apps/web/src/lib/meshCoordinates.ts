export type MeshPoint = readonly [number, number, number];

/** Maps the Z-up coordinate convention used by slicers/CAD files into Scketch3Dweb's Y-up scene. */
export function zUpToScketch3Dweb([x, y, z]: MeshPoint): [number, number, number] {
  return [x, z, -y];
}

/** Maps Scketch3Dweb's Y-up scene into the Z-up coordinate convention expected by slicers. */
export function scketch3DwebToZUp([x, y, z]: MeshPoint): [number, number, number] {
  return [x, -z, y];
}
