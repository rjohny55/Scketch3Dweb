import { describe, expect, it } from "vitest";
import { meshPrintReport } from "@/lib/meshPrintReport";
import { exportMeshesToStl } from "@/lib/stlExport";
import { importedShapeFromStl } from "@/lib/stlImport";
import { translate } from "@/lib/i18n";
import type { StlExportMesh } from "@/lib/stlExport";

const mesh: StlExportMesh = {
  vertices: [[0,0,0],[20,0,0],[0,40,0],[0,0,10]],
  faces: [[0,2,1],[0,1,3],[0,3,2],[1,2,3]],
};
describe("print diagnostics and STL coordinate contract", () => {
  it("recognizes a closed solid and reports millimeter Z-up bounds", () => {
    const r = meshPrintReport([mesh]);
    expect(r.basicChecksPass).toBe(true);
    expect(r.bounds?.size).toEqual([20,10,40]);
    expect(r.signedVolumeMm3).toBeCloseTo(20*10*40/6);
    expect(r.notChecked).toContain("self-intersections");
  });
  it("detects open, duplicated, inverted and degenerate geometry", () => {
    expect(meshPrintReport([{ ...mesh, faces: mesh.faces.slice(1) }]).boundaryEdges).toBe(3);
    expect(meshPrintReport([{ ...mesh, faces: [...mesh.faces, mesh.faces[0]] }]).nonManifoldEdges).toBe(3);
    expect(meshPrintReport([{ ...mesh, faces: mesh.faces.map(([a,b,c]) => [a,c,b]) }]).basicChecksPass).toBe(false);
    expect(meshPrintReport([{ ...mesh, faces: [[0,0,0]] }]).degenerateTriangles).toBe(1);
  });
  it("preserves a tall STL without the legacy auto-orientation heuristic", () => {
    const shape = importedShapeFromStl("tall.stl", exportMeshesToStl([mesh]), "z-up");
    expect([shape.width,shape.depth,shape.height]).toEqual([20,10,40]);
  });
});
describe("Russian UI dictionary", () => {
  it("translates controls and dynamic statuses while preserving English and unknown user content", () => {
    expect(translate("Export", "ru")).toBe("Экспорт");
    expect(translate(" Width", "ru")).toBe(" Ширина");
    expect(translate("Settings", "en")).toBe("Settings");
    expect(translate("0&deg;", "en")).toBe("0°");
    expect(translate("My_custom_model_01", "ru")).toBe("My_custom_model_01");
    expect(translate("5 min ago", "ru")).toBe("5 мин. назад");
  });
});
