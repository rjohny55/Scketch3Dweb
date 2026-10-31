# Precise flange positioning through MCP

1. Read the scene and `scketch3dweb_read_connections` for the chosen object.
2. Identify the fixed and moving named faces. If ambiguous, ask the user to select or name them; never guess IDs.
3. Inspect `floorFrames.horizontal`. Left/right refer to this world-space direction, not the current camera. Confirm the reference edge on each face: `min`, `center`, or `max`.
4. Call `scketch3dweb_set_connection_position` with `preview: true` and the current fingerprint. Distances are absolute targets, not increments.
5. Commit the same arguments with `preview: false` after checking the preview. Read the fresh fingerprint before another edit. Undo restores the operation.

For “place the moving lower/left edge 7 mm left and 2.5 mm down from the fixed lower/left edge”, when positive horizontal points right:

```json
{
  "id": "<object ID>",
  "expectedFingerprint": "<from read_connections>",
  "fixedFaceId": "<fixed face ID>",
  "movingFaceId": "<moving face ID>",
  "horizontalMm": -7,
  "verticalMm": -2.5,
  "fixedHorizontalEdge": "min",
  "movingHorizontalEdge": "min",
  "fixedVerticalEdge": "min",
  "movingVerticalEdge": "min",
  "preview": true
}
```

Both axes are required: do not silently reset an unspecified distance to zero. Read the geometry to retain an existing distance, or ask which second-axis position is intended. Protected end regions default to 2 mm and can be configured with `keepFixed` and `keepMoving`.

## Diameter changes

`scketch3dweb_read_holes` and `scketch3dweb_edit_hole` support recognized straight through-hole edits. They do **not** resize an entire flange or adapt a fan bolt pattern. Never use whole-object scaling or a hole edit as a substitute for changing a fan interface while preserving bolt diameters and plate thickness.

The planned flange-diameter operation will move bolt centers proportionally while retaining bolt-hole diameters and plate thickness. It requires circular-interface recognition and collision checks before it can be exposed as a safe MCP mutation.
