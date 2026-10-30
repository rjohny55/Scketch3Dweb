#!/usr/bin/env node

import { AsyncLocalStorage } from "node:async_hooks";
import { pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile, realpath } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const MCP_ROUTE = "/api/scketch3dweb-mcp";
const baseUrl = process.env.SCKETCH3DWEB_URL || DEFAULT_BASE_URL;
const accountContext = new AsyncLocalStorage();
export function withMcpAccount(account, callback) { return accountContext.run(account, callback); }
export async function authenticateMcpAccount(authorization) {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ") || authorization.length > 300) throw new Error("A valid personal MCP key is required.");
  const response = await fetch(new URL("/api/mcp-auth", baseUrl), { headers: { Authorization: authorization }, signal: AbortSignal.timeout(10000) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !/^[a-zA-Z0-9_-]{1,100}$/.test(body?.user?.id ?? "")) throw new Error("A valid personal MCP key is required.");
  return { authorization, userId: body.user.id, legacyOwner: body.user.legacyOwner === true };
}
function modelsDirectory() {
  const root = path.resolve(process.env.SCKETCH3DWEB_MODELS_DIR || "data/models"), account = accountContext.getStore();
  // Existing root files belong to the original administrator; other accounts use disjoint directories.
  return account && !account.legacyOwner ? path.join(root, ".accounts", account.userId) : root;
}


const editorTargetSchema = {
  type: "object",
  properties: {
    editorNumber: { type: "number", description: "The 5-digit Scketch3Dweb editor number from scketch3dweb_list_editors." },
    editorId: { type: "string", description: "Optional internal editor id. Prefer editorNumber for human-directed use." },
    timeoutMs: { type: "number", description: "Command timeout in milliseconds. Defaults to 15000." },
  },
};

const objectGuard={id:{type:"string"},expectedFingerprint:{type:"string",description:"Current fingerprint from read_connections/read_holes or read_scene(includeRawShapes:true). Required for mutations."},preview:{type:"boolean",description:"Compute a rendering-only preview without changing the project."}};
const modelingTool=(name,description,required,properties)=>({name,description,inputSchema:{...editorTargetSchema,required,properties:{...editorTargetSchema.properties,...properties}}});
const modelingOperations={
 scketch3dweb_estimate_plastic:"estimate_plastic",scketch3dweb_read_connections:"read_connections",scketch3dweb_offset_connection:"offset_connection",scketch3dweb_stretch_object:"stretch",scketch3dweb_rotate_on_floor:"rotate_floor",scketch3dweb_read_holes:"read_holes",scketch3dweb_edit_hole:"edit_hole",scketch3dweb_draw_object:"draw_object",scketch3dweb_paint_face:"paint_face",scketch3dweb_edit_face_label:"edit_face_label",scketch3dweb_clear_modeling_preview:"clear_preview"
};
const modelingTools=[
 modelingTool("scketch3dweb_estimate_plastic","Explicit read-only FDM material estimate in a Worker. Calculates selected visible objects by default; scope=all sums visible bodies excluding cutters. Returns cm3, grams, filament meters and materialCost = massG / 1000 * costPerKg in user-defined units (no currency), reports partial totals with excluded defective objects; allowApproximateMeshes=true explicitly includes eligible defective meshes as rough estimates, and warns about unresolved overlaps/cutters. Shell volume is approximated as min(V, area*wallThickness); no slicing or automatic supports. Does not alter geometry or start automatic recalculation.",[],{scope:{type:"string",enum:["selected","all"],default:"selected"},density:{type:"number",minimum:0.01,maximum:30,default:1.24},diameter:{type:"number",minimum:0.1,maximum:10,default:1.75},infill:{type:"number",minimum:0,maximum:100,default:20},wallThickness:{type:"number",minimum:0,maximum:100,default:1.2},extraPercent:{type:"number",minimum:0,maximum:1000,default:0},costPerKg:{type:"number",minimum:0,maximum:1e12,default:0},allowApproximateMeshes:{type:"boolean",default:false}}),
 modelingTool("scketch3dweb_read_connections","Read named planar faces and candidate connectionFrames with U/V basis vectors and separating slabs: true geometry centers, normals, local bounds, axial ends and guarded fingerprint. Does not modify the editor.",["id"],{id:{type:"string"}}),
 modelingTool("scketch3dweb_offset_connection","Keep one named planar face fixed and translate a second separated face in the transverse plane of their separating slab, shearing the full transition and inner channel. Protected end regions remain rigid. Offsets are added to the CURRENT pose. By default offsetU/offsetV are mm along local U/V vectors from read_connections.connectionFrames. With coordinateSystem=floor, offsetU is world vertical Y and offsetV is horizontal across the fixed flange along the floor; read floorFrames for its world vector. Inclined and non-extreme faces are supported; adjacent/shared faces are rejected. mode=center aligns geometric flange centers. Does not automatically place the model on the floor. One undo step; preview is optional.",["id","expectedFingerprint","fixedFaceId","movingFaceId"],{...objectGuard,fixedFaceId:{type:"string"},movingFaceId:{type:"string"},mode:{type:"string",enum:["offset","center"]},coordinateSystem:{type:"string",enum:["local","floor"],default:"local"},offsetU:{type:"number"},offsetV:{type:"number"},keepFixed:{type:"number",minimum:0,default:2},keepMoving:{type:"number",minimum:0,default:2}}),
 modelingTool("scketch3dweb_stretch_object","Change axial length while preserving protected end regions; resize only the middle. Local axes, mm; one undo step.",["id","expectedFingerprint","axis","target"],{...objectGuard,axis:{type:"string",enum:["x","y","z"]},target:{type:"number",exclusiveMinimum:0},keepStart:{type:"number",minimum:0},keepEnd:{type:"number",minimum:0},anchor:{type:"string",enum:["start","center","end"]}}),
 modelingTool("scketch3dweb_rotate_on_floor","Rotate around world vertical by degrees and set the actual lowest vertex on Y=0. Optional named faceId first places that supporting face down. Preserves mesh data; one undo step.",["id","expectedFingerprint"],{...objectGuard,degrees:{type:"number"},faceId:{type:"string"}}),
 modelingTool("scketch3dweb_read_holes","Read recognized straight circular, rectangular and polygonal through holes, editable hole ids, local coordinate frame/bounds, and current object fingerprint. Works without enabling the UI hole mode.",["id"],{id:{type:"string"}}),
 modelingTool("scketch3dweb_edit_hole","Physically add, update or fill/remove a recognized through hole. Units mm in the frame returned by read_holes: X/Z centered and Y based at zero; U/V are ascending axes perpendicular to axis. For add, holeId may be an existing template, which is preserved. For update/remove provide holeId. New holes require axis, lower/upper wall planes, centerU/V and dimensions. Polygon contains U/V point pairs. No UI selection required; guarded and undoable.",["id","expectedFingerprint","action"],{...objectGuard,action:{type:"string",enum:["add","update","remove"]},holeId:{type:"string"},kind:{type:"string",enum:["circle","rectangle","polygon"]},axis:{type:"string",enum:["x","y","z"]},lower:{type:"number"},upper:{type:"number"},centerU:{type:"number"},centerV:{type:"number"},diameter:{type:"number",minimum:.1},width:{type:"number",minimum:.1},height:{type:"number",minimum:.1},polygon:{type:"array",minItems:3,items:{type:"array",minItems:2,maxItems:2,items:{type:"number"}}}}),
 modelingTool("scketch3dweb_draw_object","Create the same floor-drawn bodies as the UI: rectangle uses two opposite corners, circle uses center and radius point, triangle uses three vertices. Point pairs are world X/Z mm; height is extrusion in Y. Normal editable objects support grouping and ungrouping.",["profile","points","height"],{profile:{type:"string",enum:["rectangle","circle","triangle"]},points:{type:"array",minItems:2,maxItems:3,items:{type:"array",minItems:2,maxItems:2,items:{type:"number"}}},height:{type:"number",minimum:.1},name:{type:"string"}}),
 modelingTool("scketch3dweb_paint_face","Set or erase the rendering color of an existing named planar face. Does not change STL geometry.",["id","expectedFingerprint","faceId"],{...objectGuard,faceId:{type:"string"},color:{type:"string",pattern:"^#[0-9a-fA-F]{6}$"},erase:{type:"boolean"}}),
 modelingTool("scketch3dweb_edit_face_label","Rename or remove an existing face label, retaining its geometric binding when renamed.",["id","expectedFingerprint","faceId"],{...objectGuard,faceId:{type:"string"},name:{type:"string"},remove:{type:"boolean"}}),
 modelingTool("scketch3dweb_clear_modeling_preview","Remove the transient modeling preview without changing geometry or history.",[],{})
];

export const tools = [
  ...modelingTools,
  { name:"scketch3dweb_replace_mesh_file", description:"Replace imported geometry in place from a prepared .mesh.json file in the models directory, including guarded source fingerprint and face labels. Suitable for meshes exceeding the HTTP tool request size limit. The editor must be updated.",inputSchema:{...editorTargetSchema,required:["id","filename"],properties:{...editorTargetSchema.properties,id:{type:"string"},filename:{type:"string"}}} },
  {
    name: "scketch3dweb_replace_mesh",
    description: "Replace an imported mesh in one undoable operation, preserving its ID and prepared face labels. Use expectedFingerprint from read_scene(includeRawShapes:true). For large meshes prefer replace_mesh_file.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["id", "expectedFingerprint", "positions", "width", "height", "depth", "x", "z", "elevation", "faceAnnotations"],
      properties: {
        ...editorTargetSchema.properties,
        id: { type: "string" }, expectedFingerprint: { type: "string" },
        positions: { type: "array", items: { type: "number" } },
        width: { type: "number" }, height: { type: "number" }, depth: { type: "number" },
        x: { type: "number" }, z: { type: "number" }, elevation: { type: "number" },
        faceAnnotations: { type: "array", items: { type: "object" } },
      },
    },
  },
  { name: "scketch3dweb_read_face_annotations", description: "Read named planar faces and their live length, width, area, perimeter, anchor and normal. Dimensions use a minimum enclosing rectangle in the face plane. Stale geometry bindings are explicitly reported. Also returns the currently selected hole and its measured diameter.", inputSchema: editorTargetSchema },
  {
    name: "scketch3dweb_read_measurements",
    description: "Read the live 3D ruler without modifying it: point coordinates (Y-up and Z-up), displayed labels, precise lengths in mm, curved edge paths, object attachments, and pending point. Requires an updated editor tab.",
    inputSchema: editorTargetSchema,
  },
  {
    name: "scketch3dweb_list_editors",
    description: "List Scketch3Dweb editor tabs that are currently open and heartbeating, including editorNumber and projectName.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "scketch3dweb_read_scene",
    description: "Read the current scene, selection, workspace units, and exact object dimensions from an open Scketch3Dweb editor.",
    inputSchema: {
      ...editorTargetSchema,
      properties: {
        ...editorTargetSchema.properties,
        includeRawShapes: { type: "boolean", description: "Include raw WorkplaneShape JSON. Can be large for imported meshes." },
      },
    },
  },
  {
    name: "scketch3dweb_list_objects",
    description: "List all current objects available in the editor with exact dimensions, position, rotation, and object ids.",
    inputSchema: editorTargetSchema,
  },
  {
    name: "scketch3dweb_select_objects",
    description: "Select objects by id in the Scketch3Dweb editor.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["ids"],
      properties: {
        ...editorTargetSchema.properties,
        ids: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "scketch3dweb_delete_objects",
    description: "Delete objects by id, or delete the current selection when ids are omitted.",
    inputSchema: {
      ...editorTargetSchema,
      properties: {
        ...editorTargetSchema.properties,
        ids: { type: "array", items: { type: "string" } },
        id: { type: "string" },
      },
    },
  },
  {
    name: "scketch3dweb_create_shape",
    description: "Create a box/cube, cylinder, simple extruded sketch, one of ten utility mesh presets, or an RP1 robot part (kind=robot). For kind=utility provide preset; dimensions default to that preset.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["kind"],
      properties: {
        ...editorTargetSchema.properties,
        kind: { type: "string", enum: ["box", "cube", "cylinder", "sketch", "utility", "robot"] },
        preset: { type: "string", enum: ["utility-rounded-plate", "utility-capsule", "utility-hex-prism", "utility-oct-prism", "utility-frustum", "utility-rect-tube", "utility-u-channel", "utility-angle", "utility-flange", "utility-countersunk-washer", "rp1-ycl-m000250", "rp1-ycl-m000270", "rp1-ycl-m000298", "rp1-ycl-m000308", "rp1-ycl-m000311", "rp1-ycl-m000313", "rp1-ycl-m000322", "rp1-ycl-m000323", "rp1-ycl-m000333", "rp1-ycl-m000335", "rp1-ycl-m000338", "rp1-ycl-m000340", "rp1-ycl-m000398", "rp1-ycl-m000402", "rp1-ycl-m000435", "rp1-ycl-m000443", "rp1-ycl-m000559", "rp1-ycl-m000661", "rp1-ycl-m000709", "rp1-ycl-m000710", "rp1-ycl-m000711-02", "rp1-ycl-m000718", "rp1-ycl-m000744", "rp1-ycl-m000745", "rp1-ycl-m000747", "rp1-ycl-m000783", "rp1-ycl-m000787", "rp1-ycl-m000790", "rp1-ycl-m000819-02", "rp1-ycl-m000820-02", "rp1-ycl-m000821-02", "rp1-ycl-m000822-02", "rp1-ycl-m000823-02", "rp1-ycl-m000824-02", "rp1-ycl-m000825-02", "rp1-ycl-m000826-02", "rp1-ycl-m000827-02", "rp1-ycl-m000828-02", "rp1-ycl-m000832", "rp1-ycl-m000833", "rp1-ycl-m000834", "rp1-ycl-m000895", "rp1-ycl-m000926", "rp1-ycl-m000928", "rp1-ycl-m000929", "rp1-ycl-m000930", "rp1-ycl-m000976", "rp1-ycl-m000977", "rp1-ycl-m000979", "rp1-ycl-m000980", "rp1-ycl-m000983"] },
        name: { type: "string" },
        color: { type: "string" },
        x: { type: "number" },
        z: { type: "number" },
        elevation: { type: "number" },
        width: { type: "number" },
        depth: { type: "number" },
        height: { type: "number" },
        size: { type: "number" },
        rotation: { type: "number" },
        rotationX: { type: "number" },
        rotationZ: { type: "number" },
        sides: { type: "number" },
      },
    },
  },
  {
    name: "scketch3dweb_import_mesh",
    description: "Import a triangle mesh into Scketch3Dweb from raw position and optional normal arrays.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["positions"],
      properties: {
        ...editorTargetSchema.properties,
        name: { type: "string" },
        color: { type: "string" },
        x: { type: "number" },
        z: { type: "number" },
        elevation: { type: "number" },
        width: { type: "number" },
        depth: { type: "number" },
        height: { type: "number" },
        positions: { type: "array", items: { type: "number" } },
        normals: { type: "array", items: { type: "number" } },
      },
    },
  },
  {
    name: "scketch3dweb_update_object",
    description: "Update one object's exact dimensions, position, color, name, hole state, or rotations.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["id"],
      properties: {
        ...editorTargetSchema.properties,
        id: { type: "string" },
        name: { type: "string" },
        color: { type: "string" },
        hole: { type: "boolean" },
        hidden: { type: "boolean" },
        locked: { type: "boolean" },
        x: { type: "number" },
        z: { type: "number" },
        elevation: { type: "number" },
        width: { type: "number" },
        depth: { type: "number" },
        height: { type: "number" },
        size: { type: "number" },
        rotation: { type: "number" },
        rotationX: { type: "number" },
        rotationZ: { type: "number" },
      },
    },
  },
  {
    name: "scketch3dweb_align_objects",
    description: "Align two or more Scketch3Dweb objects using the same alignment logic as the editor Alignment button.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["axis", "target"],
      properties: {
        ...editorTargetSchema.properties,
        ids: { type: "array", items: { type: "string" }, description: "Object ids to align. If omitted, uses the current selection." },
        anchorId: { type: "string", description: "Optional object id to keep fixed as the alignment reference." },
        axis: { type: "string", enum: ["x", "y", "z"], description: "x=left/right, z=front/back, y=bottom/top." },
        target: { type: "string", enum: ["min", "center", "max"], description: "Which side/center to align." },
      },
    },
  },
  {
    name: "scketch3dweb_group_objects",
    description: "Group objects by id using Scketch3Dweb's normal grouping/boolean pipeline.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["ids"],
      properties: {
        ...editorTargetSchema.properties,
        ids: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "scketch3dweb_ungroup_objects",
    description: "Ungroup one or more grouped objects by id and preserve their edited geometry.",
    inputSchema: {
      ...editorTargetSchema,
      properties: {
        ...editorTargetSchema.properties,
        ids: { type: "array", items: { type: "string" } },
        id: { type: "string" },
      },
    },
  },
  {
    name: "scketch3dweb_boolean_cut",
    description: "Cut solids with hole objects. Provide solidIds and holeIds; result replaces operands. The upstream mesh path expands cutters by 0.05 mm per side: verify final hole dimensions.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["solidIds", "holeIds"],
      properties: {
        ...editorTargetSchema.properties,
        solidIds: { type: "array", items: { type: "string" } },
        holeIds: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "scketch3dweb_separate_parts",
    description: "Separate one disconnected multi-part object into independent objects.",
    inputSchema: {
      ...editorTargetSchema,
      properties: {
        ...editorTargetSchema.properties,
        id: { type: "string" },
      },
    },
  },
  {
    name: "scketch3dweb_list_edges",
    description: "List real CAD edge ids for one object so a later chamfer/fillet can target specific edges.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["id"],
      properties: {
        ...editorTargetSchema.properties,
        id: { type: "string" },
        sharpAngle: { type: "number" },
      },
    },
  },
  {
    name: "scketch3dweb_apply_edge_treatment",
    description: "Apply chamfer or fillet to specific edge ids returned by scketch3dweb_list_edges.",
    inputSchema: {
      ...editorTargetSchema,
      required: ["id", "kind", "edgeIds", "amount"],
      properties: {
        ...editorTargetSchema.properties,
        id: { type: "string" },
        kind: { type: "string", enum: ["chamfer", "fillet"] },
        edgeIds: {
          anyOf: [
            { type: "array", items: { type: "number" } },
            { type: "string", enum: ["all"] },
          ],
        },
        allEdges: { type: "boolean" },
        amount: { type: "number" },
        chamferAngle: { type: "number" },
        sharpAngle: { type: "number" },
        quality: { type: "string", enum: ["draft", "standard", "fine"] },
        preserveEdgeSize: { type: "boolean" },
      },
    },
  },
  {
    name: "scketch3dweb_inspect_errors",
    description: "Inspect the editor notice, last MCP error, and active edge modifier error.",
    inputSchema: editorTargetSchema,
  },
  {
    name: "scketch3dweb_capture_image",
    description: "Capture a PNG image of the editor viewport, including visible ruler lines and labels by default. Use face=current to preserve the user's camera.",
    inputSchema: {
      ...editorTargetSchema,
      properties: {
        ...editorTargetSchema.properties,
        face: { type: "string", enum: ["current", "home", "top", "bottom", "front", "back", "right", "left"] },
        includeMeasurements: { type: "boolean", default: true, description: "Composite 3D ruler lines, named face labels and the selected hole contour/diameter into the PNG." },
      },
    },
  },
];

