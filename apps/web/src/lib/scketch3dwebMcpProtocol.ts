import type { GridSize, ShapeKind, WorkplaneWorkspaceSettings } from "@/types/scketch3dweb";
import type { RulerMeasurementsSnapshot } from "@/lib/rulerMeasurements";

export const SCKETCH3DWEB_MCP_ROUTE = "/api/scketch3dweb-mcp";
export const SCKETCH3DWEB_MCP_STALE_MS = 15_000;
export const SCKETCH3DWEB_MCP_HEARTBEAT_MS = 5_000;
export const SCKETCH3DWEB_MCP_LONG_POLL_TIMEOUT_MS = 25_000;
export const SCKETCH3DWEB_MCP_POLL_RETRY_MS = 1_000;

export type Scketch3DwebMcpViewFace = "current" | "home" | "top" | "bottom" | "front" | "back" | "right" | "left";

export type Scketch3DwebMcpShapeSummary = {
  id: string;
  name: string;
  kind: ShapeKind;
  color: string;
  hole: boolean;
  locked: boolean;
  hidden: boolean;
  position: {
    x: number;
    z: number;
    elevation: number;
  };
  dimensions: {
    width: number;
    depth: number;
    height: number;
    size: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
  };
  mirror: {
    x: boolean;
    y: boolean;
    z: boolean;
  };
  edgeTreatments: unknown[];
  groupedCount: number;
  facePaints?: Array<{ id: string; color: string; triangleCount: number }>;
  importedTriangles: number;
  cadDisplayEdgeCount: number | null;
  sketchPointCount: number;
  sketchSegmentCount: number;
  children?: Scketch3DwebMcpShapeSummary[];
};

export type Scketch3DwebMcpSceneSummary = {
  projectId: string | null;
  projectName: string;
  notice: string;
  selectedIds: string[];
  shapeCount: number;
  workspace: WorkplaneWorkspaceSettings;
  snap: GridSize | null;
  shapes: Scketch3DwebMcpShapeSummary[];
  modelingAvailable?: boolean;
  meshReplacementAvailable?: boolean;
  faceAnnotations?: import("@/lib/faceAnnotations").FaceAnnotationsSnapshot | { available: false; reason: string };
  holeEditor?: unknown;
  selectedHole?: unknown;
  measurements: RulerMeasurementsSnapshot | { available: false; reason: string };
};

export type Scketch3DwebMcpEditorSummary = {
  editorId: string;
  editorNumber: number;
  projectId: string | null;
  projectName: string;
  url: string;
  focused: boolean;
  shapeCount: number;
  selectedCount: number;
  notice: string;
  lastError: string | null;
  lastSeen: number;
};

export type Scketch3DwebMcpCommandName =
  | "modeling_command"
  | "get_scene"
  | "list_objects"
  | "select_objects"
  | "delete_objects"
  | "create_shape"
  | "import_mesh"
  | "import_stl"
  | "export_stl"
  | "analyze_printability"
  | "replace_mesh"
  | "update_object"
  | "align_objects"
  | "group_objects"
  | "ungroup_objects"
  | "boolean_cut"
  | "separate_parts"
  | "list_edges"
  | "apply_edge_treatment"
  | "inspect_errors"
  | "capture_image";

export type Scketch3DwebMcpCommand = {
  id: string;
  action: Scketch3DwebMcpCommandName;
  params: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
};

export type Scketch3DwebMcpCommandResult = {
  commandId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  completedAt?: number;
};

export type Scketch3DwebMcpHeartbeatPayload = {
  type: "heartbeat";
  editor: Omit<Scketch3DwebMcpEditorSummary, "lastSeen">;
};

export type Scketch3DwebMcpPollPayload = {
  type: "poll";
  editorId: string;
};

export type Scketch3DwebMcpResultPayload = {
  type: "result";
  editorId: string;
  result: Scketch3DwebMcpCommandResult;
};

export type Scketch3DwebMcpDispatchPayload = {
  type: "command";
  editorId?: string;
  editorNumber?: number;
  action: Scketch3DwebMcpCommandName;
  params?: Record<string, unknown>;
  timeoutMs?: number;
};

export type Scketch3DwebMcpApiPayload =
  | Scketch3DwebMcpHeartbeatPayload
  | Scketch3DwebMcpPollPayload
  | Scketch3DwebMcpResultPayload
  | Scketch3DwebMcpDispatchPayload;

/** Check again immediately before mutations after asynchronous geometry work. */
export function assertMcpCommandActive(command: Pick<Scketch3DwebMcpCommand, "createdAt" | "expiresAt">) {
  if (Date.now() >= (command.expiresAt ?? command.createdAt + 60_000)) {
    throw new Error("MCP command expired; no changes were applied. Read the current scene before retrying.");
  }
}
