import { describe, expect, it } from "vitest";
import { rulerInclinationDegrees, rulerMeasurementLabel, rulerMeasurementsSnapshot } from "@/lib/rulerMeasurements";

describe("MCP ruler measurements", () => {
  it("returns the 61.03 label with unrounded mm values and both coordinate systems", () => {
    const r = rulerMeasurementsSnapshot([
      { id: "a", position: [0,0,0] }, { id: "b", position: [61.034,0,0], shapeId: "mesh-1", attachmentKind: "surface" },
    ], [{ id: "ab", startId: "a", endId: "b" }], 2, "idle", null);
    expect(r.segments[0].lengthMm).toBe(61.034);
    expect(r.segments[0].label).toBe("61.03 (0°)");
    expect(r.points[1].positionZUp).toEqual([61.034,-0,0]);
    expect(r.points[1].shapeId).toBe("mesh-1");
  });
  it("measures curved edge paths rather than just the chord", () => {
    const r = rulerMeasurementsSnapshot([{ id: "a", position: [0,0,0] }, { id: "b", position: [3,4,0] }],
      [{ id: "edge", startId: "a", endId: "b", edgeShapeId: "part", polyline: [[0,0,0],[3,0,0],[3,4,0]] }], 2, "move", "b");
    expect(r.segments[0].lengthMm).toBe(7);
    expect(r.segments[0].straightDistanceMm).toBe(5);
    expect(r.segments[0].pathZUp[2]).toEqual([3,-0,4]);
    expect(r.pendingPointId).toBe("b");
  });
  it("handles an empty ruler, unfinished points, missing endpoints and zero length without inventing measurements", () => {
    const empty = rulerMeasurementsSnapshot([], [], 2, "idle", null);
    expect(empty.available).toBe(true); expect(empty.segmentCount).toBe(0);
    const p = [{ id: "a", position: [0,0,0] as [number,number,number] }];
    const r = rulerMeasurementsSnapshot(p, [{ id: "bad", startId: "a", endId: "missing" }, { id: "zero", startId: "a", endId: "a" }], 2, "add", "a", false);
    expect(r.unresolvedSegmentIds).toEqual(["bad"]); expect(r.segments[0].label).toBe("0.00 (0°)"); expect(r.visible).toBe(false);
  });
  it("uses fresh resolved positions after attached objects move and rejects invalid coordinates", () => {
    const read = (x: number) => rulerMeasurementsSnapshot([{id:"a",position:[0,0,0]},{id:"b",position:[x,0,0]}], [{id:"ab",startId:"a",endId:"b"}], 2, "idle", null);
    expect(read(10).segments[0].lengthMm).toBe(10); expect(read(20).segments[0].lengthMm).toBe(20);
    expect(() => read(Number.NaN)).toThrow("Non-finite");
  });
});

it("measures level, vertical and sloped inclinations in model space independent of endpoint direction", () => {
  expect(rulerMeasurementLabel(74, [0, 4, 0], [74, 4, 0], 2)).toBe("74.00 (0°)");
  expect(rulerInclinationDegrees([0, 0, 0], [0, 10, 0])).toBe(90);
  expect(rulerInclinationDegrees([0, 0, 0], [10, -10, 0])).toBe(45);
  expect(rulerInclinationDegrees([0, 0, 0], [0, 0, 10])).toBe(0);
  expect(rulerInclinationDegrees([0, 0, 0], [0, 0, 0])).toBe(0);
  expect(rulerMeasurementLabel(5, [0, 0, 0], [3, 4, 0], 2)).toBe("5.00 (53.13°)");
});