tools.push(
  { name: "scketch3dweb_import_stl_file", description: "Import an STL from the server models directory. STL uses millimeters and Z-up. Returns object id and basic mesh checks.", inputSchema: { ...editorTargetSchema, required: ["filename"], properties: { ...editorTargetSchema.properties, filename: { type: "string" }, x: { type: "number" }, z: { type: "number" }, elevation: { type: "number" } } } },
  { name: "scketch3dweb_export_stl", description: "Export solids to binary Z-up STL in the server models directory and return basic printability checks. Apply boolean cuts first. Existing files require overwrite=true.", inputSchema: { ...editorTargetSchema, properties: { ...editorTargetSchema.properties, ids: { type: "array", items: { type: "string" } }, filename: { type: "string" }, overwrite: { type: "boolean", default: false }, download: { type: "boolean", default: false } } } },
  { name: "scketch3dweb_analyze_printability", description: "Check mesh bounds, volume, boundary/non-manifold edges, winding and degenerate triangles. Does NOT check wall thickness, self-intersections, supports or printer settings.", inputSchema: { ...editorTargetSchema, properties: { ...editorTargetSchema.properties, ids: { type: "array", items: { type: "string" } } } } },
);

export async function modelFile(filename, mustExist = false) {
  if (typeof filename !== "string" || !/^[\p{L}\p{N}_. -]+\.stl$/iu.test(filename) || filename.length > 160 || filename.includes("..")) throw new Error("Use a simple .stl filename without directories");
  const directory = modelsDirectory();
  await mkdir(directory, { recursive: true });
  const root = await realpath(directory);
  const candidate = path.join(root, filename);
  try {
    const actual = await realpath(candidate);
    if (path.dirname(actual) !== root) throw new Error("Model symlink points outside the models directory");
  } catch (error) {
    if (error.code !== "ENOENT" || mustExist) throw error;
  }
  return candidate;
}

