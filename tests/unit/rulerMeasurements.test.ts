import { describe, expect, it } from "vitest";
import { rulerInclinationDegrees, rulerMeasurementLabel, rulerMeasurementsSnapshot, rulerLevel, rulerBubblePosition } from "@/lib/rulerMeasurements";

describe("MCP ruler measurements", () => {
  it("returns the 61.03 label with unrounded mm values and both coordinate systems", () => {
    const r = rulerMeasurementsSnapshot([
      { id: "a", position: [0,0,0] }, { id: "b", position: [61.034,0,0], shapeId: "mesh-1", attachmentKind: "surface" },
    ], [{ id: "ab", startId: "a", endId: "b" }], 2, "idle", null);
    expect(r.segments[0].lengthMm).toBe(61.034);
    expect(r.segments[0].label).toBe("61.03 (H Δ0°)");
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
    expect(r.unresolvedSegmentIds).toEqual(["bad"]); expect(r.segments[0].label).toBe("0.00 (H Δ0°)"); expect(r.visible).toBe(false);
  });
  it("uses fresh resolved positions after attached objects move and rejects invalid coordinates", () => {
    const read = (x: number) => rulerMeasurementsSnapshot([{id:"a",position:[0,0,0]},{id:"b",position:[x,0,0]}], [{id:"ab",startId:"a",endId:"b"}], 2, "idle", null);
    expect(read(10).segments[0].lengthMm).toBe(10); expect(read(20).segments[0].lengthMm).toBe(20);
    expect(() => read(Number.NaN)).toThrow("Non-finite");
  });
});

it("measures level, vertical and sloped inclinations in model space independent of endpoint direction", () => {
  expect(rulerMeasurementLabel(74, [0, 4, 0], [74, 4, 0], 2)).toBe("74.00 (H Δ0°)");
  expect(rulerInclinationDegrees([0, 0, 0], [0, 10, 0])).toBe(90);
  expect(rulerInclinationDegrees([0, 0, 0], [10, -10, 0])).toBe(45);
  expect(rulerInclinationDegrees([0, 0, 0], [0, 0, 10])).toBe(0);
  expect(rulerInclinationDegrees([0, 0, 0], [0, 0, 0])).toBe(0);
  expect(rulerMeasurementLabel(5, [0, 0, 0], [3, 4, 0], 2)).toBe("5.00 (V Δ36.87°)");
});

it('reads 89.98° as 0.02° away from plumb, including reversed and mirrored endpoints',()=>{
  const p=[Math.tan(.02*Math.PI/180)*100,100,0];
  for(const [a,b] of [[[0,0,0],p],[p,[0,0,0]],[[0,0,0],[-p[0],-p[1],0]]]){
    expect(rulerLevel(a,b).reference).toBe('vertical');
    expect(rulerLevel(a,b).deviationDegrees).toBeCloseTo(.02,7);
    expect(rulerMeasurementLabel(100,a,b,2)).toBe('100.00 (V Δ0.02°)');
  }
  expect(rulerLevel([0,0,0],[0,100,0])).toEqual({reference:'vertical',deviationDegrees:0});
});

it('centers the bubble on both axes, travels both ways and clips large inclinations',()=>{
  const a=[0,0,0];
  expect(rulerBubblePosition(a,[100,0,0])).toBe(0);
  expect(rulerBubblePosition(a,[0,100,0])).toBe(0);
  expect(rulerBubblePosition(a,[100,1,0])).toBeGreaterThan(0);
  expect(rulerBubblePosition(a,[100,-1,0])).toBeLessThan(0);
  expect(rulerBubblePosition(a,[1,100,0])).toBeGreaterThan(0);
  expect(rulerBubblePosition(a,[-1,100,0])).toBeLessThan(0);
  expect(rulerBubblePosition(a,[100,30,0])).toBe(1);
  expect(rulerBubblePosition(a,[100,-30,0])).toBe(-1);
});
