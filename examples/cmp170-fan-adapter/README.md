# NVIDIA CMP 170 — 120 mm fan flange adapter

Flange adapter connecting a **120 × 120 mm fan** to an **NVIDIA CMP 170 graphics card**. This is the fitted model previously edited in Scketch3Dweb, not a newly generated approximation.

![Fitted CMP 170 fan adapter in Scketch3Dweb](editor-preview.png)

## Files

- [Editable project — SKF](cmp170-120mm-fan-adapter.skf): the mesh, two named flange faces, and a ruler measurement. Open it in Scketch3Dweb 1.0.11 or later.
- [Triangle mesh — STL](cmp170-120mm-fan-adapter.stl): millimeters, Z-up, for inspecting and preparing in a slicer.
- [Manifest](manifest.json): geometry details, file checksums, and original input checksums.
- [Model preview](preview.png) and [editor screenshot](editor-preview.png): actual renders from the built-in project.

The application includes this model on its Home screen. **Open fan adapter demo** creates an editable copy; edits never overwrite the bundled original. SKF and STL can also be downloaded directly from that card.

## Fitted dimensions

| Item | Value |
| --- | --- |
| Nominal fan size | 120 × 120 mm |
| Distance between the two saved ruler points | 74.4 mm |
| Lateral difference between those points | 11 mm |
| Axial span | Approximately 73.5823 mm |
| Overall mesh bounds, Z-up | Approximately 73.5823 × 120 × 133 mm |
| Triangle count | 37,256 |

The 74.4 mm value is the **point-to-point ruler distance**, not the axial bounding-box span. The flanges are named **NVIDIA CMP 170 flange** and **120 mm fan flange**.

## Geometry and printing

The distributed STL keeps the final fitted model's triangle payload unchanged. Only its descriptive 80-byte STL header was updated. SKF metadata was normalized to the public Scketch3Dweb format, identifiers were made demo-specific, labels were translated into English, and the verified ruler points were restored. The mesh asset itself is unchanged.

Basic mesh checks cover closed boundaries, manifold edge counts, finite coordinates, winding, and nondegenerate triangles. They do not certify wall thickness, self-intersections, thermal suitability, printability, or compatibility with every CMP 170 shroud and fan. Check dimensions, mounting clearance, material, and slicer settings before printing or fitting the part. This is not an official NVIDIA accessory.

This owner-provided example is distributed under the project's **MIT OR Apache-2.0** license. NVIDIA product names identify the intended hardware and do not imply endorsement.