function bridgeHeaders() {
  const authorization = accountContext.getStore()?.authorization || (process.env.SCKETCH3DWEB_MCP_TOKEN ? `Bearer ${process.env.SCKETCH3DWEB_MCP_TOKEN}` : "");
  return authorization ? { Authorization: authorization } : {};
}

function bridgeUrl() {
  return new URL(MCP_ROUTE, baseUrl);
}

async function bridgeGet() {
  const response = await fetch(bridgeUrl(), { headers: bridgeHeaders(), signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Scketch3Dweb bridge returned HTTP ${response.status}`);
  }
  return payload;
}

async function bridgeCommand(action, args = {}, defaultTimeoutMs = 15000) {
  const { editorNumber, editorId, timeoutMs, ...params } = args || {};
  let targetNumber = typeof editorNumber === "number" ? editorNumber : undefined;
  let targetId = typeof editorId === "string" ? editorId : undefined;

  if (!targetNumber && !targetId) {
    const { editors = [] } = await bridgeGet();
    if (editors.length === 1) {
      targetNumber = editors[0].editorNumber;
    } else {
      throw new Error(editors.length === 0 ? "No open Scketch3Dweb editors found" : "Provide editorNumber because multiple Scketch3Dweb editors are open");
    }
  }

  const response = await fetch(bridgeUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...bridgeHeaders() },
    signal: AbortSignal.timeout((typeof timeoutMs === "number" ? timeoutMs : defaultTimeoutMs) + 5000),
    body: JSON.stringify({
      type: "command",
      editorNumber: targetNumber,
      editorId: targetId,
      action,
      params,
      timeoutMs: typeof timeoutMs === "number" ? timeoutMs : defaultTimeoutMs,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!payload?.ok) {
    throw new Error(payload?.error || `Scketch3Dweb command failed with HTTP ${response.status}`);
  }
  return payload.data;
}

export async function callTool(name, args = {}) {
  if (accountContext.getStore()) return callAccountTool(name, args);
  const account = await authenticateMcpAccount(bridgeHeaders().Authorization);
  return withMcpAccount(account, () => callAccountTool(name, args));
}

async function callAccountTool(name, args = {}) {
  if(modelingOperations[name])return bridgeCommand("modeling_command",{...args,operation:modelingOperations[name]},120000);
  switch (name) {
    case "scketch3dweb_replace_mesh_file": {
      const scene = await bridgeCommand("get_scene",args);
      if (!scene.meshReplacementAvailable) throw new Error("Refresh the editor tab to enable in-place mesh replacement.");
      if(typeof args.filename!=="string"||! /^[\p{L}\p{N}_. -]+\.mesh\.json$/iu.test(args.filename)||args.filename.includes("..")||args.filename.length>160)throw new Error("Use a simple .mesh.json filename without directories");
      const directory=await realpath(modelsDirectory());
      const file=await realpath(path.join(directory,args.filename));
      if(path.dirname(file)!==directory)throw new Error("Prepared mesh file is outside the models directory");
      const bytes=await readFile(file);if(bytes.length>24*1024*1024)throw new Error("Prepared mesh file exceeds 24 MiB");
      const payload=JSON.parse(bytes.toString("utf8"));
      return bridgeCommand("replace_mesh",{...payload,editorNumber:args.editorNumber,editorId:args.editorId,id:args.id,timeoutMs:args.timeoutMs},60000);
    }
    case "scketch3dweb_replace_mesh": {
      const scene = await bridgeCommand("get_scene", args);
      if (!scene.meshReplacementAvailable) throw new Error("Refresh the editor tab to enable in-place mesh replacement.");
      return bridgeCommand("replace_mesh", args, 60000);
    }
    case "scketch3dweb_read_face_annotations": {
      const scene = await bridgeCommand("get_scene", args);
      if (!scene.faceAnnotations) throw new Error("Refresh the editor tab to enable named face annotations and hole measurements.");
      return { ...scene.faceAnnotations, selectedHole: scene.selectedHole ?? null };
    }
    case "scketch3dweb_read_measurements": {
      const scene = await bridgeCommand("get_scene", args);
      if (!scene.measurements) throw new Error("Refresh this editor tab to enable ruler measurements in MCP. Old tabs do not expose measurements; their absence is not an empty ruler.");
      return scene.measurements;
    }
    case "scketch3dweb_import_stl_file": {
      const file = await modelFile(args.filename, true);
      const bytes = await readFile(file);
      if (bytes.length > 18 * 1024 * 1024) throw new Error("MCP STL import limit is 18 MiB");
      return bridgeCommand("import_stl", { ...args, name: args.filename, base64: bytes.toString("base64") }, 60000);
    }
    case "scketch3dweb_export_stl": {
      const filename = args.filename || `model-${Date.now()}.stl`;
      const file = await modelFile(filename);
      const { overwrite, ...commandArgs } = args;
      const result = await bridgeCommand("export_stl", { ...commandArgs, filename }, 60000);
      const { base64, ...metadata } = result;
      const bytes = Buffer.from(base64, "base64");
      if (bytes.length !== metadata.bytes) throw new Error("Incomplete STL response");
      // O_NOFOLLOW also prevents replacing a symlink after modelFile's check.
      const { open, constants } = await import("node:fs/promises");
      const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | (overwrite ? constants.O_TRUNC : constants.O_EXCL), 0o600);
      try { await handle.writeFile(bytes); } finally { await handle.close(); }
      await writeFile(`${file}.report.json`, JSON.stringify(metadata.report, null, 2), { flag: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, mode: 0o600 });
      return { ...metadata, filename, serverPath: file, reportPath: `${file}.report.json` };
    }
    case "scketch3dweb_analyze_printability":
      return bridgeCommand("analyze_printability", args, 60000);
    case "scketch3dweb_list_editors":
      return bridgeGet();
    case "scketch3dweb_read_scene":
      return bridgeCommand("get_scene", args);
    case "scketch3dweb_list_objects":
      return bridgeCommand("list_objects", args);
    case "scketch3dweb_select_objects":
      return bridgeCommand("select_objects", args);
    case "scketch3dweb_delete_objects":
      return bridgeCommand("delete_objects", args);
    case "scketch3dweb_create_shape":
      return bridgeCommand("create_shape", args);
    case "scketch3dweb_import_mesh":
      return bridgeCommand("import_mesh", args, 60000);
    case "scketch3dweb_update_object":
      return bridgeCommand("update_object", args);
    case "scketch3dweb_align_objects":
      return bridgeCommand("align_objects", args);
    case "scketch3dweb_group_objects":
      return bridgeCommand("group_objects", args, 30000);
    case "scketch3dweb_ungroup_objects":
      return bridgeCommand("ungroup_objects", args);
    case "scketch3dweb_boolean_cut":
      return bridgeCommand("boolean_cut", args, 45000);
    case "scketch3dweb_separate_parts":
      return bridgeCommand("separate_parts", args);
    case "scketch3dweb_list_edges":
      return bridgeCommand("list_edges", args, 30000);
    case "scketch3dweb_apply_edge_treatment":
      return bridgeCommand("apply_edge_treatment", args, 60000);
    case "scketch3dweb_inspect_errors":
      return bridgeCommand("inspect_errors", args);
    case "scketch3dweb_capture_image":
      return bridgeCommand("capture_image", args, 30000);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function textContent(value) {
  return {
    type: "text",
    text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
  };
}

export function toolResult(value) {
  if (value?.dataUrl?.startsWith?.("data:image/png;base64,")) {
    return {
      content: [
        textContent({ face: value.face, bytesApprox: value.bytesApprox }),
        {
          type: "image",
          data: value.dataUrl.slice("data:image/png;base64,".length),
          mimeType: "image/png",
        },
      ],
    };
  }
  return { content: [textContent(value)] };
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMessage(message) {
  if (!message || typeof message !== "object") return;
  const { id, method, params } = message;
  try {
    if (method === "initialize") {
      sendResult(id, {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "scketch3dweb-mcp", version: "0.1.0" },
      });
      return;
    }
    if (method === "notifications/initialized") {
      return;
    }
    if (method === "ping") {
      sendResult(id, {});
      return;
    }
    if (method === "tools/list") {
      sendResult(id, { tools });
      return;
    }
    if (method === "tools/call") {
      const name = params?.name;
      if (typeof name !== "string") {
        sendError(id, -32602, "Expected tool name");
        return;
      }
      const result = await callTool(name, params?.arguments || {});
      sendResult(id, toolResult(result));
      return;
    }
    if (method === "resources/list") {
      sendResult(id, { resources: [] });
      return;
    }
    sendError(id, -32601, `Unknown method: ${method}`);
  } catch (error) {
    if (method === "tools/call") {
      sendResult(id, { isError: true, content: [textContent(error instanceof Error ? error.message : String(error))] });
      return;
    }
    sendError(id, -32000, error instanceof Error ? error.message : String(error));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      void handleMessage(JSON.parse(trimmed));
    } catch (error) {
      sendError(null, -32700, error instanceof Error ? error.message : String(error));
    }
  });
});
}
