import { describe, expect, it } from "vitest";
import { scketch3DwebToZUp, zUpToScketch3Dweb } from "@/lib/meshCoordinates";

describe("mesh coordinate conventions", () => {
  it("maps slicer Z-up coordinates to Scketch3Dweb Y-up and back", () => {
    const slicerPoint: [number, number, number] = [12, 34, 56];
    const scketch3DwebPoint = zUpToScketch3Dweb(slicerPoint);

    expect(scketch3DwebPoint).toEqual([12, 56, -34]);
    expect(scketch3DwebToZUp(scketch3DwebPoint)).toEqual(slicerPoint);
  });
});
