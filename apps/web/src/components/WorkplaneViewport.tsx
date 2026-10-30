"use client";
import {pickRulerLine} from "@/lib/rulerEdgePicking";
import {frameCameraBounds} from "@/lib/cameraFrame";
import {Calculator} from "lucide-react";
import {PlasticEstimatorPanel} from "@/components/workplane/PlasticEstimatorPanel";
import {estimatePlasticInWorker} from "@/lib/plasticEstimateClient";
import {DEFAULT_PLASTIC_SETTINGS,validatePlasticSettings,type PlasticSettings} from "@/lib/plasticEstimate";
import {capturePlasticGeometry} from "@/lib/plasticGeometry";
import {ModelingWorkerClient,canceledModelingJob} from "@/lib/modelingWorkerClient";
import {snapshotModelingJob,type DeformationOperation,type ModelingResult} from "@/lib/modelingWorkerProtocol";
import {restoreRulerState,type RulerState,type RulerPoint,type RulerAttachment,type RulerEdgeAttachment,type RulerSegment} from "@/lib/rulerState";

import {createPortal} from "react-dom";
import {ModelingQuickTools,type InspectorSectionRequest,type QuickModelingAction} from "@/components/workplane/ModelingQuickTools";
import {RotateCw,MoveRight,Expand,Triangle,Circle,Square,Tag,Palette,CirclePlus,SlidersHorizontal,Box,Settings2 as Gear,Split} from "lucide-react";
import { T, L } from "@/components/Localization";
import {readEndConnections,offsetConnection,connectionOffsetFrame,floorConnectionFrame,type EndConnection,type ConnectionOffsetOptions} from "@/lib/endOffset";
import { drawnPrimitive,type DrawnPrimitiveKind } from "@/lib/drawnPrimitives";
import { HoleEditorPanel } from "@/components/workplane/HoleEditorPanel";
import { SceneObjectsPanel } from "@/components/workplane/SceneObjectsPanel";
import { readHoleModel,changeMeshHole,type HoleEdit,type HoleModel } from "@/lib/meshHoleEditing";
import type { HoleKind } from "@/lib/holeProfiles";
import { getManifoldRuntime } from "@/lib/manifoldRuntime";
import { meshReplacementFingerprint } from "@/lib/replaceImportedMesh";
import { floorRotation } from "@/lib/floorRotation";
import { stretchShape, type AxialStretchOptions } from "@/lib/axialStretch";
import { RightDoubleClick } from "@/lib/rightDoubleClick";
import type { TransientHistoryAction } from "@/lib/sessionActionHistory";
import { createFacePaint } from "@/lib/facePaint";
import { createFaceSelectionHighlight, disposeFaceSelectionHighlight } from "@/lib/faceSelectionHighlight";
import { annotatePlanarFace, faceGeometryKey, measureAnnotatedFace, type FaceAnnotationsSnapshot, type FaceMeasurement } from "@/lib/faceAnnotations";
import { detectCircularHoles, measureCircularHole, type CircularHole } from "@/lib/holeMeasurements";
import type { FaceAnnotation } from "@/types/scketch3dweb";
import { armCameraPanReturn, cameraPanReturnBaseline, updateCameraPanReturn, type CameraPanReturn } from "@/lib/cameraPanReturn";
import { snapRulerAxisToSurface } from "@/lib/rulerAxisSnap";
import { rulerMeasurementLabel, rulerMeasurementsSnapshot, type RulerMeasurementsSnapshot } from "@/lib/rulerMeasurements";
import { ArrowLeftRight, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, Move, PaintBucket, Home, Minus, MousePointer2, PanelsTopLeft, Pencil, Plus, Ruler, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type DragEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction, type WheelEvent as ReactWheelEvent } from "react";
import * as THREE from "three";
import { Brush, Evaluator, HOLLOW_INTERSECTION } from "three-bvh-csg";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree, MeshBVH } from "three-mesh-bvh";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader, type Font, type FontData } from "three/examples/jsm/loaders/FontLoader.js";
import droidMonoFontJson from "three/examples/fonts/droid/droid_sans_mono_regular.typeface.json";
import droidSansBoldFontJson from "three/examples/fonts/droid/droid_sans_bold.typeface.json";
import droidSerifBoldFontJson from "three/examples/fonts/droid/droid_serif_bold.typeface.json";
import gentilisBoldFontJson from "three/examples/fonts/gentilis_bold.typeface.json";
import helvetikerBoldFontJson from "three/examples/fonts/helvetiker_bold.typeface.json";
import optimerBoldFontJson from "three/examples/fonts/optimer_bold.typeface.json";
import { AlignOverlay, MirrorOverlay, type AlignOverlayState, type MirrorOverlayState } from "@/components/workplane/ActionOverlays";
import { MoveDimensionOverlay } from "@/components/workplane/MoveDimensionOverlay";
import { ShapeInspector, SnapGridControl, type ShapeInspectorUpdateOptions } from "@/components/workplane/ShapeInspector";
import { GuidedLessonPanel } from "@/components/workplane/GuidedLessonPanel";
import { WorkspaceSettingsModal } from "@/components/workplane/WorkspaceSettingsModal";
import type { AppThemePreference, ResolvedAppTheme } from "@/lib/appTheme";
import type { ChallengeTutorialId } from "@/lib/challenges";
import { cadModifierPrimitiveForBakedShape, cadTransformFromMatrix, cadTransformToMatrix } from "@/lib/cadBakeMetadata";
import { createGearGeometry } from "@/lib/gearGeometry";
import { parseMeasurementInput } from "@/lib/measurementUnits";
import { createMoveDimensionOverlay, type MoveDimensionAxis, type MoveDimensionOverlayData } from "@/lib/moveDimensionLines";
import {
  horizontalPlacementWorkplane,
  placementWorkplaneCoordinates,
  placementWorkplaneFromSurface,
  placementWorkplaneIsBase,
  placementWorkplanePoint,
  placementWorkplaneQuaternion,
  snapPlacementWorkplaneOrigin,
  type PlacementPoint,
  type PlacementWorkplane,
} from "@/lib/placementWorkplane";
import { regularPolygonFootprintScale } from "@/lib/regularPolygonFootprint";
import { projectThumbnailDimensions } from "@/lib/projectThumbnail";
import { canBeginShapeDrag, DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE, normalizeSnapGrid, normalizeWorkspaceSettings, shapeDimensionLimit, workplaneSettingsFingerprint, workspaceHydrationSyncDecision } from "@/lib/workplaneSettings";
import { interiorWorkplaneGridCoordinates, workplaneThemePalette, WORKPLANE_LINE_ELEVATION, WORKPLANE_MAJOR_GRID_INTERVAL } from "@/lib/workplaneGrid";
import { cleanNearZero, cleanRotationDegrees, fallbackSolidColor, mirroredAxisCount, mirrorSign, preservesEdgeTreatmentSize, proportionalResizeScale, resizedImportedCoordinates, resizedImportedMeshPositions, resizedShapeSize, shapeDepth, shapeHasTaper, shapeOverallFootprintDimensions, shapeTaperDimensions, shapeTaperScaleAt, shapeWidth } from "@/lib/workplaneShapes";
import { sphereTessellation } from "@/lib/sphereTessellation";
import type { Scketch3DwebMcpViewFace } from "@/lib/scketch3dwebMcpProtocol";
import {
  TransformOverlay,
  continuousSnappedWheelRotation,
  getElevationMeasureKey,
  isPointInsideTransformBounds,
  measureKeyForHandle,
  normalizedRotationPlaneBasis,
  rotationPlaneDirectionSign,
  transformBoundsIntersectClipVolume,
  transformOverlayScreenPoint,
  ROTATION_WHEEL_SHIFT_SNAP_DEGREES,
  ROTATION_WHEEL_SNAP_DEGREES,
  snappedRotationDelta,
  snappedWheelRotation,
  type DimensionMark,
  type EditingDimension,
  type EditingRotation,
  type PinnedRotationWheelView,
  type RotationAxis,
  type RotationPlaneView,
  type RotationReadout,
  type RotationWheelView,
  type TransformHandleKind,
  type TransformOverlayState,
} from "@/components/workplane/TransformOverlay";
import type { AlignAxis, AlignHandleStatus, AlignTarget, GridSize, MeasurementAccuracy, ShapeAsset, WorkplaneShape, WorkplaneWorkspaceSettings } from "@/types/scketch3dweb";
import type { CadModifierEdge } from "@/lib/cadModifierTypes";

const WORKPLANE_WIDTH = 200;
const WORKPLANE_DEPTH = 140;
const MIN_GRID_BLOCK_SIZE = 1;
const MAX_GRID_BLOCK_SIZE = 200;
const WORKSPACE_DEFAULTS_STORAGE_PREFIX = "scketch3Dweb.workspaceDefault.";
const MOVE_DIMENSIONS_ENABLED_STORAGE_KEY = "scketch3Dweb.editor.moveDimensionsEnabled";
const DEFAULT_WORKSPACE = DEFAULT_WORKPLANE_WORKSPACE;
const CAMERA_FOV = 38;
const CAMERA_HOME = new THREE.Vector3(118, 96, 118);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
const MIN_SHAPE_SIZE = 0.01;
const CUT_PREVIEW_PADDING = 0.01;
const MIN_ELEVATION = -180;
const MAX_ELEVATION = 220;
const CAMERA_MIN_TARGET_Y = -70;
const CAMERA_MAX_TARGET_Y = 120;
const ROTATION_PROTRACTOR_OUTER_RADIUS = 94;
const RENDER_LAYER_WORKPLANE = 0;
const RENDER_LAYER_SHAPES = 1;
const RENDER_LAYER_HELPERS = 2;
const RENDER_LAYER_MODIFIERS = 3;
const RENDER_LAYER_PREVIEWS = 4;
const BVH_PICKING_TRIANGLE_THRESHOLD = 512;
const SHAPE_KINDS = new Set<ShapeAsset["kind"]>([
  "box",
  "cylinder",
  "sphere",
  "sketch",
  "scribble",
  "cone",
  "pyramid",
  "roof",
  "text",
  "roundRoof",
  "halfSphere",
  "torus",
  "tube",
  "gear",
  "ring",
  "wedge",
  "polygon",
  "icosahedron",
  "mesh",
]);
const fontLoader = new FontLoader();
const textFonts: Record<string, Font> = {
  Multilanguage: fontLoader.parse(helvetikerBoldFontJson as FontData),
  Sans: fontLoader.parse(droidSansBoldFontJson as FontData),
  Serif: fontLoader.parse(droidSerifBoldFontJson as FontData),
  Script: fontLoader.parse(gentilisBoldFontJson as FontData),
  Monospace: fontLoader.parse(droidMonoFontJson as FontData),
  Rounded: fontLoader.parse(optimerBoldFontJson as FontData),
  Stencil: fontLoader.parse(helvetikerBoldFontJson as FontData),
};
const importedGeometryCache = new WeakMap<
  NonNullable<WorkplaneShape["importedMesh"]>,
  { geometry: THREE.BufferGeometry; edges: Map<number, THREE.EdgesGeometry> }
>();
const preservedImportedGeometryCache = new WeakMap<WorkplaneShape, THREE.BufferGeometry>();
const MAX_SHARED_SHAPE_GEOMETRIES = 192;
const MAX_SHARED_SHAPE_MATERIALS = 128;
const sharedShapeGeometryCache = new Map<string, { geometry: THREE.BufferGeometry; users: number }>();
const sharedEdgesGeometryCache = new WeakMap<THREE.BufferGeometry, Map<number, THREE.EdgesGeometry>>();
const sharedShapeMaterialCache = new Map<string, { material: THREE.MeshStandardMaterial; users: number }>();
const sharedLineMaterialCache = new Map<string, THREE.LineBasicMaterial>();
const shapeResourceIds = new WeakMap<object, number>();
let nextShapeResourceId = 1;
const imageTextureLoader = new THREE.TextureLoader();
const IMPORTED_SELECTED_EDGE_TRIANGLE_LIMIT = 40000;
const NORMAL_IMPORTED_SELECTION_EDGE_ANGLE = 60;
const MODIFIER_EDGE_PICK_RADIUS_PX = 14;

function parseDroppedShapeAsset(raw: string): ShapeAsset | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") {
      return null;
    }
    const asset = value as Partial<ShapeAsset>;
    if (
      typeof asset.id !== "string" ||
      typeof asset.name !== "string" ||
      typeof asset.src !== "string" ||
      typeof asset.color !== "string" ||
      !SHAPE_KINDS.has(asset.kind as ShapeAsset["kind"]) ||
      (asset.hole !== undefined && typeof asset.hole !== "boolean")
    ) {
      return null;
    }
    return {
      id: asset.id,
      name: asset.name,
      src: asset.src,
      kind: asset.kind as ShapeAsset["kind"],
      color: asset.color,
      hole: asset.hole,
    };
  } catch {
    return null;
  }
}

type WorkplaneViewportProps = {
  onRulerAction?: (action: TransientHistoryAction) => void;
  onModelingBusyChange?: (busy:boolean)=>void;
  initialRulers?: RulerState;
  onRulersChange?: (rulers: RulerState) => void;
  autoFrameOnOpen?: boolean;
  shapes: WorkplaneShape[];
  selectedIds: string[];
  alignMode: boolean;
  alignAnchorId: string | null;
  alignHandles: AlignHandleStatus[];
  alignReferenceShapes: WorkplaneShape[];
  mirrorMode: boolean;
  mirrorReferenceShapes: WorkplaneShape[];
  placementWorkplane: PlacementWorkplane;
  workplaneMode: boolean;
  initialSnap?: GridSize;
  initialWorkspace?: WorkplaneWorkspaceSettings;
  workspaceSettingsKey?: string | null;
  showProjectNameInToolbar?: boolean;
  onShowProjectNameInToolbarChange?: (show: boolean) => void;
  onCreateShape: (shape: WorkplaneShape) => void;
  onAddShape: (shape: ShapeAsset, point?: PlacementPoint) => void;
  onAlignAnchorChange: (id: string) => void;
  onAlignPreview: (axis: AlignAxis, target: AlignTarget) => void;
  onAlignPreviewClear: () => void;
  onAlignSelection: (axis: AlignAxis, target: AlignTarget) => void;
  onMirrorPreview: (axis: AlignAxis) => void;
  onMirrorPreviewClear: () => void;
  onMirrorSelection: (axis: AlignAxis) => void;
  onSelectShape: (id: string | string[] | null, mode?: "replace" | "toggle") => void;
  onSetPlacementWorkplane: (workplane: PlacementWorkplane, source: "shape" | "base") => void;
  onToggleWorkplaneTool: () => void;
  onInteractionActiveChange?: (active: boolean) => void;
  onEditSketch?: () => void;
  canSeparateParts?: boolean;
  onSeparateParts?: () => void;
  onUpdateShape: (id: string, patch: ShapeUpdatePatch) => void;
  onWorkspaceSettingsChange?: (settings: { workspace: WorkplaneWorkspaceSettings; snap: GridSize }) => void;
  onWorkplaneModeChange: (active: boolean) => void;
  modifierActive?: boolean;
  modifierPreviewActive?: boolean;
  modifierEdges?: CadModifierEdge[];
  selectedModifierEdgeIds?: number[];
  onModifierEdgeToggle?: (id: number, singleEdge: boolean) => void;
  challengeTutorial?: ChallengeTutorialId | null;
  onChallengeTutorialFinish?: () => void;
  themePreference?: AppThemePreference;
  resolvedTheme?: ResolvedAppTheme;
  onThemePreferenceChange?: (preference: AppThemePreference) => void;
};

type WorkspaceSettings = WorkplaneWorkspaceSettings;
type ViewCubeFace = "top" | "bottom" | "front" | "back" | "right" | "left";

const VIEW_FACE_SHORTCUTS: Readonly<Record<string, ViewCubeFace>> = {
  "1": "front",
  "2": "back",
  "3": "left",
  "4": "right",
  "5": "top",
  "6": "bottom",
};

function readSavedWorkspaceDefault(key: string | null) {
  if (!key || typeof window === "undefined") {
    return null;
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${WORKSPACE_DEFAULTS_STORAGE_PREFIX}${key}`) ?? "null") as {
      workspace?: unknown;
      snap?: unknown;
    } | null;
    if (!parsed) {
      return null;
    }
    return {
      workspace: normalizeWorkspaceSettings(parsed.workspace),
      snap: normalizeSnapGrid(parsed.snap, DEFAULT_SNAP_GRID),
    };
  } catch {
    return null;
  }
}

function readMoveDimensionsEnabled() {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(MOVE_DIMENSIONS_ENABLED_STORAGE_KEY) !== "false";
}

type ShapeRenderRecord = {
  object: THREE.Group;
  shape: WorkplaneShape;
  transformSignature: string;
  materialSignature: string;
  geometrySignature: string;
  selected: boolean;
};

type ThreeState = {
  framedSceneBounds?: THREE.Box3;
  cameraPanMode: boolean;
  cameraPanReturn?: CameraPanReturn;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  controls: OrbitControls;
  workplaneLayer: THREE.Group;
  workplanePreviewLayer: THREE.Group;
  shapeLayer: THREE.Group;
  helperLayer: THREE.Group;
  transformGuideLayer: THREE.Group;
  moveDimensionLayer: THREE.Group;
  modifierLayer: THREE.Group;
  shapeRecords: Map<string, ShapeRenderRecord>;
  officialShapeLayerActive: boolean;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  dragPlane: THREE.Plane;
  animationId: number;
  needsRender: boolean;
  wasCameraMoving: boolean;
  lastOverlaySync: number;
  lastViewCubeSync: number;
  rotationHandleSides: RotationHandleSides | null;
  disposeInteractionListeners: () => void;
  resize: () => void;
};

type ViewportPerfStats = {
  fps: number;
  frameMs: number;
  maxFrameMs: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  shapeCount: number;
};

declare global {
  interface Window {
    scketch3dwebPerf?: {
      get: () => ViewportPerfStats;
    };
    scketch3dwebCaptureCanvas?: () => string;
    scketch3dwebCaptureCanvasAsync?: () => Promise<string>;
    scketch3dwebCaptureView?: (face?: Scketch3DwebMcpViewFace, includeMeasurements?: boolean) => Promise<string> | string;
    scketch3dwebReadFaceAnnotations?: () => FaceAnnotationsSnapshot;
    scketch3dwebReadSelectedHole?: () => unknown;
    scketch3dwebReadHoleEditor?: () => unknown;
    scketch3dwebModelingCommand?: (operation:string,params:Record<string,unknown>)=>Promise<unknown>;
    scketch3dwebReadRulerMeasurements?: () => RulerMeasurementsSnapshot;
  }
}

type DragState = {
  primaryId: string;
  offsetX: number;
  offsetZ: number;
  planeY: number;
  workplane: PlacementWorkplane;
  startPoint: PlacementPoint;
  pointerId: number;
  primaryStartX: number;
  primaryStartZ: number;
  items: DragItem[];
};

type MoveDimensionSession = {
  active: boolean;
  originX: number;
  originZ: number;
  planeY: number;
  deltaX: number;
  deltaZ: number;
  items: Array<Pick<DragItem, "id" | "startX" | "startZ">>;
};

type MoveDimensionOverlayState = MoveDimensionOverlayData & {
  active: boolean;
};

type MarqueeState = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  hasMoved: boolean;
};

type RulerModel = {
  points: RulerPoint[];
  segments: RulerSegment[];
  startPointId: string | null;
  hover: RulerCandidate | null;
};

type RulerOverlayState = {
  points: Array<RulerPoint & { screenX: number; screenY: number }>;
  segments: Array<RulerSegment & { x1: number; y1: number; x2: number; y2: number; screenPoints?: string; labelX: number; labelY: number; label: string }>;
  hover: { screenX: number; screenY: number; edgeScreenPoints?: string } | null;
  preview: { x1: number; y1: number; x2: number; y2: number; labelX: number; labelY: number; label: string } | null;
};

type RulerCandidate = {
  surfacePlane?: THREE.Plane;
  x: number;
  y: number;
  z: number;
  pointId?: string;
  attachment?: RulerAttachment;
  edge?: RulerEdgeAttachment;
};

type RulerPointDragState = {
  pointId: string;
  pointerId: number;
  clientX: number;
  clientY: number;
};

type RotationHandleSide = "near" | "right" | "far" | "left";
type RotationHandleSides = Record<RotationAxis, RotationHandleSide>;
type ShapeUpdatePatch = Partial<WorkplaneShape> & { bakeTransform?: boolean };
type ResizeSigns = { x: number; z: number };
type ResizeAnchorMemory = {
  shapeId: string;
  handleKey: string;
  signs: ResizeSigns;
  pressedY: "top" | "bottom" | null;
};
type TransformDragState = {
  id: string;
  ids: string[];
  kind: TransformHandleKind;
  handleKey: string;
  rotationAxis: RotationAxis;
  pointerId: number;
  startShape: WorkplaneShape;
  items: TransformDragItem[];
  selectionFrame: SelectionFrame;
  startScreenAngle: number;
  startClientX: number;
  startClientY: number;
  scalePlaneY: number;
  scalePlane?: THREE.Plane;
  scaleSigns?: ResizeSigns;
  scaleAnchorPoint?: THREE.Vector3;
  scaleStartPoint?: THREE.Vector3;
  liftAxis?: THREE.Vector3;
  liftPlane?: THREE.Plane;
  liftStartPoint?: THREE.Vector3;
  liftHandlePoint?: THREE.Vector3;
  liftStartValue?: number;
  rotationAxisVector?: THREE.Vector3;
  rotationPivot?: THREE.Vector3;
  rotationPlaneCenter?: THREE.Vector3;
  rotationPlaneView?: RotationPlaneView;
  rotationStartPointerAngle?: number;
  rotationStartVector?: THREE.Vector3;
  rotationScreenCenter?: { x: number; y: number };
  rotationScreenSign?: number;
  rotationStartQuaternion?: THREE.Quaternion;
  rotationWheelAppliedDelta?: number;
  rotationWheelAppliedPointerAngle?: number;
  rotationWheelDeltaOffset?: number;
  rotationWheelPointerOffset?: number;
  rotationWheelSnapDegrees?: number;
  wheelCenter?: RotationWheelView;
  hasMoved?: boolean;
};

type TransformDragItem = {
  id: string;
  startShape: WorkplaneShape;
  startCenter: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
};

type SelectionFrame = {
  ids: string[];
  center: THREE.Vector3;
  quaternion: THREE.Quaternion;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  zAxis: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  singleShape: WorkplaneShape | null;
};

type DragItem = {
  id: string;
  startX: number;
  startZ: number;
  startElevation: number;
  nextX: number;
  nextZ: number;
  nextElevation: number;
  startVisualY: number;
  visual: THREE.Object3D | null;
  helper: THREE.Box3Helper | null;
  helperBox: THREE.Box3 | null;
  hadPreviewSimplified: boolean;
};

function isVerticalMeasureHandleKind(kind: TransformHandleKind) {
  return kind === "height" || kind === "lift";
}

function previewShapesForDrag(shapes: WorkplaneShape[], drag: DragState | null) {
  if (!drag) {
    return shapes;
  }
  const previewById = new Map(drag.items.map((item) => [item.id, item]));
  return shapes.map((shape) => {
    const preview = previewById.get(shape.id);
    return preview ? { ...shape, x: preview.nextX, z: preview.nextZ, elevation: preview.nextElevation } : shape;
  });
}

function shouldBuildCutPreviews(transform: TransformDragState | null, drag: DragState | null) {
  return !drag && (!transform || transform.kind === "scale" || transform.kind === "height");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapStep(size: GridSize) {
  if (size === "Off") {
    return 0;
  }
  if (size === "Brick") {
    return 8;
  }
  return Number.parseFloat(size) || 1;
}

function snapValue(value: number, step: number) {
  return step > 0 ? Math.round(value / step) * step : value;
}

function snapDimension(value: number, step: number, min = MIN_SHAPE_SIZE, max = 220) {
  const snapped = step > 0 ? snapValue(value, step) : value;
  const effectiveMin = step > 0 ? Math.max(min, Math.min(step, max)) : min;
  return clamp(snapped, effectiveMin, max);
}

function snapPositionValue(value: number, step: number, min: number, max: number) {
  return clamp(step > 0 ? snapValue(value, step) : value, min, max);
}

function screenAngle(clientX: number, clientY: number, center: { x: number; y: number }) {
  return Math.atan2(clientY - center.y, clientX - center.x);
}

function rotationPlanePointerLocal(
  plane: RotationPlaneView | undefined,
  screenX: number,
  screenY: number,
) {
  if (!plane) {
    return null;
  }
  const planeX = screenX - plane.x;
  const planeY = screenY - plane.y;
  const determinant = plane.a * plane.d - plane.b * plane.c;
  if (Math.abs(determinant) < 0.000001) {
    return null;
  }
  return {
    x: (plane.d * planeX - plane.c * planeY) / determinant,
    y: (-plane.b * planeX + plane.a * planeY) / determinant,
  };
}

function rotationPlanePointerAngle(
  plane: RotationPlaneView | undefined,
  screenX: number,
  screenY: number,
  fallbackCenter: { x: number; y: number },
) {
  const local = rotationPlanePointerLocal(plane, screenX, screenY);
  return THREE.MathUtils.radToDeg(
    local
      ? Math.atan2(local.y, local.x)
      : Math.atan2(screenY - fallbackCenter.y, screenX - fallbackCenter.x),
  );
}

function unwrapRadians(value: number) {
  if (value > Math.PI) {
    return value - Math.PI * 2;
  }
  if (value < -Math.PI) {
    return value + Math.PI * 2;
  }
  return value;
}

function rotationAxisForHandle(handleKey: string): RotationAxis {
  if (handleKey.endsWith("-x") || handleKey === "rotate-left") {
    return "x";
  }
  if (handleKey.endsWith("-z") || handleKey === "rotate-right") {
    return "z";
  }
  return "y";
}

function rotationValueForAxis(shape: WorkplaneShape, axis: RotationAxis) {
  if (axis === "x") {
    return shape.rotationX ?? 0;
  }
  if (axis === "z") {
    return shape.rotationZ ?? 0;
  }
  return shape.rotation;
}

function rotationPatchForAxis(axis: RotationAxis, value: number): Partial<WorkplaneShape> {
  const normalized = cleanRotationDegrees(value);
  if (axis === "x") {
    return { rotationX: normalized };
  }
  if (axis === "z") {
    return { rotationZ: normalized };
  }
  return { rotation: normalized };
}

function quaternionForShape(shape: WorkplaneShape) {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(shape.rotationX ?? 0),
      THREE.MathUtils.degToRad(shape.rotation),
      THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
      "XYZ",
    ),
  );
}

function rotationPatchFromQuaternion(quaternion: THREE.Quaternion): Partial<WorkplaneShape> {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
  return {
    rotationX: cleanRotationDegrees(THREE.MathUtils.radToDeg(euler.x)),
    rotation: cleanRotationDegrees(THREE.MathUtils.radToDeg(euler.y)),
    rotationZ: cleanRotationDegrees(THREE.MathUtils.radToDeg(euler.z)),
  };
}

function canvasPngDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    }, "image/png");
  });
}

function thumbnailPngDataUrl(source: HTMLCanvasElement) {
  const dimensions = projectThumbnailDimensions(source.width, source.height);
  const thumbnail = document.createElement("canvas");
  thumbnail.width = dimensions.width;
  thumbnail.height = dimensions.height;
  const context = thumbnail.getContext("2d", { alpha: false });
  if (!context) return Promise.resolve("");
  context.drawImage(source, 0, 0, dimensions.width, dimensions.height);
  return canvasPngDataUrl(thumbnail);
}

function rotationScreenSign(axisVector: THREE.Vector3, camera: THREE.Camera) {
  const cameraForward = camera.getWorldDirection(new THREE.Vector3());
  return axisVector.dot(cameraForward) >= 0 ? 1 : -1;
}

function projectToScreen(point: THREE.Vector3, state: ThreeState) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.camera.updateMatrixWorld();
  const projected = point.clone().project(state.camera);
  return {
    x: ((projected.x + 1) / 2) * rect.width,
    y: ((1 - projected.y) / 2) * rect.height,
  };
}

function syncMoveDimensionOverlay(
  state: ThreeState,
  session: MoveDimensionSession | null,
  overlayRef: MutableRefObject<MoveDimensionOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<MoveDimensionOverlayState | null>>,
  accuracy: MeasurementAccuracy,
  theme: ResolvedAppTheme,
) {
  syncMoveDimensionWorldLines(state, session, theme);
  const rect = state.renderer.domElement.getBoundingClientRect();
  const projected = session
    ? createMoveDimensionOverlay({
        originX: session.originX,
        originZ: session.originZ,
        planeY: session.planeY,
        deltaX: session.deltaX,
        deltaZ: session.deltaZ,
        accuracy,
        width: rect.width,
        height: rect.height,
        project: ({ x, y, z }) => projectToScreen(new THREE.Vector3(x, y, z), state),
      })
    : null;
  const next = projected && session ? { ...projected, active: session.active } : null;
  if (JSON.stringify(overlayRef.current) === JSON.stringify(next)) {
    return;
  }
  overlayRef.current = next;
  setOverlay(next);
}

function syncMoveDimensionWorldLines(
  state: ThreeState,
  session: MoveDimensionSession | null,
  theme: ResolvedAppTheme,
) {
  const layer = state.moveDimensionLayer;
  const signature = session
    ? [session.originX, session.originZ, session.planeY, session.deltaX, session.deltaZ, theme].join(":")
    : "";
  if (layer.userData.moveDimensionSignature === signature) {
    return;
  }
  layer.userData.moveDimensionSignature = signature;
  disposeChildren(layer);
  if (!session || (Math.abs(session.deltaX) < 1e-9 && Math.abs(session.deltaZ) < 1e-9)) {
    state.needsRender = true;
    return;
  }

  const y = session.planeY;
  const origin = new THREE.Vector3(session.originX, y, session.originZ);
  const xEnd = new THREE.Vector3(session.originX + session.deltaX, y, session.originZ);
  const zEnd = new THREE.Vector3(session.originX, y, session.originZ + session.deltaZ);
  const current = new THREE.Vector3(session.originX + session.deltaX, y, session.originZ + session.deltaZ);
  const solidColor = theme !== "light" ? "#f1f8fc" : "#111a21";
  const guideColor = theme !== "light" ? "#b8c9d2" : "#65737c";
  const solidPoints: number[] = [];
  const guidePoints: number[] = [];

  const addSegment = (points: number[], start: THREE.Vector3, end: THREE.Vector3) => {
    points.push(start.x, start.y, start.z, end.x, end.y, end.z);
  };
  const addWideSegments = (points: number[], color: string, linewidth: number, opacity: number, renderOrder: number) => {
    if (points.length === 0) {
      return;
    }
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(points);
    const material = new LineMaterial({
      color,
      linewidth,
      worldUnits: false,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
      alphaToCoverage: false,
    });
    material.toneMapped = false;
    const rect = state.renderer.domElement.getBoundingClientRect();
    material.resolution.set(Math.max(1, rect.width), Math.max(1, rect.height));
    const lines = new LineSegments2(geometry, material);
    lines.renderOrder = renderOrder;
    lines.frustumCulled = false;
    setObjectRenderLayer(lines, RENDER_LAYER_HELPERS);
    layer.add(lines);
  };
  const addArrow = (endpoint: THREE.Vector3, axisX: number, axisZ: number, movement: number) => {
    const direction = new THREE.Vector3(axisX * Math.sign(movement), 0, axisZ * Math.sign(movement));
    const arrowLength = Math.min(1.1, Math.max(0.26, Math.abs(movement) * 0.5));
    const arrowWidth = arrowLength * 0.72;
    const base = endpoint.clone().addScaledVector(direction, -arrowLength);
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(arrowWidth / 2);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([
        endpoint.x, endpoint.y, endpoint.z,
        base.x + perpendicular.x, base.y, base.z + perpendicular.z,
        base.x - perpendicular.x, base.y, base.z - perpendicular.z,
      ], 3),
    );
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: solidColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    });
    arrowMaterial.toneMapped = false;
    const arrow = new THREE.Mesh(geometry, arrowMaterial);
    arrow.renderOrder = 1002;
    arrow.frustumCulled = false;
    setObjectRenderLayer(arrow, RENDER_LAYER_HELPERS);
    layer.add(arrow);
  };

  if (Math.abs(session.deltaX) >= 1e-9) {
    const overrun = Math.min(2, Math.max(0.5, Math.abs(session.deltaX) * 0.15));
    const start = origin.clone().add(new THREE.Vector3(-Math.sign(session.deltaX) * overrun, 0, 0));
    addSegment(solidPoints, start, xEnd);
    addSegment(guidePoints, xEnd, current);
    addArrow(xEnd, 1, 0, session.deltaX);
  }
  if (Math.abs(session.deltaZ) >= 1e-9) {
    const overrun = Math.min(2, Math.max(0.5, Math.abs(session.deltaZ) * 0.15));
    const start = origin.clone().add(new THREE.Vector3(0, 0, -Math.sign(session.deltaZ) * overrun));
    addSegment(solidPoints, start, zEnd);
    addSegment(guidePoints, zEnd, current);
    addArrow(zEnd, 0, 1, session.deltaZ);
  }

  addWideSegments(solidPoints, solidColor, 1.45, 1, 1001);
  addWideSegments(guidePoints, guideColor, 1.05, 0.72, 1000);
  state.needsRender = true;
}

function syncTransformGuideWorldLines(
  state: ThreeState,
  segments: Array<readonly [THREE.Vector3, THREE.Vector3]> | null,
  theme: ResolvedAppTheme,
) {
  const layer = state.transformGuideLayer;
  const signature = segments
    ? [
        theme,
        ...segments.flatMap(([start, end]) => [start.x, start.y, start.z, end.x, end.y, end.z]),
      ].join(":")
    : "";
  if (layer.userData.transformGuideSignature === signature) {
    return;
  }

  layer.userData.transformGuideSignature = signature;
  disposeChildren(layer);
  if (!segments || segments.length === 0) {
    state.needsRender = true;
    return;
  }

  const positions = segments.flatMap(([start, end]) => [start.x, start.y, start.z, end.x, end.y, end.z]);
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color: theme !== "light" ? "#cfe1ea" : "#1f272e",
    linewidth: 1.15,
    worldUnits: false,
    dashed: true,
    dashSize: 0.625,
    gapSize: 0.625,
    transparent: true,
    opacity: theme !== "light" ? 0.86 : 0.72,
    depthTest: false,
    depthWrite: false,
    alphaToCoverage: false,
  });
  material.toneMapped = false;
  const rect = state.renderer.domElement.getBoundingClientRect();
  material.resolution.set(Math.max(1, rect.width), Math.max(1, rect.height));
  const lines = new LineSegments2(geometry, material);
  lines.computeLineDistances();
  lines.renderOrder = 999;
  lines.frustumCulled = false;
  setObjectRenderLayer(lines, RENDER_LAYER_HELPERS);
  freezeStaticObjectMatrices(lines);
  layer.add(lines);
  state.needsRender = true;
}

function rulerShapeDimensions(object: THREE.Object3D) {
  const dimensions = object.userData.rulerDimensions as [number, number, number] | undefined;
  return dimensions ?? [1, 1, 1];
}

function rulerShapeTopologyKey(shape: WorkplaneShape): string {
  const positions = shape.importedMesh?.positions ?? [];
  const positionSample = positions.length > 0
    ? Array.from({ length: Math.min(12, positions.length) }, (_, index) => positions[Math.floor(index * (positions.length - 1) / Math.max(1, Math.min(12, positions.length) - 1))]?.toFixed(4) ?? "0").join(",")
    : "";
  const brep = shape.cadBrep ?? "";
  const brepSample = brep.length > 0
    ? Array.from({ length: Math.min(8, brep.length) }, (_, index) => brep.charCodeAt(Math.floor(index * (brep.length - 1) / Math.max(1, Math.min(8, brep.length) - 1)))).join(",")
    : "";
  return JSON.stringify({
    kind: shape.kind,
    radius: shape.radius,
    steps: shape.steps,
    sides: shape.sides,
    bevel: shape.bevel,
    segments: shape.segments,
    topRadius: shape.topRadius,
    baseRadius: shape.baseRadius,
    taperTopWidth: shape.taperTopWidth,
    taperTopDepth: shape.taperTopDepth,
    taperBottomWidth: shape.taperBottomWidth,
    taperBottomDepth: shape.taperBottomDepth,
    taperTopScale: shape.taperTopScale,
    taperBottomScale: shape.taperBottomScale,
    teeth: shape.teeth,
    toothSize: shape.toothSize,
    toothWidth: shape.toothWidth,
    centerHoleSize: shape.centerHoleSize,
    gearType: shape.gearType,
    helixAngle: shape.helixAngle,
    helixQuality: shape.helixQuality,
    text: shape.text,
    font: shape.font,
    mesh: [positions.length, positionSample],
    brep: [brep.length, brepSample],
    treatments: shape.edgeTreatments,
    children: shape.groupedShapes?.map((child) => [child.id, rulerShapeTopologyKey(child)]),
  });
}

function shapeResourceId(value: object | null | undefined) {
  if (!value) return 0;
  const existing = shapeResourceIds.get(value);
  if (existing) return existing;
  const next = nextShapeResourceId;
  nextShapeResourceId += 1;
  shapeResourceIds.set(value, next);
  return next;
}

function shapeTransformSignature(shape: WorkplaneShape) {
  return [
    shape.x,
    shape.z,
    shape.elevation ?? 0,
    shape.rotation,
    shape.rotationX ?? 0,
    shape.rotationZ ?? 0,
    Boolean(shape.mirrorX),
    Boolean(shape.mirrorY),
    Boolean(shape.mirrorZ),
  ].join("|");
}

function shapeMaterialSignature(shape: WorkplaneShape): string {
  return JSON.stringify({
    color: shape.color,
    hole: Boolean(shape.hole),
    imagePlate: shapeResourceId(shape.imagePlate),
    imageData: shape.imagePlate?.dataUrl ?? "",
    sourceFormat: shape.importedMesh?.sourceFormat ?? "",
    mirrored: mirroredAxisCount(shape) % 2,
    cadEdges: shapeResourceId(shape.cadDisplayEdges),
    cadEdgesVersion: shape.cadDisplayEdgesVersion ?? 0,
    cadEdgeDimensions: shape.cadDisplayEdges?.length ? [shapeWidth(shape), shapeDepth(shape), shape.height] : null,
    groupedMaterials: shape.groupedShapes?.map((child) => [child.id, child.hidden, shapeMaterialSignature(shape.hole ? { ...child, hole: true, color: "#b8c2cc" } : child)]),
  });
}

function shapeGeometrySignature(shape: WorkplaneShape): string {
  const taper = shape.kind === "gear" || !shapeHasTaper(shape)
    ? null
    : { ...shapeTaperDimensions(shape), baseWidth: shapeWidth(shape), baseDepth: shapeDepth(shape) };
  if (shape.groupedShapes?.length && !shape.importedMesh) {
    return JSON.stringify({
      kind: "group",
      width: shapeWidth(shape),
      depth: shapeDepth(shape),
      height: shape.height,
      taper,
      children: shape.groupedShapes.map((child) => [
        child.id,
        child.hidden,
        shapeWidth(child),
        shapeDepth(child),
        child.height,
        shapeTransformSignature(child),
        shapeGeometrySignature(child),
      ]),
    });
  }

  if (shape.importedMesh) {
    return JSON.stringify({
      kind: "mesh",
      mesh: shapeResourceId(shape.importedMesh),
      taper,
      preserve: preservesEdgeTreatmentSize(shape)
        ? [shapeWidth(shape), shapeDepth(shape), shape.height, shape.edgeTreatments]
        : false,
    });
  }

  if (shape.kind === "box" && !(shape.radius && shape.radius > 0)) {
    return JSON.stringify({ kind: "box", taper });
  }
  if (shape.kind === "cylinder") {
    return JSON.stringify({ kind: "cylinder", sides: shape.sides, segments: shape.segments, taper });
  }
  if (shape.kind === "sphere") {
    return JSON.stringify({ kind: "sphere", steps: shape.steps, taper });
  }
  if (shape.kind === "polygon") {
    return JSON.stringify({ kind: "polygon", taper });
  }

  return JSON.stringify({
    kind: shape.kind,
    geometryRevision: shape.kind === "pyramid" ? 2 : undefined,
    width: shapeWidth(shape),
    depth: shapeDepth(shape),
    height: shape.height,
    radius: shape.radius,
    steps: shape.steps,
    sides: shape.sides,
    bevel: shape.bevel,
    segments: shape.segments,
    topRadius: shape.topRadius,
    baseRadius: shape.baseRadius,
    taperTopWidth: shape.taperTopWidth,
    taperTopDepth: shape.taperTopDepth,
    taperBottomWidth: shape.taperBottomWidth,
    taperBottomDepth: shape.taperBottomDepth,
    taperTopScale: shape.taperTopScale,
    taperBottomScale: shape.taperBottomScale,
    teeth: shape.teeth,
    toothSize: shape.toothSize,
    toothWidth: shape.toothWidth,
    centerHoleSize: shape.centerHoleSize,
    gearType: shape.gearType,
    helixAngle: shape.helixAngle,
    helixQuality: shape.helixQuality,
    text: shape.text,
    font: shape.font,
  });
}

function rulerAttachmentWorld(state: ThreeState, attachment: RulerAttachment) {
  const object = findShapeObject(state, attachment.shapeId);
  if (!object) return null;
  const dimensions = rulerShapeDimensions(object);
  return object.localToWorld(new THREE.Vector3(
    attachment.normalized[0] * dimensions[0],
    attachment.normalized[1] * dimensions[1],
    attachment.normalized[2] * dimensions[2],
  ));
}

function rulerAttachmentFromWorld(state: ThreeState, shapeId: string, world: THREE.Vector3, kind: RulerAttachment["kind"] = "surface", worldNormal?: THREE.Vector3): RulerAttachment | null {
  const object = findShapeObject(state, shapeId);
  if (!object) return null;
  const dimensions = rulerShapeDimensions(object);
  const local = object.worldToLocal(world.clone());
  return {
    shapeId,
    kind,
    topologyKey: object.userData.rulerTopologyKey as string | undefined,
    ...(worldNormal ? { localNormal: worldNormal.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(object.matrixWorld).transpose()).normalize().toArray() as [number, number, number] } : {}),
    normalized: [
      local.x / Math.max(0.001, dimensions[0]),
      local.y / Math.max(0.001, dimensions[1]),
      local.z / Math.max(0.001, dimensions[2]),
    ],
  };
}

function rulerAttachmentPlane(state: ThreeState, attachment: RulerAttachment) {
  if (!attachment.localNormal) return undefined;
  const object = findShapeObject(state, attachment.shapeId);
  const point = rulerAttachmentWorld(state, attachment);
  if (!object || !point) return undefined;
  const normal = new THREE.Vector3(...attachment.localNormal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(object.matrixWorld)).normalize();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
}

function rulerPointWorld(state: ThreeState, point: Pick<RulerPoint, "x" | "y" | "z" | "attachment">) {
  return point.attachment ? rulerAttachmentWorld(state, point.attachment) ?? new THREE.Vector3(point.x, point.y, point.z) : new THREE.Vector3(point.x, point.y, point.z);
}

function rulerEdgeWorldPoints(state: ThreeState, edge: RulerEdgeAttachment) {
  return edge.normalizedPoints.flatMap((normalized) => {
    const world = rulerAttachmentWorld(state, { shapeId: edge.shapeId, normalized });
    return world ? [world] : [];
  });
}

function rulerPolylineLength(points: THREE.Vector3[]) {
  let length = 0;
  for (let index = 0; index + 1 < points.length; index += 1) length += points[index].distanceTo(points[index + 1]);
  return length;
}

function rulerPolylineMidpoint(points: THREE.Vector3[]) {
  if (points.length === 0) return new THREE.Vector3();
  const half = rulerPolylineLength(points) / 2;
  let traversed = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const length = points[index].distanceTo(points[index + 1]);
    if (traversed + length >= half && length > 1e-9) return points[index].clone().lerp(points[index + 1], (half - traversed) / length);
    traversed += length;
  }
  return points[points.length - 1].clone();
}

function rulerScreenPointList(points: THREE.Vector3[], state: ThreeState) {
  return points.map((point) => {
    const screen = projectToScreen(point, state);
    return `${screen.x},${screen.y}`;
  }).join(" ");
}

function rulerNormalizedLineSegments(state: ThreeState, shapeId: string) {
  const object = findShapeObject(state, shapeId);
  if (!object) return [];
  object.updateWorldMatrix(true, true);
  const dimensions = rulerShapeDimensions(object);
  const normalizedFromWorld = (world: THREE.Vector3) => {
    const local = object.worldToLocal(world.clone());
    return new THREE.Vector3(
      local.x / Math.max(0.001, dimensions[0]),
      local.y / Math.max(0.001, dimensions[1]),
      local.z / Math.max(0.001, dimensions[2]),
    );
  };
  const segments: Array<[THREE.Vector3, THREE.Vector3]> = [];
  object.traverse((child) => {
    if (!(child instanceof THREE.Line) || !child.visible) return;
    const position = child.geometry.getAttribute("position");
    if (!position || position.count < 2) return;
    const points: THREE.Vector3[] = [];
    for (let index = 0; index < position.count; index += 1) {
      points.push(normalizedFromWorld(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(child.matrixWorld)));
    }
    if ((child as THREE.LineSegments).isLineSegments) {
      for (let index = 0; index + 1 < points.length; index += 2) segments.push([points[index], points[index + 1]]);
    } else {
      for (let index = 0; index + 1 < points.length; index += 1) segments.push([points[index], points[index + 1]]);
      if ((child as THREE.LineLoop).isLineLoop && points.length > 2) segments.push([points[points.length - 1], points[0]]);
    }
  });
  return segments;
}

function rulerPointToSegmentDistance(point: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3) {
  const delta = end.clone().sub(start);
  const lengthSq = delta.lengthSq();
  const amount = lengthSq > 1e-12 ? clamp(point.clone().sub(start).dot(delta) / lengthSq, 0, 1) : 0;
  return point.distanceTo(start.clone().addScaledVector(delta, amount));
}

function rulerAttachmentMatchesTopology(state: ThreeState, attachment: RulerAttachment) {
  const object = findShapeObject(state, attachment.shapeId);
  if (!object) return false;
  const currentTopologyKey = object.userData.rulerTopologyKey as string | undefined;
  if (!attachment.topologyKey || attachment.topologyKey === currentTopologyKey || attachment.kind === "surface") return true;
  const target = new THREE.Vector3(...attachment.normalized);
  const segments = rulerNormalizedLineSegments(state, attachment.shapeId);
  if (attachment.kind === "vertex") {
    return segments.some(([start, end]) => start.distanceTo(target) <= 0.002 || end.distanceTo(target) <= 0.002);
  }
  return segments.some(([start, end]) => rulerPointToSegmentDistance(target, start, end) <= 0.002);
}

function rulerEdgeMatchesTopology(state: ThreeState, edge: RulerEdgeAttachment) {
  const object = findShapeObject(state, edge.shapeId);
  if (!object) return false;
  const currentTopologyKey = object.userData.rulerTopologyKey as string | undefined;
  if (!edge.topologyKey || edge.topologyKey === currentTopologyKey) return true;
  const segments = rulerNormalizedLineSegments(state, edge.shapeId);
  if (segments.length === 0) return false;
  const samples = edge.normalizedPoints.filter((_, index) => (
    index === 0
    || index === edge.normalizedPoints.length - 1
    || index % Math.max(1, Math.floor(edge.normalizedPoints.length / 8)) === 0
  ));
  return samples.every((point) => {
    const target = new THREE.Vector3(...point);
    return segments.some(([start, end]) => rulerPointToSegmentDistance(target, start, end) <= 0.002);
  });
}

function pickModelRulerCandidate(state: ThreeState, shapeIds: string[], clientX: number, clientY: number): RulerCandidate | null {
  const rect = state.renderer.domElement.getBoundingClientRect();
  const pointerX = clientX - rect.left;
  const pointerY = clientY - rect.top;
  state.camera.updateMatrixWorld();
  const targets = shapeIds.flatMap(id=>{
    const object=findShapeObject(state,id);if(!object)return[];
    object.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(object);if(box.isEmpty())return[];
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,near=false;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const p=new THREE.Vector3(x,y,z).project(state.camera);if(p.z< -1)near=true;
      const sx=(p.x+1)*rect.width/2,sy=(1-p.y)*rect.height/2;minX=Math.min(minX,sx);maxX=Math.max(maxX,sx);minY=Math.min(minY,sy);maxY=Math.max(maxY,sy);
    }
    return near||(pointerX>=minX-12&&pointerX<=maxX+12&&pointerY>=minY-12&&pointerY<=maxY+12)?[object]:[];
  });
  if(!targets.length)return null;
  const vertexCandidates: Array<{ distance: number; candidate: RulerCandidate }> = [];
  const edgeCandidates: Array<{ distance: number; candidate: RulerCandidate }> = [];

  targets.forEach((target) => {
    const shapeId = target.userData.shapeId as string;
    target.traverse((child) => {
      if (!(child instanceof THREE.Line) || !child.visible) return;
      const hit=pickRulerLine(child,state.camera,rect.width,rect.height,pointerX,pointerY);
      if(hit.vertex){const attachment=rulerAttachmentFromWorld(state,shapeId,hit.vertex.point,"vertex");if(attachment)vertexCandidates.push({distance:hit.vertex.distance,candidate:{x:hit.vertex.point.x,y:hit.vertex.point.y,z:hit.vertex.point.z,attachment}});}
      if(hit.edge){
        const point=hit.edge.point,attachment=rulerAttachmentFromWorld(state,shapeId,point,"edge");
        if(attachment){const dimensions=rulerShapeDimensions(target),inverse=target.matrixWorld.clone().invert().multiply(child.matrixWorld),normalizedPoints=hit.edge.path.map(p=>{const local=p.clone().applyMatrix4(inverse);return[local.x/Math.max(.001,dimensions[0]),local.y/Math.max(.001,dimensions[1]),local.z/Math.max(.001,dimensions[2])] as [number,number,number];});edgeCandidates.push({distance:hit.edge.distance,candidate:{x:point.x,y:point.y,z:point.z,attachment,edge:{key:`${shapeId}:${child.uuid}:${hit.edge.pathIndex}`,shapeId,normalizedPoints,topologyKey:target.userData.rulerTopologyKey as string|undefined}}});}
      }
    });
  });

  state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);
  state.raycaster.layers.set(RENDER_LAYER_SHAPES);
  const surfaces:THREE.Mesh[]=[];for(const target of targets)target.traverse(object=>{if(object instanceof THREE.Mesh&&object.visible&&object.userData.shapeSurface)surfaces.push(object);});
  const surfaceHit = state.raycaster.intersectObjects(surfaces, false)[0];
  const surfacePlane = surfaceHit?.face ? new THREE.Plane().setFromNormalAndCoplanarPoint(
    surfaceHit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(surfaceHit.object.matrixWorld)).normalize(), surfaceHit.point,
  ) : undefined;
  vertexCandidates.sort((a, b) => a.distance - b.distance);
  edgeCandidates.sort((a, b) => a.distance - b.distance);
  const snapped = vertexCandidates[0]?.candidate ?? edgeCandidates[0]?.candidate;
  if (snapped) {
    if (surfacePlane && surfaceHit?.object.userData.shapeId === snapped.attachment?.shapeId && Math.abs(surfacePlane.distanceToPoint(new THREE.Vector3(snapped.x,snapped.y,snapped.z))) < .01) {
      const attachment = rulerAttachmentFromWorld(state, snapped.attachment!.shapeId, new THREE.Vector3(snapped.x, snapped.y, snapped.z), snapped.attachment!.kind, surfacePlane.normal);
      return { ...snapped, attachment: attachment ?? snapped.attachment, surfacePlane };
    }
    return snapped;
  }
  if (!surfaceHit) return null;
  const shapeId = surfaceHit.object.userData.shapeId as string;
  const attachment = rulerAttachmentFromWorld(state, shapeId, surfaceHit.point, "surface", surfacePlane?.normal);
  return attachment ? { x: surfaceHit.point.x, y: surfaceHit.point.y, z: surfaceHit.point.z, attachment, surfacePlane } : null;
}

function distanceToScreenSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const amount = lengthSq > 0.0001 ? clamp(((x - ax) * dx + (y - ay) * dy) / lengthSq, 0, 1) : 0;
  return Math.hypot(x - (ax + dx * amount), y - (ay + dy * amount));
}

function projectCadPointToCanvas(point: THREE.Vector3, state: ThreeState, rect: DOMRect) {
  const projected = point.clone().project(state.camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z < -1 || projected.z > 1) {
    return null;
  }
  return {
    x: ((projected.x + 1) / 2) * rect.width,
    y: ((1 - projected.y) / 2) * rect.height,
  };
}

function pickModifierEdgeFromScreen(state: ThreeState, edges: CadModifierEdge[], clientX: number, clientY: number) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  const pointerX = clientX - rect.left;
  const pointerY = clientY - rect.top;
  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();
  let nearestId: number | null = null;
  let nearestDistance = MODIFIER_EDGE_PICK_RADIUS_PX;
  state.camera.updateMatrixWorld();
  edges.forEach((edge) => {
    for (let index = 0; index + 5 < edge.points.length; index += 3) {
      pointA.set(edge.points[index], edge.points[index + 1], edge.points[index + 2]);
      pointB.set(edge.points[index + 3], edge.points[index + 4], edge.points[index + 5]);
      const a = projectCadPointToCanvas(pointA, state, rect);
      const b = projectCadPointToCanvas(pointB, state, rect);
      if (!a || !b) continue;
      const distance = distanceToScreenSegment(pointerX, pointerY, a.x, a.y, b.x, b.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = edge.id;
      }
    }
  });
  return nearestId;
}

function syncRulerOverlay(
  state: ThreeState,
  model: RulerModel,
  overlayRef: MutableRefObject<RulerOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<RulerOverlayState | null>>,
  accuracy: MeasurementAccuracy,
) {
  const projectedPoints = new Map<string, { screenX: number; screenY: number }>();
  const points = model.points.map((point) => {
    const screen = projectToScreen(rulerPointWorld(state, point), state);
    const projected = { screenX: screen.x, screenY: screen.y };
    projectedPoints.set(point.id, projected);
    return { ...point, ...projected };
  });
  const segments = model.segments.flatMap((segment) => {
    const start = model.points.find((point) => point.id === segment.startId);
    const end = model.points.find((point) => point.id === segment.endId);
    const startScreen = projectedPoints.get(segment.startId);
    const endScreen = projectedPoints.get(segment.endId);
    if (!start || !end || !startScreen || !endScreen) {
      return [];
    }
    const startWorld = rulerPointWorld(state, start);
    const endWorld = rulerPointWorld(state, end);
    const attachedEdgePoints = segment.edge ? rulerEdgeWorldPoints(state, segment.edge) : [];
    const worldPoints = attachedEdgePoints.length >= 2 ? attachedEdgePoints : [startWorld, endWorld];
    const labelScreen = projectToScreen(rulerPolylineMidpoint(worldPoints), state);
    return [
      {
        ...segment,
        x1: startScreen.screenX,
        y1: startScreen.screenY,
        x2: endScreen.screenX,
        y2: endScreen.screenY,
        screenPoints: segment.edge && worldPoints.length >= 2 ? rulerScreenPointList(worldPoints, state) : undefined,
        labelX: labelScreen.x,
        labelY: labelScreen.y - 18,
        label: rulerMeasurementLabel(rulerPolylineLength(worldPoints), startWorld.toArray(), endWorld.toArray(), accuracy),
      },
    ];
  });
  const hoverWorld = model.hover ? rulerPointWorld(state, model.hover) : null;
  const hoverScreen = hoverWorld ? projectToScreen(hoverWorld, state) : null;
  const hoverEdgePoints = model.hover?.edge ? rulerEdgeWorldPoints(state, model.hover.edge) : [];
  const pendingStart = model.points.find((point) => point.id === model.startPointId);
  const pendingScreen = model.startPointId ? projectedPoints.get(model.startPointId) : null;
  const pendingWorld = pendingStart ? rulerPointWorld(state, pendingStart) : null;
  const previewMidpoint = pendingWorld && hoverWorld ? projectToScreen(pendingWorld.clone().lerp(hoverWorld, 0.5), state) : null;
  const next: RulerOverlayState = {
    preview: pendingWorld && pendingScreen && hoverWorld && hoverScreen && previewMidpoint ? {
      x1: pendingScreen.screenX, y1: pendingScreen.screenY,
      x2: hoverScreen.x, y2: hoverScreen.y,
      labelX: previewMidpoint.x, labelY: previewMidpoint.y - 18,
      label: rulerMeasurementLabel(pendingWorld.distanceTo(hoverWorld), pendingWorld.toArray(), hoverWorld.toArray(), accuracy),
    } : null,
    points,
    segments,
    hover: hoverScreen ? {
      screenX: hoverScreen.x,
      screenY: hoverScreen.y,
      edgeScreenPoints: hoverEdgePoints.length >= 2 ? rulerScreenPointList(hoverEdgePoints, state) : undefined,
    } : null,
  };
  const previous = overlayRef.current;
  const unchanged =
    previous &&
    JSON.stringify(previous.preview) === JSON.stringify(next.preview) &&
    previous.points.length === next.points.length &&
    previous.segments.length === next.segments.length &&
    previous.points.every((point, index) => {
      const candidate = next.points[index];
      return point.id === candidate.id && Math.abs(point.screenX - candidate.screenX) < 0.2 && Math.abs(point.screenY - candidate.screenY) < 0.2;
    }) &&
    previous.segments.every((segment, index) => {
      const candidate = next.segments[index];
      return segment.id === candidate.id
        && segment.label === candidate.label
        && segment.screenPoints === candidate.screenPoints
        && Math.abs(segment.x1 - candidate.x1) < 0.2
        && Math.abs(segment.y1 - candidate.y1) < 0.2
        && Math.abs(segment.x2 - candidate.x2) < 0.2
        && Math.abs(segment.y2 - candidate.y2) < 0.2
        && Math.abs(segment.labelX - candidate.labelX) < 0.2
        && Math.abs(segment.labelY - candidate.labelY) < 0.2;
    }) &&
    ((!previous.hover && !next.hover) ||
      (previous.hover && next.hover
        && previous.hover.edgeScreenPoints === next.hover.edgeScreenPoints
        && Math.abs(previous.hover.screenX - next.hover.screenX) < 0.2
        && Math.abs(previous.hover.screenY - next.hover.screenY) < 0.2));
  if (!unchanged) {
    overlayRef.current = next;
    setOverlay(next);
  }
}

function RulerOverlay({
  overlay,
  startPointId,
  active,
  deleteMode,
  moveMode,
  onPointPointerDown,
  onPointPointerMove,
  onPointPointerUp,
  onSegmentPointerDown,
  onWheel,
  stretchMode,
  onLabelEdit,
}: {
  stretchMode: boolean;
  onLabelEdit: (segmentId: string) => void;
  overlay: RulerOverlayState;
  startPointId: string | null;
  active: boolean;
  deleteMode: boolean;
  moveMode: boolean;
  onPointPointerDown: (event: ReactPointerEvent<SVGCircleElement>, pointId: string) => void;
  onPointPointerMove: (event: ReactPointerEvent<SVGCircleElement>, pointId: string) => void;
  onPointPointerUp: (event: ReactPointerEvent<SVGCircleElement>, pointId: string) => void;
  onSegmentPointerDown: (event: ReactPointerEvent<SVGElement>, segmentId: string) => void;
  onWheel: (event: ReactWheelEvent<Element>) => void;
}) {
  return (
    <L><div className={`ruler-overlay ${active ? "active" : ""} ${deleteMode ? "delete-mode" : ""} ${moveMode ? "move-mode" : ""} ${stretchMode ? "stretch-mode" : ""}`} aria-label="Ruler measurements" onWheel={onWheel}>
      <svg className="ruler-guides" width="100%" height="100%" aria-hidden="true">
        {overlay.segments.map((segment) => (
          <g key={segment.id} className="ruler-segment-group">
            {segment.screenPoints ? (
              <>
                <polyline className="ruler-segment" points={segment.screenPoints} fill="none" />
                <polyline className="ruler-segment-hit" points={segment.screenPoints} fill="none" onPointerDown={(event) => onSegmentPointerDown(event, segment.id)} />
              </>
            ) : (
              <>
                <line className="ruler-segment" x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} />
                <line
                  className="ruler-segment-hit"
                  x1={segment.x1}
                  y1={segment.y1}
                  x2={segment.x2}
                  y2={segment.y2}
                  onPointerDown={(event) => onSegmentPointerDown(event, segment.id)}
                />
              </>
            )}
          </g>
        ))}
        {active && overlay.preview ? (
          <line className="ruler-segment ruler-preview-segment" x1={overlay.preview.x1} y1={overlay.preview.y1} x2={overlay.preview.x2} y2={overlay.preview.y2} />
        ) : null}
        {overlay.points.map((point) => (
          <circle
            key={point.id}
            className={`ruler-point ${point.id === startPointId ? "pending" : ""}`}
            cx={point.screenX}
            cy={point.screenY}
            r="5"
            onPointerDown={(event) => onPointPointerDown(event, point.id)}
            onPointerMove={(event) => onPointPointerMove(event, point.id)}
            onPointerUp={(event) => onPointPointerUp(event, point.id)}
            onPointerCancel={(event) => onPointPointerUp(event, point.id)}
          />
        ))}
        {active && overlay.hover?.edgeScreenPoints ? <polyline className="ruler-hover-edge" points={overlay.hover.edgeScreenPoints} fill="none" /> : null}
        {active && overlay.hover ? <circle className="ruler-hover-point" cx={overlay.hover.screenX} cy={overlay.hover.screenY} r="5" /> : null}
      </svg>
      {active && overlay.preview ? (
        <span className="ruler-label ruler-preview-label" style={{ left: overlay.preview.labelX, top: overlay.preview.labelY }}>
          <T text={overlay.preview.label} />
        </span>
      ) : null}
      {overlay.segments.map((segment) => (
        <span key={`${segment.id}-label`} className="ruler-label" style={{ left: segment.labelX, top: segment.labelY }} onPointerDown={event => { event.stopPropagation(); }} onDoubleClick={event => { event.preventDefault();event.stopPropagation();onLabelEdit(segment.id); }}>
          <T text={segment.label} />
        </span>
      ))}
    </div></L>
  );
}

function shapeCenter(shape: WorkplaneShape) {
  return new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z);
}

function shapeLocalExtents(shape: WorkplaneShape) {
  const footprint = shapeOverallFootprintDimensions(shape);
  return {
    x: footprint.width / 2,
    y: shape.height / 2,
    z: footprint.depth / 2,
  };
}

type AxisProjectionBounds = {
  min: THREE.Vector3;
  max: THREE.Vector3;
};

const importedShapeProjectionBoundsCache = new WeakMap<WorkplaneShape, Map<string, AxisProjectionBounds>>();

function importedShapeProjectionBounds(
  shape: WorkplaneShape,
  xAxis: THREE.Vector3,
  yAxis: THREE.Vector3,
  zAxis: THREE.Vector3,
) {
  if (!shape.importedMesh?.positions.length) {
    return null;
  }

  const axisKey = [...xAxis.toArray(), ...yAxis.toArray(), ...zAxis.toArray()].map((value) => value.toFixed(6)).join(":");
  let shapeCache = importedShapeProjectionBoundsCache.get(shape);
  if (!shapeCache) {
    shapeCache = new Map();
    importedShapeProjectionBoundsCache.set(shape, shapeCache);
  }
  const cached = shapeCache.get(axisKey);
  if (cached) {
    return {
      min: cached.min.clone(),
      max: cached.max.clone(),
    };
  }

  const preserveSize = preservesEdgeTreatmentSize(shape);
  const positions = preserveSize ? resizedImportedMeshPositions(shape) : shape.importedMesh.positions;
  const scaleX = preserveSize ? 1 : shapeWidth(shape) / Math.max(0.001, shape.importedMesh.baseWidth);
  const scaleY = preserveSize ? 1 : shape.height / Math.max(0.001, shape.importedMesh.baseHeight);
  const scaleZ = preserveSize ? 1 : shapeDepth(shape) / Math.max(0.001, shape.importedMesh.baseDepth);
  const center = shapeCenter(shape);
  const quaternion = quaternionForShape(shape);
  const min = new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new THREE.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  const point = new THREE.Vector3();
  const tapered = shapeHasTaper(shape);
  let taperMinY = Number.POSITIVE_INFINITY;
  let taperMaxY = Number.NEGATIVE_INFINITY;
  if (tapered) {
    for (let index = 1; index < positions.length; index += 3) {
      const localY = positions[index] * scaleY;
      taperMinY = Math.min(taperMinY, localY);
      taperMaxY = Math.max(taperMaxY, localY);
    }
  }
  const taperHeight = Math.max(1e-6, taperMaxY - taperMinY);

  for (let index = 0; index + 2 < positions.length; index += 3) {
    const localY = positions[index + 1] * scaleY;
    const normalizedHeight = tapered ? (localY - taperMinY) / taperHeight : 0;
    const widthScale = tapered ? shapeTaperScaleAt(shape, normalizedHeight, "width") : 1;
    const depthScale = tapered ? shapeTaperScaleAt(shape, normalizedHeight, "depth") : 1;
    point
      .set(
        positions[index] * scaleX * widthScale,
        localY - shape.height / 2,
        positions[index + 2] * scaleZ * depthScale,
      )
      .applyQuaternion(quaternion)
      .add(center);
    const projected = new THREE.Vector3(point.dot(xAxis), point.dot(yAxis), point.dot(zAxis));
    min.min(projected);
    max.max(projected);
  }

  if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite)) {
    return null;
  }
  shapeCache.set(axisKey, { min: min.clone(), max: max.clone() });
  return { min, max };
}

function selectionFrameForShapes(
  shapes: WorkplaneShape[],
  selectedIds: string[],
  workplane?: PlacementWorkplane,
): SelectionFrame | null {
  const selected = selectedIds.map((id) => shapes.find((shape) => shape.id === id)).filter((shape): shape is WorkplaneShape => Boolean(shape && !shape.hidden));
  if (selected.length === 0) {
    return null;
  }

  const singleShape = selected.length === 1 ? selected[0] : null;
  const quaternion = workplane
    ? placementWorkplaneQuaternion(workplane)
    : singleShape ? quaternionForShape(singleShape) : new THREE.Quaternion();
  const xAxis = workplane
    ? new THREE.Vector3(workplane.xAxis.x, workplane.xAxis.y, workplane.xAxis.z).normalize()
    : new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize();
  const yAxis = workplane
    ? new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z).normalize()
    : new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize();
  const zAxis = workplane
    ? new THREE.Vector3(workplane.zAxis.x, workplane.zAxis.y, workplane.zAxis.z).normalize()
    : new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();
  const localMin = new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const localMax = new THREE.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  const origin = workplane
    ? new THREE.Vector3(workplane.origin.x, workplane.origin.y, workplane.origin.z)
    : singleShape ? shapeCenter(singleShape) : new THREE.Vector3();

  if (!workplane && !singleShape) {
    selected.forEach((shape) => origin.add(shapeCenter(shape)));
    origin.multiplyScalar(1 / selected.length);
  }

  selected.forEach((shape) => {
    const importedBounds = importedShapeProjectionBounds(shape, xAxis, yAxis, zAxis);
    if (importedBounds) {
      const originProjection = new THREE.Vector3(origin.dot(xAxis), origin.dot(yAxis), origin.dot(zAxis));
      localMin.min(importedBounds.min.sub(originProjection));
      localMax.max(importedBounds.max.sub(originProjection));
      return;
    }
    const center = shapeCenter(shape);
    const extents = shapeLocalExtents(shape);
    const shapeQuaternion = quaternionForShape(shape);
    [-1, 1].forEach((xSign) => {
      [-1, 1].forEach((ySign) => {
        [-1, 1].forEach((zSign) => {
          const point = new THREE.Vector3(xSign * extents.x, ySign * extents.y, zSign * extents.z).applyQuaternion(shapeQuaternion).add(center);
          const offset = point.sub(origin);
          const local = new THREE.Vector3(offset.dot(xAxis), offset.dot(yAxis), offset.dot(zAxis));
          localMin.min(local);
          localMax.max(local);
        });
      });
    });
  });

  const localCenter = localMin.clone().add(localMax).multiplyScalar(0.5);
  const center = origin.clone()
    .addScaledVector(xAxis, localCenter.x)
    .addScaledVector(yAxis, localCenter.y)
    .addScaledVector(zAxis, localCenter.z);
  const width = Math.max(MIN_SHAPE_SIZE, localMax.x - localMin.x);
  const height = Math.max(MIN_SHAPE_SIZE, localMax.y - localMin.y);
  const depth = Math.max(MIN_SHAPE_SIZE, localMax.z - localMin.z);

  return {
    ids: selected.map((shape) => shape.id),
    center,
    quaternion,
    xAxis,
    yAxis,
    zAxis,
    width,
    height,
    depth,
    min: new THREE.Vector3(-width / 2, -height / 2, -depth / 2),
    max: new THREE.Vector3(width / 2, height / 2, depth / 2),
    singleShape,
  };
}

function framePoint(frame: SelectionFrame, x: number, y: number, z: number) {
  return frame.center
    .clone()
    .add(frame.xAxis.clone().multiplyScalar(x))
    .add(frame.yAxis.clone().multiplyScalar(y))
    .add(frame.zAxis.clone().multiplyScalar(z));
}

function frameLocalPoint(frame: SelectionFrame, point: THREE.Vector3) {
  const offset = point.clone().sub(frame.center);
  return new THREE.Vector3(offset.dot(frame.xAxis), offset.dot(frame.yAxis), offset.dot(frame.zAxis));
}

function frameLocalDelta(frame: SelectionFrame, start: THREE.Vector3, current: THREE.Vector3) {
  const offset = current.clone().sub(start);
  return new THREE.Vector3(offset.dot(frame.xAxis), offset.dot(frame.yAxis), offset.dot(frame.zAxis));
}

function selectionFrameCorners(frame: SelectionFrame) {
  const corners: THREE.Vector3[] = [];
  [-1, 1].forEach((xSign) => {
    [-1, 1].forEach((ySign) => {
      [-1, 1].forEach((zSign) => {
        corners.push(framePoint(frame, (xSign * frame.width) / 2, (ySign * frame.height) / 2, (zSign * frame.depth) / 2));
      });
    });
  });
  return corners;
}

function moveDimensionAnchorForCamera(state: ThreeState, frame: SelectionFrame) {
  const planeY = WORKPLANE_LINE_ELEVATION + 0.04;
  const footprint = [
    framePoint(frame, frame.min.x, frame.min.y, frame.max.z),
    framePoint(frame, frame.max.x, frame.min.y, frame.max.z),
    framePoint(frame, frame.max.x, frame.min.y, frame.min.z),
    framePoint(frame, frame.min.x, frame.min.y, frame.min.z),
  ].map((corner) => {
    const groundCorner = new THREE.Vector3(corner.x, planeY, corner.z);
    return { world: groundCorner, screen: projectToScreen(groundCorner, state) };
  });

  const leftVisibleCorner = footprint.reduce((leftmost, candidate) => {
    const horizontalDifference = candidate.screen.x - leftmost.screen.x;
    if (horizontalDifference < -0.75) {
      return candidate;
    }
    if (Math.abs(horizontalDifference) <= 0.75 && candidate.screen.y > leftmost.screen.y) {
      return candidate;
    }
    return leftmost;
  });
  return leftVisibleCorner.world;
}

function selectionWorldYBounds(frame: SelectionFrame) {
  const corners = selectionFrameCorners(frame);
  const min = cleanNearZero(Math.min(...corners.map((corner) => corner.y)));
  const max = cleanNearZero(Math.max(...corners.map((corner) => corner.y)));
  return { min, max, height: Math.max(MIN_SHAPE_SIZE, max - min) };
}

function workplaneYForFrame(frame: SelectionFrame, workplane: PlacementWorkplane) {
  const origin = new THREE.Vector3(workplane.origin.x, workplane.origin.y, workplane.origin.z);
  return origin.sub(frame.center).dot(frame.yAxis);
}

function workplaneFootprintY(frame: SelectionFrame, workplane: PlacementWorkplane) {
  return clamp(workplaneYForFrame(frame, workplane), frame.min.y, frame.max.y);
}

function localResizePlaneForFrame(frame: SelectionFrame, localY = frame.min.y) {
  return new THREE.Plane().setFromNormalAndCoplanarPoint(
    frame.yAxis.clone().normalize(),
    framePoint(frame, 0, localY, 0),
  );
}

function resizeSignsForHandle(handleKey: string): ResizeSigns {
  const key = handleKey.toLowerCase();
  return {
    x: key.includes("right") ? 1 : key.includes("left") ? -1 : 0,
    z: key.includes("near") ? 1 : key.includes("far") ? -1 : 0,
  };
}

function resizeAnchorPointForFrame(frame: SelectionFrame, signs: ResizeSigns) {
  return framePoint(
    frame,
    signs.x ? (-signs.x * frame.width) / 2 : 0,
    frame.min.y,
    signs.z ? (-signs.z * frame.depth) / 2 : 0,
  );
}

function resizeCenterFromAnchor(frame: SelectionFrame, anchor: THREE.Vector3, signs: ResizeSigns, width: number, depth: number) {
  return anchor
    .clone()
    .add(frame.yAxis.clone().multiplyScalar(frame.height / 2))
    .add(frame.xAxis.clone().multiplyScalar(signs.x ? (signs.x * width) / 2 : 0))
    .add(frame.zAxis.clone().multiplyScalar(signs.z ? (signs.z * depth) / 2 : 0));
}

function resizedShapePatchFromFrame(shape: WorkplaneShape, center: THREE.Vector3, width: number, depth: number): Partial<WorkplaneShape> {
  const patch: Partial<WorkplaneShape> = {
    x: cleanNearZero(center.x, 0.0005),
    z: cleanNearZero(center.z, 0.0005),
    elevation: cleanNearZero(center.y - shape.height / 2, 0.0005),
    width,
    depth,
    size: resizedShapeSize(width, depth),
  };
  if (shape.kind === "cone") {
    patch.baseRadius = width / 2;
  }
  return patch;
}

function scaledHorizontalShapePatch(shape: WorkplaneShape, scaleX: number, scaleZ: number): Partial<WorkplaneShape> {
  const width = Math.max(MIN_SHAPE_SIZE, shapeWidth(shape) * scaleX);
  const depth = Math.max(MIN_SHAPE_SIZE, shapeDepth(shape) * scaleZ);
  const patch: Partial<WorkplaneShape> = {
    width,
    depth,
    size: resizedShapeSize(width, depth),
  };
  if (shape.kind === "cone") {
    patch.baseRadius = width / 2;
  }
  if (shapeHasTaper(shape)) {
    const taper = shapeTaperDimensions(shape);
    patch.taperTopWidth = Math.max(MIN_SHAPE_SIZE, taper.topWidth * scaleX);
    patch.taperBottomWidth = Math.max(MIN_SHAPE_SIZE, taper.bottomWidth * scaleX);
    patch.taperTopDepth = Math.max(MIN_SHAPE_SIZE, taper.topDepth * scaleZ);
    patch.taperBottomDepth = Math.max(MIN_SHAPE_SIZE, taper.bottomDepth * scaleZ);
  }
  return patch;
}

function shapeScreenBounds(state: ThreeState, shape: WorkplaneShape) {
  const frame = selectionFrameForShapes([shape], [shape.id]);
  if (!frame) {
    return null;
  }
  const points = selectionFrameCorners(frame).map((corner) => projectToScreen(corner, state));
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function boundsIntersectRect(bounds: NonNullable<ReturnType<typeof shapeScreenBounds>>, rect: { left: number; top: number; right: number; bottom: number }) {
  return bounds.maxX >= rect.left && bounds.minX <= rect.right && bounds.maxY >= rect.top && bounds.minY <= rect.bottom;
}

function rotationAxisVectorForFrame(handleKey: string, frame: SelectionFrame) {
  const axis = rotationAxisForHandle(handleKey);
  if (axis === "x") {
    return frame.xAxis.clone().normalize();
  }
  if (axis === "z") {
    return frame.zAxis.clone().normalize();
  }
  return frame.yAxis.clone().normalize();
}

function rayPointOnRotationPlane(state: ThreeState, clientX: number, clientY: number, pivot: THREE.Vector3, axis: THREE.Vector3) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(axis.clone().normalize(), pivot);
  return state.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
}

function axisDragPlaneForCamera(state: ThreeState, axis: THREE.Vector3, point: THREE.Vector3) {
  const normalizedAxis = axis.clone().normalize();
  let normal = state.camera.getWorldDirection(new THREE.Vector3()).projectOnPlane(normalizedAxis);
  if (normal.lengthSq() < 0.000001) {
    normal = new THREE.Vector3(0, 1, 0).applyQuaternion(state.camera.quaternion).projectOnPlane(normalizedAxis);
  }
  if (normal.lengthSq() < 0.000001) {
    const fallback = Math.abs(normalizedAxis.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);
    normal = fallback.projectOnPlane(normalizedAxis);
  }
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), point);
}

function signedAngleAroundAxis(start: THREE.Vector3, current: THREE.Vector3, axis: THREE.Vector3) {
  const a = start.clone().normalize();
  const b = current.clone().normalize();
  return Math.atan2(axis.clone().normalize().dot(a.clone().cross(b)), clamp(a.dot(b), -1, 1));
}

const ROTATION_HANDLE_SIDE_HYSTERESIS = 0.22;
const ROTATION_HANDLE_DOMINANCE_HYSTERESIS = 0.18;
function signedRotationSide(value: number, previous: RotationHandleSide | undefined, positiveSide: RotationHandleSide, negativeSide: RotationHandleSide) {
  if (previous === positiveSide && value > -ROTATION_HANDLE_SIDE_HYSTERESIS) {
    return previous;
  }
  if (previous === negativeSide && value < ROTATION_HANDLE_SIDE_HYSTERESIS) {
    return previous;
  }
  return value >= 0 ? positiveSide : negativeSide;
}

function rotationSideScore(side: RotationHandleSide, viewX: number, viewZ: number) {
  if (side === "right") {
    return viewX;
  }
  if (side === "left") {
    return -viewX;
  }
  if (side === "near") {
    return viewZ;
  }
  return -viewZ;
}

function dominantRotationSide(viewX: number, viewZ: number, previous: RotationHandleSide | undefined) {
  const sides: RotationHandleSide[] = ["near", "right", "far", "left"];
  const best = sides.reduce(
    (current, side) => {
      const score = rotationSideScore(side, viewX, viewZ);
      return score > current.score ? { side, score } : current;
    },
    { side: "near" as RotationHandleSide, score: Number.NEGATIVE_INFINITY },
  );

  if (previous && rotationSideScore(previous, viewX, viewZ) >= best.score - ROTATION_HANDLE_DOMINANCE_HYSTERESIS) {
    return previous;
  }
  return best.side;
}

function rotationHandleSidesForCamera(
  state: ThreeState,
  center: THREE.Vector3,
  xAxis = new THREE.Vector3(1, 0, 0),
  zAxis = new THREE.Vector3(0, 0, 1),
) {
  const view = state.camera.position.clone().sub(center);
  const viewXRaw = view.dot(xAxis);
  const viewZRaw = view.dot(zAxis);
  const length = Math.hypot(viewXRaw, viewZRaw);
  if (length < 0.0001) {
    return state.rotationHandleSides ?? { x: "right", y: "near", z: "near" };
  }

  const viewX = viewXRaw / length;
  const viewZ = viewZRaw / length;
  const previous = state.rotationHandleSides ?? undefined;
  const next: RotationHandleSides = {
    // Keep the two upper rotation handles on the faces opposite the camera.
    x: signedRotationSide(viewX, previous?.x, "left", "right"),
    y: dominantRotationSide(viewX, viewZ, previous?.y),
    z: signedRotationSide(viewZ, previous?.z, "far", "near"),
  };
  state.rotationHandleSides = next;
  return next;
}

function patchWithPreservedWorldYEdge(shape: WorkplaneShape, patch: Partial<WorkplaneShape>, edge: "bottom" | "top") {
  const startFrame = selectionFrameForShapes([shape], [shape.id]);
  if (!startFrame) {
    return patch;
  }
  const startBounds = selectionWorldYBounds(startFrame);
  const draftShape = { ...shape, ...patch };
  const draftFrame = selectionFrameForShapes([draftShape], [shape.id]);
  if (!draftFrame) {
    return patch;
  }
  const draftBounds = selectionWorldYBounds(draftFrame);
  const delta = edge === "bottom" ? startBounds.min - draftBounds.min : startBounds.max - draftBounds.max;
  return {
    ...patch,
    elevation: cleanNearZero(clamp((draftShape.elevation ?? 0) + delta, MIN_ELEVATION, MAX_ELEVATION), 0.0005),
  };
}

function patchWithPreservedWorldBottom(shape: WorkplaneShape, patch: Partial<WorkplaneShape>) {
  return patchWithPreservedWorldYEdge(shape, patch, "bottom");
}

function resizeSignsForDimension(signs: ResizeSigns, axis: "width" | "depth") {
  return axis === "width" ? { x: signs.x, z: 0 } : { x: 0, z: signs.z };
}

function patchWithResizeAnchor(
  shape: WorkplaneShape,
  patch: Partial<WorkplaneShape>,
  axis: ShapeInspectorUpdateOptions["resizeAxis"] | DimensionMark["axis"],
  anchor: ResizeAnchorMemory | null,
) {
  if (axis === "height") {
    return patchWithPreservedWorldYEdge(shape, patch, anchor?.shapeId === shape.id && anchor.pressedY === "bottom" ? "top" : "bottom");
  }

  if (axis !== "width" && axis !== "depth") {
    return patchWithPreservedWorldBottom(shape, patch);
  }
  if (!anchor || anchor.shapeId !== shape.id) {
    return patchWithPreservedWorldBottom(shape, patch);
  }

  const signs = resizeSignsForDimension(anchor.signs, axis);
  if (!signs.x && !signs.z) {
    return patchWithPreservedWorldBottom(shape, patch);
  }

  const frame = selectionFrameForShapes([shape], [shape.id]);
  if (!frame) {
    return patchWithPreservedWorldBottom(shape, patch);
  }

  const draftShape = { ...shape, ...patch };
  const draftFrame = selectionFrameForShapes([draftShape], [shape.id]);
  const width = Math.max(MIN_SHAPE_SIZE, draftFrame?.width ?? patch.width ?? shapeWidth(shape));
  const depth = Math.max(MIN_SHAPE_SIZE, draftFrame?.depth ?? patch.depth ?? shapeDepth(shape));
  const center = resizeCenterFromAnchor(frame, resizeAnchorPointForFrame(frame, signs), signs, width, depth);
  return patchWithPreservedWorldBottom(shape, {
    ...patch,
    x: cleanNearZero(center.x, 0.0005),
    z: cleanNearZero(center.z, 0.0005),
    elevation: cleanNearZero(center.y - shape.height / 2, 0.0005),
  });
}

function resizeShapeFromFrameHandle(
  transform: TransformDragState,
  point: THREE.Vector3,
  handleKey: string,
  shiftKey: boolean,
  altKey: boolean,
  step: number,
  maxSize: number,
): Partial<WorkplaneShape> {
  const shape = transform.startShape;
  const frame = transform.selectionFrame;
  const width = frame.width;
  const depth = frame.depth;
  const localDelta = transform.scaleStartPoint ? frameLocalDelta(frame, transform.scaleStartPoint, point) : new THREE.Vector3();

  const signs = transform.scaleSigns ?? resizeSignsForHandle(handleKey);
  const axisResize = (current: number, delta: number, sign: number) => {
    if (!sign) {
      return current;
    }
    const signedDelta = sign * delta;
    if (altKey) {
      return snapDimension(current + signedDelta * 2, step, MIN_SHAPE_SIZE, maxSize);
    }
    return snapDimension(current + signedDelta, step, MIN_SHAPE_SIZE, maxSize);
  };

  let nextWidth = axisResize(width, localDelta.x, signs.x);
  let nextDepth = axisResize(depth, localDelta.z, signs.z);

  if (shiftKey && signs.x && signs.z) {
    const scale = proportionalResizeScale(width, depth, nextWidth, nextDepth);
    const limitedScale = clamp(scale, MIN_SHAPE_SIZE / Math.max(MIN_SHAPE_SIZE, Math.min(width, depth)), maxSize / Math.max(width, depth));
    nextWidth = snapDimension(width * limitedScale, step, MIN_SHAPE_SIZE, maxSize);
    nextDepth = snapDimension(depth * limitedScale, step, MIN_SHAPE_SIZE, maxSize);
  }

  const nextCenter = altKey
    ? frame.center.clone()
    : resizeCenterFromAnchor(frame, transform.scaleAnchorPoint ?? resizeAnchorPointForFrame(frame, signs), signs, nextWidth, nextDepth);
  if (shapeHasTaper(shape)) {
    const scaleX = nextWidth / Math.max(MIN_SHAPE_SIZE, width);
    const scaleZ = nextDepth / Math.max(MIN_SHAPE_SIZE, depth);
    const scaled = scaledHorizontalShapePatch(shape, scaleX, scaleZ);
    return {
      ...scaled,
      x: cleanNearZero(nextCenter.x, 0.0005),
      z: cleanNearZero(nextCenter.z, 0.0005),
      elevation: cleanNearZero(nextCenter.y - shape.height / 2, 0.0005),
    };
  }
  return resizedShapePatchFromFrame(shape, nextCenter, nextWidth, nextDepth);
}

function axisScaleMatrix(axis: THREE.Vector3, scale: number, anchor: number) {
  const normal = axis.clone().normalize();
  const factor = scale - 1;
  const translation = normal.clone().multiplyScalar((1 - scale) * anchor);
  return new THREE.Matrix4().set(
    1 + factor * normal.x * normal.x,
    factor * normal.x * normal.y,
    factor * normal.x * normal.z,
    translation.x,
    factor * normal.y * normal.x,
    1 + factor * normal.y * normal.y,
    factor * normal.y * normal.z,
    translation.y,
    factor * normal.z * normal.x,
    factor * normal.z * normal.y,
    1 + factor * normal.z * normal.z,
    translation.z,
    0, 0, 0, 1,
  );
}

function resizeImportedShapeAlongFrameNormal(
  shape: WorkplaneShape,
  frame: SelectionFrame,
  nextFrameHeight: number,
  resizingFromBottom: boolean,
): Partial<WorkplaneShape> | null {
  if (!shape.importedMesh?.positions.length) {
    return null;
  }

  const positions = resizedImportedMeshPositions(shape);
  const scale = nextFrameHeight / Math.max(MIN_SHAPE_SIZE, frame.height);
  const axis = frame.yAxis.clone().normalize();
  const anchorLocal = resizingFromBottom ? frame.max.y : frame.min.y;
  const anchorWorld = frame.center.dot(axis) + anchorLocal;
  const deformation = axisScaleMatrix(axis, scale, anchorWorld);
  const shapeCenterWorld = shapeCenter(shape);
  const quaternion = quaternionForShape(shape);
  const worldPositions: number[] = [];
  const point = new THREE.Vector3();
  const min = new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new THREE.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (let index = 0; index + 2 < positions.length; index += 3) {
    point
      .set(positions[index], positions[index + 1] - shape.height / 2, positions[index + 2])
      .applyQuaternion(quaternion)
      .add(shapeCenterWorld)
      .applyMatrix4(deformation);
    worldPositions.push(point.x, point.y, point.z);
    min.min(point);
    max.max(point);
  }

  if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite)) {
    return null;
  }

  const centerX = (min.x + max.x) / 2;
  const centerZ = (min.z + max.z) / 2;
  const width = Math.max(MIN_SHAPE_SIZE, max.x - min.x);
  const height = Math.max(MIN_SHAPE_SIZE, max.y - min.y);
  const depth = Math.max(MIN_SHAPE_SIZE, max.z - min.z);
  const localPositions = worldPositions.map((value, index) => {
    if (index % 3 === 0) return value - centerX;
    if (index % 3 === 1) return value - min.y;
    return value - centerZ;
  });
  const primitive = cadModifierPrimitiveForBakedShape(shape);
  const primitiveTransform = primitive
    ? deformation.clone().multiply(cadTransformToMatrix(primitive.transform))
    : null;
  const cadPrimitiveFrame = primitive && primitiveTransform
    ? {
        kind: primitive.kind,
        width: primitive.width,
        depth: primitive.depth,
        height: primitive.height,
        frame: {
          x: centerX,
          z: centerZ,
          elevation: min.y,
          width,
          depth,
          height,
          sourceTransform: cadTransformFromMatrix(primitiveTransform),
        },
      }
    : undefined;

  return {
    kind: "mesh",
    x: cleanNearZero(centerX, 0.0005),
    z: cleanNearZero(centerZ, 0.0005),
    elevation: cleanNearZero(min.y, 0.0005),
    width,
    depth,
    height,
    size: Math.max(width, depth),
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    mirrorX: undefined,
    mirrorY: undefined,
    mirrorZ: undefined,
    importedMesh: {
      positions: localPositions,
      baseWidth: width,
      baseDepth: depth,
      baseHeight: height,
      triangleCount: Math.floor(localPositions.length / 9),
      sourceFormat: "json",
    },
    cadPrimitiveFrame,
    cadBrep: undefined,
    cadBrepFrame: undefined,
    cadDisplayEdges: undefined,
    cadDisplayEdgesVersion: undefined,
    edgeTreatments: undefined,
    edgeTreatmentHistory: undefined,
    edgeResizeMode: undefined,
  };
}

function resizeShapeAlongFrameNormal(
  shape: WorkplaneShape,
  frame: SelectionFrame,
  nextFrameHeight: number,
  resizingFromBottom: boolean,
): Partial<WorkplaneShape> {
  const importedPatch = resizeImportedShapeAlongFrameNormal(shape, frame, nextFrameHeight, resizingFromBottom);
  if (importedPatch) {
    return importedPatch;
  }

  const scale = nextFrameHeight / Math.max(MIN_SHAPE_SIZE, frame.height);
  const currentCenter = shapeCenter(shape);
  const currentCenterLocalY = frameLocalPoint(frame, currentCenter).y;
  const anchorLocal = resizingFromBottom ? frame.max.y : frame.min.y;
  const nextCenterLocalY = anchorLocal + (currentCenterLocalY - anchorLocal) * scale;
  const nextCenter = currentCenter.clone().addScaledVector(frame.yAxis, nextCenterLocalY - currentCenterLocalY);
  const quaternion = quaternionForShape(shape);
  const localAxes = [
    { axis: "width" as const, vector: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion) },
    { axis: "height" as const, vector: new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion) },
    { axis: "depth" as const, vector: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion) },
  ];
  const dimensionAxis = localAxes.reduce((best, candidate) =>
    Math.abs(candidate.vector.dot(frame.yAxis)) > Math.abs(best.vector.dot(frame.yAxis)) ? candidate : best,
  );
  const patch: Partial<WorkplaneShape> = {
    x: cleanNearZero(nextCenter.x, 0.0005),
    z: cleanNearZero(nextCenter.z, 0.0005),
  };
  if (dimensionAxis.axis === "width") {
    patch.width = Math.max(MIN_SHAPE_SIZE, shapeWidth(shape) * scale);
    patch.size = resizedShapeSize(patch.width, shapeDepth(shape));
    patch.elevation = cleanNearZero(nextCenter.y - shape.height / 2, 0.0005);
  } else if (dimensionAxis.axis === "depth") {
    patch.depth = Math.max(MIN_SHAPE_SIZE, shapeDepth(shape) * scale);
    patch.size = resizedShapeSize(shapeWidth(shape), patch.depth);
    patch.elevation = cleanNearZero(nextCenter.y - shape.height / 2, 0.0005);
  } else {
    patch.height = Math.max(MIN_SHAPE_SIZE, shape.height * scale);
    patch.elevation = cleanNearZero(nextCenter.y - patch.height / 2, 0.0005);
  }
  return patch;
}

function resizeSelectionFromHandle(
  transform: TransformDragState,
  point: THREE.Vector3,
  handleKey: string,
  shiftKey: boolean,
  altKey: boolean,
  step: number,
  maxSize: number,
) {
  const frame = transform.selectionFrame;
  const localDelta = transform.scaleStartPoint ? frameLocalDelta(frame, transform.scaleStartPoint, point) : new THREE.Vector3();
  const signs = transform.scaleSigns ?? resizeSignsForHandle(handleKey);
  const axisResize = (current: number, delta: number, sign: number) => {
    if (!sign) {
      return { size: current, scale: 1 };
    }
    const signedDelta = sign * delta;
    if (altKey) {
      const size = snapDimension(current + signedDelta * 2, step, MIN_SHAPE_SIZE, maxSize);
      return { size, scale: size / Math.max(MIN_SHAPE_SIZE, current) };
    }
    const rawSize = current + signedDelta;
    const size = snapDimension(rawSize, step, MIN_SHAPE_SIZE, maxSize);
    return {
      size,
      scale: size / Math.max(MIN_SHAPE_SIZE, current),
    };
  };

  let nextX = axisResize(frame.width, localDelta.x, signs.x);
  let nextZ = axisResize(frame.depth, localDelta.z, signs.z);
  if (shiftKey && signs.x && signs.z) {
    const scale = proportionalResizeScale(frame.width, frame.depth, nextX.size, nextZ.size);
    const limitedScale = clamp(scale, MIN_SHAPE_SIZE / Math.max(MIN_SHAPE_SIZE, Math.min(frame.width, frame.depth)), maxSize / Math.max(frame.width, frame.depth));
    const width = snapDimension(frame.width * limitedScale, step, MIN_SHAPE_SIZE, maxSize);
    const depth = snapDimension(frame.depth * limitedScale, step, MIN_SHAPE_SIZE, maxSize);
    nextX = {
      size: width,
      scale: width / Math.max(MIN_SHAPE_SIZE, frame.width),
    };
    nextZ = {
      size: depth,
      scale: depth / Math.max(MIN_SHAPE_SIZE, frame.depth),
    };
  }

  const nextCenter = altKey
    ? frame.center.clone()
    : resizeCenterFromAnchor(frame, transform.scaleAnchorPoint ?? resizeAnchorPointForFrame(frame, signs), signs, nextX.size, nextZ.size);

  return transform.items.map((item) => {
    const localCenter = frameLocalPoint(frame, item.startCenter);
    const nextItemCenter = nextCenter
      .clone()
      .add(frame.xAxis.clone().multiplyScalar(localCenter.x * nextX.scale))
      .add(frame.yAxis.clone().multiplyScalar(localCenter.y))
      .add(frame.zAxis.clone().multiplyScalar(localCenter.z * nextZ.scale));
    const width = snapDimension(shapeWidth(item.startShape) * nextX.scale, step, MIN_SHAPE_SIZE, maxSize);
    const depth = snapDimension(shapeDepth(item.startShape) * nextZ.scale, step, MIN_SHAPE_SIZE, maxSize);
    const actualScaleX = width / Math.max(MIN_SHAPE_SIZE, shapeWidth(item.startShape));
    const actualScaleZ = depth / Math.max(MIN_SHAPE_SIZE, shapeDepth(item.startShape));
    const patch = {
      ...scaledHorizontalShapePatch(item.startShape, actualScaleX, actualScaleZ),
      x: nextItemCenter.x,
      z: nextItemCenter.z,
      elevation: cleanNearZero(nextItemCenter.y - item.startShape.height / 2, 0.0005),
    } satisfies Partial<WorkplaneShape>;
    return {
      id: item.id,
      patch,
    };
  });
}

export function WorkplaneViewport({
  autoFrameOnOpen = false,
  shapes,
  selectedIds,
  alignMode,
  alignAnchorId,
  alignHandles,
  alignReferenceShapes,
  mirrorMode,
  mirrorReferenceShapes,
  placementWorkplane,
  workplaneMode,
  initialSnap,
  initialWorkspace,
  workspaceSettingsKey,
  showProjectNameInToolbar = true,
  onShowProjectNameInToolbarChange,
  onAddShape,
  onCreateShape,
  onAlignAnchorChange,
  onAlignPreview,
  onAlignPreviewClear,
  onAlignSelection,
  onMirrorPreview,
  onMirrorPreviewClear,
  onMirrorSelection,
  onSelectShape,
  onSetPlacementWorkplane,
  onToggleWorkplaneTool,
  onInteractionActiveChange,
  onEditSketch,
  canSeparateParts = false,
  onSeparateParts,
  onUpdateShape,
  onRulerAction,initialRulers,onRulersChange,onModelingBusyChange,
  onWorkspaceSettingsChange,
  onWorkplaneModeChange,
  modifierActive = false,
  modifierPreviewActive = false,
  modifierEdges = [],
  selectedModifierEdgeIds = [],
  onModifierEdgeToggle,
  challengeTutorial = null,
  onChallengeTutorialFinish,
  themePreference = "system",
  resolvedTheme = "light",
  onThemePreferenceChange,
}: WorkplaneViewportProps) {
  const [endConnections,setEndConnections]=useState<EndConnection[]>([]);
  const [creationMode,setCreationMode]=useState(false);const creationModeRef=useRef(creationMode);creationModeRef.current=creationMode;
  const [creationKind,setCreationKind]=useState<DrawnPrimitiveKind>("rectangle");
  const [creationHeight,setCreationHeight]=useState("10");const [creationError,setCreationError]=useState("");
  const creationPointsRef=useRef<THREE.Vector3[]>([]);const [creationPreview,setCreationPreview]=useState<THREE.Vector3[]>([]);
  const creationPointerRef=useRef<(x:number,y:number,hover:boolean)=>void>(()=>{});
  const [holeModeId,setHoleModeId]=useState<string|null>(null);const holeModeRef=useRef(holeModeId);holeModeRef.current=holeModeId;
  const [holeModel,setHoleModel]=useState<HoleModel|null>(null);const holeModelRef=useRef(holeModel);holeModelRef.current=holeModel;
  const [holeSelected,setHoleSelected]=useState<string|null>(null);const holeSelectedRef=useRef(holeSelected);holeSelectedRef.current=holeSelected;
  const [holeDraft,setHoleDraft]=useState<HoleEdit|null>(null);
  const [holePlacement,setHolePlacement]=useState<HoleKind|null>(null);const holePlacementRef=useRef(holePlacement);holePlacementRef.current=holePlacement;
  const [holeError,setHoleError]=useState("");const [holeBusy,setHoleBusy]=useState(false);const holeBusyRef=useRef(false);
  const holePendingSelectionRef=useRef<HoleEdit|null>(null);
  const holeSketchRef=useRef<{edit:HoleEdit;plane:THREE.Plane;points:number[][]}|null>(null);
  const [holeDrawWorld,setHoleDrawWorld]=useState<number[][]>([]);
  const holeApplyRef=useRef<(edit:HoleEdit|null)=>void>(()=>{});
  const holePointerRef=useRef<(x:number,y:number,hover:boolean)=>void>(()=>{});
  const [floorPickId, setFloorPickId] = useState<string | null>(null);
  const floorPickRef = useRef(floorPickId); floorPickRef.current=floorPickId;
  const [stretchMeasureMode, setStretchMeasureMode] = useState(false);
  const [stretchStart, setStretchStart] = useState("2");
  const [stretchEnd, setStretchEnd] = useState("2");
  const [stretchAxis, setStretchAxis] = useState<"auto" | AxialStretchOptions["axis"]>("auto");
  const [stretchAnchor, setStretchAnchor] = useState<AxialStretchOptions["anchor"]>("start");
  const [stretchEdit, setStretchEdit] = useState<{ segmentId: string; value: string; error: string } | null>(null);
  const stretchEditRef = useRef(stretchEdit); stretchEditRef.current = stretchEdit;
  const stretchInputRef = useRef<HTMLInputElement>(null);
  const stretchPreviewRef = useRef<THREE.Object3D | null>(null);
  const modelingWorkerRef=useRef<ModelingWorkerClient|null>(null);
  const modelingRunRef=useRef(0);
  const [modelingBusy,setModelingBusy]=useState(false);
  useEffect(()=>{onModelingBusyChange?.(modelingBusy);},[modelingBusy,onModelingBusyChange]);
  const rulerStretchPendingRef=useRef<object|null>(null);
  const [paintMode, setPaintMode] = useState(false);
  const [paintColor, setPaintColor] = useState("#ef5350");
  const [paintErase, setPaintErase] = useState(false);
  const paintModeRef = useRef(paintMode);paintModeRef.current=paintMode;
  const paintColorRef = useRef(paintColor);paintColorRef.current=paintColor;
  const paintEraseRef = useRef(paintErase);paintEraseRef.current=paintErase;
  const paintOverlaysRef = useRef<Array<{ surface: THREE.Mesh<THREE.BufferGeometry>; group: THREE.Group }>>([]);
  const [cameraPanMode, setCameraPanMode] = useState(false);
  const cameraPanModeRef = useRef(false);
  cameraPanModeRef.current = cameraPanMode;
  const [facePanelOpen, setFacePanelOpen] = useState(true);
  const [faceLabelsVisible, setFaceLabelsVisible] = useState(true);
  const faceLabelsVisibleRef = useRef(faceLabelsVisible);
  faceLabelsVisibleRef.current = faceLabelsVisible;
  const [faceMode, setFaceMode] = useState(false);
  const [faceDraft, setFaceDraft] = useState<{ shapeId: string; annotation: FaceAnnotation } | null>(null);
  const [faceName, setFaceName] = useState("");
  const [faceReadings, setFaceReadings] = useState<FaceMeasurement[]>([]);
  const [faceError, setFaceError] = useState("");
  const [selectedHoleOverlay, setSelectedHoleOverlay] = useState<{ label: string; points: string; x: number; y: number } | null>(null);
  const selectedHoleRef = useRef<{ shapeId: string; geometry: THREE.BufferGeometry; hole: CircularHole } | null>(null);
  const faceHighlightRef = useRef<{ group: THREE.Group; surface: THREE.Mesh<THREE.BufferGeometry>; annotation: FaceAnnotation; selected: boolean; triangles: Set<number> } | null>(null);
  const faceDraftRef = useRef(faceDraft);
  faceDraftRef.current = faceDraft;
  const faceModeRef = useRef(false);
  faceModeRef.current = faceMode;
  const [snapOpen, setSnapOpen] = useState(false);
  const [snap, setSnap] = useState<GridSize>(() => normalizeSnapGrid(initialSnap, DEFAULT_SNAP_GRID));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceSettings>(() => normalizeWorkspaceSettings(initialWorkspace));
  const [transformOverlay, setTransformOverlay] = useState<TransformOverlayState | null>(null);
  const [alignOverlay, setAlignOverlay] = useState<AlignOverlayState | null>(null);
  const [mirrorOverlay, setMirrorOverlay] = useState<MirrorOverlayState | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [hoverMeasureKey, setHoverMeasureKey] = useState<string | null>(null);
  const [pinnedMeasureKey, setPinnedMeasureKey] = useState<string | null>(null);
  const [rotationReadout, setRotationReadout] = useState<RotationReadout>(null);
  const suppressNextRotationEditRef = useRef(false);
  const [activeRotationWheel, setActiveRotationWheel] = useState(false);
  const [activeTransformKind, setActiveTransformKind] = useState<TransformHandleKind | null>(null);
  const [rotationWheelAxis, setRotationWheelAxis] = useState<RotationAxis>("y");
  const [pinnedRotationWheelView, setPinnedRotationWheelView] = useState<PinnedRotationWheelView | null>(null);
  const [editingDimension, setEditingDimension] = useState<EditingDimension>(null);
  const [editingRotation, setEditingRotation] = useState<EditingRotation>(null);
  const [rulerMode, setRulerMode] = useState(false);
  const [rulerDeleteMode, setRulerDeleteMode] = useState(false);
  const [rulerMoveMode, setRulerMoveMode] = useState(false);
  const [rulerToolsOpen, setRulerToolsOpen] = useState(false);
  const [cameraControlsCollapsed, setCameraControlsCollapsed] = useState(false);
  const [rulerModel, setRulerModel] = useState<RulerModel>(()=>({...restoreRulerState(initialRulers),startPointId:null,hover:null}));
  const [rulerOverlay, setRulerOverlay] = useState<RulerOverlayState | null>(null);
  const [moveDimensionOverlay, setMoveDimensionOverlay] = useState<MoveDimensionOverlayState | null>(null);
  const [moveDimensionsEnabled, setMoveDimensionsEnabled] = useState(true);
  const [challengeTutorialCollapsed, setChallengeTutorialCollapsed] = useState(false);

  useEffect(() => {
    setChallengeTutorialCollapsed(false);
  }, [challengeTutorial]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const threeRef = useRef<ThreeState | null>(null);
  const shapesRef = useRef(shapes);
  const alignReferenceShapesRef = useRef(alignReferenceShapes);
  const mirrorReferenceShapesRef = useRef(mirrorReferenceShapes);
  const selectedIdsRef = useRef(selectedIds);
  const dragRef = useRef<DragState | null>(null);
  const moveDimensionSessionRef = useRef<MoveDimensionSession | null>(null);
  const moveDimensionOverlayRef = useRef<MoveDimensionOverlayState | null>(null);
  const moveDimensionsEnabledRef = useRef(true);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const transformRef = useRef<TransformDragState | null>(null);
  const lastResizeAnchorRef = useRef<ResizeAnchorMemory | null>(null);
  const suppressNextLiftEditRef = useRef(false);
  const snapRef = useRef(snap);
  const workspaceRef = useRef(workspace);
  const workspaceSettingsKeyRef = useRef(workspaceSettingsKey ?? null);
  const lastWorkspaceSettingsSyncRef = useRef("");
  const pendingWorkspaceHydrationFingerprintRef = useRef<string | null>(null);
  const viewCubeRef = useRef<HTMLDivElement | null>(null);
  const transformOverlayRef = useRef<TransformOverlayState | null>(null);
  const alignOverlayRef = useRef<AlignOverlayState | null>(null);
  const mirrorOverlayRef = useRef<MirrorOverlayState | null>(null);
  const rulerModeRef = useRef(false);
  const rulerDeleteModeRef = useRef(false);
  const rulerMoveModeRef = useRef(false);
  const rulerPointDragRef = useRef<RulerPointDragState | null>(null);
  const rulerDragBeforeRef = useRef<RulerModel | null>(null);
  const rulerPointClickRef = useRef<{ pointId: string; time: number; x: number; y: number } | null>(null);
  const rulerShiftRef = useRef(false);
  const rulerPointerRef = useRef<{ x: number; y: number } | null>(null);
  const rulerModelRef = useRef(rulerModel);
  const rulerOverlayRef = useRef<RulerOverlayState | null>(null);
  const rulerIdRef = useRef(0);
  const alignModeRef = useRef(alignMode);
  const alignAnchorIdRef = useRef(alignAnchorId);
  const alignHandlesRef = useRef(alignHandles);
  const mirrorModeRef = useRef(mirrorMode);
  const modifierActiveRef = useRef(modifierActive);
  const modifierPreviewActiveRef = useRef(modifierPreviewActive);
  const modifierEdgesRef = useRef(modifierEdges);
  const [hoverModifierEdgeId, setHoverModifierEdgeId] = useState<number | null>(null);
  const selectedIdsKeyRef = useRef(selectedIds.join("|"));
  const placementWorkplaneRef = useRef(placementWorkplane);
  const workplaneModeRef = useRef(workplaneMode);
  placementWorkplaneRef.current = placementWorkplane;
  workplaneModeRef.current = workplaneMode;
  const perfRef = useRef({
    fps: 0,
    frameMs: 0,
    maxFrameMs: 0,
    frames: 0,
    lastSample: 0,
  });

  const selectedShape = useMemo(() => (selectedIds.length === 1 ? shapes.find((shape) => shape.id === selectedIds[0]) ?? null : null), [selectedIds, shapes]);
  const renderSelectionIds = useCallback(
    (ids = selectedIdsRef.current) => (
      workplaneModeRef.current || (modifierActiveRef.current && !modifierPreviewActiveRef.current) ? [] : ids
    ),
    [],
  );

  useEffect(() => {
    modifierEdgesRef.current = modifierEdges;
    rebuildModifierEdges(threeRef.current, modifierEdges, selectedModifierEdgeIds, modifierPreviewActive, hoverModifierEdgeId);
  }, [hoverModifierEdgeId, modifierEdges, modifierPreviewActive, selectedModifierEdgeIds]);

  const resolvedThemeRef = useRef(resolvedTheme);
  resolvedThemeRef.current = resolvedTheme;

  const clearMoveDimensions = useCallback(() => {
    moveDimensionSessionRef.current = null;
    moveDimensionOverlayRef.current = null;
    setMoveDimensionOverlay(null);
    if (threeRef.current) {
      syncMoveDimensionWorldLines(threeRef.current, null, resolvedThemeRef.current);
    }
  }, []);

  useEffect(() => {
    const applyStoredPreference = () => {
      const enabled = readMoveDimensionsEnabled();
      moveDimensionsEnabledRef.current = enabled;
      setMoveDimensionsEnabled(enabled);
      if (!enabled) {
        clearMoveDimensions();
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === MOVE_DIMENSIONS_ENABLED_STORAGE_KEY) {
        applyStoredPreference();
      }
    };
    applyStoredPreference();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearMoveDimensions]);

  const changeMoveDimensionsEnabled = useCallback((enabled: boolean) => {
    moveDimensionsEnabledRef.current = enabled;
    setMoveDimensionsEnabled(enabled);
    try {
      window.localStorage.setItem(MOVE_DIMENSIONS_ENABLED_STORAGE_KEY, String(enabled));
    } catch {
      // The preference still applies to this editor session when storage is unavailable.
    }
    if (!enabled) {
      clearMoveDimensions();
    }
  }, [clearMoveDimensions]);

  const commitMoveDimension = useCallback(
    (axis: MoveDimensionAxis, rawValue: string) => {
      const session = moveDimensionSessionRef.current;
      const value = parseMeasurementInput(rawValue);
      if (!session || !Number.isFinite(value)) {
        return;
      }

      const workspaceNow = workspaceRef.current;
      const starts = session.items.map((item) => axis === "x" ? item.startX : item.startZ);
      const workspaceExtent = axis === "x" ? workspaceNow.width : workspaceNow.depth;
      const minimumDelta = Math.max(...starts.map((start) => -workspaceExtent / 2 + 6 - start));
      const maximumDelta = Math.min(...starts.map((start) => workspaceExtent / 2 - 6 - start));
      const nextValue = clamp(value, minimumDelta, maximumDelta);
      if (axis === "x") {
        session.deltaX = nextValue;
      } else {
        session.deltaZ = nextValue;
      }

      onInteractionActiveChange?.(true);
      session.items.forEach((item) => {
        onUpdateShape(item.id, {
          x: item.startX + session.deltaX,
          z: item.startZ + session.deltaZ,
        });
      });
      onInteractionActiveChange?.(false);
      if (threeRef.current) {
        syncMoveDimensionOverlay(
          threeRef.current,
          session,
          moveDimensionOverlayRef,
          setMoveDimensionOverlay,
          workspaceNow.accuracy,
          resolvedThemeRef.current,
        );
        threeRef.current.needsRender = true;
      }
    },
    [onInteractionActiveChange, onUpdateShape],
  );

  const rememberResizeAnchor = useCallback((shapeId: string, kind: TransformHandleKind, handleKey: string) => {
    if (kind === "scale") {
      const signs = resizeSignsForHandle(handleKey);
      if (signs.x || signs.z) {
        lastResizeAnchorRef.current = { shapeId, handleKey, signs, pressedY: null };
      }
      return;
    }
    if (kind === "height") {
      lastResizeAnchorRef.current = {
        shapeId,
        handleKey,
        signs: { x: 0, z: 0 },
        pressedY: handleKey === "bottom-height" ? "bottom" : "top",
      };
    }
  }, []);

  useLayoutEffect(() => {
    const nextKey = workspaceSettingsKey ?? null;
    if (workspaceSettingsKeyRef.current !== nextKey) {
      workspaceSettingsKeyRef.current = nextKey;
      lastWorkspaceSettingsSyncRef.current = "";
    }
    const shouldUseSavedDefault = nextKey === "local-workplane" || (initialSnap === undefined && initialWorkspace === undefined);
    const savedDefault = shouldUseSavedDefault ? readSavedWorkspaceDefault(nextKey) : null;
    const nextSnap = savedDefault?.snap ?? normalizeSnapGrid(initialSnap, DEFAULT_SNAP_GRID);
    const nextWorkspace = savedDefault?.workspace ?? normalizeWorkspaceSettings(initialWorkspace);
    const nextFingerprint = workplaneSettingsFingerprint(nextWorkspace, nextSnap);
    // Prop hydration must not echo back to the parent. Parent persistence creates
    // new object references even when the values are unchanged, which previously
    // caused this effect and its callback effect to update each other indefinitely.
    lastWorkspaceSettingsSyncRef.current = nextFingerprint;
    pendingWorkspaceHydrationFingerprintRef.current = nextFingerprint;
    snapRef.current = nextSnap;
    workspaceRef.current = nextWorkspace;
    if (threeRef.current) {
      rebuildWorkplane(threeRef.current, nextWorkspace, resolvedThemeRef.current, placementWorkplaneRef.current);
      constrainCamera(threeRef.current, nextWorkspace);
      threeRef.current.needsRender = true;
    }
    setSnap((current) => (current === nextSnap ? current : nextSnap));
    setWorkspace((current) => (
      workplaneSettingsFingerprint(current, nextSnap) === nextFingerprint ? current : nextWorkspace
    ));
  }, [initialSnap, initialWorkspace, workspaceSettingsKey]);

  useEffect(() => {
    const normalizedWorkspace = normalizeWorkspaceSettings(workspace);
    const normalizedSnap = normalizeSnapGrid(snap, DEFAULT_SNAP_GRID);
    const fingerprint = workplaneSettingsFingerprint(normalizedWorkspace, normalizedSnap);
    const hydrationDecision = workspaceHydrationSyncDecision(pendingWorkspaceHydrationFingerprintRef.current, fingerprint);
    pendingWorkspaceHydrationFingerprintRef.current = hydrationDecision.pendingFingerprint;
    if (!hydrationDecision.shouldSync) {
      return;
    }
    if (lastWorkspaceSettingsSyncRef.current === fingerprint) {
      return;
    }
    lastWorkspaceSettingsSyncRef.current = fingerprint;
    onWorkspaceSettingsChange?.({ workspace: normalizedWorkspace, snap: normalizedSnap });
  }, [onWorkspaceSettingsChange, snap, workspace]);

  const makeWorkspaceDefault = useCallback(() => {
    const normalizedWorkspace = normalizeWorkspaceSettings(workspace);
    const normalizedSnap = normalizeSnapGrid(snap, DEFAULT_SNAP_GRID);
    const key = workspaceSettingsKeyRef.current;
    if (key) {
      try {
        window.localStorage.setItem(
          `${WORKSPACE_DEFAULTS_STORAGE_PREFIX}${key}`,
          JSON.stringify({ workspace: normalizedWorkspace, snap: normalizedSnap }),
        );
      } catch {
        // Project persistence below is still attempted if browser storage is unavailable.
      }
    }
    onWorkspaceSettingsChange?.({ workspace: normalizedWorkspace, snap: normalizedSnap });
  }, [onWorkspaceSettingsChange, snap, workspace]);

  useEffect(() => {
    const openWorkspaceSettings = () => setSettingsOpen(true);
    window.addEventListener("scketch3dweb:open-workspace-settings", openWorkspaceSettings);
    return () => window.removeEventListener("scketch3dweb:open-workspace-settings", openWorkspaceSettings);
  }, []);

  useEffect(() => {
    shapesRef.current = shapes;
    rebuildShapes(
      threeRef.current,
      shapes,
      renderSelectionIds(),
      shouldBuildCutPreviews(transformRef.current, dragRef.current),
      modifierActiveRef.current,
      placementWorkplaneRef.current,
    );
    refreshDragPreviewObjects(threeRef.current, dragRef.current);
    if (threeRef.current) {
      syncTransformOverlay(
        threeRef.current,
        previewShapesForDrag(shapes, dragRef.current),
        renderSelectionIds(),
        transformOverlayRef,
        setTransformOverlay,
        workspaceRef.current.accuracy,
        Boolean(transformRef.current || dragRef.current),
        false,
        placementWorkplaneRef.current,
        resolvedThemeRef.current,
      );
      syncAlignOverlay(threeRef.current, alignReferenceShapesRef.current, selectedIdsRef.current, alignModeRef.current, alignAnchorIdRef.current, alignHandlesRef.current, alignOverlayRef, setAlignOverlay);
      syncMirrorOverlay(threeRef.current, mirrorReferenceShapesRef.current, selectedIdsRef.current, mirrorModeRef.current, mirrorOverlayRef, setMirrorOverlay);
      threeRef.current.needsRender = true;
    }
  }, [shapes]);

  useEffect(() => {
    alignReferenceShapesRef.current = alignReferenceShapes;
    if (threeRef.current) {
      syncAlignOverlay(threeRef.current, alignReferenceShapes, selectedIdsRef.current, alignModeRef.current, alignAnchorIdRef.current, alignHandlesRef.current, alignOverlayRef, setAlignOverlay);
      threeRef.current.needsRender = true;
    }
  }, [alignReferenceShapes]);

  useEffect(() => {
    mirrorReferenceShapesRef.current = mirrorReferenceShapes;
    if (threeRef.current) {
      syncMirrorOverlay(threeRef.current, mirrorReferenceShapes, selectedIdsRef.current, mirrorModeRef.current, mirrorOverlayRef, setMirrorOverlay);
      threeRef.current.needsRender = true;
    }
  }, [mirrorReferenceShapes]);

  useEffect(() => {
    const nextSelectedIdsKey = selectedIds.join("|");
    if (nextSelectedIdsKey !== selectedIdsKeyRef.current) {
      selectedIdsKeyRef.current = nextSelectedIdsKey;
      if (!dragRef.current) {
        clearMoveDimensions();
      }
      lastResizeAnchorRef.current = null;
      setHoverMeasureKey(null);
      setPinnedMeasureKey(null);
      setEditingDimension(null);
      setEditingRotation(null);
      setRotationReadout(null);
      setActiveRotationWheel(false);
      setActiveTransformKind(null);
    }
    selectedIdsRef.current = selectedIds;
    rebuildShapes(
      threeRef.current,
      shapesRef.current,
      renderSelectionIds(selectedIds),
      shouldBuildCutPreviews(transformRef.current, dragRef.current),
      modifierActiveRef.current,
      placementWorkplaneRef.current,
    );
    refreshDragPreviewObjects(threeRef.current, dragRef.current);
    if (threeRef.current) {
      syncTransformOverlay(
        threeRef.current,
        previewShapesForDrag(shapesRef.current, dragRef.current),
        renderSelectionIds(selectedIds),
        transformOverlayRef,
        setTransformOverlay,
        workspaceRef.current.accuracy,
        Boolean(transformRef.current || dragRef.current),
        false,
        placementWorkplaneRef.current,
        resolvedThemeRef.current,
      );
      syncAlignOverlay(threeRef.current, alignReferenceShapesRef.current, selectedIds, alignModeRef.current, alignAnchorIdRef.current, alignHandlesRef.current, alignOverlayRef, setAlignOverlay);
      syncMirrorOverlay(threeRef.current, mirrorReferenceShapesRef.current, selectedIds, mirrorModeRef.current, mirrorOverlayRef, setMirrorOverlay);
      threeRef.current.needsRender = true;
    }
  }, [clearMoveDimensions, selectedIds]);

  useEffect(() => {
    modifierActiveRef.current = modifierActive;
    if (!modifierActive) setHoverModifierEdgeId(null);
    rebuildShapes(
      threeRef.current,
      shapesRef.current,
      renderSelectionIds(),
      !transformRef.current && !dragRef.current,
      modifierActive,
      placementWorkplaneRef.current,
    );
    if (threeRef.current) threeRef.current.needsRender = true;
  }, [modifierActive, renderSelectionIds]);

  useEffect(() => {
    modifierPreviewActiveRef.current = modifierPreviewActive;
    rebuildShapes(
      threeRef.current,
      shapesRef.current,
      renderSelectionIds(),
      !transformRef.current && !dragRef.current,
      modifierActiveRef.current,
      placementWorkplaneRef.current,
    );
    if (threeRef.current) threeRef.current.needsRender = true;
  }, [modifierPreviewActive, renderSelectionIds]);

  useEffect(() => {
    if (hoverModifierEdgeId !== null && !modifierEdges.some((edge) => edge.id === hoverModifierEdgeId)) {
      setHoverModifierEdgeId(null);
    }
  }, [hoverModifierEdgeId, modifierEdges]);

  useEffect(() => {
    alignModeRef.current = alignMode;
    alignAnchorIdRef.current = alignAnchorId;
    alignHandlesRef.current = alignHandles;
    if (threeRef.current) {
      syncAlignOverlay(threeRef.current, alignReferenceShapesRef.current, selectedIdsRef.current, alignMode, alignAnchorId, alignHandles, alignOverlayRef, setAlignOverlay);
      threeRef.current.needsRender = true;
    }
  }, [alignAnchorId, alignHandles, alignMode]);

  useEffect(() => {
    mirrorModeRef.current = mirrorMode;
    if (threeRef.current) {
      syncMirrorOverlay(threeRef.current, mirrorReferenceShapesRef.current, selectedIdsRef.current, mirrorMode, mirrorOverlayRef, setMirrorOverlay);
      threeRef.current.needsRender = true;
    }
  }, [mirrorMode]);

  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);

  useEffect(() => {
    rulerModeRef.current = rulerMode;
  }, [rulerMode]);

  useEffect(() => {
    rulerDeleteModeRef.current = rulerDeleteMode;
  }, [rulerDeleteMode]);

  useEffect(() => {
    rulerMoveModeRef.current = rulerMoveMode;
  }, [rulerMoveMode]);

  useEffect(() => {
    rulerModelRef.current = rulerModel;
    if (threeRef.current) {
      syncRulerOverlay(threeRef.current, rulerModel, rulerOverlayRef, setRulerOverlay, workspaceRef.current.accuracy);
      threeRef.current.needsRender = true;
    }
  }, [rulerModel]);

  useLayoutEffect(() => {
    const state = threeRef.current;
    rebuildShapes(
      state,
      shapesRef.current,
      renderSelectionIds(),
      shouldBuildCutPreviews(transformRef.current, dragRef.current),
      modifierActiveRef.current,
      placementWorkplaneRef.current,
    );
    if (state) {
      syncTransformOverlay(
        state,
        shapesRef.current,
        renderSelectionIds(),
        transformOverlayRef,
        setTransformOverlay,
        workspaceRef.current.accuracy,
        Boolean(transformRef.current || dragRef.current),
        false,
        placementWorkplaneRef.current,
        resolvedThemeRef.current,
      );
    }
    setSelectionHelpersVisible(state, !workplaneMode && transformRef.current?.kind !== "rotate");
    if (state) {
      state.modifierLayer.visible = !workplaneMode;
      state.moveDimensionLayer.visible = !workplaneMode;
      state.needsRender = true;
    }
    if (workplaneMode) {
      clearMoveDimensions();
      setMarqueeRect(null);
      setHoverMeasureKey(null);
      setPinnedMeasureKey(null);
      setEditingDimension(null);
      setEditingRotation(null);
      setRotationReadout(null);
      setActiveRotationWheel(false);
      setActiveTransformKind(null);
      setPinnedRotationWheelView(null);
    }
    if (!workplaneMode) {
      syncWorkplaneHoverPreview(threeRef.current, null, workspaceRef.current, resolvedThemeRef.current);
    }
  }, [clearMoveDimensions, renderSelectionIds, workplaneMode]);

  useLayoutEffect(() => {
    workspaceRef.current = workspace;
    rebuildWorkplane(threeRef.current, workspace, resolvedTheme, placementWorkplane);
    rebuildSelectionHelpers(threeRef.current, shapesRef.current, renderSelectionIds(), placementWorkplane);
    if (threeRef.current) {
      syncTransformOverlay(
        threeRef.current,
        shapesRef.current,
        renderSelectionIds(),
        transformOverlayRef,
        setTransformOverlay,
        workspace.accuracy,
        Boolean(transformRef.current || dragRef.current),
        false,
        placementWorkplaneRef.current,
        resolvedThemeRef.current,
      );
      syncRulerOverlay(threeRef.current, rulerModelRef.current, rulerOverlayRef, setRulerOverlay, workspace.accuracy);
      syncMoveDimensionWorldLines(threeRef.current, moveDimensionSessionRef.current, resolvedTheme);
      threeRef.current.needsRender = true;
    }
  }, [placementWorkplane, resolvedTheme, workspace]);

  useEffect(() => {
    setSelectionHelpersVisible(threeRef.current, !workplaneMode && activeTransformKind !== "rotate");
  }, [activeTransformKind, workplaneMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const state = createThreeScene(host);
    threeRef.current = state;
    rebuildWorkplane(state, workspaceRef.current, resolvedThemeRef.current, placementWorkplaneRef.current);
    const readRulerMeasurements = () => {
      const model = rulerModelRef.current;
      return rulerMeasurementsSnapshot(
        model.points.map((point) => ({
          id: point.id, position: rulerPointWorld(state, point).toArray() as [number, number, number],
          ...(point.attachment ? { shapeId: point.attachment.shapeId, attachmentKind: point.attachment.kind } : {}),
        })),
        model.segments.map((segment) => ({
          id: segment.id, startId: segment.startId, endId: segment.endId,
          ...(segment.edge ? { edgeShapeId: segment.edge.shapeId, polyline: rulerEdgeWorldPoints(state, segment.edge).map((p) => p.toArray() as [number, number, number]) } : {}),
        })),
        workspaceRef.current.accuracy,
        rulerModeRef.current ? "add" : rulerMoveModeRef.current ? "move" : rulerDeleteModeRef.current ? "delete" : "idle",
        model.startPointId,
        !workplaneModeRef.current,
      );
    };
    window.scketch3dwebReadRulerMeasurements = readRulerMeasurements;
    const shapeMesh = (id: string, geometryKey?: string) => {
      let result: THREE.Mesh<THREE.BufferGeometry> | null = null;
      findShapeObject(state, id)?.traverse(object => {
        if (!result && object instanceof THREE.Mesh && object.geometry?.getAttribute("position") && (!geometryKey || faceGeometryKey(object.geometry) === geometryKey)) result = object;
      });
      return result as THREE.Mesh<THREE.BufferGeometry> | null;
    };
    const readFaces = (): FaceAnnotationsSnapshot => ({ available: true, labelsVisible: faceLabelsVisibleRef.current, annotations: shapesRef.current.flatMap(shape => (shape.faceAnnotations ?? []).map(annotation => {
      const mesh = shapeMesh(shape.id, annotation.geometryKey);
      const reading = mesh ? measureAnnotatedFace(mesh, annotation) : { id: annotation.id, name: annotation.name, status: "stale" as const, reason: "Геометрия изменилась или объект недоступен. Укажите грань заново." };
      const screen = reading.status === "valid" ? projectToScreen(new THREE.Vector3(...reading.point as [number,number,number]), state) : undefined;
      const projected = reading.status === "valid" ? new THREE.Vector3(...reading.point as [number,number,number]).project(state.camera) : null;
      return { ...reading, shapeId: shape.id, shapeName: shape.name, ...(screen ? { screen: { x: screen.x, y: screen.y, visible: !!projected && projected.z > -1 && projected.z < 1 } } : {}) };
    })) });
    window.scketch3dwebReadFaceAnnotations = readFaces;
    window.scketch3dwebReadHoleEditor = () => {const model=holeModelRef.current;return{active:Boolean(holeModeRef.current),shapeId:holeModeRef.current,selectedId:holeSelectedRef.current,drawing:holeSketchRef.current?{points:holeSketchRef.current.points,edit:holeSketchRef.current.edit}:null,profiles:model?.profiles.map(({rimA,rimB,...rest})=>rest)??[]};};
    window.scketch3dwebReadSelectedHole = () => {
      const model=holeModelRef.current,profile=model?.profiles.find(p=>p.id===holeSelectedRef.current),shape=shapesRef.current.find(s=>s.id===holeModeRef.current),object=shape&&findShapeObject(state,shape.id);
      if(profile&&shape&&object){const world=(p:number[])=>object.localToWorld(new THREE.Vector3(p[0],p[1]-shape.height/2,p[2]));const at=(value:number)=>world(new THREE.Vector3().setComponent(profile.axis,value).setComponent(profile.u,profile.centerU).setComponent(profile.v,profile.centerV).toArray());const lower=at(profile.lower),upper=at(profile.upper),nearUpper=upper.distanceToSquared(state.camera.position)<lower.distanceToSquared(state.camera.position),center=nearUpper?upper:lower;const normal=new THREE.Vector3().setComponent(profile.axis,1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(object.matrixWorld));return{shapeId:shape.id,status:profile.kind,kind:profile.kind,diameterMm:profile.kind==='circle'?profile.width:null,widthMm:profile.width,heightMm:profile.height,center:center.toArray(),normal:normal.toArray(),rim:(nearUpper?profile.rimB:profile.rimA).map(p=>world(p).toArray()),label:profile.kind==='circle'?`⌀ ${profile.width.toFixed(2)} мм`:`${profile.width.toFixed(2)} × ${profile.height.toFixed(2)} мм`};}

      const selected = selectedHoleRef.current;
      if (!selected) return null;
      const mesh = shapeMesh(selected.shapeId);
      if (!mesh || mesh.geometry !== selected.geometry) return { shapeId: selected.shapeId, status: "stale", reason: "Геометрия изменилась, выберите отверстие заново" };
      return { shapeId: selected.shapeId, ...measureCircularHole(mesh, selected.hole) };
    };
    const annotationTimer = window.setInterval(() => {
      if (shapesRef.current.some(s => s.faceAnnotations?.length)) setFaceReadings(readFaces().annotations);
      else setFaceReadings(previous => previous.length ? [] : previous);
      const selected = window.scketch3dwebReadSelectedHole?.() as ReturnType<typeof measureCircularHole> | null;
      if (selected?.rim) {
        const screen = projectToScreen(new THREE.Vector3(...selected.center as [number,number,number]), state);
        setSelectedHoleOverlay({ label: selected.label, x: screen.x, y: screen.y, points: [...selected.rim, selected.rim[0]].map(p => { const s=projectToScreen(new THREE.Vector3(...p as [number,number,number]), state); return `${s.x},${s.y}`; }).join(" ") });
      } else setSelectedHoleOverlay(null);
    }, 250);

    window.scketch3dwebCaptureCanvas = () => {
      state.camera.updateMatrixWorld();
      state.renderer.render(state.scene, state.camera);
      return state.renderer.domElement.toDataURL("image/png");
    };
    window.scketch3dwebCaptureCanvasAsync = () => {
      state.camera.updateMatrixWorld();
      state.renderer.render(state.scene, state.camera);
      return thumbnailPngDataUrl(state.renderer.domElement);
    };
    window.scketch3dwebCaptureView = (face = "current", includeMeasurements = true) => {
      if (face === "home") {
        resetCamera(state);
      } else if (face !== "current") {
        setCameraToViewFace(state, face);
      }
      syncViewCube(state, viewCubeRef.current);
      state.camera.updateMatrixWorld();
      state.renderer.render(state.scene, state.camera);
      const ruler = readRulerMeasurements();
      const faces = faceLabelsVisibleRef.current ? readFaces().annotations : [];
      const selectedHole = window.scketch3dwebReadSelectedHole?.() as ReturnType<typeof measureCircularHole> | null;
      if (includeMeasurements && ((ruler.visible && ruler.points.length) || faces.length || selectedHole?.rim)) {
        const source = state.renderer.domElement;
        const canvas = document.createElement("canvas");
        canvas.width = source.width; canvas.height = source.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Unable to capture ruler overlay");
        ctx.drawImage(source, 0, 0);
        const rect = source.getBoundingClientRect();
        ctx.scale(canvas.width / rect.width, canvas.height / rect.height);
        ctx.lineWidth = 2; ctx.strokeStyle = "#159cc4"; ctx.fillStyle = "#159cc4";
        for (const segment of ruler.segments) {
          ctx.beginPath();
          segment.path.forEach((point, index) => {
            const screen = projectToScreen(new THREE.Vector3(...point), state);
            if (index === 0) ctx.moveTo(screen.x, screen.y); else ctx.lineTo(screen.x, screen.y);
          });
          ctx.stroke();
        }
        for (const point of ruler.points) {
          const screen = projectToScreen(new THREE.Vector3(...point.position), state);
          ctx.beginPath(); ctx.arc(screen.x, screen.y, 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.font = "600 13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const segment of ruler.segments) {
          const middle = rulerPolylineMidpoint(segment.path.map((p) => new THREE.Vector3(...p)));
          const screen = projectToScreen(middle, state);
          const labelWidth = ctx.measureText(segment.label).width + 14;
          ctx.fillStyle = "#ffffff"; ctx.fillRect(screen.x-labelWidth/2, screen.y-29, labelWidth, 22);
          ctx.fillStyle = "#163347"; ctx.fillText(segment.label, screen.x, screen.y-18);
        }
        const drawLabel = (text: string, x: number, y: number, color = "#173b60") => {
          const width=ctx.measureText(text).width+14;
          ctx.fillStyle="#ffffff";ctx.fillRect(x-width/2,y-27,width,22);ctx.fillStyle=color;ctx.fillText(text,x,y-16);
        };
        for (const face of faces) if(face.status==="valid" && face.screen?.visible) drawLabel(face.label,face.screen.x,face.screen.y);
        if(selectedHole?.rim){
          ctx.beginPath();ctx.strokeStyle="#ff8400";ctx.lineWidth=3;
          [...selectedHole.rim,selectedHole.rim[0]].forEach((p,i)=>{const s=projectToScreen(new THREE.Vector3(...p as [number,number,number]),state);if(i)ctx.lineTo(s.x,s.y);else ctx.moveTo(s.x,s.y);});ctx.stroke();
          const s=projectToScreen(new THREE.Vector3(...selectedHole.center as [number,number,number]),state);drawLabel(selectedHole.label,s.x,s.y,"#863f00");
        }
        return canvas.toDataURL("image/png");
      }
      return state.renderer.domElement.toDataURL("image/png");
    };
    perfRef.current.lastSample = performance.now();
    resetCamera(state);
    rebuildShapes(state, shapesRef.current, renderSelectionIds(), true, false, placementWorkplaneRef.current);

    const animate = () => {
      state.animationId = window.requestAnimationFrame(animate);
      const now = performance.now();
      const controlsChanged = state.controls.update();
      if (state.cameraPanReturn && updateCameraPanReturn(state.cameraPanReturn, state.camera, state.controls.target)) state.needsRender = true;
      const cameraSettled = state.wasCameraMoving && !controlsChanged;
      if (!controlsChanged && !state.needsRender && !cameraSettled) {
        return;
      }
      constrainCamera(state, workspaceRef.current);
      // Future edits: keep this before any view cube or transform-overlay projection.
      // OrbitControls changes camera position/quaternion, but manual Vector3.project()
      // can read the previous matrix unless we force the matrix world current here.
      // Removing this brings back the one-frame-late handle/line lag during camera motion.
      state.camera.updateMatrixWorld();
      if (now - state.lastViewCubeSync > 48 || cameraSettled || state.needsRender) {
        syncViewCube(state, viewCubeRef.current);
        state.lastViewCubeSync = now;
      }
      if (controlsChanged || cameraSettled || state.needsRender || now - state.lastOverlaySync > 96) {
        const previewShapes = previewShapesForDrag(shapesRef.current, dragRef.current);
        syncTransformOverlay(
          state,
          previewShapes,
          renderSelectionIds(),
          transformOverlayRef,
          setTransformOverlay,
          workspaceRef.current.accuracy,
          Boolean(transformRef.current || dragRef.current),
          false,
          placementWorkplaneRef.current,
          resolvedThemeRef.current,
        );
        syncAlignOverlay(state, alignReferenceShapesRef.current, selectedIdsRef.current, alignModeRef.current, alignAnchorIdRef.current, alignHandlesRef.current, alignOverlayRef, setAlignOverlay);
        syncMirrorOverlay(state, mirrorReferenceShapesRef.current, selectedIdsRef.current, mirrorModeRef.current, mirrorOverlayRef, setMirrorOverlay);
        syncRulerOverlay(state, rulerModelRef.current, rulerOverlayRef, setRulerOverlay, workspaceRef.current.accuracy);
        syncMoveDimensionOverlay(
          state,
          moveDimensionSessionRef.current,
          moveDimensionOverlayRef,
          setMoveDimensionOverlay,
          workspaceRef.current.accuracy,
          resolvedThemeRef.current,
        );
        state.lastOverlaySync = now;
      }
      for(const record of paintOverlaysRef.current) {record.surface.updateWorldMatrix(true,false);record.group.matrix.copy(record.surface.matrixWorld);}
      const renderStart = performance.now();
      state.renderer.render(state.scene, state.camera);
      const frameMs = performance.now() - renderStart;
      const perf = perfRef.current;
      perf.frameMs = frameMs;
      perf.maxFrameMs = Math.max(perf.maxFrameMs, frameMs);
      perf.frames += 1;
      if (now - perf.lastSample >= 1000) {
        perf.fps = (perf.frames * 1000) / Math.max(1, now - perf.lastSample);
        perf.frames = 0;
        perf.lastSample = now;
        perf.maxFrameMs = frameMs;
      }
      state.wasCameraMoving = controlsChanged;
      state.needsRender = false;
    };

    animate();
    window.addEventListener("resize", state.resize);

    return () => {
      window.cancelAnimationFrame(state.animationId);
      window.removeEventListener("resize", state.resize);
      state.disposeInteractionListeners();
      state.controls.dispose();
      disposeChildren(state.workplaneLayer);
      if (state.workplanePreviewLayer) {
        disposeChildren(state.workplanePreviewLayer);
      }
      disposeChildren(state.shapeLayer);
      state.shapeRecords.clear();
      disposeChildren(state.helperLayer);
      disposeChildren(state.transformGuideLayer);
      disposeChildren(state.moveDimensionLayer);
      disposeChildren(state.modifierLayer);
      state.renderer.dispose();
      host.replaceChildren();
      if (window.scketch3dwebCaptureCanvas) {
        delete window.scketch3dwebCaptureCanvas;
      }
      if (window.scketch3dwebCaptureCanvasAsync) {
        delete window.scketch3dwebCaptureCanvasAsync;
      }
      if (window.scketch3dwebCaptureView) {
        delete window.scketch3dwebCaptureView;
      }
      if (window.scketch3dwebReadRulerMeasurements === readRulerMeasurements) delete window.scketch3dwebReadRulerMeasurements;
      if (faceHighlightRef.current) { disposeFaceSelectionHighlight(faceHighlightRef.current.group); faceHighlightRef.current = null; }
      window.clearInterval(annotationTimer);
      delete window.scketch3dwebReadFaceAnnotations;
      delete window.scketch3dwebReadSelectedHole;
      delete window.scketch3dwebReadHoleEditor;
      threeRef.current = null;
    };
  }, []);

  const framedProjectRef = useRef<string | null>(null);
  const frameOnOpenRef = useRef(autoFrameOnOpen);frameOnOpenRef.current=autoFrameOnOpen;
  useEffect(()=>{
    const state=threeRef.current,key=workspaceSettingsKey??"local-workplane";
    if(!state)return;
    if(!autoFrameOnOpen){state.framedSceneBounds=undefined;return;}
    if(framedProjectRef.current===key||shapes.length===0)return;
    const timer=window.requestAnimationFrame(()=>{
      if(frameScene(state)){framedProjectRef.current=key;state.needsRender=true;}
    });
    return ()=>window.cancelAnimationFrame(timer);
  },[autoFrameOnOpen,shapes,workspaceSettingsKey]);


  useEffect(() => {
    const state = threeRef.current;
    if (!state) {
      return;
    }
    const visible = !workplaneMode
      && !alignMode
      && !mirrorMode
      && !rulerMode
      && !rulerDeleteMode
      && !rulerMoveMode
      && !modifierActive
      && activeTransformKind !== "rotate";
    if (state.transformGuideLayer.visible !== visible) {
      state.transformGuideLayer.visible = visible;
      state.needsRender = true;
    }
  }, [activeTransformKind, alignMode, mirrorMode, modifierActive, rulerDeleteMode, rulerMode, rulerMoveMode, workplaneMode]);

  useEffect(() => {
    window.scketch3dwebPerf = {
      get: () => {
        const state = threeRef.current;
        const info = state?.renderer.info.render;
        return {
          fps: Number(perfRef.current.fps.toFixed(1)),
          frameMs: Number(perfRef.current.frameMs.toFixed(2)),
          maxFrameMs: Number(perfRef.current.maxFrameMs.toFixed(2)),
          drawCalls: info?.calls ?? 0,
          triangles: info?.triangles ?? 0,
          points: info?.points ?? 0,
          lines: info?.lines ?? 0,
          shapeCount: shapesRef.current.filter((shape) => !shape.hidden).length,
        };
      },
    };
    return () => {
      delete window.scketch3dwebPerf;
    };
  }, []);

  const toRawPlanePoint = useCallback((clientX: number, clientY: number, plane: THREE.Plane) => {
    const state = threeRef.current;
    if (!state) {
      return null;
    }

    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);

    const hit = new THREE.Vector3();
    if (!state.raycaster.ray.intersectPlane(plane, hit)) {
      return null;
    }

    return hit;
  }, []);

  const toPlanePointAtY = useCallback((clientX: number, clientY: number, planeY = 0) => {
    const state = threeRef.current;
    const hit = toRawPlanePoint(clientX, clientY, planeY === 0 ? state?.dragPlane ?? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) : new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY));
    if (!state || !hit) {
      return null;
    }

    const step = snapStep(snapRef.current);
    const bounds = workspaceRef.current;
    return {
      x: clamp(snapValue(hit.x, step), -bounds.width / 2 + 6, bounds.width / 2 - 6),
      z: clamp(snapValue(hit.z, step), -bounds.depth / 2 + 6, bounds.depth / 2 - 6),
    };
  }, [toRawPlanePoint]);
  const toPlanePoint = useCallback((clientX: number, clientY: number) => toPlanePointAtY(clientX, clientY, 0), [toPlanePointAtY]);

  const toPlacementWorkplanePoint = useCallback((clientX: number, clientY: number, workplane = placementWorkplaneRef.current) => {
    const normal = new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z);
    const origin = new THREE.Vector3(workplane.origin.x, workplane.origin.y, workplane.origin.z);
    const raw = toRawPlanePoint(clientX, clientY, new THREE.Plane(normal, -normal.dot(origin)));
    if (!raw) return null;
    const local = placementWorkplaneCoordinates(workplane, raw);
    const step = snapStep(snapRef.current);
    const bounds = workspaceRef.current;
    return placementWorkplanePoint(
      workplane,
      clamp(snapValue(local.x, step), -bounds.width / 2 + 6, bounds.width / 2 - 6),
      clamp(snapValue(local.z, step), -bounds.depth / 2 + 6, bounds.depth / 2 - 6),
    );
  }, [toRawPlanePoint]);

  const onRulersChangeRef = useRef(onRulersChange);
  onRulersChangeRef.current = onRulersChange;
  const rulerProjectRef = useRef(workspaceSettingsKey);
  useEffect(() => {
    const restored = restoreRulerState(initialRulers);
    if (rulerProjectRef.current === workspaceSettingsKey && JSON.stringify(restoreRulerState(rulerModelRef.current)) === JSON.stringify(restored)) return;
    rulerProjectRef.current = workspaceSettingsKey;
    rulerPointDragRef.current = null; rulerDragBeforeRef.current = null;
    const next = {...restored,startPointId:null,hover:null};
    rulerModelRef.current = next; setRulerModel(next);
  }, [initialRulers,workspaceSettingsKey]);
  const storeRulerModel = useCallback((next: RulerModel) => {
    const previous = restoreRulerState(rulerModelRef.current), durable = restoreRulerState(next);
    rulerModelRef.current = next;
    setRulerModel(next);
    if (JSON.stringify(previous) !== JSON.stringify(durable)) onRulersChangeRef.current?.(durable);
  }, []);

  const commitRulerModel = useCallback((next: RulerModel, before = rulerModelRef.current) => {
    const snapshot = (model: RulerModel): RulerModel => ({ ...model, hover: null });
    const previous = snapshot(before), after = snapshot(next);
    storeRulerModel(next);
    if (JSON.stringify(previous) === JSON.stringify(after)) return;
    const restore = (model: RulerModel) => {
      rulerPointDragRef.current = null;rulerDragBeforeRef.current = null;
      storeRulerModel({ ...model, startPointId: rulerModeRef.current ? model.startPointId : null, hover: null });
    };
    onRulerAction?.({ undo: () => restore(previous), redo: () => restore(after) });
  }, [onRulerAction, storeRulerModel]);

  useEffect(() => {
    const current = rulerModelRef.current;
    const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));
    const shapeIds = new Set(shapeById.keys());
    const state = threeRef.current;
    const removedPointIds = new Set<string>();
    let metadataChanged = false;
    const updatedPoints = current.points.map((point) => {
      if (!point.attachment) return point;
      const attachedShape = shapeById.get(point.attachment.shapeId);
      if (!attachedShape || (state && !attachedShape.hidden && !rulerAttachmentMatchesTopology(state, point.attachment))) {
        removedPointIds.add(point.id);
        return point;
      }
      const object = state ? findShapeObject(state, point.attachment.shapeId) : null;
      const topologyKey = object?.userData.rulerTopologyKey as string | undefined;
      if (topologyKey && topologyKey !== point.attachment.topologyKey) {
        metadataChanged = true;
        return { ...point, attachment: { ...point.attachment, topologyKey } };
      }
      return point;
    });
    const invalidEdgeSegments = new Set<string>();
    const updatedSegments = current.segments.map((segment) => {
      if (!segment.edge) return segment;
      const attachedShape = shapeById.get(segment.edge.shapeId);
      if (!attachedShape || (state && !attachedShape.hidden && !rulerEdgeMatchesTopology(state, segment.edge))) {
        invalidEdgeSegments.add(segment.id);
        return segment;
      }
      const object = state ? findShapeObject(state, segment.edge.shapeId) : null;
      const topologyKey = object?.userData.rulerTopologyKey as string | undefined;
      if (topologyKey && topologyKey !== segment.edge.topologyKey) {
        metadataChanged = true;
        return { ...segment, edge: { ...segment.edge, topologyKey } };
      }
      return segment;
    });
    const provisionalSegments = updatedSegments.filter((segment) => (
      !removedPointIds.has(segment.startId)
      && !removedPointIds.has(segment.endId)
      && !invalidEdgeSegments.has(segment.id)
    ));
    current.segments.filter((segment) => invalidEdgeSegments.has(segment.id)).forEach((segment) => {
      [segment.startId, segment.endId].forEach((pointId) => {
        if (!provisionalSegments.some((candidate) => candidate.startId === pointId || candidate.endId === pointId)) removedPointIds.add(pointId);
      });
    });
    const segments = provisionalSegments.filter((segment) => !removedPointIds.has(segment.startId) && !removedPointIds.has(segment.endId));
    const points = updatedPoints.filter((point) => !removedPointIds.has(point.id));
    const hoverRemoved = Boolean(current.hover?.attachment && (
      !shapeIds.has(current.hover.attachment.shapeId)
      || (state && !shapeById.get(current.hover.attachment.shapeId)?.hidden && !rulerAttachmentMatchesTopology(state, current.hover.attachment))
    ));
    if (removedPointIds.size === 0 && invalidEdgeSegments.size === 0 && !hoverRemoved && !metadataChanged) return;
    if (rulerPointDragRef.current && removedPointIds.has(rulerPointDragRef.current.pointId)) rulerPointDragRef.current = null;
    storeRulerModel({
      points,
      segments,
      startPointId: current.startPointId && !removedPointIds.has(current.startPointId) ? current.startPointId : null,
      hover: hoverRemoved ? null : current.hover,
    });
  }, [shapes, storeRulerModel]);

  const setRulerActive = useCallback((active: boolean) => {
    rulerModeRef.current = active;
    setRulerMode(active);
    if (!active) {
      const current = rulerModelRef.current;
      storeRulerModel({ ...current, startPointId: null, hover: null });
    }
  }, [storeRulerModel]);

  useEffect(() => {
    if (cameraPanMode && (rulerMode || rulerMoveMode || rulerDeleteMode || faceMode || paintMode || workplaneMode || modifierActive)) setCameraPanMode(false);
    if (threeRef.current) threeRef.current.cameraPanMode = cameraPanMode;
  }, [cameraPanMode, rulerMode, rulerMoveMode, rulerDeleteMode, faceMode, paintMode, workplaneMode, modifierActive]);

  useEffect(() => { if(paintMode && (rulerMode || rulerMoveMode || rulerDeleteMode || faceMode || workplaneMode || modifierActive)) setPaintMode(false); }, [paintMode,rulerMode,rulerMoveMode,rulerDeleteMode,faceMode,workplaneMode,modifierActive]);
  useEffect(() => {
    const state=threeRef.current;if(!state)return;
    const overlays: typeof paintOverlaysRef.current=[];
    for(const shape of shapes) if(!shape.hidden) for(const paint of shape.facePaints ?? []) {
      let surface: THREE.Mesh<THREE.BufferGeometry> | null=null;
      findShapeObject(state,shape.id)?.traverse(object=>{if(!surface && object instanceof THREE.Mesh && faceGeometryKey(object.geometry)===paint.geometryKey)surface=object;});
      if(!surface)continue;
      const group=createFacePaint(surface,paint);setObjectRenderLayer(group,RENDER_LAYER_PREVIEWS);state.scene.add(group);overlays.push({surface,group});
    }
    paintOverlaysRef.current=overlays;state.needsRender=true;
    return()=>{for(const record of overlays)disposeFaceSelectionHighlight(record.group);paintOverlaysRef.current=[];};
  },[shapes]);

  const resolveRulerCandidate = useCallback(
    (clientX: number, clientY: number, ignoredPointId?: string): RulerCandidate | null => {
      const state = threeRef.current;
      if (!state) return null;

      const model = rulerModelRef.current;
      const rect = state.renderer.domElement.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const closestPoint = model.points.reduce<{ point: RulerPoint; distance: number } | null>((closest, point) => {
        if (point.id === ignoredPointId) return closest;
        const screen = projectToScreen(rulerPointWorld(state, point), state);
        const distance = Math.hypot(screen.x - localX, screen.y - localY);
        if (distance <= 12 && (!closest || distance < closest.distance)) {
          return { point, distance };
        }
        return closest;
      }, null);
      if (closestPoint) {
        const world = rulerPointWorld(state, closestPoint.point);
        return { x: world.x, y: world.y, z: world.z, pointId: closestPoint.point.id, attachment: closestPoint.point.attachment };
      }

      const closestSegment = model.segments.reduce<{ world: THREE.Vector3; distance: number } | null>((closest, segment) => {
        if (segment.startId === ignoredPointId || segment.endId === ignoredPointId) return closest;
        const start = model.points.find((point) => point.id === segment.startId);
        const end = model.points.find((point) => point.id === segment.endId);
        if (!start || !end) return closest;
        const edgePoints = segment.edge ? rulerEdgeWorldPoints(state, segment.edge) : [];
        const worldPoints = edgePoints.length >= 2 ? edgePoints : [rulerPointWorld(state, start), rulerPointWorld(state, end)];
        for (let index = 0; index + 1 < worldPoints.length; index += 1) {
          const a = projectToScreen(worldPoints[index], state);
          const b = projectToScreen(worldPoints[index + 1], state);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const amount = dx * dx + dy * dy > 0.001 ? clamp(((localX - a.x) * dx + (localY - a.y) * dy) / (dx * dx + dy * dy), 0, 1) : 0;
          const distance = Math.hypot(localX - (a.x + dx * amount), localY - (a.y + dy * amount));
          if (distance <= 10 && (!closest || distance < closest.distance)) {
            closest = { world: worldPoints[index].clone().lerp(worldPoints[index + 1], amount), distance };
          }
        }
        return closest;
      }, null);

      if (closestSegment) {
        const existing = model.points.find((point) => rulerPointWorld(state, point).distanceTo(closestSegment.world) < 0.001);
        return { x: closestSegment.world.x, y: closestSegment.world.y, z: closestSegment.world.z, pointId: existing?.id };
      }

      const selectedShapeIds = selectedIdsRef.current.filter((id) => shapesRef.current.some((shape) => shape.id === id && !shape.hidden));
      const targetShapeIds = selectedShapeIds.length > 0 ? selectedShapeIds : shapesRef.current.filter((shape) => !shape.hidden).map((shape) => shape.id);
      const modelCandidate = pickModelRulerCandidate(state, targetShapeIds, clientX, clientY);
      if (modelCandidate) return modelCandidate;

      const raw = toRawPlanePoint(clientX, clientY, state.dragPlane);
      if (!raw) return null;
      const step = snapStep(snapRef.current);
      const bounds = workspaceRef.current;
      const snapped = {
        x: clamp(snapValue(raw.x, step), -bounds.width / 2, bounds.width / 2),
        y: 0,
        z: clamp(snapValue(raw.z, step), -bounds.depth / 2, bounds.depth / 2),
      };
      const existing = model.points.find((point) => Math.hypot(point.x - snapped.x, point.y, point.z - snapped.z) < 0.001 && !point.attachment);
      return { ...snapped, pointId: existing?.id };
    },
    [toRawPlanePoint],
  );

  const constrainRulerCandidate = useCallback((candidate: RulerCandidate, startId?: string): RulerCandidate => {
    const state = threeRef.current;
    const start = rulerModelRef.current.points.find((point) => point.id === (startId ?? rulerModelRef.current.startPointId));
    if (!rulerShiftRef.current || !state || !start) return candidate;
    const origin = rulerPointWorld(state, start);
    const x = candidate.x;
    const z = candidate.z;
    if (Math.hypot(x - candidate.x, origin.y - candidate.y, z - candidate.z) < 1e-8) return candidate;
    if (candidate.attachment) {
      const target = findShapeObject(state, candidate.attachment.shapeId);
      const meshes: THREE.Mesh[] = [];
      target?.traverse(object => { if (object instanceof THREE.Mesh && object.visible && object.layers.isEnabled(RENDER_LAYER_SHAPES)) meshes.push(object); });
      const plane = candidate.surfacePlane ?? rulerAttachmentPlane(state, candidate.attachment);
      const point = snapRulerAxisToSurface(origin, new THREE.Vector3(candidate.x, candidate.y, candidate.z), meshes, plane);
      // A face that the horizontal axis misses still wins over an unattached virtual point.
      if (!point) return candidate;
      const attachment = rulerAttachmentFromWorld(state, candidate.attachment.shapeId, point, "surface", plane?.normal);
      return attachment ? { x: point.x, y: point.y, z: point.z, attachment, surfacePlane: plane } : candidate;
    }
    return { x, y: origin.y, z };
  }, []);

  const updateRulerPointDrag = useCallback((clientX: number, clientY: number, shiftKey: boolean) => {
    const drag=rulerPointDragRef.current,state=threeRef.current;
    if(!drag || !state || !rulerMoveModeRef.current)return;
    drag.clientX=clientX;drag.clientY=clientY;rulerShiftRef.current=shiftKey;
    const current=rulerModelRef.current;
    const point=current.points.find(point=>point.id===drag.pointId);
    if(!point)return;
    let candidate=resolveRulerCandidate(clientX,clientY,point.id);
    if(shiftKey && candidate) {
      const segment=[...current.segments].reverse().find(segment=>segment.startId===point.id || segment.endId===point.id);
      const anchorId=segment ? (segment.startId===point.id ? segment.endId : segment.startId) : undefined;
      if(anchorId && anchorId!==point.id)candidate=constrainRulerCandidate(candidate,anchorId);
    }
    if(!candidate)return;
    storeRulerModel({...current,points:current.points.map(value=>value.id===point.id ? {...value,x:candidate.x,y:candidate.y,z:candidate.z,attachment:candidate.attachment} : value),
      segments:current.segments.map(segment=>segment.startId===point.id || segment.endId===point.id ? {...segment,edge:undefined} : segment),hover:candidate});
  },[constrainRulerCandidate,resolveRulerCandidate,storeRulerModel]);

  const selectRulerCandidate = useCallback(
    (rawCandidate: RulerCandidate) => {
      const candidate = constrainRulerCandidate(rawCandidate);
      const current = rulerModelRef.current;
      const sameAttachment = (point: RulerPoint, attachment: RulerAttachment | undefined) => Boolean(
        attachment
        && point.attachment?.shapeId === attachment.shapeId
        && Math.hypot(
          point.attachment.normalized[0] - attachment.normalized[0],
          point.attachment.normalized[1] - attachment.normalized[1],
          point.attachment.normalized[2] - attachment.normalized[2],
        ) < 1e-5,
      );
      const findExisting = (value: Pick<RulerCandidate, "x" | "y" | "z" | "pointId" | "attachment">) => value.pointId
        ? current.points.find((point) => point.id === value.pointId)
        : current.points.find((point) => sameAttachment(point, value.attachment) || (!point.attachment && !value.attachment && Math.hypot(point.x - value.x, point.y - value.y, point.z - value.z) < 0.001));
      const makePoint = (value: Pick<RulerCandidate, "x" | "y" | "z" | "pointId" | "attachment">) => findExisting(value) ?? {
        id: `ruler-point-${++rulerIdRef.current}`,
        x: value.x,
        y: value.y,
        z: value.z,
        attachment: value.attachment,
      };

      if (candidate.edge && !current.startPointId) {
        const state = threeRef.current;
        const worldPoints = state ? rulerEdgeWorldPoints(state, candidate.edge) : [];
        if (worldPoints.length >= 2) {
          const firstAttachment: RulerAttachment = {
            shapeId: candidate.edge.shapeId,
            normalized: candidate.edge.normalizedPoints[0],
            kind: "vertex",
            topologyKey: candidate.edge.topologyKey,
          };
          const lastAttachment: RulerAttachment = {
            shapeId: candidate.edge.shapeId,
            normalized: candidate.edge.normalizedPoints[candidate.edge.normalizedPoints.length - 1],
            kind: "vertex",
            topologyKey: candidate.edge.topologyKey,
          };
          const start = makePoint({ x: worldPoints[0].x, y: worldPoints[0].y, z: worldPoints[0].z, attachment: firstAttachment });
          const endWorld = worldPoints[worldPoints.length - 1];
          const end = makePoint({ x: endWorld.x, y: endWorld.y, z: endWorld.z, attachment: lastAttachment });
          const points = [...current.points];
          if (!points.some((point) => point.id === start.id)) points.push(start);
          if (!points.some((point) => point.id === end.id)) points.push(end);
          const duplicate = current.segments.some((segment) => segment.edge?.key === candidate.edge?.key);
          const segments = duplicate ? current.segments : [...current.segments, {
            id: `ruler-segment-${++rulerIdRef.current}`,
            startId: start.id,
            endId: end.id,
            edge: candidate.edge,
          }];
          commitRulerModel({ points, segments, startPointId: null, hover: null });
          return;
        }
      }

      const existing = findExisting(candidate);
      const point = existing ?? makePoint(candidate);
      const points = existing ? current.points : [...current.points, point];
      if (!current.startPointId) {
        commitRulerModel({ ...current, points, startPointId: point.id, hover: { x: point.x, y: point.y, z: point.z, attachment: point.attachment } });
        return;
      }
      if (current.startPointId === point.id) {
        return;
      }

      const duplicate = current.segments.some(
        (segment) =>
          (segment.startId === current.startPointId && segment.endId === point.id) ||
          (segment.startId === point.id && segment.endId === current.startPointId),
      );
      const segments = duplicate
        ? current.segments
        : [...current.segments, { id: `ruler-segment-${++rulerIdRef.current}`, startId: current.startPointId, endId: point.id }];
      commitRulerModel({ points, segments, startPointId: null, hover: null });
    },
    [commitRulerModel, constrainRulerCandidate],
  );

  const updateRulerHover = useCallback(
    (clientX: number, clientY: number, shiftKey = rulerShiftRef.current) => {
      rulerPointerRef.current = { x: clientX, y: clientY };
      rulerShiftRef.current = shiftKey;
      if (!rulerModeRef.current) {
        return;
      }
      const candidate = resolveRulerCandidate(clientX, clientY);
      const current = rulerModelRef.current;
      const hover = candidate ? constrainRulerCandidate(candidate) : null;
      if ((!current.hover && !hover) || (current.hover && hover
        && current.hover.edge?.key === hover.edge?.key
        && Math.hypot(current.hover.x - hover.x, current.hover.y - hover.y, current.hover.z - hover.z) < 0.0001)) {
        return;
      }
      storeRulerModel({ ...current, hover });
    },
    [constrainRulerCandidate, resolveRulerCandidate, storeRulerModel],
  );

  const rulerHoverFrameRef=useRef<number|null>(null),pendingRulerHoverRef=useRef<{x:number;y:number;shift:boolean}|null>(null);
  const scheduleRulerHover=useCallback((x:number,y:number,shift:boolean)=>{
    pendingRulerHoverRef.current={x,y,shift};
    if(rulerHoverFrameRef.current!==null)return;
    rulerHoverFrameRef.current=window.requestAnimationFrame(()=>{rulerHoverFrameRef.current=null;const p=pendingRulerHoverRef.current;if(p)updateRulerHover(p.x,p.y,p.shift);});
  },[updateRulerHover]);
  useEffect(()=>()=>{if(rulerHoverFrameRef.current!==null)window.cancelAnimationFrame(rulerHoverFrameRef.current);},[]);

  const removeRulerSegment = useCallback(
    (segmentId: string) => {
      const current = rulerModelRef.current;
      const segments = current.segments.filter((segment) => segment.id !== segmentId);
      const usedPointIds = new Set(segments.flatMap((segment) => [segment.startId, segment.endId]));
      const points = current.points.filter((point) => usedPointIds.has(point.id) || point.id === current.startPointId);
      commitRulerModel({ ...current, points, segments });
    },
    [commitRulerModel],
  );

  useEffect(() => {
    const updateShift = (event: KeyboardEvent) => {
      if (event.key !== "Shift") return;
      if (event.ctrlKey || event.metaKey) { rulerShiftRef.current = false;return; }
      rulerShiftRef.current = event.type === "keydown";
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      const drag=rulerPointDragRef.current;
      if(!typing && drag && rulerMoveModeRef.current) {updateRulerPointDrag(drag.clientX,drag.clientY,rulerShiftRef.current);return;}
      const model = rulerModelRef.current;
      if (!typing && !event.repeat && event.type === "keydown" && rulerModeRef.current && !model.startPointId) {
        const segment = model.segments.at(-1);
        const end = segment && !segment.edge ? model.points.find(point => point.id === segment.endId) : null;
        const state = threeRef.current;
        if (segment && end && state) {
          const world = rulerPointWorld(state, end);
          const adjusted = constrainRulerCandidate({ x: world.x, y: world.y, z: world.z, attachment: end.attachment }, segment.startId);
          commitRulerModel({ ...model, points: model.points.map(point => point.id === end.id ? { ...point, x: adjusted.x, y: adjusted.y, z: adjusted.z, attachment: adjusted.attachment } : point) });
        }
      }
      const pointer = rulerPointerRef.current;
      if (pointer && rulerModeRef.current) updateRulerHover(pointer.x, pointer.y, rulerShiftRef.current);
    };
    const clearShift = () => {
      rulerShiftRef.current = false;
      const pointer = rulerPointerRef.current;
      if (pointer && rulerModeRef.current) updateRulerHover(pointer.x, pointer.y, false);
    };
    window.addEventListener("keydown", updateShift);
    window.addEventListener("keyup", updateShift);
    window.addEventListener("blur", clearShift);
    return () => {
      window.removeEventListener("keydown", updateShift);
      window.removeEventListener("keyup", updateShift);
      window.removeEventListener("blur", clearShift);
    };
  }, [commitRulerModel, constrainRulerCandidate, updateRulerHover, updateRulerPointDrag]);

  const removeRulerPoint = useCallback(
    (pointId: string) => {
      const current = rulerModelRef.current;
      const segments = current.segments.filter((segment) => segment.startId !== pointId && segment.endId !== pointId);
      const points = current.points.filter((point) => point.id !== pointId);
      commitRulerModel({
        ...current,
        points,
        segments,
        startPointId: current.startPointId === pointId ? null : current.startPointId,
      });
    },
    [commitRulerModel],
  );

  const setMarqueeFromState = useCallback((marquee: MarqueeState | null) => {
    if (!marquee) {
      setMarqueeRect(null);
      return;
    }
    const left = Math.min(marquee.startX, marquee.currentX);
    const top = Math.min(marquee.startY, marquee.currentY);
    setMarqueeRect({
      left,
      top,
      width: Math.abs(marquee.currentX - marquee.startX),
      height: Math.abs(marquee.currentY - marquee.startY),
    });
  }, []);

  const shapesInMarquee = useCallback((rect: { left: number; top: number; right: number; bottom: number }) => {
    const state = threeRef.current;
    if (!state) {
      return [];
    }
    return shapesRef.current
      .filter((shape) => !shape.hidden)
      .filter((shape) => !shape.imagePlate)
      .filter((shape) => {
        const bounds = shapeScreenBounds(state, shape);
        return bounds ? boundsIntersectRect(bounds, rect) : false;
      })
      .map((shape) => shape.id);
  }, []);

  const beginTransform = useCallback(
    (kind: TransformHandleKind, handleKey: string, event: ReactPointerEvent<Element>) => {
      if (event.button !== 0) {
        return;
      }
      clearMoveDimensions();
      const ids = selectedIdsRef.current;
      const activeWorkplane = placementWorkplaneRef.current;
      const frame = selectionFrameForShapes(shapesRef.current, ids, activeWorkplane);
      const shape = frame?.singleShape ?? shapesRef.current.find((entry) => entry.id === ids[0]);
      if (!frame || !shape || ids.length === 0 || ids.some((id) => shapesRef.current.find((entry) => entry.id === id)?.locked)) {
        return;
      }

      const rotationAxis = rotationAxisForHandle(handleKey);
      const resizeHandleKey = handleKey;
      const state = threeRef.current;
      const yBounds = selectionWorldYBounds(frame);
      const handlesLowerSide = handleKey === "bottom-height" || handleKey === "lower-shape";
      const liftOffset = kind === "lift" ? Math.max(2, frame.height * 0.08) * (handlesLowerSide ? -1 : 1) : 0;
      const overlay = transformOverlayRef.current;
      const wheel = kind === "rotate" ? (overlay?.rotationWheels[rotationAxis] ?? overlay?.rotationWheel ?? undefined) : undefined;
      const rotationPlane = kind === "rotate" ? overlay?.rotationPlanes[rotationAxis] : undefined;
      const rotationPlaneCenterData = kind === "rotate" ? overlay?.rotationPlaneCenters[rotationAxis] : undefined;
      const rotationPlaneCenter = rotationPlaneCenterData
        ? new THREE.Vector3(rotationPlaneCenterData.x, rotationPlaneCenterData.y, rotationPlaneCenterData.z)
        : frame.center.clone();
      const rect = state?.renderer.domElement.getBoundingClientRect();
      const localClientX = rect ? event.clientX - rect.left : event.clientX;
      const localClientY = rect ? event.clientY - rect.top : event.clientY;
      const axisVector = rotationAxisVectorForFrame(handleKey, frame);
      const pivot = frame.center.clone();
      const rotationCenter = kind === "rotate" ? wheel ?? (state ? projectToScreen(pivot, state) : { x: localClientX, y: localClientY }) : undefined;
      const rotationStartPoint = kind === "rotate" && state ? rayPointOnRotationPlane(state, event.clientX, event.clientY, rotationPlaneCenter, axisVector) : null;
      const rotationStartVector = rotationStartPoint ? rotationStartPoint.sub(rotationPlaneCenter) : undefined;
      const rotationStartPointerAngle = kind === "rotate"
        ? rotationPlanePointerAngle(rotationPlane, localClientX, localClientY, rotationCenter ?? { x: localClientX, y: localClientY })
        : undefined;
      const scalePlane = kind === "scale"
        ? localResizePlaneForFrame(frame, workplaneFootprintY(frame, activeWorkplane))
        : undefined;
      const scaleStartPoint = scalePlane ? toRawPlanePoint(event.clientX, event.clientY, scalePlane) ?? undefined : undefined;
      const scaleSigns = kind === "scale" ? resizeSignsForHandle(resizeHandleKey) : undefined;
      const scaleAnchorPoint = kind === "scale" && scaleSigns ? resizeAnchorPointForFrame(frame, scaleSigns) : undefined;
      const liftAxis = kind === "lift" || kind === "height" ? frame.yAxis.clone().normalize() : undefined;
      const liftHandlePoint = liftAxis
        ? framePoint(frame, 0, handlesLowerSide ? frame.min.y : frame.max.y, 0).addScaledVector(liftAxis, liftOffset)
        : undefined;
      const liftPlane = state && liftAxis && liftHandlePoint
        ? axisDragPlaneForCamera(state, liftAxis, liftHandlePoint)
        : undefined;
      const liftStartPoint = liftPlane ? toRawPlanePoint(event.clientX, event.clientY, liftPlane) ?? undefined : undefined;
      const liftStartValue = kind === "lift"
        ? workplaneFootprintY(frame, activeWorkplane) - workplaneYForFrame(frame, activeWorkplane)
        : undefined;
      if (kind === "scale" && !scaleStartPoint) {
        return;
      }
      if ((kind === "lift" || kind === "height") && !liftStartPoint) {
        return;
      }
      rememberResizeAnchor(shape.id, kind, resizeHandleKey);
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setEditingRotation(null);
      setPinnedMeasureKey(measureKeyForHandle(kind, handleKey, transformOverlayRef.current));
      if (kind === "height") {
        setHoverMeasureKey(null);
      }
      setActiveRotationWheel(kind === "rotate");
      setActiveTransformKind(kind);
      setSelectionHelpersVisible(state ?? null, kind !== "rotate");
      if (kind === "rotate") {
        setRotationWheelAxis(rotationAxis);
        setPinnedRotationWheelView(wheel && rotationPlane ? { axis: rotationAxis, wheel: { ...wheel }, plane: { ...rotationPlane } } : null);
      } else {
        setPinnedRotationWheelView(null);
      }
      transformRef.current = {
        id: shape.id,
        ids: frame.ids,
        kind,
        handleKey: resizeHandleKey,
        rotationAxis,
        pointerId: event.pointerId,
        startShape: { ...shape },
        items: frame.ids
          .map((id) => shapesRef.current.find((entry) => entry.id === id))
          .filter((entry): entry is WorkplaneShape => Boolean(entry))
          .map((entry) => ({
            id: entry.id,
            startShape: { ...entry },
            startCenter: shapeCenter(entry),
            startQuaternion: quaternionForShape(entry),
          })),
        selectionFrame: frame,
        startScreenAngle: rotationCenter ? screenAngle(localClientX, localClientY, rotationCenter) : 0,
        startClientX: event.clientX,
        startClientY: event.clientY,
        scalePlaneY: kind === "scale" ? yBounds.min : 0,
        scalePlane,
        scaleSigns,
        scaleAnchorPoint,
        scaleStartPoint,
        liftAxis,
        liftPlane,
        liftStartPoint,
        liftHandlePoint,
        liftStartValue,
        rotationAxisVector: kind === "rotate" ? axisVector : undefined,
        rotationPivot: kind === "rotate" ? pivot : undefined,
        rotationPlaneCenter: kind === "rotate" ? rotationPlaneCenter : undefined,
        rotationPlaneView: kind === "rotate" ? rotationPlane : undefined,
        rotationStartPointerAngle,
        rotationStartVector: kind === "rotate" ? rotationStartVector : undefined,
        rotationScreenCenter: rotationCenter,
        rotationScreenSign: kind === "rotate" && state ? rotationScreenSign(axisVector, state.camera) : 1,
        rotationStartQuaternion: kind === "rotate" ? quaternionForShape(shape) : undefined,
        wheelCenter: wheel,
      };
      if (kind === "rotate" && state) {
        const renderRect = state.renderer.domElement.getBoundingClientRect();
        setRotationReadout({
          x: event.clientX - renderRect.left + 18,
          y: event.clientY - renderRect.top - 18,
          text: `${Math.round(rotationValueForAxis(shape, rotationAxis))}°`,
          angle: 0,
          pointerAngle: rotationPlanePointerAngle(rotationPlane, localClientX, localClientY, rotationCenter ?? { x: localClientX, y: localClientY }),
        });
      } else if (kind === "lift" && state) {
        const renderRect = state.renderer.domElement.getBoundingClientRect();
        setRotationReadout({
          x: event.clientX - renderRect.left + 22,
          y: event.clientY - renderRect.top - 34,
          text: formatMeasure(liftStartValue ?? 0, workspaceRef.current.accuracy),
        });
      } else {
        setRotationReadout(null);
      }
      if (state) {
        if (kind !== "scale" && kind !== "height") {
          clearCutPreviewOverlays(state);
        }
        state.needsRender = true;
        state.controls.enabled = false;
      }
      onInteractionActiveChange?.(true);
    },
    [clearMoveDimensions, onInteractionActiveChange, rememberResizeAnchor, toRawPlanePoint],
  );

  const beginCameraDragFromOverlay = useCallback((event: ReactPointerEvent<Element>) => {
    if (event.button !== 1 && event.button !== 2 && !(event.button === 0 && cameraPanModeRef.current)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const state = threeRef.current;
    const canvas = state?.renderer.domElement;
    const PointerEventConstructor = canvas?.ownerDocument.defaultView?.PointerEvent;
    if (!canvas || !PointerEventConstructor) {
      return;
    }

    const source = event.nativeEvent;
    canvas.dispatchEvent(
      new PointerEventConstructor("pointerdown", {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: source.pointerId,
        pointerType: source.pointerType,
        isPrimary: source.isPrimary,
        button: source.button,
        buttons: source.buttons,
        clientX: source.clientX,
        clientY: source.clientY,
        screenX: source.screenX,
        screenY: source.screenY,
        ctrlKey: source.ctrlKey,
        shiftKey: source.shiftKey,
        altKey: source.altKey,
        metaKey: source.metaKey,
      }),
    );
  }, []);

  const forwardCameraWheelFromOverlay = useCallback((event: ReactWheelEvent<Element>) => {
    const state = threeRef.current;
    const canvas = state?.renderer.domElement;
    const WheelEventConstructor = canvas?.ownerDocument.defaultView?.WheelEvent;
    if (!canvas || !WheelEventConstructor) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const source = event.nativeEvent;
    canvas.dispatchEvent(
      new WheelEventConstructor("wheel", {
        bubbles: true,
        cancelable: true,
        composed: true,
        deltaX: source.deltaX,
        deltaY: source.deltaY,
        deltaZ: source.deltaZ,
        deltaMode: source.deltaMode,
        clientX: source.clientX,
        clientY: source.clientY,
        screenX: source.screenX,
        screenY: source.screenY,
        ctrlKey: source.ctrlKey,
        shiftKey: source.shiftKey,
        altKey: source.altKey,
        metaKey: source.metaKey,
      }),
    );
  }, []);

  const updateTransform = useCallback(
    (clientX: number, clientY: number, shiftKey = false, altKey = false) => {
      const transform = transformRef.current;
      if (!transform) {
        return false;
      }
      if (Math.hypot(clientX - transform.startClientX, clientY - transform.startClientY) > 3) {
        transform.hasMoved = true;
      }

      const step = snapStep(snapRef.current);
      if (transform.kind === "height") {
        const axis = (transform.liftAxis ?? transform.selectionFrame.yAxis).clone().normalize();
        const currentPoint = transform.liftPlane
          ? toRawPlanePoint(clientX, clientY, transform.liftPlane)
          : null;
        const rawDelta = currentPoint && transform.liftStartPoint
          ? currentPoint.clone().sub(transform.liftStartPoint).dot(axis)
          : 0;
        const resizingFromBottom = transform.handleKey === "bottom-height";
        const rawFrameHeight = transform.selectionFrame.height + (resizingFromBottom ? -rawDelta : rawDelta);
        const maxHeight = Math.max(...transform.items.map((item) => shapeDimensionLimit(workspaceRef.current, item.startShape.kind, 180)));
        const nextFrameHeight = clamp(
          transform.selectionFrame.height + snapValue(rawFrameHeight - transform.selectionFrame.height, step),
          MIN_SHAPE_SIZE,
          maxHeight,
        );
        transform.items.forEach((item) => {
          onUpdateShape(
            item.id,
            resizeShapeAlongFrameNormal(item.startShape, transform.selectionFrame, nextFrameHeight, resizingFromBottom),
          );
        });
        return true;
      }

      if (transform.kind === "lift") {
        const state = threeRef.current;
        const axis = (transform.liftAxis ?? transform.selectionFrame.yAxis).clone().normalize();
        const currentPoint = transform.liftPlane
          ? toRawPlanePoint(clientX, clientY, transform.liftPlane)
          : null;
        const rawDelta = currentPoint && transform.liftStartPoint
          ? currentPoint.clone().sub(transform.liftStartPoint).dot(axis)
          : 0;
        const delta = snapValue(rawDelta, step);
        transform.items.forEach((item) => {
          const nextCenter = item.startCenter.clone().addScaledVector(axis, delta);
          onUpdateShape(item.id, {
            x: cleanNearZero(nextCenter.x, 0.0005),
            z: cleanNearZero(nextCenter.z, 0.0005),
            elevation: cleanNearZero(
              clamp(nextCenter.y - item.startShape.height / 2, MIN_ELEVATION, MAX_ELEVATION),
              0.0005,
            ),
          });
        });
        if (state) {
          const readoutWorld = (transform.liftHandlePoint ?? transform.selectionFrame.center).clone().addScaledVector(axis, delta);
          const readoutPoint = projectToScreen(readoutWorld, state);
          setRotationReadout({
            x: readoutPoint.x + 28,
            y: readoutPoint.y - 30,
            text: formatMeasure((transform.liftStartValue ?? 0) + delta, workspaceRef.current.accuracy),
          });
        }
        return true;
      }

      if (transform.kind === "scale") {
        const worldPoint = transform.scalePlane ? toRawPlanePoint(clientX, clientY, transform.scalePlane) : null;
        if (!worldPoint) {
          return true;
        }
        if (transform.items.length === 1) {
          const maxSize = shapeDimensionLimit(workspaceRef.current, transform.startShape.kind, 220);
          const next = resizeShapeFromFrameHandle(transform, worldPoint, transform.handleKey, shiftKey, altKey, step, maxSize);
          onUpdateShape(transform.id, next);
        } else {
          const maxSize = Math.max(...transform.items.map((item) => shapeDimensionLimit(workspaceRef.current, item.startShape.kind, 260)));
          resizeSelectionFromHandle(transform, worldPoint, transform.handleKey, shiftKey, altKey, step, maxSize).forEach(({ id, patch }) => onUpdateShape(id, patch));
        }
        return true;
      }

      const point = toPlanePoint(clientX, clientY);
      if (!point && transform.kind !== "rotate") {
        return true;
      }

      const state = threeRef.current;
      const rotationCenter = transform.rotationScreenCenter ?? transform.wheelCenter;
      if (!state || !rotationCenter) {
        return true;
      }
      const rect = state.renderer.domElement.getBoundingClientRect();
      const localClientX = clientX - rect.left;
      const localClientY = clientY - rect.top;
      const axisVector = (transform.rotationAxisVector ?? rotationAxisVectorForFrame(transform.handleKey, transform.selectionFrame)).clone().normalize();
      const pivot = transform.rotationPivot ?? transform.selectionFrame.center;
      const planeCenter = transform.rotationPlaneCenter ?? pivot;
      const currentPoint = rayPointOnRotationPlane(state, clientX, clientY, planeCenter, axisVector);
      const rawDelta =
        currentPoint && transform.rotationStartVector && transform.rotationStartVector.lengthSq() > 0.000001
          ? THREE.MathUtils.radToDeg(signedAngleAroundAxis(transform.rotationStartVector, currentPoint.sub(planeCenter), axisVector))
          : THREE.MathUtils.radToDeg(unwrapRadians(screenAngle(localClientX, localClientY, rotationCenter) - transform.startScreenAngle)) * (transform.rotationScreenSign ?? 1);
      const localRotationPointer = rotationPlanePointerLocal(transform.rotationPlaneView, localClientX, localClientY);
      const insideSnapWheel = localRotationPointer
        ? Math.hypot(localRotationPointer.x, localRotationPointer.y) <= ROTATION_PROTRACTOR_OUTER_RADIUS
        : Boolean(
          transform.wheelCenter
          && Math.hypot(localClientX - transform.wheelCenter.x, localClientY - transform.wheelCenter.y) <= transform.wheelCenter.radius
        );
      const rawPointerAngle = rotationPlanePointerAngle(transform.rotationPlaneView, localClientX, localClientY, rotationCenter);
      const wheelSnapDegrees = shiftKey ? ROTATION_WHEEL_SHIFT_SNAP_DEGREES : ROTATION_WHEEL_SNAP_DEGREES;
      const wheelDirectionSign = transform.rotationPlaneView?.directionSign ?? (transform.rotationAxis === "z" ? 1 : -1);
      const snappedWheel = insideSnapWheel
        ? snappedWheelRotation(
            rawPointerAngle,
            transform.rotationStartPointerAngle
              ?? rawPointerAngle - rawDelta * wheelDirectionSign,
            wheelDirectionSign,
            wheelSnapDegrees,
          )
        : null;
      const wheelRotation = snappedWheel
        ? continuousSnappedWheelRotation(
            snappedWheel,
            wheelSnapDegrees,
            transform.rotationWheelSnapDegrees,
            transform.rotationWheelAppliedDelta,
            transform.rotationWheelAppliedPointerAngle,
            transform.rotationWheelDeltaOffset,
            transform.rotationWheelPointerOffset,
          )
        : null;
      if (wheelRotation) {
        transform.rotationWheelSnapDegrees = wheelSnapDegrees;
        transform.rotationWheelDeltaOffset = wheelRotation.deltaOffset;
        transform.rotationWheelPointerOffset = wheelRotation.pointerOffset;
        transform.rotationWheelAppliedDelta = wheelRotation.delta;
        transform.rotationWheelAppliedPointerAngle = wheelRotation.pointerAngle;
      } else {
        transform.rotationWheelSnapDegrees = undefined;
        transform.rotationWheelDeltaOffset = undefined;
        transform.rotationWheelPointerOffset = undefined;
        transform.rotationWheelAppliedDelta = undefined;
        transform.rotationWheelAppliedPointerAngle = undefined;
      }
      const delta = wheelRotation?.delta ?? snappedRotationDelta(rawDelta, false, shiftKey);

      const deltaQuaternion = new THREE.Quaternion().setFromAxisAngle(axisVector, THREE.MathUtils.degToRad(delta));
      const rotationDelta = deltaQuaternion.clone();
      if (state) {
        setRotationReadout({
          x: transform.wheelCenter ? transform.wheelCenter.x : localClientX + 18,
          y: transform.wheelCenter ? transform.wheelCenter.y - 92 : localClientY - 18,
          text: `${Number(delta.toFixed(1))}°`,
          angle: delta,
          pointerAngle: wheelRotation?.pointerAngle ?? rawPointerAngle,
        });
      }
      transform.items.forEach((item) => {
        const nextQuaternion = rotationDelta.clone().multiply(item.startQuaternion);
        const patch: Partial<WorkplaneShape> = rotationPatchFromQuaternion(nextQuaternion);
        if (transform.items.length > 1) {
          const nextCenter = pivot.clone().add(item.startCenter.clone().sub(pivot).applyQuaternion(rotationDelta));
          patch.x = snapPositionValue(nextCenter.x, step, -workspaceRef.current.width / 2 + 6, workspaceRef.current.width / 2 - 6);
          patch.z = snapPositionValue(nextCenter.z, step, -workspaceRef.current.depth / 2 + 6, workspaceRef.current.depth / 2 - 6);
          patch.elevation = snapPositionValue(nextCenter.y - item.startShape.height / 2, step, MIN_ELEVATION, MAX_ELEVATION);
        }
        onUpdateShape(item.id, patch);
      });
      return true;
    },
    [onUpdateShape, toPlanePoint, toRawPlanePoint],
  );

  const suppressLiftEditAfterDrag = useCallback(() => {
    suppressNextLiftEditRef.current = true;
    window.setTimeout(() => {
      suppressNextLiftEditRef.current = false;
    }, 250);
  }, []);

  const finishTransform = useCallback((event: ReactPointerEvent<Element>) => {
    const transform = transformRef.current;
    if (!transform) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(transform.pointerId)) {
      event.currentTarget.releasePointerCapture(transform.pointerId);
    }
    const bakeRotatedShapes = transform.kind === "rotate" && transform.hasMoved ? transform.ids : [];
    if (transform.kind === "lift") {
      setPinnedMeasureKey(getElevationMeasureKey(transformOverlayRef.current));
    }
    if (transform.kind === "lift" && transform.hasMoved) {
      suppressLiftEditAfterDrag();
    }
    if (transform.kind === "rotate" && transform.hasMoved) {
      suppressNextRotationEditRef.current = true;
      window.setTimeout(() => {
        suppressNextRotationEditRef.current = false;
      }, 250);
    }
    transformRef.current = null;
    setActiveRotationWheel(false);
    setActiveTransformKind(null);
    setPinnedRotationWheelView(null);
    setRotationReadout(null);
    if (threeRef.current) {
      syncCutPreviewOverlays(threeRef.current, shapesRef.current);
      setSelectionHelpersVisible(threeRef.current, true);
      threeRef.current.controls.enabled = true;
      threeRef.current.needsRender = true;
    }
    onInteractionActiveChange?.(false);
    bakeRotatedShapes.forEach((id) => onUpdateShape(id, { bakeTransform: true }));
  }, [onInteractionActiveChange, onUpdateShape, suppressLiftEditAfterDrag]);

  const beginDimensionEdit = useCallback((mark: DimensionMark) => {
    const id = selectedIdsRef.current[0];
    if (id && (mark.axis === "width" || mark.axis === "depth" || mark.axis === "height")) {
      rememberResizeAnchor(id, mark.axis === "height" ? "height" : "scale", mark.handleKey);
    }
    setPinnedMeasureKey(mark.handleKey);
    setEditingDimension({ key: mark.key, axis: mark.axis, x: mark.labelX, y: mark.labelY, value: mark.label });
  }, [rememberResizeAnchor]);

  const beginLiftEdit = useCallback((handleKey: string, x: number, y: number) => {
    if (suppressNextLiftEditRef.current) {
      suppressNextLiftEditRef.current = false;
      return;
    }
    const activeWorkplane = placementWorkplaneRef.current;
    const frame = selectionFrameForShapes(shapesRef.current, selectedIdsRef.current, activeWorkplane);
    if (!frame) {
      return;
    }
    const elevation = workplaneFootprintY(frame, activeWorkplane) - workplaneYForFrame(frame, activeWorkplane);
    const elevationMark = Object.values(transformOverlayRef.current?.dimensions ?? {})
      .flat()
      .find((entry) => entry.axis === "elevation");
    const editX = elevationMark?.labelX ?? x;
    const editY = elevationMark?.labelY ?? y;
    setPinnedMeasureKey(elevationMark?.handleKey ?? handleKey);
    setActiveRotationWheel(false);
    setRotationReadout(null);
    setEditingDimension({
      key: "elevation",
      axis: "elevation",
      x: clamp(editX, 44, Math.max(44, (transformOverlayRef.current?.width ?? 900) - 44)),
      y: clamp(editY, 34, Math.max(34, (transformOverlayRef.current?.height ?? 600) - 34)),
      value: formatMeasure(elevation, workspaceRef.current.accuracy),
    });
  }, []);

  const commitDimensionEdit = useCallback(() => {
    const edit = editingDimension;
    const id = selectedIdsRef.current[0];
    const shape = shapesRef.current.find((entry) => entry.id === id);
    if (!edit || !shape) {
      setEditingDimension(null);
      return;
    }
    const value = parseMeasurementInput(edit.value);
    if (edit.axis === "elevation") {
      if (Number.isFinite(value)) {
        const activeWorkplane = placementWorkplaneRef.current;
        const frame = selectionFrameForShapes(shapesRef.current, selectedIdsRef.current, activeWorkplane);
        const currentElevation = frame
          ? workplaneFootprintY(frame, activeWorkplane) - workplaneYForFrame(frame, activeWorkplane)
          : shape.elevation ?? 0;
        const targetElevation = cleanNearZero(clamp(value, MIN_ELEVATION, MAX_ELEVATION), 0.0005);
        const delta = targetElevation - currentElevation;
        const axis = frame?.yAxis.clone().normalize() ?? new THREE.Vector3(0, 1, 0);
        selectedIdsRef.current.forEach((selectedId) => {
          const selectedShape = shapesRef.current.find((entry) => entry.id === selectedId);
          if (selectedShape) {
            const nextCenter = shapeCenter(selectedShape).addScaledVector(axis, delta);
            onUpdateShape(selectedId, {
              x: cleanNearZero(nextCenter.x, 0.0005),
              z: cleanNearZero(nextCenter.z, 0.0005),
              elevation: cleanNearZero(clamp(nextCenter.y - selectedShape.height / 2, MIN_ELEVATION, MAX_ELEVATION), 0.0005),
            });
          }
        });
      }
      setEditingDimension(null);
      return;
    }
    if (Number.isFinite(value) && value > 0) {
      const customLimit = workspaceRef.current.shapeCustomizations[shape.kind]?.maxDimension;
      const nextValue = Math.min(customLimit ?? Number.POSITIVE_INFINITY, Math.max(MIN_SHAPE_SIZE, value));
      if (edit.axis === "width") {
        const frame = selectionFrameForShapes([shape], [shape.id]);
        if (shapeHasTaper(shape) && frame) {
          const scaleX = nextValue / Math.max(MIN_SHAPE_SIZE, frame.width);
          const anchor = lastResizeAnchorRef.current;
          const signs = anchor?.shapeId === shape.id ? resizeSignsForDimension(anchor.signs, "width") : { x: 0, z: 0 };
          const nextCenter = signs.x
            ? resizeCenterFromAnchor(frame, resizeAnchorPointForFrame(frame, signs), signs, nextValue, frame.depth)
            : frame.center.clone();
          onUpdateShape(id, {
            ...scaledHorizontalShapePatch(shape, scaleX, 1),
            x: cleanNearZero(nextCenter.x, 0.0005),
            z: cleanNearZero(nextCenter.z, 0.0005),
            elevation: cleanNearZero(nextCenter.y - shape.height / 2, 0.0005),
          });
        } else {
          const patch: Partial<WorkplaneShape> = { width: nextValue, size: resizedShapeSize(nextValue, shapeDepth(shape)) };
          if (shape.kind === "cone") {
            patch.baseRadius = nextValue / 2;
          }
          onUpdateShape(id, patchWithResizeAnchor(shape, patch, edit.axis, lastResizeAnchorRef.current));
        }
      } else if (edit.axis === "depth") {
        const frame = selectionFrameForShapes([shape], [shape.id]);
        if (shapeHasTaper(shape) && frame) {
          const scaleZ = nextValue / Math.max(MIN_SHAPE_SIZE, frame.depth);
          const anchor = lastResizeAnchorRef.current;
          const signs = anchor?.shapeId === shape.id ? resizeSignsForDimension(anchor.signs, "depth") : { x: 0, z: 0 };
          const nextCenter = signs.z
            ? resizeCenterFromAnchor(frame, resizeAnchorPointForFrame(frame, signs), signs, frame.width, nextValue)
            : frame.center.clone();
          onUpdateShape(id, {
            ...scaledHorizontalShapePatch(shape, 1, scaleZ),
            x: cleanNearZero(nextCenter.x, 0.0005),
            z: cleanNearZero(nextCenter.z, 0.0005),
            elevation: cleanNearZero(nextCenter.y - shape.height / 2, 0.0005),
          });
        } else {
          onUpdateShape(id, patchWithResizeAnchor(shape, { depth: nextValue, size: resizedShapeSize(shapeWidth(shape), nextValue) }, edit.axis, lastResizeAnchorRef.current));
        }
      } else {
        onUpdateShape(id, patchWithResizeAnchor(shape, { height: nextValue }, edit.axis, lastResizeAnchorRef.current));
      }
    }
    setEditingDimension(null);
  }, [editingDimension, onUpdateShape]);

  const cancelDimensionEdit = useCallback(() => {
    setEditingDimension(null);
  }, []);

  const beginRotationEdit = useCallback((handleKey: string, x: number, y: number) => {
    if (suppressNextRotationEditRef.current) {
      suppressNextRotationEditRef.current = false;
      return;
    }
    const axis = rotationAxisForHandle(handleKey);
    const shape = selectedIdsRef.current.length === 1 ? shapesRef.current.find((entry) => entry.id === selectedIdsRef.current[0]) : null;
    const currentValue = shape ? rotationValueForAxis(shape, axis) : 0;
    setPinnedMeasureKey(handleKey);
    setActiveRotationWheel(true);
    setRotationWheelAxis(axis);
    setRotationReadout(null);
    setEditingRotation({
      axis,
      handleKey,
      x: clamp(x, 38, Math.max(38, (transformOverlayRef.current?.width ?? 900) - 38)),
      y: clamp(y, 38, Math.max(38, (transformOverlayRef.current?.height ?? 600) - 38)),
      value: String(Number(currentValue.toFixed(1))),
    });
  }, []);

  const commitRotationEdit = useCallback(() => {
    const edit = editingRotation;
    if (!edit) {
      return;
    }
    const value = parseMeasurementInput(edit.value);
    if (Number.isFinite(value)) {
      selectedIdsRef.current.forEach((id) => onUpdateShape(id, { ...rotationPatchForAxis(edit.axis, value), bakeTransform: true }));
    }
    setEditingRotation(null);
    setActiveRotationWheel(false);
  }, [editingRotation, onUpdateShape]);

  const cancelRotationEdit = useCallback(() => {
    setEditingRotation(null);
    setActiveRotationWheel(false);
  }, []);

  const pickShape = useCallback((clientX: number, clientY: number) => {
    const state = threeRef.current;
    if (!state) {
      return null;
    }

    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);
    state.raycaster.layers.set(RENDER_LAYER_SHAPES);

    const intersections = state.raycaster.intersectObjects(state.shapeLayer.children, true);
    const hit = intersections.find((entry) => {
      const shapeId = entry.object.userData.shapeId;
      if (typeof shapeId !== "string") return false;
      const shape = shapesRef.current.find((candidate) => candidate.id === shapeId);
      return shape ? !shape.imagePlate : false;
    });
    if (hit) {
      return hit.object.userData.shapeId as string;
    }

    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    shapesRef.current.forEach((shape) => {
      if (shape.imagePlate) return;
      const center = new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z).project(state.camera);
      const screenX = rect.left + ((center.x + 1) / 2) * rect.width;
      const screenY = rect.top + ((1 - center.y) / 2) * rect.height;
      const distance = Math.hypot(clientX - screenX, clientY - screenY);
      const hitRadius = clamp(Math.max(shapeWidth(shape), shapeDepth(shape)) * 2.6, 48, 112);
      if (distance <= hitRadius && distance < nearestDistance) {
        nearestId = shape.id;
        nearestDistance = distance;
      }
    });

    return nearestId;
  }, []);

  const pickPlacementSurface = useCallback((clientX: number, clientY: number, reverse: boolean) => {
    const state = threeRef.current;
    if (!state) return null;
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);
    state.raycaster.layers.set(RENDER_LAYER_SHAPES);

    const hit = state.raycaster
      .intersectObjects(state.shapeLayer.children, true)
      .find((entry) => entry.object instanceof THREE.Mesh && entry.face && typeof entry.object.userData.shapeId === "string");
    if (!hit?.face) return null;

    const surface = hit.object as THREE.Mesh<THREE.BufferGeometry>;
    surface.updateWorldMatrix(true, false);
    const normal = hit.face.normal.clone().applyNormalMatrix(
      new THREE.Matrix3().getNormalMatrix(surface.matrixWorld),
    ).normalize();
    const shapeId = hit.object.userData.shapeId as string;
    const shapeObject = findShapeObject(state, shapeId);
    const shapeQuaternion = shapeObject?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
    const position = surface.geometry.getAttribute("position");
    const triangle = [hit.face.a, hit.face.b, hit.face.c]
      .filter((index) => index >= 0 && index < position.count)
      .map((index) => new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(surface.matrixWorld));
    const faceEdges = triangle.length === 3
      ? [
          triangle[1].clone().sub(triangle[0]),
          triangle[2].clone().sub(triangle[1]),
          triangle[0].clone().sub(triangle[2]),
        ]
          .map((edge) => edge.projectOnPlane(normal))
          .filter((edge) => edge.lengthSq() > 1e-8)
          .sort((a, b) => b.lengthSq() - a.lengthSq())
      : [];
    let tangent = faceEdges[Math.min(1, faceEdges.length - 1)]?.clone()
      ?? new THREE.Vector3(1, 0, 0).applyQuaternion(shapeQuaternion).projectOnPlane(normal);
    if (tangent.lengthSq() < 1e-8) {
      tangent = new THREE.Vector3(0, 0, 1).applyQuaternion(shapeQuaternion).projectOnPlane(normal);
    }
    const stableDirection = new THREE.Vector3(1, 0, 0).projectOnPlane(normal);
    if (stableDirection.lengthSq() < 1e-8) {
      stableDirection.set(0, 0, 1).projectOnPlane(normal);
    }
    if (tangent.dot(stableDirection) < 0) {
      tangent.negate();
    }

    const workplane = placementWorkplaneFromSurface(
      { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      { x: normal.x, y: normal.y, z: normal.z },
      { x: tangent.x, y: tangent.y, z: tangent.z },
      reverse,
    );

    return {
      shapeId,
      workplane: snapPlacementWorkplaneOrigin(workplane, snapStep(snapRef.current)),
    };
  }, []);

  const pickModifierEdge = useCallback((clientX: number, clientY: number) => {
    const state = threeRef.current;
    if (!state) return null;
    return pickModifierEdgeFromScreen(state, modifierEdgesRef.current, clientX, clientY);
  }, []);

  const updateModifierEdgeHover = useCallback((clientX: number, clientY: number) => {
    const edgeId = pickModifierEdge(clientX, clientY);
    setHoverModifierEdgeId((current) => (current === edgeId ? current : edgeId));
  }, [pickModifierEdge]);

  const clearModifierEdgeHover = useCallback(() => {
    setHoverModifierEdgeId((current) => (current === null ? current : null));
  }, []);

  const pickTransformHandle = useCallback((clientX: number, clientY: number) => {
    const state = threeRef.current;
    if (!state || selectedIdsRef.current.length !== 1) {
      return null;
    }

    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, state.camera);
    state.raycaster.layers.set(RENDER_LAYER_HELPERS);

    const intersections = state.raycaster.intersectObjects(state.helperLayer.children, true);
    const hit = intersections.find((entry) => typeof entry.object.userData.transformHandle === "string");
    if (!hit) {
      return null;
    }

    return {
      id: hit.object.userData.shapeId as string,
      kind: hit.object.userData.transformHandle as TransformHandleKind,
      handleKey: (hit.object.userData.transformHandleKey as string | undefined) ?? (hit.object.userData.transformHandle as string),
      planeY: typeof hit.object.userData.transformPlaneY === "number" ? (hit.object.userData.transformPlaneY as number) : 0,
    };
  }, []);

  const clearFaceHighlight = useCallback(() => {
    if (!faceHighlightRef.current) return;
    disposeFaceSelectionHighlight(faceHighlightRef.current.group);
    faceHighlightRef.current = null;
    if (threeRef.current) threeRef.current.needsRender = true;
  }, []);
  const showFaceHighlight = useCallback((surface: THREE.Mesh<THREE.BufferGeometry>, annotation: FaceAnnotation, selected: boolean) => {
    const state = threeRef.current;
    if (!state) return;
    clearFaceHighlight();
    const group = createFaceSelectionHighlight(surface, annotation, selected);
    setObjectRenderLayer(group, RENDER_LAYER_PREVIEWS);
    state.scene.add(group);
    faceHighlightRef.current = { group, surface, annotation, selected, triangles: new Set(annotation.triangleIndices) };
    state.needsRender = true;
  }, [clearFaceHighlight]);
  const pickNamedFace = useCallback((clientX: number, clientY: number, hover = false) => {
    const state = threeRef.current;
    if (!state || (hover && !paintModeRef.current && faceDraftRef.current)) return;
    const rect = state.renderer.domElement.getBoundingClientRect();
    state.pointer.set((clientX-rect.left)/rect.width*2-1, -(clientY-rect.top)/rect.height*2+1);
    state.raycaster.setFromCamera(state.pointer,state.camera);
    state.raycaster.layers.set(RENDER_LAYER_SHAPES);
    const hit = state.raycaster.intersectObjects(state.shapeLayer.children,true).find(h=>h.object instanceof THREE.Mesh && h.face && typeof h.object.userData.shapeId === "string");
    if (!hit || hit.faceIndex == null) {
      if (hover) clearFaceHighlight();
      else setFaceError("Нажмите на поверхность модели");
      return;
    }
    try {
      const surface = hit.object as THREE.Mesh<THREE.BufferGeometry>;
      const previous = faceHighlightRef.current;
      if (hover && previous?.surface === surface && previous.triangles.has(hit.faceIndex)) return;
      const annotation = previous?.surface === surface && previous.triangles.has(hit.faceIndex)
        ? { ...previous.annotation, localPoint: surface.worldToLocal(hit.point.clone()).toArray() as [number,number,number] }
        : annotatePlanarFace(surface, hit.faceIndex, hit.point);
      if(!hover && floorPickRef.current) {
        const shape=shapesRef.current.find(s=>s.id===floorPickRef.current);
        if(!shape || shape.id!==hit.object.userData.shapeId)throw new Error("Нажмите на грань выбранной детали.");
        const object=findShapeObject(state,shape.id);if(!object)return;
        const normal=new THREE.Vector3(...annotation.localNormal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(surface.matrixWorld));
        const patch=floorRotation(shape,object,0,normal,hit.point);onUpdateShape(shape.id,patch);setFloorPickId(null);floorPickRef.current=null;setFaceError("");clearFaceHighlight();return;
      }
      if(!hover && paintModeRef.current) {
        const shape=shapesRef.current.find(shape=>shape.id===hit.object.userData.shapeId);
        if(!shape || shape.locked)return;
        const remaining=(shape.facePaints??[]).filter(paint=>paint.geometryKey!==annotation.geometryKey || !paint.triangleIndices.includes(hit.faceIndex!));
        onUpdateShape(shape.id,{facePaints:paintEraseRef.current ? remaining : [...remaining,{...annotation,color:paintColorRef.current}]});
        setFaceError("");clearFaceHighlight();return;
      }
      showFaceHighlight(surface, annotation, !hover);
      if (!hover) {
        setFaceDraft({shapeId:hit.object.userData.shapeId,annotation}); setFaceName(""); setFaceError("");
      }
    } catch(error) { if (!hover) setFaceError(error instanceof Error ? error.message : String(error)); else clearFaceHighlight(); }
  }, [clearFaceHighlight, onUpdateShape, showFaceHighlight]);
  useEffect(() => {
    if (!faceDraft) { clearFaceHighlight(); return; }
    const state = threeRef.current;
    if (!state) return;
    let surface: THREE.Mesh<THREE.BufferGeometry> | null = null;
    findShapeObject(state, faceDraft.shapeId)?.traverse(object => {
      if (!surface && object instanceof THREE.Mesh && faceGeometryKey(object.geometry) === faceDraft.annotation.geometryKey) surface = object;
    });
    if (surface) showFaceHighlight(surface, faceDraft.annotation, true);
    else clearFaceHighlight();
  }, [faceDraft, faceMode, shapes, clearFaceHighlight, showFaceHighlight]);
  const pickHole = useCallback((clientX: number, clientY: number) => {
    const state = threeRef.current;
    if (!state) return false;
    const rect=state.renderer.domElement.getBoundingClientRect(), x=clientX-rect.left, y=clientY-rect.top;
    state.pointer.set(x/rect.width*2-1,-y/rect.height*2+1);
    state.raycaster.setFromCamera(state.pointer,state.camera); state.raycaster.layers.set(RENDER_LAYER_SHAPES);
    const firstHit=state.raycaster.intersectObjects(state.shapeLayer.children,true).find(h=>h.object instanceof THREE.Mesh);
    let best: { shapeId:string; geometry:THREE.BufferGeometry; hole:CircularHole; distance:number; depth:number } | null = null;
    for (const object of state.shapeLayer.children) object.traverse(child=>{
      if (!(child instanceof THREE.Mesh) || !child.visible || typeof child.userData.shapeId !== "string") return;
      const shape=shapesRef.current.find(s=>s.id===child.userData.shapeId);
      if (!shape || shape.hidden || shape.imagePlate) return;
      for (const hole of detectCircularHoles(child.geometry)) {
        const reading=measureCircularHole(child,hole);
        const worldCenter=new THREE.Vector3(...reading.center as [number,number,number]);
        const projectedCenter=worldCenter.clone().project(state.camera);
        if(projectedCenter.z < -1 || projectedCenter.z > 1) continue;
        const planeHit=state.raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...reading.normal as [number,number,number]),worldCenter),new THREE.Vector3());
        if(!planeHit || (firstHit && planeHit.distanceTo(state.raycaster.ray.origin)>firstHit.distance+0.2)) continue;
        const center=projectToScreen(worldCenter, state);
        const projected=reading.rim.map(p=>projectToScreen(new THREE.Vector3(...p as [number,number,number]), state));
        let inside=false, edgeDistance=Infinity;
        for(let i=0,j=projected.length-1;i<projected.length;j=i++) {
          const a=projected[j],b=projected[i];
          if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
          const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
          edgeDistance=Math.min(edgeDistance,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));
        }
        const distance=Math.hypot(center.x-x,center.y-y);
        const depth=planeHit.distanceTo(state.raycaster.ray.origin);
        if ((inside||edgeDistance<7) && (!best || distance<best.distance-1 || (Math.abs(distance-best.distance)<=1 && depth<best.depth))) best={shapeId:shape.id,geometry:child.geometry,hole,distance,depth};
      }
    });
    if(best){selectedHoleRef.current=best;return true;}
    selectedHoleRef.current=null;return false;
  }, []);
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = threeRef.current;
      if (!state) {
        return;
      }
      if (event.button !== 0 || event.ctrlKey || event.metaKey) {
        return;
      }
      if (cameraPanModeRef.current) return;
      clearMoveDimensions();
      const rect = state.renderer.domElement.getBoundingClientRect();

      if(creationModeRef.current){event.preventDefault();event.stopPropagation();creationPointerRef.current(event.clientX,event.clientY,false);return;}
      if(holeModeRef.current){event.preventDefault();event.stopPropagation();holePointerRef.current(event.clientX,event.clientY,false);return;}
      if (faceModeRef.current || paintModeRef.current || floorPickRef.current) { event.preventDefault(); event.stopPropagation(); pickNamedFace(event.clientX,event.clientY); return; }

      if (modifierActive) {
        event.preventDefault();
        const edgeId = pickModifierEdge(event.clientX, event.clientY);
        if (edgeId !== null) onModifierEdgeToggle?.(edgeId, event.shiftKey);
        return;
      }

      if (rulerDeleteModeRef.current) {
        event.preventDefault();
        return;
      }

      if (rulerMoveModeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (rulerModeRef.current) {
        event.preventDefault();
        rulerShiftRef.current = event.shiftKey;
        const candidate = resolveRulerCandidate(event.clientX, event.clientY);
        if (candidate) {
          selectRulerCandidate(candidate);
        }
        return;
      }

      if (workplaneModeRef.current) {
        event.preventDefault();
        syncWorkplaneHoverPreview(state, null, workspaceRef.current, resolvedThemeRef.current);
        const surface = pickPlacementSurface(event.clientX, event.clientY, event.shiftKey);
        if (surface) {
          onSetPlacementWorkplane(surface.workplane, "shape");
        } else {
          onSetPlacementWorkplane(horizontalPlacementWorkplane(), "base");
        }
        onWorkplaneModeChange(false);
        return;
      }

      if (!alignMode && !mirrorMode && !event.shiftKey && pickHole(event.clientX,event.clientY)) { event.preventDefault(); return; }

      const handle = pickTransformHandle(event.clientX, event.clientY);
      if (handle) {
        const shape = shapesRef.current.find((entry) => entry.id === handle.id);
        const activeWorkplane = placementWorkplaneRef.current;
        const frame = selectionFrameForShapes(shapesRef.current, selectedIdsRef.current, activeWorkplane);
        const scalePlane = handle.kind === "scale" && frame
          ? localResizePlaneForFrame(frame, workplaneFootprintY(frame, activeWorkplane))
          : undefined;
        const scaleStartPoint = scalePlane ? toRawPlanePoint(event.clientX, event.clientY, scalePlane) ?? undefined : undefined;
        const point = scalePlane ? scaleStartPoint : toPlanePoint(event.clientX, event.clientY);
        if (!shape || !frame || shape.locked || (!point && handle.kind !== "height" && handle.kind !== "lift" && handle.kind !== "rotate")) {
          return;
        }
        const yBounds = selectionWorldYBounds(frame);
        const handlesLowerSide = handle.handleKey === "bottom-height" || handle.handleKey === "lower-shape";
        const liftOffset = handle.kind === "lift" ? Math.max(2, frame.height * 0.08) * (handlesLowerSide ? -1 : 1) : 0;
        const overlay = transformOverlayRef.current;
        const rotationAxis = rotationAxisForHandle(handle.handleKey);
        const resizeHandleKey = handle.handleKey;
        const scaleSigns = handle.kind === "scale" ? resizeSignsForHandle(resizeHandleKey) : undefined;
        const scaleAnchorPoint = handle.kind === "scale" && scaleSigns ? resizeAnchorPointForFrame(frame, scaleSigns) : undefined;
        const wheel = handle.kind === "rotate" ? (overlay?.rotationWheels[rotationAxis] ?? overlay?.rotationWheel ?? undefined) : undefined;
        const rotationPlane = handle.kind === "rotate" ? overlay?.rotationPlanes[rotationAxis] : undefined;
        const rotationPlaneCenterData = handle.kind === "rotate" ? overlay?.rotationPlaneCenters[rotationAxis] : undefined;
        const rotationPlaneCenter = rotationPlaneCenterData
          ? new THREE.Vector3(rotationPlaneCenterData.x, rotationPlaneCenterData.y, rotationPlaneCenterData.z)
          : frame.center.clone();
        const localClientX = event.clientX - rect.left;
        const localClientY = event.clientY - rect.top;
        const axisVector = rotationAxisVectorForFrame(handle.handleKey, frame);
        const pivot = frame.center.clone();
        const rotationCenter = handle.kind === "rotate" ? wheel ?? projectToScreen(pivot, state) : undefined;
        const rotationStartPoint = handle.kind === "rotate" ? rayPointOnRotationPlane(state, event.clientX, event.clientY, rotationPlaneCenter, axisVector) : null;
        const rotationStartVector = rotationStartPoint ? rotationStartPoint.sub(rotationPlaneCenter) : undefined;
        const liftAxis = handle.kind === "lift" || handle.kind === "height" ? frame.yAxis.clone().normalize() : undefined;
        const liftHandlePoint = liftAxis
          ? framePoint(frame, 0, handlesLowerSide ? frame.min.y : frame.max.y, 0).addScaledVector(liftAxis, liftOffset)
          : undefined;
        const liftPlane = liftAxis && liftHandlePoint
          ? axisDragPlaneForCamera(state, liftAxis, liftHandlePoint)
          : undefined;
        const liftStartPoint = liftPlane ? toRawPlanePoint(event.clientX, event.clientY, liftPlane) ?? undefined : undefined;
        const liftStartValue = handle.kind === "lift"
          ? workplaneFootprintY(frame, activeWorkplane) - workplaneYForFrame(frame, activeWorkplane)
          : undefined;
        if ((handle.kind === "lift" || handle.kind === "height") && !liftStartPoint) {
          return;
        }
        rememberResizeAnchor(handle.id, handle.kind, resizeHandleKey);
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setEditingRotation(null);
        setPinnedMeasureKey(measureKeyForHandle(handle.kind, handle.handleKey, transformOverlayRef.current));
        if (handle.kind === "height") {
          setHoverMeasureKey(null);
        }
        setActiveRotationWheel(handle.kind === "rotate");
        setActiveTransformKind(handle.kind);
        setSelectionHelpersVisible(state, handle.kind !== "rotate");
        if (handle.kind === "rotate") {
          setRotationWheelAxis(rotationAxis);
          setPinnedRotationWheelView(wheel && rotationPlane ? { axis: rotationAxis, wheel: { ...wheel }, plane: { ...rotationPlane } } : null);
        } else {
          setPinnedRotationWheelView(null);
        }
        transformRef.current = {
          id: handle.id,
          ids: frame.ids,
          kind: handle.kind,
          handleKey: resizeHandleKey,
          rotationAxis,
          pointerId: event.pointerId,
          startShape: { ...shape },
          items: frame.ids
            .map((id) => shapesRef.current.find((entry) => entry.id === id))
            .filter((entry): entry is WorkplaneShape => Boolean(entry))
            .map((entry) => ({
              id: entry.id,
              startShape: { ...entry },
              startCenter: shapeCenter(entry),
              startQuaternion: quaternionForShape(entry),
            })),
          selectionFrame: frame,
          startScreenAngle: rotationCenter ? screenAngle(localClientX, localClientY, rotationCenter) : 0,
          startClientX: event.clientX,
          startClientY: event.clientY,
          scalePlaneY: handle.kind === "scale" ? handle.planeY : 0,
          scalePlane,
          scaleSigns,
          scaleAnchorPoint,
          scaleStartPoint,
          liftAxis,
          liftPlane,
          liftStartPoint,
          liftHandlePoint,
          liftStartValue,
          rotationAxisVector: handle.kind === "rotate" ? axisVector : undefined,
          rotationPivot: handle.kind === "rotate" ? pivot : undefined,
        rotationPlaneCenter: handle.kind === "rotate" ? rotationPlaneCenter : undefined,
        rotationPlaneView: handle.kind === "rotate" ? rotationPlane : undefined,
        rotationStartPointerAngle: handle.kind === "rotate"
          ? rotationPlanePointerAngle(rotationPlane, localClientX, localClientY, rotationCenter ?? { x: localClientX, y: localClientY })
          : undefined,
        rotationStartVector: handle.kind === "rotate" ? rotationStartVector : undefined,
          rotationScreenCenter: rotationCenter,
          rotationScreenSign: handle.kind === "rotate" ? rotationScreenSign(axisVector, state.camera) : 1,
          rotationStartQuaternion: handle.kind === "rotate" ? quaternionForShape(shape) : undefined,
          wheelCenter: wheel,
        };
        if (handle.kind === "rotate") {
          setRotationReadout({
            x: event.clientX - rect.left + 18,
            y: event.clientY - rect.top - 18,
            text: `${Math.round(rotationValueForAxis(shape, rotationAxis))}°`,
            angle: 0,
            pointerAngle: rotationPlanePointerAngle(rotationPlane, localClientX, localClientY, rotationCenter ?? { x: localClientX, y: localClientY }),
          });
        } else if (handle.kind === "lift") {
          setRotationReadout({
            x: event.clientX - rect.left + 22,
            y: event.clientY - rect.top - 34,
            text: formatMeasure(liftStartValue ?? 0, workspaceRef.current.accuracy),
          });
        } else {
          setRotationReadout(null);
        }
        if (handle.kind !== "scale" && handle.kind !== "height") {
          clearCutPreviewOverlays(state);
        }
        state.needsRender = true;
        state.controls.enabled = false;
        onInteractionActiveChange?.(true);
        return;
      }

      const id = pickShape(event.clientX, event.clientY);
      const additive = event.shiftKey;
      if (!id) {
        const startX = event.clientX - rect.left;
        const startY = event.clientY - rect.top;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        marqueeRef.current = {
          pointerId: event.pointerId,
          startX,
          startY,
          currentX: startX,
          currentY: startY,
          additive,
          hasMoved: false,
        };
        setMarqueeFromState(marqueeRef.current);
        state.controls.enabled = false;
        onInteractionActiveChange?.(true);
        return;
      }

      const shape = shapesRef.current.find((entry) => entry.id === id);
      const selectedIdsSnapshot = selectedIdsRef.current;
      if (alignModeRef.current && selectedIdsSnapshot.includes(id)) {
        event.preventDefault();
        onAlignAnchorChange(id);
        return;
      }
      const dragPlaneY = shape ? shape.elevation ?? 0 : 0;
      const activeWorkplane = placementWorkplaneRef.current;
      const point = toPlacementWorkplanePoint(event.clientX, event.clientY, activeWorkplane);
      if (!point || !shape) {
        return;
      }

      event.preventDefault();
      const alreadySelected = selectedIdsSnapshot.includes(id);
      if (additive) {
        onSelectShape(id, "toggle");
        return;
      }
      if (!alreadySelected) {
        onSelectShape(id);
      }
      if (!canBeginShapeDrag(workspaceRef.current.selectBeforeMove, alreadySelected)) {
        return;
      }
      if (shape.locked) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      const dragIds = alreadySelected && selectedIdsSnapshot.length > 1 ? selectedIdsSnapshot : [id];
      const items = dragIds
        .map<DragItem | null>((dragId) => {
          const dragShape = shapesRef.current.find((entry) => entry.id === dragId);
          if (!dragShape || dragShape.locked) {
            return null;
          }
          const helper = findSelectionHelper(state, dragId);
          const visual = findShapeObject(state, dragId);
          return {
            id: dragId,
            startX: dragShape.x,
            startZ: dragShape.z,
            startElevation: dragShape.elevation ?? 0,
            nextX: dragShape.x,
            nextZ: dragShape.z,
            nextElevation: dragShape.elevation ?? 0,
            startVisualY: visual?.position.y ?? (dragShape.elevation ?? 0) + dragShape.height / 2,
            visual,
            helper,
            helperBox: helper ? helper.box.clone() : null,
            hadPreviewSimplified: false,
          };
        })
        .filter((item): item is DragItem => Boolean(item));
      if (items.length === 0) {
        return;
      }
      dragRef.current = {
        primaryId: id,
        offsetX: shape.x - point.x,
        offsetZ: shape.z - point.z,
        planeY: dragPlaneY,
        workplane: activeWorkplane,
        startPoint: point,
        pointerId: event.pointerId,
        primaryStartX: shape.x,
        primaryStartZ: shape.z,
        items,
      };
      const usesWorldHorizontalAxes = Math.abs(activeWorkplane.normal.y - 1) < 1e-6
        && Math.abs(activeWorkplane.xAxis.x - 1) < 1e-6
        && Math.abs(activeWorkplane.zAxis.z - 1) < 1e-6;
      if (moveDimensionsEnabledRef.current && usesWorldHorizontalAxes) {
        const dragFrame = selectionFrameForShapes(shapesRef.current, items.map((item) => item.id));
        const moveDimensionAnchor = dragFrame
          ? moveDimensionAnchorForCamera(state, dragFrame)
          : new THREE.Vector3(shape.x, WORKPLANE_LINE_ELEVATION + 0.04, shape.z);
        moveDimensionSessionRef.current = {
          active: true,
          originX: moveDimensionAnchor.x,
          originZ: moveDimensionAnchor.z,
          planeY: moveDimensionAnchor.y,
          deltaX: 0,
          deltaZ: 0,
          items: items.map(({ id: itemId, startX, startZ }) => ({ id: itemId, startX, startZ })),
        };
      }
      state.needsRender = true;
      state.controls.enabled = false;
      onInteractionActiveChange?.(true);
    },
    [
      clearMoveDimensions,
      alignMode, mirrorMode, pickHole, pickNamedFace,
      modifierActive,
      onAlignAnchorChange,
      onInteractionActiveChange,
      onModifierEdgeToggle,
      onSelectShape,
      onSetPlacementWorkplane,
      onWorkplaneModeChange,
      pickPlacementSurface,
      pickModifierEdge,
      pickShape,
      pickTransformHandle,
      resolveRulerCandidate,
      selectRulerCandidate,
      setMarqueeFromState,
      toPlanePoint,
      toPlanePointAtY,
      toPlacementWorkplanePoint,
      toRawPlanePoint,
    ],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (cameraPanModeRef.current) return;
      if(creationModeRef.current){creationPointerRef.current(event.clientX,event.clientY,true);return;}
      if(holeModeRef.current){holePointerRef.current(event.clientX,event.clientY,true);return;}
      if (faceModeRef.current || paintModeRef.current || floorPickRef.current) { pickNamedFace(event.clientX, event.clientY, true); return; }
      if (workplaneModeRef.current) {
        const surface = pickPlacementSurface(event.clientX, event.clientY, event.shiftKey);
        let preview = surface?.workplane ?? null;
        if (!preview) {
          const basePoint = toRawPlanePoint(
            event.clientX,
            event.clientY,
            new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
          );
          if (basePoint) {
            preview = snapPlacementWorkplaneOrigin(
              placementWorkplaneFromSurface(
                { x: basePoint.x, y: 0, z: basePoint.z },
                { x: 0, y: 1, z: 0 },
                { x: 1, y: 0, z: 0 },
                event.shiftKey,
              ),
              snapStep(snapRef.current),
            );
          }
        }
        syncWorkplaneHoverPreview(
          threeRef.current,
          preview,
          workspaceRef.current,
          resolvedThemeRef.current,
        );
        return;
      }
      if (modifierActiveRef.current) {
        updateModifierEdgeHover(event.clientX, event.clientY);
        return;
      }
      if (rulerModeRef.current) {
        if(!(event.buttons&6))scheduleRulerHover(event.clientX, event.clientY, event.shiftKey);
        return;
      }
      if (rulerMoveModeRef.current) return;
      const transform = transformRef.current;
      if (transform) {
        updateTransform(event.clientX, event.clientY, event.shiftKey, event.altKey);
        if (threeRef.current) {
          threeRef.current.needsRender = true;
        }
        return;
      }

      const marquee = marqueeRef.current;
      if (marquee) {
        const state = threeRef.current;
        if (!state) {
          return;
        }
        const rect = state.renderer.domElement.getBoundingClientRect();
        marquee.currentX = event.clientX - rect.left;
        marquee.currentY = event.clientY - rect.top;
        marquee.hasMoved = marquee.hasMoved || Math.hypot(marquee.currentX - marquee.startX, marquee.currentY - marquee.startY) > 5;
        setMarqueeFromState(marquee);
        return;
      }

      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const point = toPlacementWorkplanePoint(event.clientX, event.clientY, drag.workplane);
      if (!point) {
        return;
      }

      const deltaX = point.x - drag.startPoint.x;
      const deltaY = point.y - drag.startPoint.y;
      const deltaZ = point.z - drag.startPoint.z;
      const moveDimensionSession = moveDimensionSessionRef.current;
      if (moveDimensionSession) {
        moveDimensionSession.deltaX = deltaX;
        moveDimensionSession.deltaZ = deltaZ;
        moveDimensionSession.active = true;
      }

      drag.items.forEach((item) => {
        item.nextX = item.startX + deltaX;
        item.nextZ = item.startZ + deltaZ;
        item.nextElevation = item.startElevation + deltaY;
        if (threeRef.current) applyDragItemPreview(threeRef.current, item);
      });
      if (threeRef.current) {
        const previewShapes = previewShapesForDrag(shapesRef.current, drag);
        updateSelectedGroundFootprintPreviews(threeRef.current, drag);
        syncTransformOverlay(
          threeRef.current,
          previewShapes,
          renderSelectionIds(),
          transformOverlayRef,
          setTransformOverlay,
          workspaceRef.current.accuracy,
          true,
          true,
          placementWorkplaneRef.current,
          resolvedThemeRef.current,
        );
        syncCutPreviewOverlays(threeRef.current, previewShapes);
        syncMoveDimensionOverlay(
          threeRef.current,
          moveDimensionSession,
          moveDimensionOverlayRef,
          setMoveDimensionOverlay,
          workspaceRef.current.accuracy,
          resolvedThemeRef.current,
        );
        threeRef.current.lastOverlaySync = performance.now();
        threeRef.current.needsRender = true;
      }
    },
    [pickNamedFace, pickPlacementSurface, setMarqueeFromState, toPlacementWorkplanePoint, toRawPlanePoint, updateModifierEdgeHover, scheduleRulerHover, updateTransform],
  );

  const handlePointerLeave = useCallback(() => {
    if (!faceDraftRef.current) clearFaceHighlight();
    if (workplaneModeRef.current) {
      syncWorkplaneHoverPreview(threeRef.current, null, workspaceRef.current, resolvedThemeRef.current);
    }
    if (modifierActiveRef.current) clearModifierEdgeHover();
  }, [clearModifierEdgeHover, clearFaceHighlight]);

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = threeRef.current;
      const transform = transformRef.current;
      if (transform) {
        if (event.currentTarget.hasPointerCapture(transform.pointerId)) {
          event.currentTarget.releasePointerCapture(transform.pointerId);
        }
        if (transform.kind === "lift") {
          setPinnedMeasureKey(getElevationMeasureKey(transformOverlayRef.current));
        } else if (transform.kind === "height") {
          setPinnedMeasureKey(null);
          setHoverMeasureKey(null);
        }
        if (transform.kind === "lift" && transform.hasMoved) {
          suppressLiftEditAfterDrag();
        }
        transformRef.current = null;
        setActiveRotationWheel(false);
        setActiveTransformKind(null);
        setRotationReadout(null);
        if (state) {
          syncCutPreviewOverlays(state, shapesRef.current);
          setSelectionHelpersVisible(state, true);
          state.controls.enabled = true;
          state.needsRender = true;
        }
        onInteractionActiveChange?.(false);
        return;
      }

      const marquee = marqueeRef.current;
      if (marquee) {
        if (event.currentTarget.hasPointerCapture(marquee.pointerId)) {
          event.currentTarget.releasePointerCapture(marquee.pointerId);
        }
        marqueeRef.current = null;
        setMarqueeFromState(null);
        if (marquee.hasMoved) {
          const rect = {
            left: Math.min(marquee.startX, marquee.currentX),
            right: Math.max(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            bottom: Math.max(marquee.startY, marquee.currentY),
          };
          const selected = shapesInMarquee(rect);
          if (marquee.additive) {
            const merged = [...selectedIdsRef.current];
            selected.forEach((id) => {
              if (!merged.includes(id)) {
                merged.push(id);
              }
            });
            onSelectShape(merged);
          } else {
            onSelectShape(selected);
          }
        } else if (!marquee.additive) {
          onSelectShape(null);
        }
        if (state) {
          state.controls.enabled = true;
        }
        onInteractionActiveChange?.(false);
        return;
      }

      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
        event.currentTarget.releasePointerCapture(drag.pointerId);
      }

      let movedShape = false;
      drag.items.forEach((item) => {
        if (item.visual && item.hadPreviewSimplified) {
          setComplexEdgeVisibility(item.visual, true);
        }
        const shape = shapesRef.current.find((entry) => entry.id === item.id);
        if (shape && (shape.x !== item.nextX || shape.z !== item.nextZ || (shape.elevation ?? 0) !== item.nextElevation)) {
          movedShape = true;
          onUpdateShape(item.id, { x: item.nextX, z: item.nextZ, elevation: item.nextElevation });
        }
      });

      const moveDimensionSession = moveDimensionSessionRef.current;
      if (movedShape && moveDimensionSession) {
        moveDimensionSession.active = false;
      } else {
        clearMoveDimensions();
      }
      dragRef.current = null;
      if (state) {
        // A moved shape triggers the shapes effect, which rebuilds this preview.
        // Running it here as well makes cylinder/hole CSG execute twice on release.
        if (!movedShape) {
          syncCutPreviewOverlays(state, shapesRef.current);
        }
        syncMoveDimensionOverlay(
          state,
          moveDimensionSessionRef.current,
          moveDimensionOverlayRef,
          setMoveDimensionOverlay,
          workspaceRef.current.accuracy,
          resolvedThemeRef.current,
        );
        state.controls.enabled = true;
        state.needsRender = true;
      }
      onInteractionActiveChange?.(false);
    },
    [clearMoveDimensions, onInteractionActiveChange, onSelectShape, onUpdateShape, rememberResizeAnchor, setMarqueeFromState, shapesInMarquee, suppressLiftEditAfterDrag],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (rulerMoveModeRef.current) return;
      const raw = event.dataTransfer.getData("application/x-scketch3dweb-shape");
      if (!raw) {
        return;
      }

      const asset = parseDroppedShapeAsset(raw);
      if (!asset) {
        return;
      }
      const point = toPlacementWorkplanePoint(event.clientX, event.clientY);
      onAddShape(asset, point ?? placementWorkplaneRef.current.origin);
    },
    [onAddShape, toPlacementWorkplanePoint],
  );

  const resetView = useCallback(() => {
    const state = threeRef.current;
    if (state) {
      resetCamera(state);
      if(frameOnOpenRef.current)frameScene(state);
      state.needsRender = true;
    }
  }, []);

  const setViewCubeFace = useCallback((face: ViewCubeFace) => {
    const state = threeRef.current;
    if (!state) {
      return;
    }
    setCameraToViewFace(state, face);
    syncViewCube(state, viewCubeRef.current);
  }, []);

  const zoomCamera = useCallback((scale: number) => {
    const state = threeRef.current;
    if (!state) {
      return;
    }

    if (state.camera instanceof THREE.OrthographicCamera) {
      state.camera.zoom = clamp(state.camera.zoom / scale, 0.02, 100);
    } else {
      const offset = state.camera.position.clone().sub(state.controls.target);
      const distance = clamp(offset.length() * scale, 22, 4200);
      offset.setLength(distance);
      state.camera.position.copy(state.controls.target).add(offset);
    }
    state.camera.updateProjectionMatrix();
    state.controls.update();
    state.needsRender = true;
  }, []);

  const toggleProjection = useCallback(() => {
    const state = threeRef.current;
    if (!state) {
      return;
    }
    toggleCameraProjection(state);
  }, []);

  const togglePlacementWorkplane = useCallback(() => {
    setFaceMode(false);
    setRulerToolsOpen(false);
    setRulerActive(false);
    rulerDeleteModeRef.current = false;
    setRulerDeleteMode(false);
    rulerMoveModeRef.current = false;
    setRulerMoveMode(false);
    onToggleWorkplaneTool();
  }, [onToggleWorkplaneTool, setRulerActive]);

  const setPlacementWorkplaneAtSelection = useCallback(() => {
    if (selectedIdsRef.current.length !== 1) return false;
    const shape = shapesRef.current.find((entry) => entry.id === selectedIdsRef.current[0] && !entry.hidden);
    if (!shape) return false;
    const quaternion = quaternionForShape(shape);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize();
    const tangent = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize();
    const origin = shapeCenter(shape).addScaledVector(normal, shape.height / 2);
    onSetPlacementWorkplane(snapPlacementWorkplaneOrigin(
      placementWorkplaneFromSurface(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: normal.x, y: normal.y, z: normal.z },
        { x: tangent.x, y: tangent.y, z: tangent.z },
      ),
      snapStep(snapRef.current),
    ), "shape");
    onWorkplaneModeChange(false);
    return true;
  }, [onSetPlacementWorkplane, onWorkplaneModeChange]);

  const leaveCameraPanMode = useCallback(() => {
    cameraPanModeRef.current=false;setCameraPanMode(false);
    if(threeRef.current)threeRef.current.cameraPanMode=false;
  },[]);

  const toggleRulerTools = useCallback(() => {
    if (rulerModeRef.current || rulerMoveModeRef.current || rulerDeleteModeRef.current) {
      setRulerToolsOpen(false);
      setRulerActive(false);
      rulerMoveModeRef.current = false;
      setRulerMoveMode(false);
      rulerDeleteModeRef.current = false;
      setRulerDeleteMode(false);
      rulerPointDragRef.current = null;
      rulerPointClickRef.current = null;
      return;
    }
    leaveCameraPanMode();
    setFaceMode(false);
    setRulerToolsOpen(true);
    setRulerActive(true);
    rulerDeleteModeRef.current = false;
    setRulerDeleteMode(false);
    rulerMoveModeRef.current = false;
    setRulerMoveMode(false);
    onWorkplaneModeChange(false);
  }, [leaveCameraPanMode, onWorkplaneModeChange, setRulerActive]);

  const activateRulerAdd = useCallback(() => {
    leaveCameraPanMode();
    setFaceMode(false);
    rulerDeleteModeRef.current = false;
    setRulerDeleteMode(false);
    rulerMoveModeRef.current = false;
    setRulerMoveMode(false);
    setRulerActive(true);
    onWorkplaneModeChange(false);
  }, [leaveCameraPanMode, onWorkplaneModeChange, setRulerActive]);

  const activateRulerDelete = useCallback(() => {
    leaveCameraPanMode();
    setFaceMode(false);
    setRulerActive(false);
    rulerMoveModeRef.current = false;
    setRulerMoveMode(false);
    rulerDeleteModeRef.current = true;
    setRulerDeleteMode(true);
    onWorkplaneModeChange(false);
  }, [leaveCameraPanMode, onWorkplaneModeChange, setRulerActive]);

  const activateRulerMove = useCallback(() => {
    leaveCameraPanMode();
    setFaceMode(false);
    setRulerActive(false);
    rulerDeleteModeRef.current = false;
    setRulerDeleteMode(false);
    rulerMoveModeRef.current = true;
    setRulerMoveMode(true);
    onWorkplaneModeChange(false);
    onSelectShape(null);
  }, [leaveCameraPanMode, onSelectShape, onWorkplaneModeChange, setRulerActive]);

  useEffect(() => {
    const canvas=threeRef.current?.renderer.domElement;
    if(!canvas)return;
    const gesture=new RightDoubleClick();
    const down=(event:PointerEvent)=>gesture.pointerDown(event,performance.now());
    const move=(event:PointerEvent)=>gesture.pointerMove(event);
    const up=(event:PointerEvent)=>{
      if(!gesture.pointerUp(event,performance.now()))return;
      if(!rulerModeRef.current && !rulerMoveModeRef.current && !rulerDeleteModeRef.current && !holeModeRef.current)return;
      setHoleModeId(null);holeModeRef.current=null;setHolePlacement(null);holePlacementRef.current=null;setHoleDraft(null);holeSketchRef.current=null;setHoleDrawWorld([]);setHoleError("");
      setRulerActive(false);
      rulerMoveModeRef.current=false;setRulerMoveMode(false);
      rulerDeleteModeRef.current=false;setRulerDeleteMode(false);
      rulerPointDragRef.current=null;
      rulerPointClickRef.current=null;
      setPaintMode(false);setFaceMode(false);
      onWorkplaneModeChange(false);
      cameraPanModeRef.current=true;setCameraPanMode(true);
      if(threeRef.current)threeRef.current.cameraPanMode=true;
    };
    const cancel=()=>gesture.reset();
    canvas.addEventListener("pointerdown",down,true);
    canvas.addEventListener("pointermove",move,true);
    canvas.addEventListener("pointerup",up,true);
    canvas.addEventListener("pointercancel",cancel,true);
    return()=>{
      canvas.removeEventListener("pointerdown",down,true);
      canvas.removeEventListener("pointermove",move,true);
      canvas.removeEventListener("pointerup",up,true);
      canvas.removeEventListener("pointercancel",cancel,true);
    };
  },[onWorkplaneModeChange,setRulerActive]);

  const collapseCameraControls = useCallback(() => {
    setCameraControlsCollapsed(true);
    setRulerToolsOpen(false);
    setRulerActive(false);
    rulerDeleteModeRef.current = false;
    setRulerDeleteMode(false);
    rulerMoveModeRef.current = false;
    setRulerMoveMode(false);
    rulerPointDragRef.current = null;
  }, [setRulerActive]);

  const handleRulerPointPointerDown = useCallback(
    (event: ReactPointerEvent<SVGCircleElement>, pointId: string) => {
      if (event.button !== 0) {
        beginCameraDragFromOverlay(event);
        return;
      }
      const cameraInteraction = cameraPanModeRef.current || (!rulerModeRef.current && !rulerMoveModeRef.current && !rulerDeleteModeRef.current && !paintModeRef.current && !faceModeRef.current && !workplaneModeRef.current && !modifierActiveRef.current && !alignModeRef.current && !mirrorModeRef.current);
      if (cameraInteraction) {
        event.preventDefault();event.stopPropagation();
        const previous = rulerPointClickRef.current, now = performance.now();
        const doubleClick = previous?.pointId === pointId && now - previous.time <= 500 && Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<=10;
        rulerPointClickRef.current = doubleClick ? null : {pointId,time:now,x:event.clientX,y:event.clientY};
        if (!doubleClick) {
          if(cameraPanModeRef.current)beginCameraDragFromOverlay(event);
          return;
        }
        cameraPanModeRef.current=false;setCameraPanMode(false);
        if(threeRef.current)threeRef.current.cameraPanMode=false;
        activateRulerMove();setRulerToolsOpen(true);
      } else rulerPointClickRef.current=null;
      if (rulerDeleteModeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        removeRulerPoint(pointId);
        return;
      }
      if (rulerMoveModeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        rulerDragBeforeRef.current = rulerModelRef.current;
        rulerPointDragRef.current = { pointId, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY };
        if(event.shiftKey)updateRulerPointDrag(event.clientX,event.clientY,true);
        return;
      }
      if (!rulerModeRef.current) {
        return;
      }
      const point = rulerModelRef.current.points.find((candidate) => candidate.id === pointId);
      if (!point) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const state = threeRef.current;
      const world = state ? rulerPointWorld(state, point) : new THREE.Vector3(point.x, point.y, point.z);
      rulerShiftRef.current = event.shiftKey;
      selectRulerCandidate({ x: world.x, y: world.y, z: world.z, pointId, attachment: point.attachment });
    },
    [activateRulerMove, beginCameraDragFromOverlay, removeRulerPoint, selectRulerCandidate, updateRulerPointDrag],
  );

  useEffect(()=>{if(floorPickId && floorPickId!==selectedShape?.id){setFloorPickId(null);floorPickRef.current=null;}},[floorPickId,selectedShape?.id]);
  useEffect(()=>{if(floorPickRef.current && (rulerMode||rulerMoveMode||rulerDeleteMode||paintMode||faceMode||workplaneMode||cameraPanMode||modifierActive||stretchMeasureMode)){setFloorPickId(null);floorPickRef.current=null;clearFaceHighlight();}},[rulerMode,rulerMoveMode,rulerDeleteMode,paintMode,faceMode,workplaneMode,cameraPanMode,modifierActive,stretchMeasureMode]);
  const clearStretchPreview = useCallback((cancel=true) => {
    if(cancel){modelingRunRef.current++;modelingWorkerRef.current?.cancel();setModelingBusy(false);}
    const preview = stretchPreviewRef.current;
    if (preview) { preview.parent?.remove(preview); disposeObject(preview); stretchPreviewRef.current = null; if(threeRef.current)threeRef.current.needsRender=true; }
  }, []);
  useEffect(() => { clearStretchPreview(); }, [clearStretchPreview, shapes, selectedShape?.id, modifierActive]);
  useEffect(() => clearStretchPreview, [clearStretchPreview]);
  useEffect(()=>{
    if(!holeModeId){setHoleModel(null);return;}
    if(selectedShape?.id!==holeModeId){setHoleModeId(null);return;}
    const frame=requestAnimationFrame(()=>{try{const state=threeRef.current,shape=shapesRef.current.find(s=>s.id===holeModeId),object=state&&shape&&findShapeObject(state,shape.id);if(!shape||!object)return;const model=readHoleModel(shape,object);setHoleModel(previous=>{previous?.geometry.dispose();return model;});const pending=holePendingSelectionRef.current;if(pending){const match=model.profiles.find(p=>p.axis===pending.axis&&Math.abs(p.centerU-pending.centerU)<.02&&Math.abs(p.centerV-pending.centerV)<.02);setHoleSelected(match?.id??null);holePendingSelectionRef.current=null;}}catch(e){setHoleError(e instanceof Error?e.message:String(e));setHoleModel(null);}});
    return()=>cancelAnimationFrame(frame);
  },[holeModeId,selectedShape?.id,shapes]);
  useEffect(()=>{if(holeModeRef.current&&(paintMode||faceMode||workplaneMode||rulerMode||rulerMoveMode||rulerDeleteMode||cameraPanMode||modifierActive||stretchMeasureMode)){setHoleModeId(null);holeSketchRef.current=null;setHoleDrawWorld([]);}},[paintMode,faceMode,workplaneMode,rulerMode,rulerMoveMode,rulerDeleteMode,cameraPanMode,modifierActive,stretchMeasureMode]);
  useEffect(()=>{
    const state=threeRef.current,shape=shapes.find(s=>s.id===holeModeId),object=state&&shape&&findShapeObject(state,shape.id);if(!state||!shape||!object||!holeModel)return;
    const group=new THREE.Group();
    const world=(p:number[])=>object.localToWorld(new THREE.Vector3(p[0],p[1]-shape.height/2,p[2]));
    for(const profile of holeModel.profiles)for(const rim of [profile.rimA,profile.rimB]){const g=new THREE.BufferGeometry().setFromPoints(rim.map(world));const line=new THREE.LineLoop(g,new THREE.LineBasicMaterial({color:profile.id===holeSelected?"#ff8400":"#00bfe8",depthTest:true,transparent:true,opacity:.95}));group.add(line);}
    if(holeDrawWorld.length){const g=new THREE.BufferGeometry().setFromPoints(holeDrawWorld.map(p=>new THREE.Vector3(...p as [number,number,number])));group.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:"#ff8400",depthTest:false})));const dots=new THREE.BufferGeometry().setFromPoints(holeDrawWorld.slice(0,1).map(p=>new THREE.Vector3(...p as [number,number,number])));group.add(new THREE.Points(dots,new THREE.PointsMaterial({color:"#ff8400",size:10,sizeAttenuation:false,depthTest:false})));}
    setObjectRenderLayer(group,RENDER_LAYER_PREVIEWS);state.scene.add(group);state.needsRender=true;return()=>{group.parent?.remove(group);disposeObject(group);state.needsRender=true;};
  },[holeModeId,holeModel,holeSelected,holeDrawWorld,shapes]);
  const applyHole=async(edit:HoleEdit|null)=>{
    if(holeBusyRef.current)return;const state=threeRef.current,shape=shapesRef.current.find(s=>s.id===holeModeRef.current),model=holeModelRef.current,object=state&&shape&&findShapeObject(state,shape.id);if(!shape||!model||!object)return;
    const fingerprint=meshReplacementFingerprint(shape);holeBusyRef.current=true;setHoleBusy(true);setHoleError("");
    try{const old=model.profiles.find(p=>p.id===holeSelectedRef.current)??null;if(!old&&!edit)return;const runtime=await getManifoldRuntime();const updated=await changeMeshHole(shape,object,model,old,edit,runtime);const current=shapesRef.current.find(s=>s.id===shape.id);if(!current||meshReplacementFingerprint(current)!==fingerprint)throw new Error("Деталь изменилась во время расчёта. Повторите действие.");holePendingSelectionRef.current=edit;setHoleDraft(null);setHolePlacement(null);holeSketchRef.current=null;setHoleDrawWorld([]);onUpdateShape(shape.id,updated);}catch(e){setHoleError(e instanceof Error?e.message:String(e));}finally{holeBusyRef.current=false;setHoleBusy(false);}
  };holeApplyRef.current=edit=>void applyHole(edit);
  holePointerRef.current=(clientX,clientY,hover)=>{
    if(holeBusyRef.current)return;const state=threeRef.current,shape=shapesRef.current.find(s=>s.id===holeModeRef.current),model=holeModelRef.current,object=state&&shape&&findShapeObject(state,shape.id);if(!state||!shape||!model||!object)return;
    const rect=state.renderer.domElement.getBoundingClientRect();state.pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);state.raycaster.setFromCamera(state.pointer,state.camera);state.raycaster.layers.set(RENDER_LAYER_SHAPES);
    const world=(p:number[])=>object.localToWorld(new THREE.Vector3(p[0],p[1]-shape.height/2,p[2]));
    const base=(p:THREE.Vector3)=>object.worldToLocal(p.clone()).add(new THREE.Vector3(0,shape.height/2,0));
    const sketch=holeSketchRef.current;
    if(sketch){const hit=state.raycaster.ray.intersectPlane(sketch.plane,new THREE.Vector3());if(!hit)return;const p=base(hit),[u,v]=[0,1,2].filter(a=>a!==sketch.edit.axis);
      const firstWorld=world(new THREE.Vector3().setComponent(sketch.edit.axis,p.getComponent(sketch.edit.axis)).setComponent(u,sketch.points[0][0]).setComponent(v,sketch.points[0][1]).toArray()),screen=projectToScreen(firstWorld,state);const close=Math.hypot(screen.x-(clientX-rect.left),screen.y-(clientY-rect.top))<10;
      if(!hover&&close&&sketch.points.length>=3){const us=sketch.points.map(p=>p[0]),vs=sketch.points.map(p=>p[1]),edit={...sketch.edit,centerU:(Math.min(...us)+Math.max(...us))/2,centerV:(Math.min(...vs)+Math.max(...vs))/2,width:Math.max(...us)-Math.min(...us),height:Math.max(...vs)-Math.min(...vs),polygon:sketch.points};holeApplyRef.current(edit);return;}
      if(!hover)sketch.points.push([p.getComponent(u),p.getComponent(v)]);
      const points=[...sketch.points,...(hover?[[p.getComponent(u),p.getComponent(v)]]:[])];setHoleDrawWorld(points.map(q=>world(new THREE.Vector3().setComponent(sketch.edit.axis,p.getComponent(sketch.edit.axis)).setComponent(u,q[0]).setComponent(v,q[1]).toArray()).toArray()));return;
    }
    if(hover)return;
    try{
      const placement=holePlacementRef.current;
      if(!placement){const front=state.raycaster.intersectObject(object,true).find(h=>h.object instanceof THREE.Mesh&&h.object.userData.shapeSurface);let selected:{id:string;distance:number}|null=null;for(const profile of model.profiles)for(const rim of [profile.rimA,profile.rimB]){const points=rim.map(world),normal=new THREE.Vector3().setComponent(profile.axis,1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(object.matrixWorld)),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,points[0]),hit=state.raycaster.ray.intersectPlane(plane,new THREE.Vector3());if(!hit)continue;const p=base(hit),poly=rim.map(q=>[q[profile.u],q[profile.v]]);let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p.getComponent(profile.v))!==(b[1]>p.getComponent(profile.v))&&p.getComponent(profile.u)<(b[0]-a[0])*(p.getComponent(profile.v)-a[1])/(b[1]-a[1])+a[0])inside=!inside;}const distance=hit.distanceTo(state.raycaster.ray.origin);if(inside&&(!front||distance<=front.distance+.2)&&(!selected||distance<selected.distance))selected={id:profile.id,distance};}if(selected){setHoleSelected(selected.id);setHoleDraft(null);setHoleError("");}return;}
      const hit=state.raycaster.intersectObject(object,true).find(h=>h.object instanceof THREE.Mesh&&h.face&&h.object.userData.shapeSurface);if(!hit||!hit.face)throw new Error("Нажмите на плоскую стенку детали.");
      const normal=hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));const localNormal=normal.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(object.matrixWorld).transpose()).normalize();const axis=localNormal.toArray().reduce((best,n,i,a)=>Math.abs(n)>Math.abs(a[best])?i:best,0);if(Math.abs(localNormal.getComponent(axis))<.99999)throw new Error("Пока поддерживаются плоские стенки вдоль локальных осей детали.");
      const ray=new THREE.Raycaster(hit.point.clone().addScaledVector(normal,-.005),normal.clone().negate());ray.layers.set(RENDER_LAYER_SHAPES);const other=ray.intersectObject(object,true).find(h=>h.object instanceof THREE.Mesh&&h.object.userData.shapeSurface&&h.distance>.005);if(!other)throw new Error("Не найдена противоположная стенка.");const a=base(hit.point),b=base(other.point),[u,v]=[0,1,2].filter(i=>i!==axis);const edit:HoleEdit={kind:placement,axis,lower:Math.min(a.getComponent(axis),b.getComponent(axis)),upper:Math.max(a.getComponent(axis),b.getComponent(axis)),centerU:a.getComponent(u),centerV:a.getComponent(v),width:4,height:4};
      if(placement==='polygon'){holeSketchRef.current={edit,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(normal,hit.point),points:[[edit.centerU,edit.centerV]]};setHoleDrawWorld([hit.point.toArray()]);}else{setHoleDraft(edit);setHolePlacement(null);}setHoleSelected(null);setHoleError("");
    }catch(e){setHoleError(e instanceof Error?e.message:String(e));}
  };
  creationPointerRef.current=(x,y,hover)=>{const point=toPlanePointAtY(x,y,0);if(!point)return;const p=new THREE.Vector3(point.x,0,point.z);const points=creationPointsRef.current;if(hover){if(points.length)setCreationPreview([...points,p]);return;}try{const next=[...points,p];if(next.length===(creationKind==='triangle'?3:2)){const height=creationHeight.trim()?Number(creationHeight.replace(",",".")):NaN;const shape=drawnPrimitive(creationKind,next,height);onCreateShape(shape);creationPointsRef.current=[];setCreationPreview([]);setCreationError("");}else{creationPointsRef.current=next;setCreationPreview(next);}}catch(e){setCreationError(e instanceof Error?e.message:String(e));}};
  useEffect(()=>{const state=threeRef.current;if(!state||!creationMode||!creationPreview.length)return;let points=creationPreview.map(p=>p.clone().setY(.02));if(points.length>=2){const a=points[0],b=points[1];if(creationKind==='rectangle')points=[a,new THREE.Vector3(b.x,.02,a.z),b,new THREE.Vector3(a.x,.02,b.z),a];else if(creationKind==='circle'){const r=Math.hypot(b.x-a.x,b.z-a.z);points=Array.from({length:65},(_,i)=>new THREE.Vector3(a.x+r*Math.cos(i*Math.PI/32),.02,a.z+r*Math.sin(i*Math.PI/32)));}else if(points.length===3)points.push(points[0]);}
    const group=new THREE.Group(),g=new THREE.BufferGeometry().setFromPoints(points);group.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:"#ff8400",depthTest:false})));const dots=new THREE.BufferGeometry().setFromPoints(creationPointsRef.current);group.add(new THREE.Points(dots,new THREE.PointsMaterial({color:"#ff8400",size:7,sizeAttenuation:false,depthTest:false})));setObjectRenderLayer(group,RENDER_LAYER_PREVIEWS);state.scene.add(group);state.needsRender=true;return()=>{group.parent?.remove(group);disposeObject(group);state.needsRender=true;};
  },[creationMode,creationKind,creationPreview]);
  useEffect(()=>{if(creationMode&&(paintMode||faceMode||workplaneMode||rulerMode||rulerMoveMode||rulerDeleteMode||cameraPanMode||modifierActive||stretchMeasureMode||holeModeId||floorPickId)){setCreationMode(false);creationPointsRef.current=[];setCreationPreview([]);}},[creationMode,paintMode,faceMode,workplaneMode,rulerMode,rulerMoveMode,rulerDeleteMode,cameraPanMode,modifierActive,stretchMeasureMode,holeModeId,floorPickId]);
  const calculateDeformation = async (shape:WorkplaneShape,object:THREE.Object3D,operation:DeformationOperation,requireSelection=true) => {
    const run=++modelingRunRef.current;
    modelingWorkerRef.current??=new ModelingWorkerClient();setModelingBusy(true);
    try {
      const result=await modelingWorkerRef.current.request(snapshotModelingJob(shape,object,operation));
      if(run!==modelingRunRef.current||shapesRef.current.find(s=>s.id===shape.id)!==shape||(requireSelection&&selectedIdsRef.current[0]!==shape.id))throw canceledModelingJob();
      return prepareWorkerShape(result);
    } finally {if(run===modelingRunRef.current)setModelingBusy(false);}
  };
  const showDeformation = useCallback((updated:WorkplaneShape,preview:boolean) => {
    const state=threeRef.current;if(!state)throw new Error("Редактор ещё не готов.");
    const shape=updated;
    clearStretchPreview(false);
    if (preview) {
      const ghost = createShapeObject({ ...updated, color: "#ffad32" }, false,undefined,false,true);
      ghost.traverse(child => { if(child instanceof THREE.Mesh) {const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",child.geometry.getAttribute("position"));geometry.setAttribute("normal",child.geometry.getAttribute("normal"));child.geometry=geometry;replaceObjectMaterials(child,new THREE.MeshStandardMaterial({color:"#ffad32",transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide}));} });
      setObjectRenderLayer(ghost, RENDER_LAYER_PREVIEWS); state.scene.add(ghost); stretchPreviewRef.current = ghost; state.needsRender=true;
    } else { clearMoveDimensions(); onUpdateShape(shape.id, updated); }
  }, [onUpdateShape, clearMoveDimensions, clearStretchPreview]);
  const editStretchShape=async(options:AxialStretchOptions,preview:boolean)=>{const state=threeRef.current,shape=shapesRef.current.find(s=>s.id===selectedShape?.id),object=state&&shape&&findShapeObject(state,shape.id);if(!shape||!object)throw new Error("Выберите деталь.");showDeformation(await calculateDeformation(shape,object,{kind:"stretch",options}),preview);};
  const offsetBaselineRef=useRef<{key:string;shape:WorkplaneShape;expected:string}|null>(null);
  const [offsetBaseConnections,setOffsetBaseConnections]=useState<EndConnection[]|null>(null);
  const [offsetSessionVersion,setOffsetSessionVersion]=useState(0);
  useEffect(()=>{const baseline=offsetBaselineRef.current;if(!baseline)return;const current=shapes.find(s=>s.id===baseline.shape.id);if(selectedShape?.id!==baseline.shape.id||!current||meshReplacementFingerprint(current)!==baseline.expected){offsetBaselineRef.current=null;setOffsetBaseConnections(null);setOffsetSessionVersion(v=>v+1);}},[shapes,selectedShape?.id]);
  const editEndOffset=async(options:ConnectionOffsetOptions,preview:boolean)=>{
    const state=threeRef.current,shape=shapesRef.current.find(s=>s.id===selectedShape?.id),object=state&&shape&&findShapeObject(state,shape.id);if(!shape||!object)throw new Error("Выберите деталь.");
    const key=[shape.id,options.fixedFaceId,options.movingFaceId].join('|'),fingerprint=meshReplacementFingerprint(shape);
    let baseline=offsetBaselineRef.current;
    if(!baseline||baseline.key!==key||baseline.expected!==fingerprint){baseline={key,shape,expected:fingerprint};offsetBaselineRef.current=baseline;setOffsetBaseConnections(readEndConnections(shape,object));}
    const source=createShapeObject(baseline.shape,false);
    try{source.updateMatrixWorld(true);const snapshot=snapshotModelingJob(baseline.shape,source,{kind:"offset",options});
      // Snapshot the baseline geometry, but guard against edits to the current displayed shape.
      const run=++modelingRunRef.current;modelingWorkerRef.current??=new ModelingWorkerClient();setModelingBusy(true);
      let updated:WorkplaneShape;try{const result=await modelingWorkerRef.current.request(snapshot);if(run!==modelingRunRef.current||shapesRef.current.find(s=>s.id===shape.id)!==shape)throw canceledModelingJob();updated=prepareWorkerShape(result);}finally{if(run===modelingRunRef.current)setModelingBusy(false);}if(!preview)baseline.expected=meshReplacementFingerprint(updated);showDeformation(updated,preview);}finally{disposeObject(source);}
  };
  const resetEndOffset=(fixedFaceId:string,movingFaceId:string)=>{
    clearStretchPreview();const baseline=offsetBaselineRef.current,current=shapesRef.current.find(s=>s.id===selectedShape?.id);
    if(!baseline||baseline.key!==[current?.id,fixedFaceId,movingFaceId].join('|'))return;
    if(!current||meshReplacementFingerprint(current)!==baseline.expected)throw new Error("Деталь изменилась. Начните новое смещение от её текущего положения.");
    if(current.locked)throw new Error("Сначала разблокируйте деталь.");
    const original=meshReplacementFingerprint(baseline.shape);if(original===baseline.expected)return;
    baseline.expected=original;const restored={...Object.fromEntries(Object.keys(current).filter(key=>!(key in baseline.shape)).map(key=>[key,undefined])),...baseline.shape};showDeformation(restored,false);
  };
  useEffect(()=>{const frame=requestAnimationFrame(()=>{try{const state=threeRef.current,shape=shapesRef.current.find(s=>s.id===selectedShape?.id),object=state&&shape&&findShapeObject(state,shape.id);setEndConnections(shape&&object?readEndConnections(shape,object):[]);}catch{setEndConnections([]);}});return()=>cancelAnimationFrame(frame);},[shapes,selectedShape?.id]);
  const beginRulerStretch = (segmentId: string) => {
    const segment = rulerModelRef.current.segments.find(s => s.id === segmentId), state = threeRef.current;
    if (!segment || !state) return;
    const a = rulerModelRef.current.points.find(p => p.id === segment.startId), b = rulerModelRef.current.points.find(p => p.id === segment.endId);
    if (!a || !b) return;
    setStretchMeasureMode(true);setRulerActive(false);setRulerMoveMode(false);rulerMoveModeRef.current=false;setRulerDeleteMode(false);rulerDeleteModeRef.current=false;setHoleModeId(null);setPaintMode(false);setFaceMode(false);setCreationMode(false);creationPointsRef.current=[];setCreationPreview([]);onWorkplaneModeChange(false);leaveCameraPanMode();
    const length = rulerPointWorld(state, a).distanceTo(rulerPointWorld(state, b));
    setStretchEdit({segmentId,value:String(Number(length.toFixed(4))),error:""});
    requestAnimationFrame(() => { stretchInputRef.current?.focus(); stretchInputRef.current?.select(); });
  };
  const applyRulerStretch = async () => {
    const edit = stretchEditRef.current, state = threeRef.current;
    if (!edit || !state || rulerStretchPendingRef.current===edit) return;
    rulerStretchPendingRef.current=edit;
    try {
      const segment = rulerModelRef.current.segments.find(s => s.id === edit.segmentId);
      if (!segment || segment.edge) throw new Error("Для изменения размера поставьте рулетку между двумя точками, без режима длины ребра.");
      const a = rulerModelRef.current.points.find(p => p.id === segment.startId), b = rulerModelRef.current.points.find(p => p.id === segment.endId);
      if (!a?.attachment || !b?.attachment || a.attachment.shapeId !== b.attachment.shapeId) throw new Error("Обе точки должны быть прикреплены к одной детали.");
      const shape = shapesRef.current.find(s => s.id === a.attachment!.shapeId), object = shape && findShapeObject(state,shape.id);
      if (!shape || !object) throw new Error("Деталь не найдена.");
      const pa = object.worldToLocal(rulerPointWorld(state,a)), pb = object.worldToLocal(rulerPointWorld(state,b)), delta = pb.clone().sub(pa);
      const axisNames = ["x","y","z"] as const;
      const dimensions = [shapeWidth(shape),shape.height,shapeDepth(shape)];
      const outerAxes = [0,1,2].filter(i=>Math.abs(Math.min(pa.getComponent(i),pb.getComponent(i))+dimensions[i]/2)<=.05 && Math.abs(Math.max(pa.getComponent(i),pb.getComponent(i))-dimensions[i]/2)<=.05);
      const axis = stretchAxis === "auto" ? outerAxes.sort((a,b)=>Math.abs(delta.getComponent(b))-Math.abs(delta.getComponent(a)))[0] ?? 0 : axisNames.indexOf(stretchAxis);
      const length = dimensions[axis];
      if (Math.abs(Math.min(pa.getComponent(axis),pb.getComponent(axis)) + length/2) > .05 || Math.abs(Math.max(pa.getComponent(axis),pb.getComponent(axis)) - length/2) > .05) throw new Error("Поставьте точки на противоположные крайние грани выбранной оси. Для внутренних точек используйте поля «Растянуть корпус».");
      const desired = edit.value.trim() ? Number(edit.value.replace(",",".")) : NaN;
      const perpendicular = delta.lengthSq() - delta.getComponent(axis)**2;
      if (!Number.isFinite(desired) || desired <= 0 || desired**2 <= perpendicular) throw new Error("Размер должен быть положительным и больше поперечного смещения точек.");
      if (Math.abs(desired - delta.length()) < 0.0001) { stretchEditRef.current=null;setStretchEdit(null);return; }
      const target = Math.sqrt(desired**2 - perpendicular);
      const options: AxialStretchOptions = {axis:axisNames[axis],target,keepStart:stretchStart.trim()?Number(stretchStart.replace(",",".")):NaN,keepEnd:stretchEnd.trim()?Number(stretchEnd.replace(",",".")):NaN,anchor:stretchAnchor};
      const updated = await calculateDeformation(shape,object,{kind:"stretch",options},false);
      if(stretchEditRef.current!==edit)throw canceledModelingJob();
      // Keep the selected axis for subsequent edits, even after contraction changes the dominant dimension.
      setStretchAxis(axisNames[axis]);
      stretchEditRef.current = null; setStretchEdit(null); clearStretchPreview(); clearMoveDimensions();
      onUpdateShape(shape.id,updated);
    } catch(e) {
      if(e instanceof Error&&e.name==="AbortError")return;
      const next = {...edit,error:e instanceof Error?e.message:String(e)}; stretchEditRef.current=next;setStretchEdit(next);
      requestAnimationFrame(() => stretchInputRef.current?.focus());
    } finally {if(rulerStretchPendingRef.current===edit)rulerStretchPendingRef.current=null;}
  };

  useEffect(()=>{
    const handler=async(operation:string,params:Record<string,unknown>):Promise<unknown>=>{
      const assertActive=()=>{if(typeof params.__mcpExpiresAt === "number" && Date.now() >= params.__mcpExpiresAt)throw new Error("MCP command expired; no changes were applied.");};
      assertActive();
      const number=(key:string,fallback?:number)=>{const value=params[key]??fallback;if(typeof value!=="number"||!Number.isFinite(value))throw new Error(`Invalid ${key}`);return value;};
      if(operation==="estimate_plastic"){
        const state=threeRef.current;if(!state)throw new Error("Editor is not ready");
        const scope=params.scope==="all"?"all":"selected",settings={...DEFAULT_PLASTIC_SETTINGS};
        for(const key of Object.keys(settings) as (keyof PlasticSettings)[])if(params[key]!==undefined)settings[key]=number(key);
        validatePlasticSettings(settings);
        const source=shapesRef.current,selection=selectedIdsRef.current;
        const geometry=capturePlasticGeometry(source,selection,id=>findShapeObject(state,id),scope);
        const result=await estimatePlasticInWorker(geometry,settings,undefined,typeof params.__mcpExpiresAt==="number"?params.__mcpExpiresAt:undefined,{allowApproximateMeshes:params.allowApproximateMeshes===true});
        assertActive();if(source!==shapesRef.current||scope==="selected"&&selection!==selectedIdsRef.current)throw new Error("Model or selection changed during calculation. Run it again.");
        return{...result,settings,scope,method:"approximate_A_times_thickness_shell_and_infill",units:{volume:"cm3",mass:"g",length:"m"},limitations:["No slicing or automatic supports","No Boolean union/subtraction; inspect warnings","No self-intersection check"]};
      }
      if(operation==="clear_preview"){clearStretchPreview();return{previewCleared:true};}
      if(operation==="draw_object"){
        if(!["rectangle","circle","triangle"].includes(String(params.profile)))throw new Error("Invalid drawing profile");
        const raw=params.points;if(!Array.isArray(raw)||raw.length!==(params.profile==="triangle"?3:2)||raw.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=="number"||!Number.isFinite(n)||Math.abs(n)>100000)))throw new Error("Supply X/Z point pairs");
        const shape=drawnPrimitive(params.profile as DrawnPrimitiveKind,raw.map(p=>new THREE.Vector3(p[0],0,p[1])),number("height"));if(typeof params.name==="string"&&params.name.trim())shape.name=params.name.trim().slice(0,120);assertActive();onCreateShape(shape);return{objectId:shape.id,dimensions:{width:shape.width,height:shape.height,depth:shape.depth}};
      }
      const state=threeRef.current,shape=shapesRef.current.find(s=>s.id===params.id),object=state&&shape&&findShapeObject(state,shape.id);
      if(!state||!shape||!object)throw new Error("Object not found or hidden");
      const fingerprint=meshReplacementFingerprint(shape);
      if(operation==="read_connections"){
        const connections=readEndConnections(shape,object),connectionFrames=connections.slice(0,32).flatMap(f=>connections.slice(0,32).filter(m=>m.id!==f.id).map(m=>{try{return{fixedFaceId:f.id,movingFaceId:m.id,...connectionOffsetFrame(connections,{fixedFaceId:f.id,movingFaceId:m.id,keepFixed:0,keepMoving:0})};}catch{return null;}}).filter(Boolean));
        return{objectId:shape.id,expectedFingerprint:fingerprint,units:"mm",localAxes:"Y is height. Offsets use the U/V basis in connectionFrames; inclined and separated interior faces are supported. Frames are reported with zero protection and recalculated with requested protection at apply time.",connections:connections.map(({localPoints,...c})=>c),connectionFrames,floorFrames:connectionFrames.map(f=>({fixedFaceId:f!.fixedFaceId,movingFaceId:f!.movingFaceId,...floorConnectionFrame(connections,f!.fixedFaceId,f!.movingFaceId)}))};
      }
      if(operation==="read_holes"){const model=readHoleModel(shape,object);try{return{objectId:shape.id,expectedFingerprint:fingerprint,units:"mm",coordinateFrame:"Object local X/Z centered, Y based at zero; centerU/V refer to ascending perpendicular axes",bounds:{min:model.min,max:model.max},holes:model.profiles.map(({rimA,rimB,...p})=>({...p,polygon:p.kind==="polygon"?rimA.map(q=>[q[p.u],q[p.v]]):undefined}))};}finally{model.geometry.dispose();}}
      if(typeof params.expectedFingerprint!=="string"||params.expectedFingerprint!==fingerprint)throw new Error("Object changed. Read its current fingerprint before editing.");
      if(shape.locked)throw new Error("Unlock the object first");
      let updated:WorkplaneShape;
      if(operation==="offset_connection")updated=await calculateDeformation(shape,object,{kind:"offset",options:{fixedFaceId:String(params.fixedFaceId),movingFaceId:String(params.movingFaceId),mode:params.mode==="center"?"center":"offset",coordinateSystem:params.coordinateSystem==="floor"?"floor":"local",keepFixed:number("keepFixed",2),keepMoving:number("keepMoving",2),offsetU:number("offsetU",0),offsetV:number("offsetV",0)}},false);
      else if(operation==="stretch"){
        if(!["x","y","z"].includes(String(params.axis))||!["start","center","end"].includes(String(params.anchor??"start")))throw new Error("Invalid axis or anchor");
        updated=await calculateDeformation(shape,object,{kind:"stretch",options:{axis:params.axis as AxialStretchOptions["axis"],target:number("target"),keepStart:number("keepStart",2),keepEnd:number("keepEnd",2),anchor:(params.anchor??"start") as AxialStretchOptions["anchor"]}},false);
      }else if(operation==="rotate_floor"){
        let normal:THREE.Vector3|undefined,point:THREE.Vector3|undefined;
        if(params.faceId){const annotation=shape.faceAnnotations?.find(a=>a.id===params.faceId);if(!annotation)throw new Error("Named face not found");let surface:THREE.Mesh<THREE.BufferGeometry>|undefined;object.traverse(c=>{if(c instanceof THREE.Mesh&&c.userData.shapeSurface&&faceGeometryKey(c.geometry)===annotation.geometryKey)surface=c;});if(!surface)throw new Error("Face binding is stale");normal=new THREE.Vector3(...annotation.localNormal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(surface.matrixWorld));point=surface.localToWorld(new THREE.Vector3(...annotation.localPoint));}
        updated={...shape,...floorRotation(shape,object,number("degrees",0),normal,point)};
      }else if(operation==="edit_hole"){
        if(!["add","update","remove"].includes(String(params.action)))throw new Error("Invalid hole action");
        const model=readHoleModel(shape,object);try{
          const old=model.profiles.find(h=>h.id===params.holeId);if(params.action!=="add"&&!old)throw new Error("Hole not found. Read holes again");
          const axis=params.axis===undefined?old?.axis:["x","y","z"].indexOf(String(params.axis));if(axis===undefined||axis<0)throw new Error("Specify the hole axis");
          const kind=(params.kind??old?.kind??"circle") as HoleKind;if(!["circle","rectangle","polygon"].includes(kind))throw new Error("Invalid hole profile");
          const width=number("diameter",number("width",old?.width??4)),height=kind==="circle"?width:number("height",old?.height??width);
          const edit:HoleEdit|null=params.action==="remove"?null:{axis,kind,lower:number("lower",old?.lower),upper:number("upper",old?.upper),centerU:number("centerU",old?.centerU),centerV:number("centerV",old?.centerV),width,height,polygon:params.polygon as number[][]|undefined};
          if(edit?.kind==="polygon"&&!edit.polygon&&old)edit.polygon=old.rimA.map(p=>[edit.centerU+(p[old.u]-old.centerU)*edit.width/old.width,edit.centerV+(p[old.v]-old.centerV)*edit.height/old.height]);
          updated=await changeMeshHole(shape,object,model,params.action==="add"?null:old!,edit,await getManifoldRuntime());
          if(meshReplacementFingerprint(shapesRef.current.find(s=>s.id===shape.id)??shape)!==fingerprint)throw new Error("Object changed during the operation");
        }finally{model.geometry.dispose();}
      }else if(operation==="paint_face"||operation==="edit_face_label"){
        const face=shape.faceAnnotations?.find(a=>a.id===params.faceId);if(!face)throw new Error("Named face not found");
        if(operation==="edit_face_label"){if(params.remove!==true&&(typeof params.name!=="string"||!params.name.trim()))throw new Error("Provide a face name");updated={...shape,faceAnnotations:params.remove===true?shape.faceAnnotations!.filter(a=>a.id!==face.id):shape.faceAnnotations!.map(a=>a.id===face.id?{...a,name:String(params.name).trim().slice(0,120)}:a)};}
        else{if(params.erase!==true&&(typeof params.color!=="string"||!/^#[0-9a-f]{6}$/i.test(params.color)))throw new Error("Use a #RRGGBB color");const rest=(shape.facePaints??[]).filter(p=>p.geometryKey!==face.geometryKey||!p.triangleIndices.some(i=>face.triangleIndices.includes(i)));updated={...shape,facePaints:params.erase===true?rest:[...rest,{...face,id:crypto.randomUUID(),color:String(params.color)}]};}
      }else throw new Error(`Unknown modeling operation: ${operation}`);
      assertActive();
      if(params.preview===true){showDeformation(updated,true);return{preview:true,objectId:shape.id,sourceFingerprint:fingerprint,dimensions:{width:updated.width,height:updated.height,depth:updated.depth}};}
      assertActive();clearStretchPreview();onUpdateShape(shape.id,updated);
      return{applied:true,objectId:shape.id,expectedFingerprint:meshReplacementFingerprint(updated),dimensions:{width:updated.width,height:updated.height,depth:updated.depth}};
    };
    window.scketch3dwebModelingCommand=handler;return()=>{if(window.scketch3dwebModelingCommand===handler)delete window.scketch3dwebModelingCommand;};
  });

  const handleRulerPointPointerMove = useCallback(
    (event: ReactPointerEvent<SVGCircleElement>, pointId: string) => {
      const drag = rulerPointDragRef.current;
      if (!rulerMoveModeRef.current || !drag || drag.pointId !== pointId || drag.pointerId !== event.pointerId) return;
      event.preventDefault();event.stopPropagation();
      updateRulerPointDrag(event.clientX,event.clientY,event.shiftKey);
    },[updateRulerPointDrag],
  );

  const handleRulerPointPointerUp = useCallback(
    (event: ReactPointerEvent<SVGCircleElement>, pointId: string) => {
      const drag = rulerPointDragRef.current;
      if (!drag || drag.pointId !== pointId || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      rulerPointDragRef.current = null;
      const current = rulerModelRef.current;
      commitRulerModel({ ...current, hover: null }, rulerDragBeforeRef.current ?? current);
      rulerDragBeforeRef.current = null;
    },
    [commitRulerModel],
  );

  const handleRulerSegmentPointerDown = useCallback(
    (event: ReactPointerEvent<SVGElement>, segmentId: string) => {
      if (event.button !== 0) {
        return;
      }
      if (rulerDeleteModeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        removeRulerSegment(segmentId);
        return;
      }
      if (!rulerModeRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      rulerShiftRef.current = event.shiftKey;
      const candidate = resolveRulerCandidate(event.clientX, event.clientY);
      if (candidate) {
        selectRulerCandidate(candidate);
      }
    },
    [removeRulerSegment, resolveRulerCandidate, selectRulerCandidate],
  );

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const shortcutView = !event.ctrlKey && !event.metaKey && !event.altKey
        ? VIEW_FACE_SHORTCUTS[event.key]
        : undefined;
      if(event.key==="Escape" && creationModeRef.current){event.preventDefault();if(creationPointsRef.current.length){creationPointsRef.current=[];setCreationPreview([]);}else setCreationMode(false);setCreationError("");
      } else if(event.key==="Escape" && holeModeRef.current){event.preventDefault();if(holePlacementRef.current||holeSketchRef.current){setHolePlacement(null);setHoleDraft(null);holeSketchRef.current=null;setHoleDrawWorld([]);}else setHoleModeId(null);setHoleError("");
      } else if(event.key === "Escape" && floorPickRef.current){event.preventDefault();setFloorPickId(null);floorPickRef.current=null;clearFaceHighlight();
      } else if (event.key === "Escape" && stretchMeasureMode) { event.preventDefault();setStretchMeasureMode(false);setStretchEdit(null);stretchEditRef.current=null;clearStretchPreview();
      } else if (event.key === "Escape" && paintModeRef.current) { event.preventDefault();setPaintMode(false);clearFaceHighlight();
      } else if (event.key === "Escape" && cameraPanModeRef.current) { event.preventDefault();setCameraPanMode(false);
      } else if (event.key === "Escape" && (faceModeRef.current || selectedHoleRef.current)) {
        event.preventDefault(); setFaceMode(false); setFaceDraft(null); selectedHoleRef.current=null;
      } else if (event.key === "Escape" && workplaneModeRef.current) {
        event.preventDefault();
        onWorkplaneModeChange(false);
      } else if (event.key === "Escape" && (rulerToolsOpen || rulerModeRef.current || rulerDeleteModeRef.current || rulerMoveModeRef.current)) {
        event.preventDefault();
        setRulerActive(false);
        rulerDeleteModeRef.current = false;
        setRulerDeleteMode(false);
        rulerMoveModeRef.current = false;
        setRulerMoveMode(false);
        rulerPointDragRef.current = null;
        setRulerToolsOpen(false);
      } else if (shortcutView) {
        event.preventDefault();
        setViewCubeFace(shortcutView);
      } else if (key === "w") {
        event.preventDefault();
        if (!event.shiftKey || !setPlacementWorkplaneAtSelection()) {
          togglePlacementWorkplane();
        }
      } else if (key === "f" || event.key === "Home") {
        event.preventDefault();
        resetView();
      } else if (key === "o" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        toggleProjection();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomCamera(0.72);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomCamera(1.28);
      }
    };

    const captureToolEscape=(event:KeyboardEvent)=>{
      if(event.key!=="Escape"||isTypingTarget(event.target))return;
      if(creationModeRef.current||holeModeRef.current||floorPickRef.current||stretchMeasureMode||paintModeRef.current||cameraPanModeRef.current||faceModeRef.current||selectedHoleRef.current||workplaneModeRef.current||rulerToolsOpen||rulerModeRef.current||rulerMoveModeRef.current||rulerDeleteModeRef.current){event.stopImmediatePropagation();handleKeyDown(event);}
    };
    window.addEventListener("keydown",captureToolEscape,true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {window.removeEventListener("keydown",captureToolEscape,true);window.removeEventListener("keydown", handleKeyDown);};
  }, [stretchMeasureMode, clearStretchPreview, clearFaceHighlight, onWorkplaneModeChange, resetView, rulerToolsOpen, setPlacementWorkplaneAtSelection, setRulerActive, setViewCubeFace, togglePlacementWorkplane, toggleProjection, zoomCamera]);

  const [quickToolsHost,setQuickToolsHost]=useState<HTMLElement|null>(null);
  const [plasticOpen,setPlasticOpen]=useState(false);
  const [inspectorSectionRequest,setInspectorSectionRequest]=useState<InspectorSectionRequest|null>(null);
  useEffect(()=>{setQuickToolsHost(document.getElementById('scketch3dweb-modeling-quick-tools'));},[]);
  const toggleCreationTool=()=>{setCreationMode(v=>!v);creationPointsRef.current=[];setCreationPreview([]);setCreationError("");setHoleModeId(null);setStretchMeasureMode(false);setFloorPickId(null);setPaintMode(false);setFaceMode(false);setRulerActive(false);setRulerMoveMode(false);rulerMoveModeRef.current=false;setRulerDeleteMode(false);rulerDeleteModeRef.current=false;setCameraPanMode(false);cameraPanModeRef.current=false;if(threeRef.current)threeRef.current.cameraPanMode=false;onWorkplaneModeChange(false);clearStretchPreview();};
  const toggleRulerStretchTool=()=>{clearStretchPreview();setStretchEdit(null);stretchEditRef.current=null;setStretchMeasureMode(v=>!v);setRulerActive(false);setRulerMoveMode(false);rulerMoveModeRef.current=false;setRulerDeleteMode(false);rulerDeleteModeRef.current=false;setPaintMode(false);setFaceMode(false);onWorkplaneModeChange(false);};

  const clearQuickModes=()=>{clearStretchPreview();setRulerActive(false);setRulerMoveMode(false);rulerMoveModeRef.current=false;setRulerDeleteMode(false);rulerDeleteModeRef.current=false;setRulerToolsOpen(false);setStretchMeasureMode(false);setCreationMode(false);creationPointsRef.current=[];setCreationPreview([]);setPaintMode(false);setFaceMode(false);setFloorPickId(null);leaveCameraPanMode();onWorkplaneModeChange(false);};
  const activateQuickSection=(section:string)=>{if(!selectedShape)return;clearQuickModes();setHoleModeId(null);holeSketchRef.current=null;setHolePlacement(null);setHoleDrawWorld([]);setInspectorSectionRequest({section,shapeId:selectedShape.id,sequence:Date.now()});};
  const beginQuickHole=(kind:HoleKind)=>{clearStretchPreview();setHolePlacement(kind);setHoleDraft(null);setHoleSelected(null);setHoleError('');holeSketchRef.current=null;setHoleDrawWorld([]);};
  const quickHoles=Boolean(selectedShape&&holeModeId===selectedShape.id);
  const quickSingle=selectedIds.length===1&&selectedShape&&!selectedShape.hidden;
  const quickDisabled=Boolean(selectedShape?.locked);
  const settingsTool=(id:string,label:string,short:string,icon:QuickModelingAction['icon']):QuickModelingAction=>({id,label,short,icon,disabled:quickDisabled,run:()=>activateQuickSection(id)});
  const quickActions:QuickModelingAction[]=quickHoles?[
    {id:'body',label:'Solid',short:'Solid',icon:Box,run:()=>activateQuickSection('properties')},
    {id:'round-hole',label:'Add round hole',short:'Circle',icon:CirclePlus,disabled:quickDisabled,active:holePlacement==='circle',run:()=>beginQuickHole('circle')},
    {id:'rectangle-hole',label:'Add rectangular hole',short:'Rectangle',icon:Square,disabled:quickDisabled,active:holePlacement==='rectangle',run:()=>beginQuickHole('rectangle')},
    {id:'free-hole',label:'Draw hole contour',short:'Contour',icon:Pencil,disabled:quickDisabled,active:holePlacement==='polygon',run:()=>beginQuickHole('polygon')},
    ...(holeSelected?[{id:'remove-hole',label:'Remove hole',short:'Delete',icon:Trash2,disabled:quickDisabled||holeBusy,run:()=>void applyHole(null)}]:[]),
  ]:quickSingle?[
    settingsTool('properties','Properties','Size',SlidersHorizontal),
    ...(!selectedShape.groupedShapes?.length?[settingsTool('offset','Offset duct connection','Offset',MoveRight),settingsTool('floor','Rotate on floor','Turn',RotateCw),settingsTool('stretch','Stretch body','Stretch',Expand)]:[]),
    ...(selectedShape.kind!=='gear'?[settingsTool('taper','Taper','Taper',Triangle)]:[settingsTool('gear-teeth','Teeth','Teeth',Gear),...(selectedShape.gearType==='helical'?[settingsTool('gear-helix','Helix','Helix',RotateCw)]:[])]),
    {id:'holes',label:'Object holes',short:'Holes',icon:Circle,disabled:quickDisabled||Boolean(selectedShape.groupedShapes?.length),run:()=>{clearQuickModes();setHoleError('');setHoleDraft(null);setHoleSelected(null);setHolePlacement(null);holeSketchRef.current=null;setHoleDrawWorld([]);setHoleModeId(selectedShape.id);}},
    settingsTool('color','Shape color','Color',Palette),
    {id:'paint',label:'Paint face',short:'Paint',icon:PaintBucket,disabled:quickDisabled,active:paintMode,run:()=>{const active=!paintMode;clearQuickModes();setPaintMode(active);setFaceError('');}},
    {id:'cutter',label:'Use as Boolean cutter',short:'Cutter',icon:Circle,disabled:quickDisabled,active:Boolean(selectedShape.hole),run:()=>onUpdateShape(selectedShape.id,{hole:!selectedShape.hole})},
    ...(canSeparateParts&&onSeparateParts?[{id:'separate',label:'Separate Parts',short:'Separate',icon:Split,disabled:quickDisabled,run:onSeparateParts}]:[]),
    ...(selectedShape.sketchProfile&&onEditSketch?[{id:'edit-sketch',label:'Edit sketch',short:'Sketch',icon:Pencil,disabled:quickDisabled,run:onEditSketch}]:[]),
    {id:'labels',label:'Face labels',short:'Labels',icon:Tag,disabled:quickDisabled,active:faceMode,run:()=>{const active=!faceMode;clearQuickModes();setFacePanelOpen(true);setFaceMode(active);setFaceDraft(null);setFaceError('');}},
  ]:[{id:'create',label:'Draw object',short:'Create',icon:Pencil,active:creationMode,run:toggleCreationTool},{id:'ruler',label:'Ruler tools',short:'Ruler',icon:Ruler,active:rulerMode||rulerMoveMode||rulerDeleteMode,run:toggleRulerTools},{id:'ruler-resize',label:'Resize by ruler',short:'Resize',icon:ArrowLeftRight,active:stretchMeasureMode,run:toggleRulerStretchTool}];
  quickActions.push({id:'plastic',label:'Plastic estimate',short:'Plastic',icon:Calculator,active:plasticOpen,run:()=>setPlasticOpen(open=>!open)});
  return (
    <main className={`workplane-stage ${challengeTutorial ? `key-tag-tutorial-active ${challengeTutorialCollapsed ? "key-tag-tutorial-collapsed" : ""}` : ""}`}>
      {quickToolsHost&&!modifierActive&&createPortal(<ModelingQuickTools actions={quickActions} mode={quickHoles?"Object holes":quickSingle?"Edit object":"Modeling tools"}/>,quickToolsHost)}
      <L><div className="view-cube" aria-label="View orientation cube" onPointerDown={(event) => event.stopPropagation()}>
        <div className="view-cube-inner" ref={viewCubeRef}>
          <L><button type="button" className="cube-face cube-top" aria-label="Bottom view" aria-keyshortcuts="6" title="Bottom view (6)" onClick={() => setViewCubeFace("bottom")}><T text={"BOTTOM"} /></button></L>
          <L><button type="button" className="cube-face cube-bottom" aria-label="Top view" aria-keyshortcuts="5" title="Top view (5)" onClick={() => setViewCubeFace("top")}><T text={"TOP"} /></button></L>
          <L><button type="button" className="cube-face cube-front" aria-label="Front view" aria-keyshortcuts="1" title="Front view (1)" onClick={() => setViewCubeFace("front")}><T text={"FRONT"} /></button></L>
          <L><button type="button" className="cube-face cube-back" aria-label="Back view" aria-keyshortcuts="2" title="Back view (2)" onClick={() => setViewCubeFace("back")}><T text={"BACK"} /></button></L>
          <L><button type="button" className="cube-face cube-right" aria-label="Right view" aria-keyshortcuts="4" title="Right view (4)" onClick={() => setViewCubeFace("right")}><T text={"RIGHT"} /></button></L>
          <L><button type="button" className="cube-face cube-left" aria-label="Left view" aria-keyshortcuts="3" title="Left view (3)" onClick={() => setViewCubeFace("left")}><T text={"LEFT"} /></button></L>
        </div>
      </div></L>

      <L><div className={`camera-controls ${cameraControlsCollapsed ? "collapsed" : ""}`} aria-label="Camera controls">
        {cameraControlsCollapsed ? (
          <L><button className="camera-controls-toggle" aria-label="Show camera controls" title="Show controls" aria-expanded={false} onClick={() => setCameraControlsCollapsed(false)}>
            <ChevronRight size={24} strokeWidth={2.25} aria-hidden="true" />
          </button></L>
        ) : (
          <>
            <L><button className="camera-controls-toggle" aria-label="Hide camera controls" title="Hide controls" aria-expanded={true} onClick={collapseCameraControls}>
              <ChevronLeft size={24} strokeWidth={2.25} aria-hidden="true" />
            </button></L>
            <L><button aria-label="Home" onClick={resetView}>
              <Home size={24} strokeWidth={2.25} />
            </button></L>
            <L><button aria-label="Pan camera" title="Pan camera: drag with the left mouse button" aria-pressed={cameraPanMode} className={cameraPanMode ? "active" : ""} onClick={() => { setPaintMode(false);setFaceMode(false);setRulerActive(false);setRulerDeleteMode(false);rulerDeleteModeRef.current=false;setRulerMoveMode(false);rulerMoveModeRef.current=false;onWorkplaneModeChange(false);setCameraPanMode(active => !active); }}><Move size={24} strokeWidth={2.1} /></button></L>
            <L><button aria-label="Zoom in" onClick={() => zoomCamera(0.7)}>
              <Plus size={28} strokeWidth={2.15} />
            </button></L>
            <L><button aria-label="Zoom out" onClick={() => zoomCamera(1.35)}>
              <Minus size={28} strokeWidth={2.15} />
            </button></L>
            <div className="workplane-control-group">
              <L><button
                className={workplaneMode ? "active" : ""}
                aria-label="Place workplane"
                title="Place workplane (W)"
                aria-pressed={workplaneMode}
                onClick={togglePlacementWorkplane}
              >
                <PanelsTopLeft size={25} strokeWidth={2.1} aria-hidden="true" />
              </button></L>
            </div>
            <div className="ruler-control-group">
              <L><button aria-label="Draw object" title="Draw object" aria-pressed={creationMode} className={creationMode?"active":""} onClick={toggleCreationTool}><Pencil size={25}/></button></L>
              {creationMode&&<div className="stretch-measure-popover" onPointerDown={e=>e.stopPropagation()}><strong><T text="Draw object"/></strong>
                <L><label className="select-property"><span><T text="Object profile"/></span><select aria-label="Object profile" value={creationKind} onChange={e=>{setCreationKind(e.target.value as DrawnPrimitiveKind);creationPointsRef.current=[];setCreationPreview([]);setCreationError("");}}><option value="rectangle"><T text="Rectangle"/></option><option value="circle"><T text="Circle"/></option><option value="triangle"><T text="Triangle"/></option></select></label></L>
                <label className="text-property"><span><T text="Extrusion height (mm)"/></span><L><input aria-label="Extrusion height (mm)" inputMode="decimal" value={creationHeight} onChange={e=>setCreationHeight(e.target.value)}/></L></label>
                <p><T text={creationKind==='rectangle'?'Click two opposite corners on the floor.':creationKind==='circle'?'Click the center, then a point on the circle.':'Click three triangle vertices on the floor.'}/></p><p><T text="Edit dimensions in Properties after drawing. Esc clears points, then exits."/></p>{creationError&&<p role="alert">{creationError}</p>}
              </div>}
            </div>
            <div className="ruler-control-group">
              <L><button aria-label="Resize by ruler" title="Resize by ruler" aria-pressed={stretchMeasureMode} className={stretchMeasureMode ? "active" : ""} onClick={toggleRulerStretchTool}><ArrowLeftRight size={25}/></button></L>
              {stretchMeasureMode && <div className="stretch-measure-popover" onPointerDown={e=>e.stopPropagation()}>
                <strong><T text="Resize by ruler" /></strong><p><T text="Double-click a measurement, enter the desired distance in mm, then click outside or press Enter. Esc cancels." /></p>
                <L><label className="select-property"><span><T text="Stretch axis" /></span><select aria-label="Ruler stretch axis" value={stretchAxis} onChange={e=>setStretchAxis(e.target.value as typeof stretchAxis)}><option value="auto"><T text="Automatic" /></option><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label></L>
                <L><label className="text-property"><span><T text="Preserve start (mm)" /></span><L><input aria-label="Ruler preserve start" inputMode="decimal" value={stretchStart} onChange={e=>setStretchStart(e.target.value)}/></L></label></L>
                <L><label className="text-property"><span><T text="Preserve end (mm)" /></span><L><input aria-label="Ruler preserve end" inputMode="decimal" value={stretchEnd} onChange={e=>setStretchEnd(e.target.value)}/></L></label></L>
                <L><label className="select-property"><span><T text="Fixed reference" /></span><select aria-label="Ruler fixed reference" value={stretchAnchor} onChange={e=>setStretchAnchor(e.target.value as typeof stretchAnchor)}><option value="start"><T text="Start (−)" /></option><option value="center"><T text="Center" /></option><option value="end"><T text="End (+)" /></option></select></label></L>
                <p><T text="Place both ruler points on opposite outer faces of one object. Protected ends keep their shape; features in the middle change size." /></p>
              </div>}
            </div>
            <div className="ruler-control-group">
              <button aria-label="Заливка грани" title="Заливка грани" aria-pressed={paintMode} className={paintMode ? "active" : ""} onClick={() => {setCameraPanMode(false);setFaceMode(false);setFaceDraft(null);setRulerActive(false);setRulerDeleteMode(false);rulerDeleteModeRef.current=false;setRulerMoveMode(false);rulerMoveModeRef.current=false;onWorkplaneModeChange(false);setPaintMode(active=>!active);setFaceError("");}}><PaintBucket size={25} strokeWidth={2.1} /></button>
              {paintMode && <div className="face-paint-popover"><strong>Заливка грани</strong><label>Цвет<input type="color" aria-label="Цвет грани" value={paintColor} onChange={event=>{setPaintColor(event.target.value);setPaintErase(false);}} /></label><button type="button" aria-pressed={paintErase} onClick={()=>setPaintErase(active=>!active)}>{paintErase ? "Стирание включено" : "Стереть заливку"}</button><span>Нажмите на плоскую грань. Esc — выход.</span>{faceError && <span role="alert">{faceError}</span>}</div>}
            </div>
            <div className="ruler-control-group">
              <L><button
                className={`ruler-trigger ${rulerMode || rulerMoveMode || rulerDeleteMode ? "active" : ""}`}
                aria-label="Ruler tools"
                aria-pressed={rulerMode || rulerMoveMode || rulerDeleteMode}
                title="Ruler tools"
                aria-expanded={rulerToolsOpen}
                aria-controls="ruler-tool-popover"
                onClick={toggleRulerTools}
              >
                <Ruler size={26} strokeWidth={2.2} aria-hidden="true" />
              </button></L>
              {rulerToolsOpen ? (
                <L><div id="ruler-tool-popover" className="ruler-tool-popover" aria-label="Ruler actions">
                  <L><button className={rulerMode ? "active" : ""} aria-label="Add measurement" title="Add measurement" aria-pressed={rulerMode} onClick={activateRulerAdd}>
                    <Plus size={21} strokeWidth={2.4} aria-hidden="true" />
                  </button></L>
                  <L><button className={rulerMoveMode ? "active" : ""} aria-label="Move measurement points" title="Move measurement points" aria-pressed={rulerMoveMode} onClick={activateRulerMove}>
                    <MousePointer2 size={20} strokeWidth={2.25} aria-hidden="true" />
                  </button></L>
                  <L><button className={`ruler-delete-button ${rulerDeleteMode ? "active" : ""}`} aria-label="Delete measurement part" title="Delete measurement part" aria-pressed={rulerDeleteMode} onClick={activateRulerDelete}>
                    <X size={20} strokeWidth={2.4} aria-hidden="true" />
                  </button></L>
                </div></L>
              ) : null}
            </div>
          </>
        )}
      </div></L>

      <L><section className={`workplane-wrap ${cameraPanMode ? "camera-pan-mode" : ""} ${faceMode || paintMode || floorPickId || holeModeId || creationMode ? "face-label-mode" : ""} ${workplaneMode ? "placing-workplane" : ""} ${rulerMode ? "ruler-mode" : ""} ${rulerDeleteMode ? "ruler-delete-mode" : ""} ${rulerMoveMode ? "ruler-move-mode" : ""} ${modifierActive ? "modifier-edge-pick" : ""}`} aria-label="Workplane">
        <div className="workplane-plane">
          <div className="named-face-overlay" aria-hidden="true">
            {faceLabelsVisible && faceReadings.filter(r=>r.status==="valid" && r.screen?.visible).map(r=><span key={`${r.shapeId}:${r.id}`} style={{left:r.screen!.x,top:r.screen!.y}}>{r.status==="valid" ? r.label : r.name}</span>)}
            {selectedHoleOverlay && <><svg className="hole-selection-outline"><polyline points={selectedHoleOverlay.points} fill="none" stroke="#ff8400" strokeWidth="3" /></svg><span className="hole-diameter-label" style={{left:selectedHoleOverlay.x,top:selectedHoleOverlay.y}}>{selectedHoleOverlay.label}</span></>}
          </div>

          <div
            className="three-workplane-host"
            ref={hostRef}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={handleDrop}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onPointerLeave={handlePointerLeave}
          />
          {!workplaneMode && marqueeRect ? <div className="selection-marquee" style={marqueeRect} /> : null}
          {!workplaneMode && moveDimensionsEnabled && moveDimensionOverlay ? (
            <MoveDimensionOverlay
              overlay={moveDimensionOverlay}
              active={moveDimensionOverlay.active}
              onCommit={commitMoveDimension}
            />
          ) : null}
          {!creationMode && !holeModeId && !floorPickId && !paintMode && !cameraPanMode && !faceMode && !workplaneMode && transformOverlay && !alignMode && !mirrorMode && !rulerMode && !rulerDeleteMode && !rulerMoveMode && !modifierActive ? (
            <TransformOverlay
              box={transformOverlay}
              measureKey={pinnedMeasureKey ?? hoverMeasureKey}
              editingDimension={editingDimension}
              editingRotation={editingRotation}
              rotationReadout={rotationReadout}
              showRotationWheel={activeRotationWheel}
              hideSelectionChrome={activeTransformKind === "rotate"}
              hideDimensionMarks={false}
              rotationWheelAxis={rotationWheelAxis}
              pinnedRotationWheelView={pinnedRotationWheelView}
              onBeginCameraDrag={beginCameraDragFromOverlay}
              onCameraWheel={forwardCameraWheelFromOverlay}
              onBeginTransform={beginTransform}
              onMoveTransform={updateTransform}
              onFinishTransform={finishTransform}
              onHoverMeasure={setHoverMeasureKey}
              onPinMeasure={setPinnedMeasureKey}
              onBeginDimensionEdit={beginDimensionEdit}
              onBeginLiftEdit={beginLiftEdit}
              onEditingDimensionChange={(value) => setEditingDimension((current) => (current ? { ...current, value } : current))}
              onCommitDimensionEdit={commitDimensionEdit}
              onCancelDimensionEdit={cancelDimensionEdit}
              onBeginRotationEdit={beginRotationEdit}
              onEditingRotationChange={(value) => setEditingRotation((current) => (current ? { ...current, value } : current))}
              onCommitRotationEdit={commitRotationEdit}
              onCancelRotationEdit={cancelRotationEdit}
            />
          ) : null}
          {!workplaneMode && alignOverlay ? <AlignOverlay overlay={alignOverlay} onAlign={onAlignSelection} onPreview={onAlignPreview} onPreviewClear={onAlignPreviewClear} /> : null}
          {!workplaneMode && mirrorOverlay ? <MirrorOverlay overlay={mirrorOverlay} onMirror={onMirrorSelection} onPreview={onMirrorPreview} onPreviewClear={onMirrorPreviewClear} /> : null}
          {!workplaneMode && rulerOverlay && (rulerOverlay.points.length > 0 || rulerOverlay.hover) ? (
            <RulerOverlay
              overlay={rulerOverlay}
              stretchMode={stretchMeasureMode}
              onLabelEdit={beginRulerStretch}
              startPointId={rulerModel.startPointId}
              active={rulerMode || rulerMoveMode}
              deleteMode={rulerDeleteMode}
              moveMode={rulerMoveMode}
              onPointPointerDown={handleRulerPointPointerDown}
              onPointPointerMove={handleRulerPointPointerMove}
              onPointPointerUp={handleRulerPointPointerUp}
              onSegmentPointerDown={handleRulerSegmentPointerDown}
              onWheel={forwardCameraWheelFromOverlay}
            />
          ) : null}
          {stretchEdit && rulerOverlay?.segments.some(s=>s.id===stretchEdit.segmentId) && (()=>{const label=rulerOverlay.segments.find(s=>s.id===stretchEdit.segmentId)!;return <div className="ruler-size-editor" style={{left:label.labelX,top:label.labelY}} onPointerDown={e=>e.stopPropagation()}>
            <L><input ref={stretchInputRef} autoFocus aria-label="Desired ruler distance (mm)" inputMode="decimal" value={stretchEdit.value} onChange={e=>{const next={...stretchEdit,value:e.target.value,error:""};stretchEditRef.current=next;setStretchEdit(next);}} onBlur={applyRulerStretch} onKeyDown={e=>{e.stopPropagation();if(e.key==="Enter"){e.preventDefault();applyRulerStretch();}if(e.key==="Escape"){e.preventDefault();stretchEditRef.current=null;setStretchEdit(null);}}}/></L>
            {stretchEdit.error && <span role="alert">{stretchEdit.error}</span>}
          </div>;})()}
        </div>
      </section></L>

      {!modifierActive ? (
        <div className="workplane-right-sidebar" aria-label="Параметры объекта и метки граней">
        <PlasticEstimatorPanel open={plasticOpen} onClose={()=>setPlasticOpen(false)} shapes={shapes} selectedIds={selectedIds} onCapture={scope=>{const state=threeRef.current;if(!state)throw new Error("Редактор ещё не готов.");return capturePlasticGeometry(shapesRef.current,selectedIdsRef.current,id=>findShapeObject(state,id),scope);}}/>
        <SceneObjectsPanel shapes={shapes} selectedIds={selectedIds} onUpdate={onUpdateShape} onSelect={(id,toggle)=>{setCreationMode(false);creationPointsRef.current=[];setCreationPreview([]);setRulerActive(false);setRulerMoveMode(false);rulerMoveModeRef.current=false;setRulerDeleteMode(false);rulerDeleteModeRef.current=false;setFaceMode(false);setPaintMode(false);setStretchMeasureMode(false);onSelectShape(id,toggle?"toggle":"replace");}}/>
      {selectedShape && !modifierActive && !rulerMode && !rulerDeleteMode && !rulerMoveMode ? (
        <ShapeInspector
          shape={selectedShape}
          sectionRequest={inspectorSectionRequest}
          snap={snap}
          snapOpen={snapOpen}
          workspace={workspace}
          onUpdate={(patch, options) => {
            clearMoveDimensions();
            onUpdateShape(selectedShape.id, patchWithResizeAnchor(selectedShape, patch, options?.resizeAxis, lastResizeAnchorRef.current));
          }}
          holesMode={holeModeId===selectedShape.id}
          onHolesModeChange={active=>{clearStretchPreview();setHoleError("");setHoleDraft(null);setHoleSelected(null);setHolePlacement(null);holeSketchRef.current=null;setHoleDrawWorld([]);setFloorPickId(null);setFaceMode(false);setPaintMode(false);setCameraPanMode(false);cameraPanModeRef.current=false;if(threeRef.current)threeRef.current.cameraPanMode=false;onWorkplaneModeChange(false);setHoleModeId(active?selectedShape.id:null);}}
          holeEditor={<HoleEditorPanel profiles={holeModel?.profiles??[]} selected={holeModel?.profiles.find(p=>p.id===holeSelected)??null} draft={holeDraft} min={holeModel?.min??[0,0,0]} busy={holeBusy} error={holeError} drawing={Boolean(holePlacement)} onSelect={id=>{setHoleSelected(id);setHoleDraft(null);setHolePlacement(null);holeSketchRef.current=null;setHoleDrawWorld([]);setHoleError("");}} onBegin={kind=>{setHolePlacement(kind);setHoleDraft(null);setHoleSelected(null);setHoleError("");holeSketchRef.current=null;setHoleDrawWorld([]);}} onApply={edit=>void applyHole(edit)} onCancel={()=>{setHolePlacement(null);setHoleDraft(null);holeSketchRef.current=null;setHoleDrawWorld([]);setHoleError("");}}/>}
          onEndOffsetPairChange={()=>{clearStretchPreview();offsetBaselineRef.current=null;const state=threeRef.current,shape=shapesRef.current.find(s=>s.id===selectedShape?.id),object=state&&shape&&findShapeObject(state,shape.id);setOffsetBaseConnections(null);setEndConnections(shape&&object?readEndConnections(shape,object):[]);}}
          endConnections={offsetBaseConnections??endConnections}
          offsetSessionVersion={offsetSessionVersion}
          onEndOffsetReset={resetEndOffset}
          onEndOffset={options=>editEndOffset(options,false)}
          onEndOffsetPreview={options=>editEndOffset(options,true)}
          onEndOffsetClear={clearStretchPreview}
          floorPicking={floorPickId===selectedShape.id}
          onFloorRotate={degrees=>{const state=threeRef.current,object=state&&findShapeObject(state,selectedShape.id);if(!state||!object)return;clearStretchPreview();onUpdateShape(selectedShape.id,floorRotation(selectedShape,object,degrees));}}
          onFloorPick={()=>{onWorkplaneModeChange(false);clearStretchPreview();setStretchMeasureMode(false);setStretchEdit(null);stretchEditRef.current=null;setPaintMode(false);setFaceMode(false);setFaceDraft(null);setCameraPanMode(false);cameraPanModeRef.current=false;if(threeRef.current)threeRef.current.cameraPanMode=false;setFaceError("");setFloorPickId(id=>id===selectedShape.id?null:selectedShape.id);}}
          onStretch={options=>editStretchShape(options,false)}
          onStretchPreview={options=>{if(options)return editStretchShape(options,true);else clearStretchPreview();}}
          onSnapChange={setSnap}
          onSnapOpenChange={setSnapOpen}
          onEditSketch={selectedShape.sketchProfile ? onEditSketch : undefined}
          canSeparateParts={canSeparateParts}
          onSeparateParts={onSeparateParts}
          onInteractionActiveChange={onInteractionActiveChange}
        />
      ) : null}
      <aside className="face-annotations-panel" aria-label="Метки граней">
        <div className={`property-card ${facePanelOpen ? "" : "collapsed"}`}>
          <div className="face-annotation-header">
          <button type="button" className="property-card-header" aria-expanded={facePanelOpen} aria-controls="face-annotations-content" onClick={() => setFacePanelOpen(open => !open)}>
            <span>Метки граней</span><ChevronUp className={facePanelOpen ? "" : "collapsed"} size={25} strokeWidth={2.8} aria-hidden="true" />
          </button>
          <button type="button" className="inspector-header-icon face-label-visibility" aria-label={faceLabelsVisible ? "Скрыть метки на модели" : "Показать метки на модели"} title={faceLabelsVisible ? "Скрыть метки на модели" : "Показать метки на модели"} aria-pressed={faceLabelsVisible} onClick={() => setFaceLabelsVisible(visible => !visible)}>
            {faceLabelsVisible ? <Eye size={19} aria-hidden="true" /> : <EyeOff size={19} aria-hidden="true" />}
          </button>
          </div>
          {facePanelOpen && <div id="face-annotations-content" className="property-list face-annotation-content">
        <button type="button" aria-label="Метка грани" aria-pressed={faceMode} className={`inspector-action-button face-add-label ${faceMode ? "active" : ""}`} onClick={() => { setFaceMode(!faceMode); setRulerActive(false); setRulerDeleteMode(false); setRulerMoveMode(false); onWorkplaneModeChange(false); setFaceDraft(null); setFaceError(""); }}><Plus size={17} strokeWidth={2.5} aria-hidden="true" /><span>Метка грани</span></button>
        {faceMode && <p className="face-annotation-hint">Нажмите на плоскую грань и задайте имя. Esc — выход.</p>}
        {faceError && <p className="face-annotation-error" role="alert">{faceError}</p>}
        {faceDraft && <p className="face-selection-status" role="status">Грань выделена. Введите имя.</p>}
        {faceDraft && <form className="face-annotation-form" onSubmit={event => { event.preventDefault(); const name=faceName.trim(); const shape=shapesRef.current.find(s=>s.id===faceDraft.shapeId); if(!name || !shape)return; onUpdateShape(shape.id,{faceAnnotations:[...(shape.faceAnnotations??[]).filter(a=>a.id!==faceDraft.annotation.id),{...faceDraft.annotation,name}]}); setFaceDraft(null);setFaceMode(false); }}>
          <label className="text-property"><span>Имя грани</span><input autoFocus aria-label="Имя грани" value={faceName} maxLength={120} onChange={event=>setFaceName(event.target.value)} placeholder="Например: фланец вентилятора" required /></label>
          <div className="face-form-actions"><button className="inspector-action-button" type="submit">Сохранить метку</button><button className="inspector-action-button" type="button" onClick={()=>setFaceDraft(null)}>Отмена</button></div>
        </form>}
        {faceReadings.map(reading=><div className="face-annotation-row" key={`${reading.shapeId}:${reading.id}`}>
          <button className="face-annotation-select" type="button" onClick={()=>onSelectShape(reading.shapeId)}><span className="face-annotation-name">{reading.name}</span><span className="face-annotation-details">{reading.status === "valid" ? `${reading.lengthMm.toFixed(2)} × ${reading.widthMm.toFixed(2)} мм · ${reading.areaMm2.toFixed(2)} мм²` : "Привязка устарела"}</span></button>
          <button className="inspector-header-icon" type="button" aria-label={`Переименовать ${reading.name}`} onClick={()=>{ const shape=shapesRef.current.find(s=>s.id===reading.shapeId);const annotation=shape?.faceAnnotations?.find(a=>a.id===reading.id);if(annotation){setFaceDraft({shapeId:reading.shapeId,annotation});setFaceName(annotation.name);} }}><Pencil size={16} strokeWidth={2} aria-hidden="true" /></button>
          <button className="inspector-header-icon" type="button" aria-label={`Удалить метку ${reading.name}`} onClick={()=>{const shape=shapesRef.current.find(s=>s.id===reading.shapeId);if(shape)onUpdateShape(shape.id,{faceAnnotations:shape.faceAnnotations?.filter(a=>a.id!==reading.id)});}}><Trash2 size={16} strokeWidth={2} aria-hidden="true" /></button>
        </div>)}
          </div>}
        </div>
      </aside>
        </div>
      ) : null}

      {!selectedShape ? (
        <div className="grid-settings">
          <SnapGridControl snap={snap} snapOpen={snapOpen} onSnapChange={setSnap} onSnapOpenChange={setSnapOpen} />
        </div>
      ) : null}

      {modelingBusy&&<div className="modeling-worker-status" role="status">Расчёт геометрии…</div>}
      {settingsOpen ? (
        <WorkspaceSettingsModal
          workspace={workspace}
          snap={snap}
          themePreference={themePreference}
          moveDimensionsEnabled={moveDimensionsEnabled}
          showProjectNameInToolbar={showProjectNameInToolbar}
          onWorkspaceChange={setWorkspace}
          onSnapChange={setSnap}
          onThemePreferenceChange={onThemePreferenceChange}
          onMoveDimensionsEnabledChange={changeMoveDimensionsEnabled}
          onShowProjectNameInToolbarChange={onShowProjectNameInToolbarChange}
          onMakeDefault={makeWorkspaceDefault}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {challengeTutorial ? <GuidedLessonPanel key={`${workspaceSettingsKey}:${challengeTutorial}`} lessonId={challengeTutorial} projectId={workspaceSettingsKey} shapes={shapes} onFinish={onChallengeTutorialFinish} collapsed={challengeTutorialCollapsed} onCollapsedChange={setChallengeTutorialCollapsed} /> : null}
    </main>
  );
}

function createThreeScene(host: HTMLDivElement): ThreeState {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = DEFAULT_WORKSPACE.showShadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f8fbfc");

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 6000);
  camera.layers.enable(RENDER_LAYER_SHAPES);
  camera.layers.enable(RENDER_LAYER_HELPERS);
  camera.layers.enable(RENDER_LAYER_MODIFIERS);
  camera.layers.enable(RENDER_LAYER_PREVIEWS);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 0.72;
  controls.panSpeed = 0.65;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.minDistance = 18;
  controls.maxDistance = 4200;
  controls.minZoom = 0.02;
  controls.maxZoom = 100;
  // Allow the documented OrbitControls pole limits so Top and Bottom views can
  // settle on the vertical axis instead of being held roughly 3.4 degrees off it.
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.target.copy(CAMERA_TARGET);

  const ambient = new THREE.HemisphereLight("#ffffff", "#d6edf5", 2.1);
  scene.add(ambient);

  const key = new THREE.DirectionalLight("#ffffff", 3.1);
  key.position.set(70, 130, 75);
  key.castShadow = true;
  key.shadow.camera.left = -130;
  key.shadow.camera.right = 130;
  key.shadow.camera.top = 130;
  key.shadow.camera.bottom = -130;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00008;
  key.shadow.normalBias = 0.045;
  scene.add(key);

  const fill = new THREE.DirectionalLight("#c8f4ff", 1.2);
  fill.position.set(-95, 45, -60);
  scene.add(fill);

  const workplaneLayer = new THREE.Group();
  workplaneLayer.name = "Workplane";
  workplaneLayer.layers.set(RENDER_LAYER_WORKPLANE);
  const workplanePreviewLayer = new THREE.Group();
  workplanePreviewLayer.name = "WorkplanePreview";
  workplanePreviewLayer.layers.set(RENDER_LAYER_PREVIEWS);
  workplanePreviewLayer.visible = false;
  const shapeLayer = new THREE.Group();
  shapeLayer.name = "Shapes";
  shapeLayer.layers.set(RENDER_LAYER_SHAPES);
  const helperLayer = new THREE.Group();
  helperLayer.name = "SelectionHelpers";
  helperLayer.layers.set(RENDER_LAYER_HELPERS);
  const transformGuideLayer = new THREE.Group();
  transformGuideLayer.name = "TransformGuides";
  transformGuideLayer.layers.set(RENDER_LAYER_HELPERS);
  const moveDimensionLayer = new THREE.Group();
  moveDimensionLayer.name = "MoveDimensions";
  moveDimensionLayer.layers.set(RENDER_LAYER_HELPERS);
  const modifierLayer = new THREE.Group();
  modifierLayer.name = "EdgeModifier";
  modifierLayer.layers.set(RENDER_LAYER_MODIFIERS);
  scene.add(workplaneLayer, workplanePreviewLayer, shapeLayer, helperLayer, transformGuideLayer, moveDimensionLayer, modifierLayer);

  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { threshold: 1.15 };
  (raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    updateCameraViewport(state.camera, width, height);
    [state.transformGuideLayer, state.moveDimensionLayer].forEach((layer) => {
      layer.traverse((child) => {
        const material = (child as THREE.Mesh).material;
        const materials = Array.isArray(material) ? material : material ? [material] : [];
        materials.forEach((candidate) => {
          if (candidate instanceof LineMaterial) {
            candidate.resolution.set(width, height);
          }
        });
      });
    });
    state.needsRender = true;
  };

  const state: ThreeState = {
    renderer,
    scene,
    camera,
    controls,
    workplaneLayer,
    workplanePreviewLayer,
    shapeLayer,
    helperLayer,
    transformGuideLayer,
    moveDimensionLayer,
    modifierLayer,
    shapeRecords: new Map<string, ShapeRenderRecord>(),
    officialShapeLayerActive: false,
    raycaster,
    pointer,
    dragPlane,
    animationId: 0,
    cameraPanMode: false,
    needsRender: true,
    wasCameraMoving: false,
    lastOverlaySync: 0,
    lastViewCubeSync: 0,
    rotationHandleSides: null,
    disposeInteractionListeners: () => {},
    resize,
  };
  const requestRender = () => {
    state.needsRender = true;
  };
  const configureScketch3DwebMouseButtons = (event: PointerEvent) => {
    controls.mouseButtons.LEFT = event.button === 0 && (state.cameraPanMode || event.ctrlKey || event.metaKey) ? THREE.MOUSE.PAN : null;
    if (state.cameraPanReturn && (event.button === 1 || (event.button === 0 && controls.mouseButtons.LEFT === THREE.MOUSE.PAN))) armCameraPanReturn(state.cameraPanReturn, state.camera, controls.target);
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  };
  const resetScketch3DwebMouseButtons = () => {
    controls.mouseButtons.LEFT = null;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  };
  const preventContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };
  controls.addEventListener("change", requestRender);
  renderer.domElement.addEventListener("pointerdown", configureScketch3DwebMouseButtons, { capture: true });
  renderer.domElement.addEventListener("pointerup", resetScketch3DwebMouseButtons);
  renderer.domElement.addEventListener("pointercancel", resetScketch3DwebMouseButtons);
  renderer.domElement.addEventListener("contextmenu", preventContextMenu);
  renderer.domElement.addEventListener("wheel", requestRender, { passive: true });
  renderer.domElement.addEventListener("pointerdown", requestRender);
  state.disposeInteractionListeners = () => {
    controls.removeEventListener("change", requestRender);
    renderer.domElement.removeEventListener("pointerdown", configureScketch3DwebMouseButtons, { capture: true });
    renderer.domElement.removeEventListener("pointerup", resetScketch3DwebMouseButtons);
    renderer.domElement.removeEventListener("pointercancel", resetScketch3DwebMouseButtons);
    renderer.domElement.removeEventListener("contextmenu", preventContextMenu);
    renderer.domElement.removeEventListener("wheel", requestRender);
    renderer.domElement.removeEventListener("pointerdown", requestRender);
  };
  rebuildWorkplane(state, DEFAULT_WORKSPACE);
  return state;
}

function frameScene(state:ThreeState){
  const bounds=new THREE.Box3().setFromObject(state.shapeLayer);
  const result=frameCameraBounds(state.camera,bounds,CAMERA_HOME.clone().sub(CAMERA_TARGET));
  if(!result)return false;
  state.framedSceneBounds=bounds;
  state.controls.target.copy(result.center);
  state.controls.maxDistance=Math.max(4200,result.distance*1.5);
  state.controls.update();
  state.cameraPanReturn=cameraPanReturnBaseline(state.camera,state.controls.target);
  return true;
}

function resetCamera(state: ThreeState) {
  state.camera.up.set(0, 1, 0);
  state.camera.position.copy(CAMERA_HOME);
  state.controls.target.copy(CAMERA_TARGET);
  if (state.camera instanceof THREE.OrthographicCamera) {
    state.camera.zoom = 1;
    const distance = CAMERA_HOME.distanceTo(CAMERA_TARGET);
    const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
    const canvas = state.renderer.domElement;
    updateOrthographicFrustum(state.camera, canvas.clientWidth / Math.max(1, canvas.clientHeight), halfHeight);
  } else {
    state.camera.zoom = 1;
  }
  state.camera.lookAt(CAMERA_TARGET);
  state.camera.updateProjectionMatrix();
  state.controls.update();
  state.cameraPanReturn = cameraPanReturnBaseline(state.camera, state.controls.target);
}

function updateCameraViewport(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  width: number,
  height: number,
) {
  const aspect = width / Math.max(1, height);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = aspect;
  } else {
    const halfHeight = Math.max(0.001, (camera.top - camera.bottom) / 2);
    updateOrthographicFrustum(camera, aspect, halfHeight);
    return;
  }
  camera.updateProjectionMatrix();
}

function updateOrthographicFrustum(camera: THREE.OrthographicCamera, aspect: number, halfHeight: number) {
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}

function toggleCameraProjection(state: ThreeState) {
  const current = state.camera;
  const target = state.controls.target;
  const canvas = state.renderer.domElement;
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const offset = current.position.clone().sub(target);
  const direction = offset.lengthSq() > 0
    ? offset.clone().normalize()
    : CAMERA_HOME.clone().sub(CAMERA_TARGET).normalize();
  let next: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  if (current instanceof THREE.PerspectiveCamera) {
    const visibleHalfHeight = Math.max(
      0.001,
      offset.length() * Math.tan(THREE.MathUtils.degToRad(current.getEffectiveFOV() / 2)),
    );
    next = new THREE.OrthographicCamera(
      -visibleHalfHeight * aspect,
      visibleHalfHeight * aspect,
      visibleHalfHeight,
      -visibleHalfHeight,
      current.near,
      current.far,
    );
    next.position.copy(current.position);
  } else {
    const visibleHalfHeight = Math.max(0.001, (current.top - current.bottom) / (2 * current.zoom));
    const distance = clamp(
      visibleHalfHeight / Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)),
      22,
      4200,
    );
    next = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, current.near, current.far);
    next.position.copy(target).addScaledVector(direction, distance);
  }

  next.up.copy(current.up);
  next.layers.mask = current.layers.mask;
  next.lookAt(target);
  next.updateProjectionMatrix();
  next.updateMatrixWorld();
  state.camera = next;
  state.controls.object = next;
  state.controls.update();
  state.needsRender = true;
}

function setCameraToViewFace(state: ThreeState, face: ViewCubeFace) {
  const offset = state.camera.position.clone().sub(state.controls.target);
  const distance = clamp(offset.length(), 22, 4200);
  const directionByFace: Record<ViewCubeFace, THREE.Vector3> = {
    top: new THREE.Vector3(0, 1, 0),
    bottom: new THREE.Vector3(0, -1, 0),
    front: new THREE.Vector3(0, 0, 1),
    back: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    left: new THREE.Vector3(-1, 0, 0),
  };
  const direction = directionByFace[face].clone().normalize();

  state.camera.up.set(0, 1, 0);
  state.camera.position.copy(state.controls.target).add(direction.multiplyScalar(distance));
  state.camera.lookAt(state.controls.target);
  state.camera.updateProjectionMatrix();
  state.controls.update();
  state.needsRender = true;
}

function constrainCamera(state: ThreeState, workspace: WorkspaceSettings) {
  const target = state.controls.target;
  const previousTarget = target.clone();
  target.x = clamp(target.x, -workspace.width / 2, workspace.width / 2);
  target.y = clamp(target.y, Math.min(CAMERA_MIN_TARGET_Y,state.framedSceneBounds?.min.y??CAMERA_MIN_TARGET_Y), Math.max(CAMERA_MAX_TARGET_Y,state.framedSceneBounds?.max.y??CAMERA_MAX_TARGET_Y));
  target.z = clamp(target.z, -workspace.depth / 2, workspace.depth / 2);

  const targetShift = target.clone().sub(previousTarget);
  if (targetShift.lengthSq() > 0) {
    state.camera.position.add(targetShift);
    state.camera.updateProjectionMatrix();
  }
}

function syncViewCube(state: ThreeState, cube: HTMLDivElement | null) {
  if (!cube) {
    return;
  }

  const offset = state.camera.position.clone().sub(state.controls.target);
  const horizontalDistance = Math.max(0.001, Math.hypot(offset.x, offset.z));
  const pitch = THREE.MathUtils.radToDeg(Math.atan2(offset.y, horizontalDistance));
  const yaw = THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z));
  cube.style.transform = `rotateX(${-pitch}deg) rotateY(${-yaw}deg)`;
}

function setObjectRenderLayer(object: THREE.Object3D, layer: number) {
  object.traverse((child) => child.layers.set(layer));
}

function freezeStaticObjectMatrices(object: THREE.Object3D) {
  object.traverse((child) => {
    child.updateMatrix();
    child.matrixAutoUpdate = false;
  });
  object.updateMatrixWorld(true);
}

function refreshFrozenObjectMatrix(object: THREE.Object3D) {
  object.updateMatrix();
  object.updateMatrixWorld(true);
}

function rebuildWorkplane(
  state: ThreeState | null,
  workspace: WorkspaceSettings,
  theme: ResolvedAppTheme = "light",
  placementWorkplane: PlacementWorkplane = horizontalPlacementWorkplane(),
) {
  if (!state) {
    return;
  }

  const palette = workplaneThemePalette(theme, workspace.background, workspace.gridColor);
  disposeChildren(state.workplaneLayer);
  state.scene.background = new THREE.Color(palette.sceneBackground);
  state.renderer.shadowMap.enabled = workspace.showShadows;
  state.controls.zoomSpeed = 0.28 + workspace.zoomSpeed * 0.09;

  const activeIsBase = placementWorkplaneIsBase(placementWorkplane);
  const addPlane = (workplane: PlacementWorkplane, muted: boolean, showMarker: boolean) => {
    const group = new THREE.Group();
    group.name = muted ? "ReferenceWorkplane" : "ActiveWorkplane";
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(workspace.width, workspace.depth),
      new THREE.MeshStandardMaterial({
        color: muted
          ? theme !== "light" ? "#59646b" : "#b8c0c5"
          : palette.surface.color,
        transparent: true,
        opacity: muted ? (theme !== "light" ? 0.17 : 0.22) : palette.surface.opacity,
        roughness: 0.92,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    surface.name = muted ? "WorkplaneBaseReference" : "WorkplaneBase";
    surface.rotation.x = -Math.PI / 2;
    surface.receiveShadow = workspace.showShadows && !muted;
    group.add(surface);

    if (workspace.showGrid) {
      group.add(createGridLines(
        workspace.width,
        workspace.depth,
        workspace.gridBlockSize,
        theme,
        muted ? theme !== "light" ? "#76828a" : "#99a3aa" : workspace.gridColor,
      ));
    }
    if (showMarker) {
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: theme !== "light" ? "#d7f4ff" : "#17405c",
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 12), markerMaterial);
      stem.position.y = 2.2;
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.2, 18), markerMaterial);
      arrow.position.y = 5.7;
      const marker = new THREE.Group();
      marker.name = "WorkplaneNormal";
      marker.add(stem, arrow);
      group.add(marker);
    }
    group.position.set(workplane.origin.x, workplane.origin.y, workplane.origin.z);
    group.quaternion.copy(placementWorkplaneQuaternion(workplane));
    state.workplaneLayer.add(group);
  };

  addPlane(horizontalPlacementWorkplane(), !activeIsBase, false);
  if (!activeIsBase) {
    addPlane(placementWorkplane, false, true);
  }
  state.workplaneLayer.position.set(0, 0, 0);
  state.workplaneLayer.quaternion.identity();
  setObjectRenderLayer(state.workplaneLayer, RENDER_LAYER_WORKPLANE);
  freezeStaticObjectMatrices(state.workplaneLayer);
}

function syncWorkplaneHoverPreview(
  state: ThreeState | null,
  workplane: PlacementWorkplane | null,
  workspace: WorkspaceSettings,
  theme: ResolvedAppTheme,
) {
  if (!state) return;
  let layer = state.workplanePreviewLayer;
  if (!layer) {
    layer = new THREE.Group();
    layer.name = "WorkplanePreview";
    layer.layers.set(RENDER_LAYER_PREVIEWS);
    layer.visible = false;
    state.workplanePreviewLayer = layer;
    state.scene.add(layer);
  }
  if (!workplane) {
    layer.visible = false;
    state.needsRender = true;
    return;
  }

  const previewSize = clamp(workspace.gridBlockSize * 6, 18, 42);
  const signature = `${theme}:${workspace.gridBlockSize}:${previewSize}`;
  if (layer.userData.previewSignature !== signature) {
    disposeChildren(layer);
    layer.userData.previewSignature = signature;
    const color = theme !== "light" ? "#69d9ff" : "#079bc6";
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(previewSize, previewSize),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.renderOrder = 950;
    layer.add(patch);

    const outlineMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const half = previewSize / 2;
    const outlinePoints = [
      -half, WORKPLANE_LINE_ELEVATION, -half, half, WORKPLANE_LINE_ELEVATION, -half,
      half, WORKPLANE_LINE_ELEVATION, -half, half, WORKPLANE_LINE_ELEVATION, half,
      half, WORKPLANE_LINE_ELEVATION, half, -half, WORKPLANE_LINE_ELEVATION, half,
      -half, WORKPLANE_LINE_ELEVATION, half, -half, WORKPLANE_LINE_ELEVATION, -half,
    ];
    const outlineGeometry = new THREE.BufferGeometry();
    outlineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(outlinePoints, 3));
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.renderOrder = 951;
    layer.add(outline);

    const markerMaterial = new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.4, 12), markerMaterial);
    stem.position.y = 1.9;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.6, 16), markerMaterial);
    arrow.position.y = 4.7;
    const marker = new THREE.Group();
    marker.add(stem, arrow);
    marker.renderOrder = 952;
    layer.add(marker);
  }

  const normal = new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z);
  layer.position.set(
    workplane.origin.x + normal.x * 0.04,
    workplane.origin.y + normal.y * 0.04,
    workplane.origin.z + normal.z * 0.04,
  );
  layer.quaternion.copy(placementWorkplaneQuaternion(workplane));
  layer.visible = true;
  setObjectRenderLayer(layer, RENDER_LAYER_PREVIEWS);
  layer.updateMatrixWorld(true);
  state.needsRender = true;
}

function createGridLines(
  width = WORKPLANE_WIDTH,
  depth = WORKPLANE_DEPTH,
  blockSize = DEFAULT_WORKSPACE.gridBlockSize,
  theme: ResolvedAppTheme = "light",
  gridColor = DEFAULT_WORKSPACE.gridColor,
) {
  const group = new THREE.Group();
  const palette = workplaneThemePalette(theme, DEFAULT_WORKSPACE.background, gridColor).grid;
  const minor = new THREE.LineBasicMaterial({ ...palette.minor, transparent: true, depthWrite: false });
  const major = new THREE.LineBasicMaterial({ ...palette.major, transparent: true, depthWrite: false });
  const axis = new THREE.LineBasicMaterial({ ...palette.axis, transparent: true, depthWrite: false });
  const minorPoints: number[] = [];
  const majorPoints: number[] = [];
  const axisPoints: number[] = [];
  const borderPoints: number[] = [];
  const pushLine = (points: number[], from: [number, number, number], to: [number, number, number]) => {
    points.push(...from, ...to);
  };
  const step = clamp(blockSize, MIN_GRID_BLOCK_SIZE, MAX_GRID_BLOCK_SIZE);
  for (const { coordinate: centeredX, index } of interiorWorkplaneGridCoordinates(width, step)) {
    const points = centeredX === 0 ? axisPoints : index % WORKPLANE_MAJOR_GRID_INTERVAL === 0 ? majorPoints : minorPoints;
    pushLine(points, [centeredX, WORKPLANE_LINE_ELEVATION, -depth / 2], [centeredX, WORKPLANE_LINE_ELEVATION, depth / 2]);
  }

  for (const { coordinate: centeredZ, index } of interiorWorkplaneGridCoordinates(depth, step)) {
    const points = centeredZ === 0 ? axisPoints : index % WORKPLANE_MAJOR_GRID_INTERVAL === 0 ? majorPoints : minorPoints;
    pushLine(points, [-width / 2, WORKPLANE_LINE_ELEVATION, centeredZ], [width / 2, WORKPLANE_LINE_ELEVATION, centeredZ]);
  }

  const border = new THREE.LineBasicMaterial({ ...palette.border, transparent: true, depthWrite: false });
  pushLine(borderPoints, [-width / 2, WORKPLANE_LINE_ELEVATION, -depth / 2], [width / 2, WORKPLANE_LINE_ELEVATION, -depth / 2]);
  pushLine(borderPoints, [width / 2, WORKPLANE_LINE_ELEVATION, -depth / 2], [width / 2, WORKPLANE_LINE_ELEVATION, depth / 2]);
  pushLine(borderPoints, [width / 2, WORKPLANE_LINE_ELEVATION, depth / 2], [-width / 2, WORKPLANE_LINE_ELEVATION, depth / 2]);
  pushLine(borderPoints, [-width / 2, WORKPLANE_LINE_ELEVATION, depth / 2], [-width / 2, WORKPLANE_LINE_ELEVATION, -depth / 2]);

  group.add(linesFromPoints(minorPoints, minor));
  group.add(linesFromPoints(majorPoints, major));
  group.add(linesFromPoints(axisPoints, axis));
  group.add(linesFromPoints(borderPoints, border));

  return group;
}

function linesFromPoints(points: number[], material: THREE.LineBasicMaterial) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 1;
  return lines;
}

type CutPreviewShapeFrame = {
  shape: WorkplaneShape;
  worldBounds: THREE.Box3;
};

function shapeCutPreviewFrames(state: ThreeState, shapes: WorkplaneShape[]) {
  return shapes.reduce<Record<string, CutPreviewShapeFrame>>((frames, shape) => {
    const object = findShapeObject(state, shape.id);
    if (!object) {
      return frames;
    }
    object.updateMatrixWorld(true);
    const worldBounds = new THREE.Box3().setFromObject(object);
    if (!worldBounds.isEmpty()) {
      frames[shape.id] = { shape, worldBounds };
    }
    return frames;
  }, {});
}

type CutPreviewBrushCacheEntry = {
  signature: string;
  brush: Brush;
};

const cutPreviewBrushCache = new WeakMap<THREE.Object3D, CutPreviewBrushCacheEntry>();
const cutPreviewEvaluator = new Evaluator();
cutPreviewEvaluator.useGroups = false;
cutPreviewEvaluator.attributes = ["position", "normal"];

function cutPreviewObjectSignature(root: THREE.Object3D) {
  const parts: string[] = [];
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.visible || !(child.geometry instanceof THREE.BufferGeometry)) {
      return;
    }
    const relativeMatrix = inverseRoot.clone().multiply(child.matrixWorld);
    parts.push(child.geometry.uuid, ...relativeMatrix.elements.map((value) => value.toFixed(5)));
  });
  return parts.join(":");
}

function cutPreviewBrushFromObject(root: THREE.Object3D) {
  const signature = cutPreviewObjectSignature(root);
  const cached = cutPreviewBrushCache.get(root);
  if (cached?.signature === signature) {
    cached.brush.matrixAutoUpdate = false;
    cached.brush.matrix.copy(root.matrixWorld);
    cached.brush.matrixWorld.copy(root.matrixWorld);
    return cached.brush;
  }

  const positions: number[] = [];
  const point = new THREE.Vector3();
  const inverseRoot = root.matrixWorld.clone().invert();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.visible || !(child.geometry instanceof THREE.BufferGeometry)) {
      return;
    }

    const position = child.geometry.getAttribute("position");
    if (!position) {
      return;
    }
    const index = child.geometry.getIndex();
    const count = index?.count ?? position.count;
    const relativeMatrix = inverseRoot.clone().multiply(child.matrixWorld);
    const mirrored = relativeMatrix.determinant() < 0;
    for (let offset = 0; offset + 2 < count; offset += 3) {
      const triangle = [0, 1, 2].map((corner) => {
        const vertexIndex = index ? index.getX(offset + corner) : offset + corner;
        return point
          .set(position.getX(vertexIndex), position.getY(vertexIndex), position.getZ(vertexIndex))
          .applyMatrix4(relativeMatrix)
          .toArray();
      });
      if (mirrored) {
        [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
      }
      positions.push(...triangle[0], ...triangle[1], ...triangle[2]);
    }
  });

  if (positions.length < 9) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const brush = new Brush(geometry);
  brush.matrixAutoUpdate = false;
  brush.matrix.copy(root.matrixWorld);
  brush.matrixWorld.copy(root.matrixWorld);
  if (cached) {
    cached.brush.geometry.dispose();
  }
  cutPreviewBrushCache.set(root, { signature, brush });
  return brush;
}

function cutPreviewActualIntersectionGeometry(state: ThreeState, solid: WorkplaneShape, hole: WorkplaneShape) {
  const solidObject = findShapeObject(state, solid.id);
  const holeObject = findShapeObject(state, hole.id);
  if (!solidObject || !holeObject) {
    return null;
  }

  const solidBrush = cutPreviewBrushFromObject(solidObject);
  const holeBrush = cutPreviewBrushFromObject(holeObject);
  if (!solidBrush || !holeBrush) {
    return null;
  }

  // Equal-height cylinders have coplanar caps. Feeding those surfaces directly
  // to three-bvh-csg can turn a few hundred input triangles into hundreds of
  // thousands of preview triangles. A tiny local expansion preserves the
  // visible cut while keeping the preview topology bounded.
  const holeScale = new THREE.Matrix4().makeScale(
    (shapeWidth(hole) + CUT_PREVIEW_PADDING * 2) / Math.max(MIN_SHAPE_SIZE, shapeWidth(hole)),
    (hole.height + CUT_PREVIEW_PADDING * 2) / Math.max(MIN_SHAPE_SIZE, hole.height),
    (shapeDepth(hole) + CUT_PREVIEW_PADDING * 2) / Math.max(MIN_SHAPE_SIZE, shapeDepth(hole)),
  );
  const paddedHoleMatrix = holeBrush.matrix.clone().multiply(holeScale);
  holeBrush.matrix.copy(paddedHoleMatrix);
  holeBrush.matrixWorld.copy(paddedHoleMatrix);

  try {
    const result = cutPreviewEvaluator.evaluate(solidBrush, holeBrush, HOLLOW_INTERSECTION);
    const position = result.geometry.getAttribute("position");
    if (!position || position.count < 3) {
      result.geometry.dispose();
      return null;
    }
    const geometry = result.geometry.clone();
    geometry.applyMatrix4(result.matrixWorld);
    result.geometry.dispose();
    geometry.computeVertexNormals();
    return geometry;
  } catch {
    return null;
  }
}

function addCutPreviewOverlays(state: ThreeState, holeFrame: CutPreviewShapeFrame, solidFrames: CutPreviewShapeFrame[]) {
  solidFrames.forEach((solidFrame) => {
    if (!holeFrame.worldBounds.intersectsBox(solidFrame.worldBounds)) {
      return;
    }

    const geometry = cutPreviewActualIntersectionGeometry(state, solidFrame.shape, holeFrame.shape);
    if (!geometry) {
      return;
    }
    const preview = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: "#30363a",
        transparent: true,
        opacity: 0.34,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    preview.name = "CutPreviewOverlay";
    preview.renderOrder = 18;
    preview.userData.cutPreview = true;
    preview.raycast = () => undefined;
    setObjectRenderLayer(preview, RENDER_LAYER_PREVIEWS);
    freezeStaticObjectMatrices(preview);
    state.shapeLayer.add(preview);
  });
}

function clearCutPreviewOverlays(state: ThreeState) {
  const overlays: THREE.Object3D[] = [];
  state.shapeLayer.traverse((child) => {
    if (child.userData.cutPreview) {
      overlays.push(child);
    }
  });
  overlays.forEach((overlay) => {
    overlay.parent?.remove(overlay);
    disposeObject(overlay);
  });
}

function syncCutPreviewOverlays(state: ThreeState, shapes: WorkplaneShape[]) {
  clearCutPreviewOverlays(state);
  const visibleShapes = shapes.filter((shape) => !shape.hidden);
  const cutFrames = shapeCutPreviewFrames(state, visibleShapes);
  const solidFrames = visibleShapes
    .filter((shape) => !shape.hole)
    .map((shape) => cutFrames[shape.id])
    .filter((frame): frame is CutPreviewShapeFrame => Boolean(frame));

  if (solidFrames.length === 0) {
    return;
  }

  visibleShapes.forEach((shape) => {
    if (!shape.hole) {
      return;
    }
    const holeFrame = cutFrames[shape.id];
    if (holeFrame) {
      addCutPreviewOverlays(state, holeFrame, solidFrames);
    }
  });
}

function updateShapeObjectTransform(object: THREE.Group, shape: WorkplaneShape) {
  object.name = shape.name;
  object.userData.shapeId = shape.id;
  object.userData.rulerDimensions = [shapeWidth(shape), shape.height, shapeDepth(shape)] satisfies [number, number, number];
  object.userData.rulerTopologyKey = rulerShapeTopologyKey(shape);
  object.position.set(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z);
  object.rotation.set(
    THREE.MathUtils.degToRad(shape.rotationX ?? 0),
    THREE.MathUtils.degToRad(shape.rotation),
    THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
  );
  object.scale.set(mirrorSign(shape.mirrorX), mirrorSign(shape.mirrorY), mirrorSign(shape.mirrorZ));
  refreshFrozenObjectMatrix(object);
}

function syncShapeObjectDimensions(object: THREE.Group, shape: WorkplaneShape) {
  object.userData.rulerDimensions = [shapeWidth(shape), shape.height, shapeDepth(shape)] satisfies [number, number, number];
  object.userData.rulerTopologyKey = rulerShapeTopologyKey(shape);
  const surface = object.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh && Boolean(child.userData.shapeSurface));
  if (!surface) return;
  const width = shapeWidth(shape);
  const depth = shapeDepth(shape);
  let scale: THREE.Vector3 | null = null;
  if (shape.importedMesh && !preservesEdgeTreatmentSize(shape)) {
    scale = new THREE.Vector3(
      width / Math.max(0.001, shape.importedMesh.baseWidth),
      shape.height / Math.max(0.001, shape.importedMesh.baseHeight),
      depth / Math.max(0.001, shape.importedMesh.baseDepth),
    );
  } else if (shape.kind === "box" && !(shape.radius && shape.radius > 0)) {
    scale = new THREE.Vector3(width, shape.height, depth);
  } else if (shape.kind === "cylinder" || shape.kind === "polygon") {
    scale = new THREE.Vector3(width / 2, shape.height, depth / 2);
  } else if (shape.kind === "sphere") {
    scale = new THREE.Vector3(width / 2, shape.height / 2, depth / 2);
  }
  if (!scale) return;

  object.position.y = (shape.elevation ?? 0) + shape.height / 2;
  object.updateMatrix();
  surface.scale.copy(scale);
  surface.position.y = -shape.height / 2;
  surface.updateMatrix();
  object.children.forEach((child) => {
    if (!child.userData.shapeEdge) return;
    child.position.copy(surface.position);
    child.rotation.copy(surface.rotation);
    child.scale.copy(surface.scale);
    child.updateMatrix();
  });
  object.updateMatrixWorld(true);
}

function removeShapeDecorations(object: THREE.Group) {
  object.children
    .filter((child) => Boolean(child.userData.shapeDecoration))
    .forEach((child) => {
      object.remove(child);
      disposeObject(child);
    });
}

function syncShapeObjectAppearance(object: THREE.Group, shape: WorkplaneShape, selected: boolean, updateSurfaceMaterial: boolean, onTextureReady?: () => void) {
  object.userData.showEdges = selected;
  const groupedContent = object.children.find((child): child is THREE.Group => child instanceof THREE.Group && Boolean(child.userData.groupedShapeContent));
  if (groupedContent && shape.groupedShapes?.length && !shape.importedMesh) {
    shape.groupedShapes
      .filter((child) => !child.hidden)
      .forEach((child) => {
        const childObject = groupedContent.children.find((entry): entry is THREE.Group => entry instanceof THREE.Group && entry.userData.groupChildId === child.id);
        if (!childObject) return;
        const childShape = shape.hole ? { ...child, hole: true, color: "#b8c2cc" } : child;
        syncShapeObjectAppearance(childObject, childShape, selected, updateSurfaceMaterial, onTextureReady);
      });
    object.traverse((child) => {
      child.userData.shapeId = shape.id;
    });
    setObjectRenderLayer(object, RENDER_LAYER_SHAPES);
    freezeStaticObjectMatrices(object);
    return;
  }

  const surface = object.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh && Boolean(child.userData.shapeSurface));
  if (!surface) return;
  if (updateSurfaceMaterial) {
    const material = sharedShapeMaterial(shape);
    const nextMaterial = shape.kind === "box" && shape.imagePlate && !shape.hole
      ? createImagePlateMaterials(shape, material, onTextureReady)
      : material;
    const currentMaterials = Array.isArray(surface.material) ? surface.material : null;
    const sameMaterial = Array.isArray(nextMaterial)
      ? Boolean(currentMaterials && nextMaterial.every((entry, index) => currentMaterials[index] === entry))
      : surface.material === nextMaterial;
    if (!sameMaterial) {
      replaceObjectMaterials(surface, nextMaterial);
    }
  }
  removeShapeDecorations(object);
  addShapeEdgeDecorations(object, surface, surface.geometry, shape);
  object.traverse((child) => {
    child.userData.shapeId = shape.id;
  });
  setObjectRenderLayer(object, RENDER_LAYER_SHAPES);
  freezeStaticObjectMatrices(object);
}

function rebuildShapes(
  state: ThreeState | null,
  shapes: WorkplaneShape[],
  selectedIds: string[],
  showCutPreviews = true,
  useOfficialModifierRendering = false,
  workplane: PlacementWorkplane = horizontalPlacementWorkplane(),
) {
  if (!state) {
    return;
  }

  clearCutPreviewOverlays(state);
  const selected = new Set(selectedIds);
  const visibleShapes = shapes.filter((shape) => !shape.hidden);

  if (useOfficialModifierRendering) {
    disposeChildren(state.shapeLayer);
    state.shapeRecords.clear();
    state.officialShapeLayerActive = true;
    visibleShapes.forEach((shape) => {
      const object = createShapeObject(shape, selected.has(shape.id), () => {
        state.needsRender = true;
      }, false);
      state.shapeLayer.add(object);
    });
    if (showCutPreviews) {
      syncCutPreviewOverlays(state, visibleShapes);
    }
    rebuildSelectionHelpers(state, shapes, selectedIds, workplane);
    state.needsRender = true;
    return;
  }

  if (state.officialShapeLayerActive) {
    disposeChildren(state.shapeLayer);
    state.shapeRecords.clear();
    state.officialShapeLayerActive = false;
  }

  const visibleIds = new Set(visibleShapes.map((shape) => shape.id));
  state.shapeRecords.forEach((record, id) => {
    if (visibleIds.has(id)) return;
    state.shapeLayer.remove(record.object);
    disposeObject(record.object);
    state.shapeRecords.delete(id);
  });

  visibleShapes.forEach((shape) => {
    const selectedShape = selected.has(shape.id);
    const transformSignature = shapeTransformSignature(shape);
    const materialSignature = shapeMaterialSignature(shape);
    const geometrySignature = shapeGeometrySignature(shape);
    let record = state.shapeRecords.get(shape.id);
    if (record && record.geometrySignature !== geometrySignature) {
      state.shapeLayer.remove(record.object);
      disposeObject(record.object);
      state.shapeRecords.delete(shape.id);
      record = undefined;
    }

    if (!record) {
      const object = createShapeObject(shape, selectedShape, () => {
        state.needsRender = true;
      });
      state.shapeLayer.add(object);
      record = {
        object,
        shape,
        transformSignature,
        materialSignature,
        geometrySignature,
        selected: selectedShape,
      };
      state.shapeRecords.set(shape.id, record);
      return;
    }

    if (record.transformSignature !== transformSignature) {
      updateShapeObjectTransform(record.object, shape);
    }
    record.object.name = shape.name;
    syncShapeObjectDimensions(record.object, shape);
    const materialChanged = record.materialSignature !== materialSignature;
    if (materialChanged || record.selected !== selectedShape) {
      syncShapeObjectAppearance(record.object, shape, selectedShape, materialChanged, () => {
        state.needsRender = true;
      });
    }
    record.shape = shape;
    record.transformSignature = transformSignature;
    record.materialSignature = materialSignature;
    record.geometrySignature = geometrySignature;
    record.selected = selectedShape;
  });

  if (showCutPreviews) {
    syncCutPreviewOverlays(state, visibleShapes);
  }

  rebuildSelectionHelpers(state, shapes, selectedIds, workplane);
  state.needsRender = true;
}

function modifierEdgeMaterialStyle(active: boolean, hovered: boolean, previewActive: boolean) {
  const subduedSelectedPreviewEdge = previewActive && active && !hovered;
  return {
    color: active ? (hovered ? "#ffbf45" : "#ff8a1d") : hovered ? "#84edff" : "#17b7e5",
    opacity: subduedSelectedPreviewEdge ? 0.18 : active || hovered ? 1 : 0.72,
    linewidth: active || hovered ? 3 : 1,
  };
}

function rebuildModifierEdges(state: ThreeState | null, edges: CadModifierEdge[], selectedIds: number[], previewActive = false, hoverId: number | null = null) {
  if (!state) return;
  disposeChildren(state.modifierLayer);
  const selected = new Set(selectedIds);
  edges.forEach((edge) => {
    if (edge.points.length < 6) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(edge.points, 3));
    const active = selected.has(edge.id);
    const hovered = hoverId === edge.id;
    const style = modifierEdgeMaterialStyle(active, hovered, previewActive);
    const material = new THREE.LineBasicMaterial({
      color: style.color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: style.opacity,
      linewidth: style.linewidth,
    });
    const line = new THREE.Line(geometry, material);
    line.userData.modifierEdgeId = edge.id;
    line.renderOrder = hovered ? 1003 : active ? 1002 : 1001;
    setObjectRenderLayer(line, RENDER_LAYER_MODIFIERS);
    freezeStaticObjectMatrices(line);
    state.modifierLayer.add(line);
  });
  state.needsRender = true;
}

function rebuildSelectionHelpers(
  state: ThreeState | null,
  shapes: WorkplaneShape[],
  selectedIds: string[],
  workplane: PlacementWorkplane,
) {
  if (!state) {
    return;
  }

  disposeChildren(state.helperLayer);
  selectedIds.forEach((id) => {
    const shape = shapes.find((entry) => entry.id === id && !entry.hidden);
    if (!shape) {
      return;
    }
    const shadow = createSelectedGroundFootprint(shape, workplane);
    if (shadow) {
      setObjectRenderLayer(shadow, RENDER_LAYER_HELPERS);
      freezeStaticObjectMatrices(shadow);
      state.helperLayer.add(shadow);
    }
  });
}

function setSelectionHelpersVisible(state: ThreeState | null, visible: boolean) {
  if (!state || state.helperLayer.visible === visible) {
    return;
  }
  state.helperLayer.visible = visible;
  state.needsRender = true;
}

function formatMeasure(value: number, accuracy: MeasurementAccuracy = DEFAULT_WORKSPACE.accuracy) {
  const zeroThreshold = 0.5 * 10 ** -accuracy;
  return cleanNearZero(value, zeroThreshold).toFixed(accuracy);
}

function makeDimensionMark(
  key: string,
  handleKey: string,
  axis: DimensionMark["axis"],
  label: string,
  fromWorld: THREE.Vector3,
  toWorld: THREE.Vector3,
  outwardWorld: THREE.Vector3,
  project: (point: THREE.Vector3) => { x: number; y: number },
): DimensionMark {
  const from = project(fromWorld);
  const to = project(toWorld);
  const outwardAxis = outwardWorld.clone();
  outwardAxis.normalize();

  const railOffset = 5.8;
  const extensionOverrun = 1.4;
  const labelOffset = 3.2;
  const railFrom = project(fromWorld.clone().add(outwardAxis.clone().multiplyScalar(railOffset)));
  const railTo = project(toWorld.clone().add(outwardAxis.clone().multiplyScalar(railOffset)));
  const extensionFrom = project(fromWorld.clone().add(outwardAxis.clone().multiplyScalar(railOffset + extensionOverrun)));
  const extensionTo = project(toWorld.clone().add(outwardAxis.clone().multiplyScalar(railOffset + extensionOverrun)));
  const labelPoint = project(
    fromWorld
      .clone()
      .lerp(toWorld, 0.5)
      .add(outwardAxis.clone().multiplyScalar(railOffset + labelOffset)),
  );

  return {
    key,
    handleKey,
    axis,
    label,
    x1: railFrom.x,
    y1: railFrom.y,
    x2: railTo.x,
    y2: railTo.y,
    e1x1: from.x,
    e1y1: from.y,
    e1x2: extensionFrom.x,
    e1y2: extensionFrom.y,
    e2x1: to.x,
    e2y1: to.y,
    e2x2: extensionTo.x,
    e2y2: extensionTo.y,
    labelX: labelPoint.x,
    labelY: labelPoint.y,
  };
}

function updateTransformOverlayIfChanged(
  overlayRef: MutableRefObject<TransformOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<TransformOverlayState | null>>,
  next: TransformOverlayState,
) {
  if (overlayRef.current && JSON.stringify(overlayRef.current) === JSON.stringify(next)) {
    return;
  }
  overlayRef.current = next;
  setOverlay(next);
}

function updateTransformOverlayDom(state: ThreeState, next: TransformOverlayState) {
  const root = state.renderer.domElement.closest(".workplane-plane");
  if (!root) {
    return;
  }
  const guideLines = root.querySelectorAll<SVGLineElement>(".transform-guides > line");
  next.guides.forEach((guide, index) => {
    const line = guideLines[index];
    if (!line) {
      return;
    }
    line.setAttribute("x1", String(guide.x1));
    line.setAttribute("y1", String(guide.y1));
    line.setAttribute("x2", String(guide.x2));
    line.setAttribute("y2", String(guide.y2));
  });
  const handles = root.querySelectorAll<HTMLElement>(".transform-overlay .transform-handle");
  next.handles.forEach((handle, index) => {
    const element = handles[index];
    if (!element) {
      return;
    }
    element.style.setProperty("--overlay-x", `${handle.x}px`);
    element.style.setProperty("--overlay-y", `${handle.y}px`);
    element.style.setProperty("--transform-handle-angle", `${handle.angle ?? 0}deg`);
  });
  const rotateHandles = root.querySelectorAll<HTMLElement>(".transform-overlay .rotate-handle");
  next.rotateHandles.forEach((handle, index) => {
    const element = rotateHandles[index];
    if (!element) {
      return;
    }
    element.style.setProperty("--overlay-x", `${handle.x}px`);
    element.style.setProperty("--overlay-y", `${handle.y}px`);
    element.style.setProperty("--rotate-plane-a", String(handle.plane.a));
    element.style.setProperty("--rotate-plane-b", String(handle.plane.b));
    element.style.setProperty("--rotate-plane-c", String(handle.plane.c));
    element.style.setProperty("--rotate-plane-d", String(handle.plane.d));
  });
}

function syncTransformOverlay(
  state: ThreeState,
  shapes: WorkplaneShape[],
  selectedIds: string[],
  overlayRef: MutableRefObject<TransformOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<TransformOverlayState | null>>,
  accuracy: MeasurementAccuracy,
  keepVisibleDuringInteraction = false,
  updateDomImmediately = false,
  workplane: PlacementWorkplane = horizontalPlacementWorkplane(),
  theme: ResolvedAppTheme = "light",
) {
  if (selectedIds.length < 1) {
    syncTransformGuideWorldLines(state, null, theme);
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
    return;
  }

  const activeWorkplane = workplane;
  const frame = selectionFrameForShapes(shapes, selectedIds, activeWorkplane);
  if (!frame) {
    syncTransformGuideWorldLines(state, null, theme);
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
    return;
  }

  const rect = state.renderer.domElement.getBoundingClientRect();
  // Future edits: do not remove this. The transform overlay is projected with
  // Vector3.project(), outside Three's renderer. With OrbitControls damping, the
  // camera matrix can otherwise be one frame stale, making handles/lines trail.
  state.camera.updateMatrixWorld();
  const corners = selectionFrameCorners(frame);
  const viewProjection = new THREE.Matrix4().multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
  const selectionIntersectsView = transformBoundsIntersectClipVolume(corners.map((corner) => {
    const clip = new THREE.Vector4(corner.x, corner.y, corner.z, 1).applyMatrix4(viewProjection);
    return { x: clip.x, y: clip.y, z: clip.z, w: clip.w };
  }));
  if (!selectionIntersectsView && !keepVisibleDuringInteraction) {
    syncTransformGuideWorldLines(state, null, theme);
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
    return;
  }
  const cameraDistance = state.camera.position.distanceTo(frame.center);
  const cameraInSelectionFrame = frameLocalPoint(frame, state.camera.position);
  const cameraInsideSelection = isPointInsideTransformBounds(cameraInSelectionFrame, frame.min, frame.max);
  const project = (point: THREE.Vector3) => {
    const cameraSpace = point.clone().applyMatrix4(state.camera.matrixWorldInverse);
    const projected = cameraSpace.clone().applyMatrix4(state.camera.projectionMatrix);
    return transformOverlayScreenPoint(projected, cameraSpace.z, rect.width, rect.height);
  };

  const xFootAxis = frame.xAxis.clone().normalize();
  const yFootAxis = frame.yAxis.clone().normalize();
  const zFootAxis = frame.zAxis.clone().normalize();
  const showLowerHandles = state.camera.position.clone().sub(frame.center).dot(yFootAxis) < 0;
  const footprintY = workplaneFootprintY(frame, activeWorkplane);
  const workplaneY = workplaneYForFrame(frame, activeWorkplane);
  const oppositeY = Math.abs(footprintY - frame.min.y) <= Math.abs(footprintY - frame.max.y)
    ? frame.max.y
    : frame.min.y;
  const footprintWorld = {
    nearLeft: framePoint(frame, frame.min.x, footprintY, frame.max.z),
    nearRight: framePoint(frame, frame.max.x, footprintY, frame.max.z),
    farRight: framePoint(frame, frame.max.x, footprintY, frame.min.z),
    farLeft: framePoint(frame, frame.min.x, footprintY, frame.min.z),
    near: framePoint(frame, 0, footprintY, frame.max.z),
    right: framePoint(frame, frame.max.x, footprintY, 0),
    far: framePoint(frame, 0, footprintY, frame.min.z),
    left: framePoint(frame, frame.min.x, footprintY, 0),
  };
  const bottomCenterWorld = framePoint(frame, 0, footprintY, 0);
  const topCenterWorld = framePoint(frame, 0, oppositeY, 0);
  syncTransformGuideWorldLines(state, [
    [topCenterWorld, bottomCenterWorld],
    [footprintWorld.nearLeft, footprintWorld.nearRight],
    [footprintWorld.nearRight, footprintWorld.farRight],
    [footprintWorld.farRight, footprintWorld.farLeft],
    [footprintWorld.farLeft, footprintWorld.nearLeft],
  ], theme);
  const lowerCenterWorld = framePoint(frame, 0, frame.min.y, 0);
  const upperCenterWorld = framePoint(frame, 0, frame.max.y, 0);
  const liftOffset = Math.max(2, frame.height * 0.08);
  const liftHandle = (showLowerHandles ? lowerCenterWorld : upperCenterWorld)
    .clone()
    .addScaledVector(yFootAxis, showLowerHandles ? -liftOffset : liftOffset);
  const bottom = {
    nearLeft: project(footprintWorld.nearLeft),
    nearRight: project(footprintWorld.nearRight),
    farRight: project(footprintWorld.farRight),
    farLeft: project(footprintWorld.farLeft),
  };
  const mid = {
    near: project(footprintWorld.near),
    right: project(footprintWorld.right),
    far: project(footprintWorld.far),
    left: project(footprintWorld.left),
  };
  const heightPoint = project(showLowerHandles ? lowerCenterWorld : upperCenterWorld);
  const liftPoint = project(liftHandle);
  const liftBasePoint = project(showLowerHandles ? lowerCenterWorld : upperCenterWorld);
  const liftTargetAngle = THREE.MathUtils.radToDeg(
    Math.atan2(liftPoint.y - liftBasePoint.y, liftPoint.x - liftBasePoint.x),
  );
  const liftHandleAngle = liftTargetAngle - (showLowerHandles ? 90 : -90);
  const centerPoint = project(frame.center);
  const widthLabel = formatMeasure(frame.width, accuracy);
  const depthLabel = formatMeasure(frame.depth, accuracy);
  const heightLabel = formatMeasure(frame.height, accuracy);
  const nearOut = zFootAxis;
  const farOut = zFootAxis.clone().multiplyScalar(-1);
  const rightOut = xFootAxis;
  const leftOut = xFootAxis.clone().multiplyScalar(-1);
  const heightHandleKey = showLowerHandles ? "bottom-height" : "top-height";
  const liftHandleKey = showLowerHandles ? "lower-shape" : "lift-shape";
  const workplaneAnchor = framePoint(frame, 0, workplaneY, 0);
  const liftLabel = formatMeasure(footprintY - workplaneY, accuracy);
  const makeFootprintDimensionMark = (handleKey: string, axis: "width" | "depth") => {
    if (axis === "width") {
      const useFarSide = handleKey.includes("far") || handleKey.includes("left");
      return makeDimensionMark(
        `${handleKey}-width`,
        handleKey,
        "width",
        widthLabel,
        useFarSide ? footprintWorld.farLeft : footprintWorld.nearLeft,
        useFarSide ? footprintWorld.farRight : footprintWorld.nearRight,
        useFarSide ? farOut : nearOut,
        project,
      );
    }
    const useLeftSide = handleKey.includes("left") || handleKey.includes("far");
    return makeDimensionMark(
      `${handleKey}-depth`,
      handleKey,
      "depth",
      depthLabel,
      useLeftSide ? footprintWorld.nearLeft : footprintWorld.nearRight,
      useLeftSide ? footprintWorld.farLeft : footprintWorld.farRight,
      useLeftSide ? leftOut : rightOut,
      project,
    );
  };
  const footprintHandleKeys = ["near-left", "near-right", "far-right", "far-left", "near-mid", "right-mid", "far-mid", "left-mid"];
  const footprintDimensionMarks = Object.fromEntries(
    footprintHandleKeys.map((handleKey) => {
      const axes = new Set<"width" | "depth">();
      if (handleKey.includes("left") || handleKey.includes("right")) {
        axes.add("width");
      }
      if (handleKey.includes("near") || handleKey.includes("far")) {
        axes.add("depth");
      }
      return [handleKey, Array.from(axes).map((axis) => makeFootprintDimensionMark(handleKey, axis))];
    }),
  );
  const dimensionMarks = {
    ...footprintDimensionMarks,
    [heightHandleKey]: [makeDimensionMark("height", heightHandleKey, "height", heightLabel, lowerCenterWorld, upperCenterWorld, rightOut, project)],
    [liftHandleKey]: [makeDimensionMark("elevation", liftHandleKey, "elevation", liftLabel, workplaneAnchor, bottomCenterWorld, rightOut, project)],
  };
  const screenOffsetFromCenter = (point: { x: number; y: number }, distance: number) => {
    const dx = point.x - centerPoint.x;
    const dy = point.y - centerPoint.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    return {
      x: point.x + (dx / length) * distance,
      y: point.y + (dy / length) * distance,
    };
  };
  const rotationSides = rotationHandleSidesForCamera(state, frame.center, xFootAxis, zFootAxis);
  const sidePoint = (side: RotationHandleSide, y: number) => {
    if (side === "right") {
      return framePoint(frame, frame.max.x, y, 0);
    }
    if (side === "left") {
      return framePoint(frame, frame.min.x, y, 0);
    }
    if (side === "near") {
      return framePoint(frame, 0, y, frame.max.z);
    }
    return framePoint(frame, 0, y, frame.min.z);
  };
  const rotateLeftSource = project(sidePoint(rotationSides.x, frame.max.y));
  const rotateRightSource = project(sidePoint(rotationSides.z, frame.max.y));
  const rotateBottomSource = project(sidePoint(rotationSides.y, footprintY));
  const rotateLeft = screenOffsetFromCenter(rotateLeftSource, 24);
  const rotateRight = screenOffsetFromCenter(rotateRightSource, 28);
  const rotateBottomAnchor = screenOffsetFromCenter(rotateBottomSource, 26);
  const rotateBottom = { ...rotateBottomAnchor, y: rotateBottomAnchor.y - 5 };
  const xFaceCenter = sidePoint(rotationSides.x, 0);
  const zFaceCenter = sidePoint(rotationSides.z, 0);
  const yFaceCenter = bottomCenterWorld;
  const yRotationAxes = rotationSides.y === "near"
    ? { u: xFootAxis, v: zFootAxis }
    : rotationSides.y === "far"
      ? { u: xFootAxis.clone().multiplyScalar(-1), v: zFootAxis.clone().multiplyScalar(-1) }
      : rotationSides.y === "right"
        ? { u: zFootAxis.clone().multiplyScalar(-1), v: xFootAxis }
        : { u: zFootAxis, v: xFootAxis.clone().multiplyScalar(-1) };
  const planeRadius = 154;
  const planeWorldStep = Math.max(0.1, cameraDistance * 0.01);
  const makePlaneView = (centerWorld: THREE.Vector3, uAxis: THREE.Vector3, vAxis: THREE.Vector3, axisVector: THREE.Vector3): RotationPlaneView => {
    const directionSign = rotationPlaneDirectionSign(axisVector, uAxis, vAxis);
    const screenCenter = project(centerWorld);
    const uOffset = uAxis.clone().multiplyScalar(planeWorldStep);
    const vOffset = vAxis.clone().multiplyScalar(planeWorldStep);
    const uStart = project(centerWorld.clone().sub(uOffset));
    const uEnd = project(centerWorld.clone().add(uOffset));
    const vStart = project(centerWorld.clone().sub(vOffset));
    const vEnd = project(centerWorld.clone().add(vOffset));
    const du = { x: (uEnd.x - uStart.x) / 2, y: (uEnd.y - uStart.y) / 2 };
    const dv = { x: (vEnd.x - vStart.x) / 2, y: (vEnd.y - vStart.y) / 2 };
    const longest = Math.max(Math.hypot(du.x, du.y), Math.hypot(dv.x, dv.y));
    if (!Number.isFinite(longest) || longest < 0.000001) {
      return { x: screenCenter.x, y: screenCenter.y, a: 1, b: 0, c: 0, d: 1, directionSign };
    }
    const scale = planeRadius / longest / 100;
    return {
      x: screenCenter.x,
      y: screenCenter.y,
      a: du.x * scale,
      b: du.y * scale,
      c: dv.x * scale,
      d: dv.y * scale,
      directionSign,
    };
  };
  const makeWheel = (centerWorld: THREE.Vector3) => {
    const screenCenter = project(centerWorld);
    return { x: screenCenter.x, y: screenCenter.y, radius: planeRadius };
  };
  const makeWorldPoint = (point: THREE.Vector3) => ({ x: point.x, y: point.y, z: point.z });
  const rotationWheels: Record<RotationAxis, { x: number; y: number; radius: number }> = {
    x: makeWheel(xFaceCenter),
    y: makeWheel(yFaceCenter),
    z: makeWheel(zFaceCenter),
  };
  const rotationPlaneCenters: Record<RotationAxis, { x: number; y: number; z: number }> = {
    x: makeWorldPoint(xFaceCenter),
    y: makeWorldPoint(yFaceCenter),
    z: makeWorldPoint(zFaceCenter),
  };
  const rotationPlanes: Record<RotationAxis, RotationPlaneView> = {
    x: makePlaneView(xFaceCenter, zFootAxis, yFootAxis, xFootAxis),
    y: makePlaneView(yFaceCenter, xFootAxis, zFootAxis, yFootAxis),
    z: makePlaneView(zFaceCenter, xFootAxis, yFootAxis, zFootAxis),
  };
  const makeCameraPlaneView = (uAxis: THREE.Vector3, vAxis: THREE.Vector3): RotationPlaneView => {
    const u = uAxis.clone().transformDirection(state.camera.matrixWorldInverse);
    const v = vAxis.clone().transformDirection(state.camera.matrixWorldInverse);
    return { x: 0, y: 0, a: u.x, b: -u.y, c: v.x, d: -v.y };
  };
  const rotationHandlePlanes: Record<RotationAxis, RotationPlaneView> = {
    // Project only the two plane axes through the camera rotation. Ignoring
    // perspective translation keeps glyph appearance independent of object
    // length and screen position while preserving camera foreshortening.
    x: makeCameraPlaneView(zFootAxis, yFootAxis),
    y: makeCameraPlaneView(yRotationAxes.u, yRotationAxes.v),
    z: makeCameraPlaneView(xFootAxis, yFootAxis),
  };

  const handles = [
    { point: bottom.nearLeft, handle: { key: "near-left", className: "corner", kind: "scale" as const, x: bottom.nearLeft.x, y: bottom.nearLeft.y, title: "Resize" } },
    { point: bottom.nearRight, handle: { key: "near-right", className: "corner", kind: "scale" as const, x: bottom.nearRight.x, y: bottom.nearRight.y, title: "Resize" } },
    { point: bottom.farRight, handle: { key: "far-right", className: "corner", kind: "scale" as const, x: bottom.farRight.x, y: bottom.farRight.y, title: "Resize" } },
    { point: bottom.farLeft, handle: { key: "far-left", className: "corner", kind: "scale" as const, x: bottom.farLeft.x, y: bottom.farLeft.y, title: "Resize" } },
    { point: mid.near, handle: { key: "near-mid", className: "edge dark", kind: "scale" as const, x: mid.near.x, y: mid.near.y, title: "Resize" } },
    { point: mid.right, handle: { key: "right-mid", className: "edge dark", kind: "scale" as const, x: mid.right.x, y: mid.right.y, title: "Resize" } },
    { point: mid.far, handle: { key: "far-mid", className: "edge dark", kind: "scale" as const, x: mid.far.x, y: mid.far.y, title: "Resize" } },
    { point: mid.left, handle: { key: "left-mid", className: "edge dark", kind: "scale" as const, x: mid.left.x, y: mid.left.y, title: "Resize" } },
    { point: heightPoint, handle: { key: heightHandleKey, className: "height-top", kind: "height" as const, x: heightPoint.x, y: heightPoint.y, title: "Height" } },
    { point: liftPoint, handle: { key: liftHandleKey, className: showLowerHandles ? "height-lift lower" : "height-lift", kind: "lift" as const, x: liftPoint.x, y: liftPoint.y, title: "Lift", angle: liftHandleAngle } },
  ].filter(({ point }) => point.visible).map(({ handle }) => handle);
  const rotationChromeVisible = !cameraInsideSelection && centerPoint.visible;
  const rotateHandles = rotationChromeVisible ? [
    rotateLeftSource.visible ? { key: "rotate-left", className: "screen-left", x: rotateLeft.x, y: rotateLeft.y, plane: normalizedRotationPlaneBasis(rotationHandlePlanes.x, true) } : null,
    rotateRightSource.visible ? { key: "rotate-right", className: "screen-right", x: rotateRight.x, y: rotateRight.y, plane: normalizedRotationPlaneBasis(rotationHandlePlanes.z, true) } : null,
    rotateBottomSource.visible ? { key: "rotate-bottom", className: "screen-bottom", x: rotateBottom.x, y: rotateBottom.y, plane: normalizedRotationPlaneBasis(rotationHandlePlanes.y, true) } : null,
  ].filter((handle): handle is NonNullable<typeof handle> => Boolean(handle)) : [];

  const next = {
    id: frame.ids.join("|"),
    width: rect.width,
    height: rect.height,
    guides: [],
    handles,
    rotateHandles,
    dimensions: dimensionMarks,
    rotationWheel: rotationWheels.y,
    rotationWheels,
    rotationPlaneCenters,
    rotationPlanes,
  };

  if (updateDomImmediately) {
    updateTransformOverlayDom(state, next);
  }
  updateTransformOverlayIfChanged(overlayRef, setOverlay, next);
}

function syncAlignOverlay(
  state: ThreeState,
  shapes: WorkplaneShape[],
  selectedIds: string[],
  alignMode: boolean,
  alignAnchorId: string | null,
  statuses: AlignHandleStatus[],
  overlayRef: MutableRefObject<AlignOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<AlignOverlayState | null>>,
) {
  const clear = () => {
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
  };

  if (!alignMode || selectedIds.length < 2) {
    clear();
    return;
  }

  const selectedFrame = selectionFrameForShapes(shapes, selectedIds);
  const anchorFrame = alignAnchorId && selectedIds.includes(alignAnchorId) ? selectionFrameForShapes(shapes, [alignAnchorId]) : null;
  const frame = anchorFrame ?? selectedFrame;
  if (!frame) {
    clear();
    return;
  }

  const rect = state.renderer.domElement.getBoundingClientRect();
  state.camera.updateMatrixWorld();
  const corners = selectionFrameCorners(frame);
  const projectedCorners = corners.map((corner) => {
    const cameraSpace = corner.clone().applyMatrix4(state.camera.matrixWorldInverse);
    const projected = corner.clone().project(state.camera);
    return { cameraSpace, projected };
  });
  const nearPlane = state.camera instanceof THREE.PerspectiveCamera ? state.camera.near : 0.1;
  if (projectedCorners.some(({ cameraSpace, projected }) => cameraSpace.z > -nearPlane * 1.5 || !Number.isFinite(projected.x) || !Number.isFinite(projected.y))) {
    clear();
    return;
  }

  const project = (point: THREE.Vector3) => {
    const projected = point.clone().project(state.camera);
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((1 - projected.y) / 2) * rect.height,
    };
  };
  const worldMinY = Math.min(...corners.map((corner) => corner.y));
  const worldMaxY = Math.max(...corners.map((corner) => corner.y));
  const worldMinX = Math.min(...corners.map((corner) => corner.x));
  const worldMaxX = Math.max(...corners.map((corner) => corner.x));
  const worldMinZ = Math.min(...corners.map((corner) => corner.z));
  const worldMaxZ = Math.max(...corners.map((corner) => corner.z));
  const worldCenterX = (worldMinX + worldMaxX) / 2;
  const worldCenterY = (worldMinY + worldMaxY) / 2;
  const worldCenterZ = (worldMinZ + worldMaxZ) / 2;
  const offset = Math.max(8, Math.max(worldMaxX - worldMinX, worldMaxY - worldMinY, worldMaxZ - worldMinZ) * 0.16);
  const statusByKey = new Map(statuses.map((status) => [`${status.axis}:${status.target}`, status]));

  const guidePoints = {
    x0: project(new THREE.Vector3(worldMinX, worldMinY, worldMaxZ + offset)),
    x1: project(new THREE.Vector3(worldMaxX, worldMinY, worldMaxZ + offset)),
    z0: project(new THREE.Vector3(worldMaxX + offset, worldMinY, worldMinZ)),
    z1: project(new THREE.Vector3(worldMaxX + offset, worldMinY, worldMaxZ)),
    y0: project(new THREE.Vector3(worldMinX - offset, worldMinY, worldMaxZ + offset)),
    y1: project(new THREE.Vector3(worldMinX - offset, worldMaxY, worldMaxZ + offset)),
  };

  const makeHandle = (axis: AlignAxis, target: AlignTarget, point: THREE.Vector3) => {
    const status = statusByKey.get(`${axis}:${target}`);
    if (!status) {
      return null;
    }
    const screen = project(point);
    return {
      ...status,
      key: `${axis}-${target}`,
      x: screen.x,
      y: screen.y,
    };
  };

  const handles = [
    makeHandle("x", "min", new THREE.Vector3(worldMinX, worldMinY, worldMaxZ + offset)),
    makeHandle("x", "center", new THREE.Vector3(worldCenterX, worldMinY, worldMaxZ + offset)),
    makeHandle("x", "max", new THREE.Vector3(worldMaxX, worldMinY, worldMaxZ + offset)),
    makeHandle("z", "min", new THREE.Vector3(worldMaxX + offset, worldMinY, worldMinZ)),
    makeHandle("z", "center", new THREE.Vector3(worldMaxX + offset, worldMinY, worldCenterZ)),
    makeHandle("z", "max", new THREE.Vector3(worldMaxX + offset, worldMinY, worldMaxZ)),
    makeHandle("y", "min", new THREE.Vector3(worldMinX - offset, worldMinY, worldMaxZ + offset)),
    makeHandle("y", "center", new THREE.Vector3(worldMinX - offset, worldCenterY, worldMaxZ + offset)),
    makeHandle("y", "max", new THREE.Vector3(worldMinX - offset, worldMaxY, worldMaxZ + offset)),
  ].filter((handle): handle is AlignOverlayState["handles"][number] => Boolean(handle));

  const next = {
    guides: [
      { key: "x", x1: guidePoints.x0.x, y1: guidePoints.x0.y, x2: guidePoints.x1.x, y2: guidePoints.x1.y },
      { key: "z", x1: guidePoints.z0.x, y1: guidePoints.z0.y, x2: guidePoints.z1.x, y2: guidePoints.z1.y },
      { key: "y", x1: guidePoints.y0.x, y1: guidePoints.y0.y, x2: guidePoints.y1.x, y2: guidePoints.y1.y },
    ],
    handles,
  };

  overlayRef.current = next;
  setOverlay(next);
}

function syncMirrorOverlay(
  state: ThreeState,
  shapes: WorkplaneShape[],
  selectedIds: string[],
  mirrorMode: boolean,
  overlayRef: MutableRefObject<MirrorOverlayState | null>,
  setOverlay: Dispatch<SetStateAction<MirrorOverlayState | null>>,
) {
  const clear = () => {
    if (overlayRef.current) {
      overlayRef.current = null;
      setOverlay(null);
    }
  };

  if (!mirrorMode || selectedIds.length < 1) {
    clear();
    return;
  }

  const frame = selectionFrameForShapes(shapes, selectedIds);
  if (!frame) {
    clear();
    return;
  }

  const rect = state.renderer.domElement.getBoundingClientRect();
  state.camera.updateMatrixWorld();
  const corners = selectionFrameCorners(frame);
  const projectedCorners = corners.map((corner) => {
    const cameraSpace = corner.clone().applyMatrix4(state.camera.matrixWorldInverse);
    const projected = corner.clone().project(state.camera);
    return { cameraSpace, projected };
  });
  const nearPlane = state.camera instanceof THREE.PerspectiveCamera ? state.camera.near : 0.1;
  if (projectedCorners.some(({ cameraSpace, projected }) => cameraSpace.z > -nearPlane * 1.5 || !Number.isFinite(projected.x) || !Number.isFinite(projected.y))) {
    clear();
    return;
  }

  const project = (point: THREE.Vector3) => {
    const projected = point.clone().project(state.camera);
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((1 - projected.y) / 2) * rect.height,
    };
  };
  const screenAngle = (from: THREE.Vector3, to: THREE.Vector3) => {
    const a = project(from);
    const b = project(to);
    return THREE.MathUtils.radToDeg(Math.atan2(b.y - a.y, b.x - a.x));
  };
  const worldMinY = Math.min(...corners.map((corner) => corner.y));
  const worldMaxY = Math.max(...corners.map((corner) => corner.y));
  const worldMinX = Math.min(...corners.map((corner) => corner.x));
  const worldMaxX = Math.max(...corners.map((corner) => corner.x));
  const worldMinZ = Math.min(...corners.map((corner) => corner.z));
  const worldMaxZ = Math.max(...corners.map((corner) => corner.z));
  const worldCenterX = (worldMinX + worldMaxX) / 2;
  const worldCenterY = (worldMinY + worldMaxY) / 2;
  const worldCenterZ = (worldMinZ + worldMaxZ) / 2;
  const width = Math.max(MIN_SHAPE_SIZE, worldMaxX - worldMinX);
  const height = Math.max(MIN_SHAPE_SIZE, worldMaxY - worldMinY);
  const depth = Math.max(MIN_SHAPE_SIZE, worldMaxZ - worldMinZ);
  const offset = Math.max(10, Math.max(width, height, depth) * 0.2);
  const step = Math.max(10, Math.max(width, height, depth) * 0.28);

  const xWorld = new THREE.Vector3(worldCenterX, worldMinY, worldMaxZ + offset);
  const zWorld = new THREE.Vector3(worldMaxX + offset, worldMinY, worldCenterZ);
  const yWorld = new THREE.Vector3(worldMinX - offset, worldCenterY, worldMaxZ + offset);
  const xScreen = project(xWorld);
  const zScreen = project(zWorld);
  const yScreen = project(yWorld);
  const xGuideA = new THREE.Vector3(worldMinX, worldMinY, worldMaxZ + offset);
  const xGuideB = new THREE.Vector3(worldMaxX, worldMinY, worldMaxZ + offset);
  const zGuideA = new THREE.Vector3(worldMaxX + offset, worldMinY, worldMinZ);
  const zGuideB = new THREE.Vector3(worldMaxX + offset, worldMinY, worldMaxZ);
  const yGuideA = new THREE.Vector3(worldMinX - offset, worldMinY, worldMaxZ + offset);
  const yGuideB = new THREE.Vector3(worldMinX - offset, worldMaxY, worldMaxZ + offset);
  const xA = project(xGuideA);
  const xB = project(xGuideB);
  const zA = project(zGuideA);
  const zB = project(zGuideB);
  const yA = project(yGuideA);
  const yB = project(yGuideB);

  const next = {
    guides: [
      { key: "x", x1: xA.x, y1: xA.y, x2: xB.x, y2: xB.y },
      { key: "z", x1: zA.x, y1: zA.y, x2: zB.x, y2: zB.y },
      { key: "y", x1: yA.x, y1: yA.y, x2: yB.x, y2: yB.y },
    ],
    handles: [
      {
        axis: "x" as const,
        key: "mirror-x",
        x: xScreen.x,
        y: xScreen.y,
        angle: screenAngle(xWorld.clone().add(new THREE.Vector3(-step, 0, 0)), xWorld.clone().add(new THREE.Vector3(step, 0, 0))),
        title: "Mirror left-right",
      },
      {
        axis: "z" as const,
        key: "mirror-z",
        x: zScreen.x,
        y: zScreen.y,
        angle: screenAngle(zWorld.clone().add(new THREE.Vector3(0, 0, -step)), zWorld.clone().add(new THREE.Vector3(0, 0, step))),
        title: "Mirror front-back",
      },
      {
        axis: "y" as const,
        key: "mirror-y",
        x: yScreen.x,
        y: yScreen.y,
        angle: screenAngle(yWorld.clone().add(new THREE.Vector3(0, -step, 0)), yWorld.clone().add(new THREE.Vector3(0, step, 0))),
        title: "Mirror top-bottom",
      },
    ],
  };

  overlayRef.current = next;
  setOverlay(next);
}

function findShapeObject(state: ThreeState, id: string) {
  return state.shapeRecords.get(id)?.object ?? null;
}

function findSelectionHelper(state: ThreeState, id: string) {
  const helper = state.helperLayer.children.find((child) => child.userData.shapeId === id);
  return helper instanceof THREE.Box3Helper ? helper : null;
}

function findSelectedGroundFootprint(state: ThreeState, id: string) {
  return state.helperLayer.children.find((child) => child.name === "SelectedGroundFootprint" && child.userData.shapeId === id) ?? null;
}

function applyDragItemPreview(state: ThreeState, item: DragItem) {
  if (!item.visual || !item.visual.parent) {
    item.visual = findShapeObject(state, item.id);
  }
  if (!item.helper || !item.helper.parent) {
    item.helper = findSelectionHelper(state, item.id);
    item.helperBox = item.helper ? item.helper.box.clone() : null;
  }

  if (item.visual) {
    if (!item.hadPreviewSimplified) {
      setComplexEdgeVisibility(item.visual, false);
      item.hadPreviewSimplified = true;
    }
    item.visual.position.x = item.nextX;
    item.visual.position.y = item.startVisualY + item.nextElevation - item.startElevation;
    item.visual.position.z = item.nextZ;
    refreshFrozenObjectMatrix(item.visual);
  }

  if (item.helper && item.helperBox) {
    item.helper.box.copy(item.helperBox);
    item.helper.box.translate(new THREE.Vector3(
      item.nextX - item.startX,
      item.nextElevation - item.startElevation,
      item.nextZ - item.startZ,
    ));
    refreshFrozenObjectMatrix(item.helper);
  }
}

function refreshDragPreviewObjects(state: ThreeState | null, drag: DragState | null) {
  if (!state || !drag) return;
  drag.items.forEach((item) => applyDragItemPreview(state, item));
  updateSelectedGroundFootprintPreviews(state, drag);
  state.needsRender = true;
}

function updateSelectedGroundFootprintPreviews(state: ThreeState, drag: DragState) {
  drag.items.forEach((item) => {
    const footprint = findSelectedGroundFootprint(state, item.id);
    if (!footprint) {
      return;
    }
    footprint.position.x = item.nextX - item.startX;
    footprint.position.y = item.nextElevation - item.startElevation;
    footprint.position.z = item.nextZ - item.startZ;
    refreshFrozenObjectMatrix(footprint);
  });
}

function createSelectedGroundFootprint(shape: WorkplaneShape, workplane: PlacementWorkplane) {
  const frame = selectionFrameForShapes([shape], [shape.id], workplane);
  if (!frame) {
    return null;
  }

  const planeY = workplaneYForFrame(frame, workplane);
  const nearestFaceY = clamp(planeY, frame.min.y, frame.max.y);
  if (Math.abs(nearestFaceY - planeY) <= 0.08) {
    return null;
  }

  const group = new THREE.Group();
  group.name = "SelectedGroundFootprint";
  group.userData.shapeId = shape.id;

  const shadowY = planeY + 0.04;
  const footprint = [
    framePoint(frame, frame.min.x, shadowY, frame.min.z),
    framePoint(frame, frame.max.x, shadowY, frame.min.z),
    framePoint(frame, frame.max.x, shadowY, frame.max.z),
    framePoint(frame, frame.min.x, shadowY, frame.max.z),
  ];
  const fillGeometry = new THREE.BufferGeometry();
  fillGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([
        footprint[0].x, footprint[0].y, footprint[0].z,
        footprint[1].x, footprint[1].y, footprint[1].z,
        footprint[2].x, footprint[2].y, footprint[2].z,
        footprint[0].x, footprint[0].y, footprint[0].z,
        footprint[2].x, footprint[2].y, footprint[2].z,
        footprint[3].x, footprint[3].y, footprint[3].z,
      ]),
      3,
    ),
  );
  fillGeometry.computeVertexNormals();
  const fill = new THREE.Mesh(
    fillGeometry,
    new THREE.MeshBasicMaterial({
      color: "#7f8f95",
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  group.add(fill);

  const points = [...footprint, footprint[0].clone()];
  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: "#00aeea", transparent: true, opacity: 0.92 }),
  );
  outline.userData.shapeId = shape.id;
  group.add(outline);

  return group;
}

function createTransformHandles(box: THREE.Box3, id: string) {
  const group = new THREE.Group();
  group.name = "Scketch3DwebTransformHandles";
  group.userData.shapeId = id;

  const handleMaterial = new THREE.MeshBasicMaterial({ color: "#e8eef1" });
  const darkMaterial = new THREE.MeshBasicMaterial({ color: "#273849" });
  const rotateMaterial = new THREE.LineBasicMaterial({ color: "#00aeea", transparent: true, opacity: 0.96 });
  const dashMaterial = new THREE.LineDashedMaterial({ color: "#2c3339", dashSize: 2.2, gapSize: 2.4, transparent: true, opacity: 0.72 });
  const handleGeometry = new THREE.BoxGeometry(2.6, 2.6, 2.6);
  const dotGeometry = new THREE.BoxGeometry(1.7, 1.7, 1.7);
  const coneGeometry = new THREE.ConeGeometry(1.7, 3.4, 18);

  const center = box.getCenter(new THREE.Vector3());
  const topY = box.max.y + 1.4;
  const x0 = box.min.x;
  const x1 = box.max.x;
  const z0 = box.min.z;
  const z1 = box.max.z;
  const xm = center.x;
  const zm = center.z;

  const cornerPoints = [
    { key: "far-left", kind: "scale" as const, point: new THREE.Vector3(x0, box.min.y + 1.3, z0) },
    { key: "far-right", kind: "scale" as const, point: new THREE.Vector3(x1, box.min.y + 1.3, z0) },
    { key: "near-left", kind: "scale" as const, point: new THREE.Vector3(x0, box.min.y + 1.3, z1) },
    { key: "near-right", kind: "scale" as const, point: new THREE.Vector3(x1, box.min.y + 1.3, z1) },
    { key: "far-left", kind: "scale" as const, point: new THREE.Vector3(x0, topY, z0) },
    { key: "far-right", kind: "scale" as const, point: new THREE.Vector3(x1, topY, z0) },
    { key: "near-left", kind: "scale" as const, point: new THREE.Vector3(x0, topY, z1) },
    { key: "near-right", kind: "scale" as const, point: new THREE.Vector3(x1, topY, z1) },
    { key: "top-height", kind: "height" as const, point: new THREE.Vector3(xm, box.max.y + 7, zm) },
  ];

  cornerPoints.forEach(({ key, kind, point }) => {
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.copy(point);
    handle.userData.shapeId = id;
    handle.userData.transformHandle = kind;
    handle.userData.transformHandleKey = key;
    handle.userData.transformPlaneY = point.y;
    group.add(handle);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(handleGeometry), new THREE.LineBasicMaterial({ color: "#2d3439", transparent: true, opacity: 0.86 }));
    outline.position.copy(point);
    outline.userData.shapeId = id;
    outline.userData.transformHandle = handle.userData.transformHandle;
    outline.userData.transformHandleKey = key;
    outline.userData.transformPlaneY = point.y;
    group.add(outline);
  });

  [
    { key: "far-mid", point: new THREE.Vector3(xm, topY, z0) },
    { key: "near-mid", point: new THREE.Vector3(xm, topY, z1) },
    { key: "left-mid", point: new THREE.Vector3(x0, topY, zm) },
    { key: "right-mid", point: new THREE.Vector3(x1, topY, zm) },
    { key: "far-mid", point: new THREE.Vector3(xm, box.min.y + 1.3, z0) },
    { key: "near-mid", point: new THREE.Vector3(xm, box.min.y + 1.3, z1) },
    { key: "left-mid", point: new THREE.Vector3(x0, box.min.y + 1.3, zm) },
    { key: "right-mid", point: new THREE.Vector3(x1, box.min.y + 1.3, zm) },
  ].forEach(({ key, point }) => {
    const dot = new THREE.Mesh(dotGeometry, darkMaterial);
    dot.position.copy(point);
    dot.userData.shapeId = id;
    dot.userData.transformHandle = "scale";
    dot.userData.transformHandleKey = key;
    dot.userData.transformPlaneY = point.y;
    group.add(dot);
  });

  [
    [new THREE.Vector3(xm, box.max.y + 7, zm), new THREE.Vector3(xm, box.min.y + 1.3, zm)],
  ].forEach(([from, to]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geometry, dashMaterial);
    line.computeLineDistances();
    group.add(line);
  });

  [
    { key: "rotate-left", center: new THREE.Vector3(x0 - 5, topY + 5, z0 - 5), start: 0.15, end: 1.45, arrow: new THREE.Vector3(x0 - 2.8, topY + 5, z0 - 8.2), rotation: Math.PI * 0.35 },
    { key: "rotate-right", center: new THREE.Vector3(x1 + 5, topY + 5, z0 - 5), start: 1.7, end: 2.95, arrow: new THREE.Vector3(x1 + 8.2, topY + 5, z0 - 2.8), rotation: Math.PI * 0.85 },
    { key: "rotate-bottom", center: new THREE.Vector3(x1 + 5, topY + 5, z1 + 5), start: 3.3, end: 4.55, arrow: new THREE.Vector3(x1 + 2.8, topY + 5, z1 + 8.2), rotation: Math.PI * 1.35 },
  ].forEach((arc) => {
    const line = createRotateArc(arc.center, 5.5, arc.start, arc.end, rotateMaterial);
    line.userData.shapeId = id;
    line.userData.transformHandle = "rotate";
    line.userData.transformHandleKey = arc.key;
    group.add(line);
    const arrow = new THREE.Mesh(coneGeometry, darkMaterial);
    arrow.position.copy(arc.arrow);
    arrow.rotation.set(Math.PI / 2, 0, arc.rotation);
    arrow.userData.shapeId = id;
    arrow.userData.transformHandle = "rotate";
    arrow.userData.transformHandleKey = arc.key;
    group.add(arrow);
  });

  return group;
}

function createRotateArc(center: THREE.Vector3, radius: number, start: number, end: number, material: THREE.LineBasicMaterial) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 18; i += 1) {
    const angle = start + ((end - start) * i) / 18;
    points.push(new THREE.Vector3(center.x + Math.cos(angle) * radius, center.y, center.z + Math.sin(angle) * radius));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function sharedShapeGeometry(key: string, create: () => THREE.BufferGeometry) {
  const cached = sharedShapeGeometryCache.get(key);
  if (cached) {
    sharedShapeGeometryCache.delete(key);
    sharedShapeGeometryCache.set(key, cached);
    return cached.geometry;
  }
  const geometry = putGeometryOnBase(create());
  geometry.userData.cached = true;
  geometry.userData.sharedShapeGeometryKey = key;
  sharedShapeGeometryCache.set(key, { geometry, users: 0 });
  return geometry;
}

function disposeSharedShapeGeometry(geometry: THREE.BufferGeometry) {
  const edges = sharedEdgesGeometryCache.get(geometry);
  edges?.forEach((entry) => entry.dispose());
  if ((geometry as THREE.BufferGeometry & { boundsTree?: unknown }).boundsTree) {
    disposeBoundsTree.call(geometry);
  }
  geometry.dispose();
}

function trimSharedShapeGeometryCache() {
  while (sharedShapeGeometryCache.size > MAX_SHARED_SHAPE_GEOMETRIES) {
    const removable = [...sharedShapeGeometryCache.entries()].find(([, entry]) => entry.users === 0);
    if (!removable) return;
    const [key, entry] = removable;
    sharedShapeGeometryCache.delete(key);
    disposeSharedShapeGeometry(entry.geometry);
  }
}

function retainSharedShapeGeometry(mesh: THREE.Mesh, geometry: THREE.BufferGeometry) {
  const key = geometry.userData.sharedShapeGeometryKey as string | undefined;
  if (!key) return;
  const entry = sharedShapeGeometryCache.get(key);
  if (!entry || entry.geometry !== geometry) return;
  entry.users += 1;
  mesh.userData.sharedShapeGeometryKey = key;
  trimSharedShapeGeometryCache();
}

function releaseSharedShapeGeometry(mesh: THREE.Mesh | THREE.LineSegments) {
  const key = mesh.userData.sharedShapeGeometryKey as string | undefined;
  if (!key) return;
  mesh.userData.sharedShapeGeometryKey = undefined;
  const entry = sharedShapeGeometryCache.get(key);
  if (entry && entry.geometry === mesh.geometry) {
    entry.users = Math.max(0, entry.users - 1);
  }
  trimSharedShapeGeometryCache();
}

function sharedShapeMaterial(shape: WorkplaneShape) {
  const key = JSON.stringify({
    color: shape.hole ? "#b7c0c9" : shape.color,
    transparent: Boolean(shape.hole),
    opacity: shape.hole ? (shape.importedMesh ? 0.34 : 0.52) : 1,
    roughness: shape.hole ? 0.88 : 0.57,
    side: "double",
  });
  const cached = sharedShapeMaterialCache.get(key);
  if (cached) {
    sharedShapeMaterialCache.delete(key);
    sharedShapeMaterialCache.set(key, cached);
    return cached.material;
  }
  const material = new THREE.MeshStandardMaterial({
    color: shape.hole ? "#b7c0c9" : shape.color,
    transparent: Boolean(shape.hole),
    opacity: shape.hole ? (shape.importedMesh ? 0.34 : 0.52) : 1,
    roughness: shape.hole ? 0.88 : 0.57,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  material.userData.cached = true;
  material.userData.sharedShapeMaterialKey = key;
  sharedShapeMaterialCache.set(key, { material, users: 0 });
  return material;
}

function trimSharedShapeMaterialCache() {
  while (sharedShapeMaterialCache.size > MAX_SHARED_SHAPE_MATERIALS) {
    const removable = [...sharedShapeMaterialCache.entries()].find(([, entry]) => entry.users === 0);
    if (!removable) return;
    const [key, entry] = removable;
    sharedShapeMaterialCache.delete(key);
    entry.material.dispose();
  }
}

function retainSharedShapeMaterials(mesh: THREE.Mesh, materials: THREE.Material | THREE.Material[]) {
  const retained: string[] = [];
  (Array.isArray(materials) ? materials : [materials]).forEach((material) => {
    const key = material.userData.sharedShapeMaterialKey as string | undefined;
    if (!key || retained.includes(key)) return;
    const entry = sharedShapeMaterialCache.get(key);
    if (!entry || entry.material !== material) return;
    entry.users += 1;
    retained.push(key);
  });
  mesh.userData.sharedShapeMaterialKeys = retained;
  trimSharedShapeMaterialCache();
}

function releaseSharedShapeMaterials(mesh: THREE.Mesh | THREE.LineSegments) {
  const keys = mesh.userData.sharedShapeMaterialKeys as string[] | undefined;
  if (!keys?.length) return;
  mesh.userData.sharedShapeMaterialKeys = [];
  keys.forEach((key) => {
    const entry = sharedShapeMaterialCache.get(key);
    if (entry) entry.users = Math.max(0, entry.users - 1);
  });
}

function sharedLineMaterial(color: string, opacity: number, depthWrite = true) {
  const key = `${color}|${opacity}|${depthWrite}`;
  const cached = sharedLineMaterialCache.get(key);
  if (cached) return cached;
  const material = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite });
  material.userData.cached = true;
  sharedLineMaterialCache.set(key, material);
  return material;
}

function disposeMaterialResource(material: THREE.Material) {
  if (material.userData.cached) return;
  const map = "map" in material ? (material.map as THREE.Texture | null) : null;
  if (map) map.dispose();
  material.dispose();
}

function replaceObjectMaterials(object: THREE.Mesh, materials: THREE.Material | THREE.Material[]) {
  const previous = Array.isArray(object.material) ? object.material : [object.material];
  releaseSharedShapeMaterials(object);
  object.material = materials;
  retainSharedShapeMaterials(object, materials);
  previous.forEach(disposeMaterialResource);
  trimSharedShapeMaterialCache();
}

function enableAcceleratedMeshPicking(mesh: THREE.Mesh, geometry: THREE.BufferGeometry, force = false) {
  const position = geometry.getAttribute("position");
  const triangles = geometry.getIndex()?.count
    ? Math.floor((geometry.getIndex()?.count ?? 0) / 3)
    : Math.floor((position?.count ?? 0) / 3);
  mesh.raycast = acceleratedRaycast;
  const bvhGeometry = geometry as THREE.BufferGeometry & { boundsTree?: unknown };
  if ((force || triangles >= BVH_PICKING_TRIANGLE_THRESHOLD) && !bvhGeometry.boundsTree) {
    computeBoundsTree.call(geometry, { targetLeafSize: 12 });
  }
}

function createShapeObject(
  shape: WorkplaneShape,
  showEdges = false,
  onTextureReady?: () => void,
  acceleratedPicking = true,
  previewOnly = false,
) {
  const group = new THREE.Group();
  group.name = shape.name;
  group.userData.shapeId = shape.id;
  group.userData.showEdges = showEdges;
  group.userData.acceleratedPicking = acceleratedPicking;
  group.userData.previewOnly=previewOnly;
  group.userData.rulerDimensions = [shapeWidth(shape), shape.height, shapeDepth(shape)] satisfies [number, number, number];
  group.userData.rulerTopologyKey = rulerShapeTopologyKey(shape);
  group.position.set(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z);
  group.rotation.set(
    THREE.MathUtils.degToRad(shape.rotationX ?? 0),
    THREE.MathUtils.degToRad(shape.rotation),
    THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
  );
  group.scale.set(mirrorSign(shape.mirrorX), mirrorSign(shape.mirrorY), mirrorSign(shape.mirrorZ));

  if (shape.groupedShapes?.length && !shape.importedMesh) {
    const content = new THREE.Group();
    content.userData.groupedShapeContent = true;
    shape.groupedShapes
      .filter((child) => !child.hidden)
      .forEach((child) => {
        const childShape = shape.hole ? { ...child, hole: true, color: "#b8c2cc" } : child;
        const childObject = createShapeObject(childShape, showEdges, onTextureReady, acceleratedPicking);
        childObject.userData.groupChildId = child.id;
        content.add(childObject);
      });
    const contentBox = new THREE.Box3().setFromObject(content);
    const contentSize = contentBox.getSize(new THREE.Vector3());
    content.scale.set(
      shapeWidth(shape) / Math.max(0.001, contentSize.x),
      shape.height / Math.max(0.001, contentSize.y),
      shapeDepth(shape) / Math.max(0.001, contentSize.z),
    );
    content.position.y = -shape.height / 2;
    group.add(content);
    applyGroupedContentTaper(content, shape, contentBox);
    group.traverse((child) => {
      child.userData.shapeId = shape.id;
    });
    setObjectRenderLayer(group, RENDER_LAYER_SHAPES);
    freezeStaticObjectMatrices(group);
    return group;
  }

  const material = sharedShapeMaterial(shape);

  const width = shapeWidth(shape);
  const depth = shapeDepth(shape);
  const size = Math.min(width, depth);
  const height = shape.height;
  const geometryCacheKey = shapeGeometrySignature(shape);

  switch (shape.kind) {
    case "box":
      addMesh(
        group,
        sharedShapeGeometry(
          geometryCacheKey,
          () => shape.radius && shape.radius > 0
            ? new RoundedBoxGeometry(width, height, depth, Math.max(1, shape.steps ?? 10), shape.radius)
            : new THREE.BoxGeometry(1, 1, 1),
        ),
        shape.imagePlate && !shape.hole ? createImagePlateMaterials(shape, material, onTextureReady) : material,
        shape,
        undefined,
        undefined,
        shape.radius && shape.radius > 0 ? undefined : new THREE.Vector3(width, height, depth),
      );
      break;
    case "cylinder":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => new THREE.CylinderGeometry(1, 1, 1, shape.sides ?? 96, shape.segments ?? 1)), material, shape, undefined, undefined, new THREE.Vector3(width / 2, height, depth / 2));
      break;
    case "sphere": {
      const { widthSegments, heightSegments } = sphereTessellation(shape.steps);
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => new THREE.SphereGeometry(1, widthSegments, heightSegments)), material, shape, undefined, undefined, new THREE.Vector3(width / 2, height / 2, depth / 2));
      break;
    }
    case "cone":
      addMesh(
        group,
        sharedShapeGeometry(geometryCacheKey, () => new THREE.CylinderGeometry(shape.topRadius ?? 0, shape.baseRadius ?? width / 2, height, shape.sides ?? 96)),
        material,
        shape,
        undefined,
        undefined,
        new THREE.Vector3(1, 1, depth / Math.max(0.001, width)),
      );
      break;
    case "pyramid":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createPyramidGeometry(width, height, depth, shape.sides ?? 4)), material, shape);
      break;
    case "roof":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createRoofGeometry(width, height, depth)), material, shape);
      break;
    case "roundRoof":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createRoundRoofGeometry(width, height, depth, shape.sides ?? 64)), material, shape);
      break;
    case "halfSphere":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createHalfSphereGeometry(width, height, depth, shape.steps ?? 32)), material, shape);
      break;
    case "torus":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createTorusGeometry(width, height, depth)), material, shape);
      break;
    case "ring":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createHollowCylinderGeometry(width, height, depth, shape.bevel ?? 4, 144)), material, shape);
      break;
    case "tube":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createHollowCylinderGeometry(width, height, depth, shape.bevel ?? 4, 144)), material, shape);
      break;
    case "gear":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createGearGeometry({
        width,
        depth,
        height,
        teeth: shape.teeth,
        toothSize: shape.toothSize,
        toothWidth: shape.toothWidth,
        centerHoleSize: shape.centerHoleSize,
        gearType: shape.gearType,
        helixAngle: shape.helixAngle,
        helixQuality: shape.helixQuality,
      })), material, shape);
      break;
    case "wedge":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => createWedgeGeometry(width, height, depth)), material, shape);
      break;
    case "polygon":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => new THREE.CylinderGeometry(1, 1, 1, 6)), material, shape, undefined, undefined, new THREE.Vector3(width / 2, height, depth / 2));
      break;
    case "icosahedron":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => new THREE.IcosahedronGeometry(size / 2, 1)), material, shape);
      break;
    case "text":
      addTextShape(group, material, shape, geometryCacheKey);
      break;
    case "mesh":
      if (shape.importedMesh) {
        const preserveEdgeSize = preservesEdgeTreatmentSize(shape);
        addMesh(
          group,
          preserveEdgeSize ? getPreservedImportedMeshGeometry(shape) : getImportedMeshGeometry(shape.importedMesh),
          material,
          shape,
          undefined,
          undefined,
          preserveEdgeSize ? undefined : new THREE.Vector3(
            width / Math.max(0.001, shape.importedMesh.baseWidth),
            height / Math.max(0.001, shape.importedMesh.baseHeight),
            depth / Math.max(0.001, shape.importedMesh.baseDepth),
          ),
        );
      } else {
        addMesh(group, sharedShapeGeometry(geometryCacheKey, () => new THREE.BoxGeometry(size, Math.max(3, height * 0.35), size * 0.72)), material, shape);
      }
      break;
    case "scribble":
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => new THREE.TorusKnotGeometry(size * 0.22, size * 0.055, 120, 12)), material, shape);
      break;
    case "sketch":
    default:
      addMesh(group, sharedShapeGeometry(geometryCacheKey, () => new THREE.BoxGeometry(size, Math.max(3, height * 0.35), size * 0.72)), material, shape);
      break;
  }

  group.traverse((child) => {
    child.userData.shapeId = shape.id;
  });
  setObjectRenderLayer(group, RENDER_LAYER_SHAPES);
  freezeStaticObjectMatrices(group);

  return group;
}

function createImagePlateMaterials(shape: WorkplaneShape, sideMaterial: THREE.MeshStandardMaterial, onTextureReady?: () => void) {
  const sideMaterials = Array.from({ length: 5 }, (_, index) => (index === 0 ? sideMaterial : sideMaterial.clone()));
  const topMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.64,
    metalness: 0,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.FrontSide,
  });

  if (shape.imagePlate?.dataUrl) {
    const texture = imageTextureLoader.load(shape.imagePlate.dataUrl, () => {
      texture.needsUpdate = true;
      topMaterial.needsUpdate = true;
      onTextureReady?.();
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    topMaterial.map = texture;
  }

  return [
    sideMaterials[0],
    sideMaterials[1],
    topMaterial,
    sideMaterials[2],
    sideMaterials[3],
    sideMaterials[4],
  ];
}

function taperGeometryForShape(geometry: THREE.BufferGeometry, shape: WorkplaneShape) {
  if (!shapeHasTaper(shape)) return geometry;
  const tapered = geometry.userData.cached ? geometry.clone() : geometry;
  if (tapered !== geometry) {
    tapered.userData = {};
  }
  tapered.computeBoundingBox();
  const box = tapered.boundingBox;
  const position = tapered.getAttribute("position");
  if (!box || !position) return tapered;
  const height = Math.max(1e-6, box.max.y - box.min.y);
  const centerX = (box.min.x + box.max.x) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    const normalizedHeight = (y - box.min.y) / height;
    const widthScale = shapeTaperScaleAt(shape, normalizedHeight, "width");
    const depthScale = shapeTaperScaleAt(shape, normalizedHeight, "depth");
    position.setXYZ(
      index,
      centerX + (position.getX(index) - centerX) * widthScale,
      y,
      centerZ + (position.getZ(index) - centerZ) * depthScale,
    );
  }
  position.needsUpdate = true;
  tapered.computeVertexNormals();
  tapered.computeBoundingBox();
  tapered.computeBoundingSphere();
  return tapered;
}

function applyGroupedContentTaper(content: THREE.Group, shape: WorkplaneShape, baseBounds: THREE.Box3) {
  if (!shapeHasTaper(shape)) return;
  const height = Math.max(1e-6, baseBounds.max.y - baseBounds.min.y);
  const centerX = (baseBounds.min.x + baseBounds.max.x) / 2;
  const centerZ = (baseBounds.min.z + baseBounds.max.z) / 2;
  content.updateMatrixWorld(true);
  const contentWorldInverse = content.matrixWorld.clone().invert();
  content.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments)) return;
    if (!(object.geometry instanceof THREE.BufferGeometry)) return;
    const sourcePosition = object.geometry.getAttribute("position");
    if (!sourcePosition) return;
    object.updateMatrixWorld(true);
    const localToContent = new THREE.Matrix4().multiplyMatrices(contentWorldInverse, object.matrixWorld);
    const contentToLocal = localToContent.clone().invert();
    if (object instanceof THREE.Mesh) {
      releaseSharedShapeGeometry(object);
    }
    const nextGeometry = object.geometry.clone();
    nextGeometry.userData = {};
    const position = nextGeometry.getAttribute("position");
    const point = new THREE.Vector3();
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(localToContent);
      const normalizedHeight = (point.y - baseBounds.min.y) / height;
      const widthScale = shapeTaperScaleAt(shape, normalizedHeight, "width");
      const depthScale = shapeTaperScaleAt(shape, normalizedHeight, "depth");
      point.x = centerX + (point.x - centerX) * widthScale;
      point.z = centerZ + (point.z - centerZ) * depthScale;
      point.applyMatrix4(contentToLocal);
      position.setXYZ(index, point.x, point.y, point.z);
    }
    position.needsUpdate = true;
    if (object instanceof THREE.Mesh) {
      nextGeometry.computeVertexNormals();
    }
    nextGeometry.computeBoundingBox();
    nextGeometry.computeBoundingSphere();
    object.geometry = nextGeometry;
    if (object instanceof THREE.Mesh && content.userData.acceleratedPicking !== false) {
      enableAcceleratedMeshPicking(object, nextGeometry, Boolean(shape.importedMesh));
    }
  });
}

function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  shape: WorkplaneShape,
  position?: THREE.Vector3,
  rotation?: THREE.Euler,
  scale?: THREE.Vector3,
) {
  const based = geometry.userData.cached ? geometry : putGeometryOnBase(geometry);
  const prepared = taperGeometryForShape(based, shape);
  const mesh = new THREE.Mesh(prepared, material);
  mesh.userData.shapeSurface = true;
  retainSharedShapeGeometry(mesh, prepared);
  retainSharedShapeMaterials(mesh, material);
  if (group.userData.acceleratedPicking !== false && !shape.edgeTreatments?.length) {
    enableAcceleratedMeshPicking(mesh, prepared, Boolean(shape.importedMesh));
  }
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  if (position) {
    mesh.position.copy(position);
  }
  mesh.position.y -= shape.height / 2;
  if (rotation) {
    mesh.rotation.copy(rotation);
  }
  if (scale) {
    mesh.scale.copy(scale);
  }
  group.add(mesh);
  if(!group.userData.previewOnly)addShapeEdgeDecorations(group, mesh, prepared, shape);
}

function addShapeEdgeDecorations(group: THREE.Group, mesh: THREE.Mesh, prepared: THREE.BufferGeometry, shape: WorkplaneShape) {
  const complexEdges =
    shape.kind === "mesh" ||
    Boolean(shape.importedMesh) ||
    ["cone", "pyramid", "roof", "roundRoof", "halfSphere", "torus", "tube", "ring", "gear", "wedge"].includes(shape.kind);
  const importedTriangleCount = shape.importedMesh?.triangleCount ?? 0;
  const skipHeavyImportedEdges = Boolean(shape.importedMesh) && importedTriangleCount > IMPORTED_SELECTED_EDGE_TRIANGLE_LIMIT;
  if ((group.userData.showEdges || complexEdges) && !skipHeavyImportedEdges) {
    const selectedOutline = Boolean(group.userData.showEdges);
    const selectedRoundedBox = selectedOutline && shape.kind === "box" && Boolean(shape.radius && shape.radius > 0);
    const edgeColor = selectedOutline ? "#00aeea" : shape.hole ? "#697989" : complexEdges ? "#141b21" : darkenHex(shape.color, 0.34);
    const edgeOpacity = selectedRoundedBox ? 0 : selectedOutline ? 0.98 : shape.hole ? 0.44 : complexEdges ? 0.38 : shape.kind === "text" ? 0.86 : 0.2;
    if (selectedOutline && shape.importedMesh && shape.cadDisplayEdgesVersion === 2 && Boolean(shape.cadDisplayEdges?.length)) {
      addCadDisplayEdges(group, shape, edgeColor, edgeOpacity);
    } else {
      const selectedThreshold = shape.importedMesh ? NORMAL_IMPORTED_SELECTION_EDGE_ANGLE : 1;
      const edges = new THREE.LineSegments(getEdgesGeometry(shape, prepared, selectedOutline ? selectedThreshold : complexEdges ? 14 : 25), sharedLineMaterial(edgeColor, edgeOpacity));
      edges.userData.complexEdge = complexEdges;
      edges.userData.shapeDecoration = true;
      edges.userData.shapeEdge = true;
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      edges.scale.copy(mesh.scale);
      group.add(edges);
    }
  }
}

function addCadDisplayEdges(group: THREE.Group, shape: WorkplaneShape, color: string, opacity: number) {
  if (!shape.cadDisplayEdges?.length) return;
  const material = sharedLineMaterial(color, opacity, false);
  shape.cadDisplayEdges.forEach((edge) => {
    if (edge.points.length < 6) return;
    const positions = resizedImportedCoordinates(shape, edge.points);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, material);
    line.position.y -= shape.height / 2;
    line.renderOrder = 1003;
    line.userData.complexEdge = true;
    line.userData.shapeDecoration = true;
    line.userData.cadDisplayEdge = true;
    group.add(line);
  });
}

function prepareWorkerShape(result:ModelingResult):WorkplaneShape{
 const updated={...result.shape,importedMesh:{...result.shape.importedMesh!,positions:Array.from(result.positions)}};
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(result.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(result.normals,3));
 geometry.boundsTree=MeshBVH.deserialize(result.bvh,geometry);geometry.userData.cached=true;
 importedGeometryCache.set(updated.importedMesh,{geometry,edges:new Map()});return updated;
}

function getImportedMeshCache(mesh: NonNullable<WorkplaneShape["importedMesh"]>) {
  const cached = importedGeometryCache.get(mesh);
  if (cached) {
    return cached;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.positions, 3));
  if (mesh.normals && mesh.normals.length === mesh.positions.length) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  putGeometryOnBase(geometry);
  geometry.userData.cached = true;
  const next = { geometry, edges: new Map<number, THREE.EdgesGeometry>() };
  importedGeometryCache.set(mesh, next);
  return next;
}

function getImportedMeshGeometry(mesh: NonNullable<WorkplaneShape["importedMesh"]>) {
  return getImportedMeshCache(mesh).geometry;
}

function getPreservedImportedMeshGeometry(shape: WorkplaneShape) {
  const cached = preservedImportedGeometryCache.get(shape);
  if (cached) return cached;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(resizedImportedMeshPositions(shape), 3));
  geometry.computeVertexNormals();
  putGeometryOnBase(geometry);
  geometry.userData.cached = true;
  preservedImportedGeometryCache.set(shape, geometry);
  return geometry;
}

function getEdgesGeometry(shape: WorkplaneShape, geometry: THREE.BufferGeometry, threshold: number) {
  const importedCache = shape.importedMesh && !preservesEdgeTreatmentSize(shape) && !shapeHasTaper(shape)
    ? getImportedMeshCache(shape.importedMesh).edges
    : null;
  let cache = importedCache ?? sharedEdgesGeometryCache.get(geometry);
  if (!cache) {
    cache = new Map<number, THREE.EdgesGeometry>();
    sharedEdgesGeometryCache.set(geometry, cache);
  }

  const cached = cache.get(threshold);
  if (cached) {
    return cached;
  }

  const edges = new THREE.EdgesGeometry(geometry, threshold);
  edges.userData.cached = true;
  cache.set(threshold, edges);
  return edges;
}

function setComplexEdgeVisibility(object: THREE.Object3D, visible: boolean) {
  object.traverse((child) => {
    if (child.userData.complexEdge) {
      child.visible = visible;
    }
  });
}

function addTextShape(group: THREE.Group, material: THREE.MeshStandardMaterial, shape: WorkplaneShape, geometryCacheKey: string) {
  const geometry = sharedShapeGeometry(geometryCacheKey, () => {
    const text = (shape.text ?? "TEXT").trim() || " ";
    const bevel = clamp(shape.bevel ?? 0, 0, 8);
    const fontName = shape.font ?? "Multilanguage";
    const next = new TextGeometry(text, {
      font: textFonts[fontName] ?? textFonts.Multilanguage,
      size: 20,
      depth: shape.height,
      curveSegments: fontName === "Stencil" ? 1 : 8,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel * 0.22,
      bevelSize: bevel * 0.16,
      bevelSegments: Math.max(1, shape.segments ?? 0),
    });

    next.computeBoundingBox();
    const box = next.boundingBox;
    if (box) {
      const textWidth = Math.max(1, box.max.x - box.min.x);
      const textDepth = Math.max(1, box.max.y - box.min.y);
      const scale = Math.min(shapeWidth(shape) / textWidth, shapeDepth(shape) / textDepth);
      next.scale(scale, scale, 1);
    }

    next.rotateX(-Math.PI / 2);
    next.computeBoundingBox();
    const rotatedBox = next.boundingBox;
    if (rotatedBox) {
      next.translate(
        -(rotatedBox.min.x + rotatedBox.max.x) / 2,
        -rotatedBox.min.y,
        -(rotatedBox.min.z + rotatedBox.max.z) / 2,
      );
    }
    return next;
  });
  addMesh(group, geometry, material, shape);
}

function putGeometryOnBase(geometry: THREE.BufferGeometry) {
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox?.min.y ?? 0;
  geometry.translate(0, -minY, 0);
  return geometry;
}

function createRoofGeometry(width: number, height: number, depth: number) {
  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, -d, w, 0, -d, 0, height, -d,
    -w, 0, d, w, 0, d, 0, height, d,
  ]);
  const indices = [
    0, 2, 1,
    3, 4, 5,
    0, 1, 4, 0, 4, 3,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry.toNonIndexed();
}

function createWedgeGeometry(width: number, height: number, depth: number) {
  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, -d, w, 0, -d, w, height, -d,
    -w, 0, d, w, 0, d, w, height, d,
  ]);
  const indices = [
    0, 2, 1,
    3, 4, 5,
    0, 1, 4, 0, 4, 3,
    1, 2, 5, 1, 5, 4,
    0, 3, 5, 0, 5, 2,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry.toNonIndexed();
}

function createPyramidGeometry(width: number, height: number, depth: number, sides = 4) {
  const count = Math.max(3, Math.round(sides));
  if (count !== 4) {
    const footprintScale = regularPolygonFootprintScale(width, depth, count);
    const geometry = new THREE.ConeGeometry(1, height, count);
    geometry.scale(footprintScale.x, 1, footprintScale.z);
    geometry.translate(footprintScale.offsetX, height / 2, footprintScale.offsetZ);
    return geometry.toNonIndexed();
  }

  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, -d, w, 0, -d, w, 0, d, -w, 0, d,
    0, height, 0,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    0, 4, 1,
    1, 4, 2,
    2, 4, 3,
    3, 4, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return geometry.toNonIndexed();
}

function createTorusGeometry(width: number, height: number, depth: number) {
  const tubeRadius = Math.max(0.1, height / 2);
  const majorRadius = Math.max(0.2, Math.min(width, depth) / 2 - tubeRadius);
  const geometry = new THREE.TorusGeometry(majorRadius, tubeRadius, 36, 144);
  geometry.rotateX(Math.PI / 2);
  const outerDiameter = (majorRadius + tubeRadius) * 2;
  geometry.scale(width / outerDiameter, 1, depth / outerDiameter);
  return geometry.toNonIndexed();
}

function createHollowCylinderGeometry(width: number, height: number, depth: number, thickness: number, segments = 96) {
  const outerX = width / 2;
  const outerZ = depth / 2;
  const safeThickness = clamp(thickness, 0.1, Math.max(0.1, Math.min(outerX, outerZ) - 0.1));
  const innerX = Math.max(0.1, outerX - safeThickness);
  const innerZ = Math.max(0.1, outerZ - safeThickness);
  const count = Math.max(12, Math.round(segments));
  const positions: number[] = [];
  const point = (rx: number, rz: number, y: number, index: number): [number, number, number] => {
    const angle = (index / count) * Math.PI * 2;
    return [Math.cos(angle) * rx, y, Math.sin(angle) * rz];
  };
  const addTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => positions.push(...a, ...b, ...c);
  const addQuad = (a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]) => {
    addTri(a, b, c);
    addTri(a, c, d);
  };

  for (let index = 0; index < count; index += 1) {
    const next = index + 1;
    const ob0 = point(outerX, outerZ, 0, index);
    const ob1 = point(outerX, outerZ, 0, next);
    const ot0 = point(outerX, outerZ, height, index);
    const ot1 = point(outerX, outerZ, height, next);
    const ib0 = point(innerX, innerZ, 0, index);
    const ib1 = point(innerX, innerZ, 0, next);
    const it0 = point(innerX, innerZ, height, index);
    const it1 = point(innerX, innerZ, height, next);

    addQuad(ob0, ot0, ot1, ob1);
    addQuad(ib1, it1, it0, ib0);
    addQuad(ot0, it0, it1, ot1);
    addQuad(ob0, ob1, ib1, ib0);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function createRoundRoofGeometry(width: number, height: number, depth: number, sides = 64) {
  const radius = width / 2;
  const segments = Math.max(4, Math.round(sides));
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.absarc(0, 0, radius, Math.PI, 0, true);
  shape.lineTo(-radius, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: segments });
  geometry.translate(0, 0, -depth / 2);
  geometry.scale(1, height / Math.max(0.001, radius), 1);
  return geometry.toNonIndexed();
}

function createHalfSphereGeometry(width: number, height: number, depth: number, steps = 32) {
  const lon = Math.max(8, Math.round(steps) * 2);
  const lat = Math.max(4, Math.round(steps / 2));
  const rx = width / 2;
  const rz = depth / 2;
  const positions: number[] = [];
  const normals: number[] = [];
  const point = (latIndex: number, lonIndex: number): [number, number, number] => {
    const theta = (latIndex / lat) * (Math.PI / 2);
    const phi = ((lonIndex % lon) / lon) * Math.PI * 2;
    const ring = Math.sin(theta);
    return [Math.cos(phi) * rx * ring, Math.cos(theta) * height, Math.sin(phi) * rz * ring];
  };
  const normal = ([x, y, z]: [number, number, number]): [number, number, number] => {
    const vector = new THREE.Vector3(x / Math.max(0.001, rx * rx), y / Math.max(0.001, height * height), z / Math.max(0.001, rz * rz)).normalize();
    return [vector.x, vector.y, vector.z];
  };
  const addTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    positions.push(...a, ...b, ...c);
    normals.push(...normal(a), ...normal(b), ...normal(c));
  };
  const addCapTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
    positions.push(...a, ...b, ...c);
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0);
  };

  const top: [number, number, number] = [0, height, 0];
  for (let xStep = 0; xStep < lon; xStep += 1) {
    addTri(top, point(1, xStep + 1), point(1, xStep));
  }

  for (let yStep = 1; yStep < lat; yStep += 1) {
    for (let xStep = 0; xStep < lon; xStep += 1) {
      const next = xStep + 1;
      const a = point(yStep, xStep);
      const b = point(yStep, next);
      const c = point(yStep + 1, next);
      const d = point(yStep + 1, xStep);
      addTri(a, c, d);
      addTri(a, b, c);
    }
  }

  const capY = 0;
  const bottomCenter: [number, number, number] = [0, capY, 0];
  const capPoint = (lonIndex: number): [number, number, number] => {
    const phi = ((lonIndex % lon) / lon) * Math.PI * 2;
    return [Math.cos(phi) * rx, capY, Math.sin(phi) * rz];
  };
  for (let xStep = 0; xStep < lon; xStep += 1) {
    addCapTri(bottomCenter, capPoint(xStep), capPoint(xStep + 1));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function disposeChildren(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1];
    if (child) {
      group.remove(child);
      disposeObject(child);
    }
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh | THREE.LineSegments;
    if ("geometry" in mesh && mesh.geometry) {
      releaseSharedShapeGeometry(mesh);
      if (!mesh.geometry.userData.cached) {
        if ((mesh.geometry as THREE.BufferGeometry & { boundsTree?: unknown }).boundsTree) {
          disposeBoundsTree.call(mesh.geometry);
        }
        mesh.geometry.dispose();
      }
    }
    if ("material" in mesh && mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      releaseSharedShapeMaterials(mesh);
      materials.forEach(disposeMaterialResource);
      trimSharedShapeMaterialCache();
    }
  });
}

function darkenHex(hex: string, amount: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  const r = Math.max(0, Math.floor(((value >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.floor(((value >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.floor((value & 255) * (1 - amount)));
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
