import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ArrowNode,
  type BoundingBox,
  type CameraViewport,
  type CanvasDocument,
  type CanvasNode,
  type CanvasPage,
  type CapsuleNode,
  type CompassAnchor,
  type CylinderNode,
  type DiamondNode,
  type NodeId,
  type PageId,
  type Point2D,
  type ResizeHandle,
  type TransformBox2D,
  computeGroupBounds,
  panByScreenDelta,
  resizeTransformBox,
  sanitizeCamera,
  screenToWorld,
  zoomAtViewportPoint,
} from "@talweg/core";
import type { Anchor } from "@talweg/router";
import type { StorageAdapter } from "@talweg/storage";
import type {
  ArrowCurveStyle,
  ArrowEndpoint,
  CanvasMode,
  DragState,
  ToolType,
} from "../types.js";
import { buildPortSlotMap } from "../utils/connectorGeometry.js";
import { createId } from "../utils/template.js";
import { ArrowSelectionOverlay } from "./ArrowSelectionOverlay.js";
import { ConnectorRenderer } from "./ConnectorRenderer.js";
import { ContextMenu, type ContextMenuState } from "./ContextMenu.js";
import { NodeRenderer } from "./NodeRenderer.js";
import { PageTabsBar } from "./PageTabsBar.js";
import { SelectionBox } from "./SelectionBox.js";
import { ZoomControls } from "./ZoomControls.js";

interface CanvasProps {
  document: CanvasDocument | null;
  camera: CameraViewport;
  onCameraChange: React.Dispatch<React.SetStateAction<CameraViewport>>;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  mode: CanvasMode;
  selectedNodeIds: ReadonlySet<NodeId>;
  onSelectNodeIds: React.Dispatch<React.SetStateAction<ReadonlySet<NodeId>>>;
  onAddNode: (node: CanvasNode) => void;
  onUpdateNode?: (id: NodeId, updates: Partial<CanvasNode>) => void;
  onUpdateNodeData: (id: NodeId, data: Record<string, unknown>) => void;
  onUpdateNodeStyle: (id: NodeId, style: Record<string, unknown>) => void;
  onBatchMoveNodes: (positions: ReadonlyMap<NodeId, Point2D>) => void;
  onConnectNodes: (
    sourceId: NodeId,
    targetId: NodeId,
    label?: string,
    sourceAnchor?: CompassAnchor,
    targetAnchor?: CompassAnchor,
    curveStyle?: ArrowCurveStyle,
  ) => void;
  onReconnectArrow: (
    arrowId: NodeId,
    endpoint: ArrowEndpoint,
    nodeId: NodeId,
    anchor: CompassAnchor,
  ) => void;
  onResetZoom: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  onDeleteSelected?: (() => void) | undefined;
  onAddMindmapChild?: (() => void) | undefined;
  onAddMindmapSibling?: (() => void) | undefined;
  adapter?: StorageAdapter | null | undefined;
  boardId?: string | undefined;
  activePageId?: PageId | undefined;
  pages?: readonly CanvasPage[] | undefined;
  onSelectPage?: ((pageId: PageId) => void) | undefined;
  onAddPage?: ((name?: string) => PageId | undefined) | undefined;
  onRenamePage?: ((pageId: PageId, newName: string) => void) | undefined;
  onDeletePage?: ((pageId: PageId) => void) | undefined;
}

function aabbIntersects(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
}

const snap16 = (val: number): number => Math.round(val / 16) * 16;
const EMPTY_PORT_SLOTS: ReadonlyMap<string, Anchor> = new Map();

export function Canvas({
  document,
  camera,
  onCameraChange,
  activeTool,
  onSelectTool,
  mode,
  selectedNodeIds,
  onSelectNodeIds,
  onAddNode,
  onUpdateNode,
  onUpdateNodeData,
  onUpdateNodeStyle,
  onBatchMoveNodes,
  onConnectNodes,
  onReconnectArrow,
  onResetZoom,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onDeleteSelected,
  onAddMindmapChild,
  onAddMindmapSibling,
  adapter,
  boardId,
  activePageId,
  pages,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [connectingSourceId, setConnectingSourceId] = useState<NodeId | null>(null);
  const [connectingSourceAnchor, setConnectingSourceAnchor] = useState<CompassAnchor | null>(null);
  const [hoveredArrowId, setHoveredArrowId] = useState<NodeId | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Local optimistic drag and resize positions for zero-latency 60fps interaction
  const [dragOffsets, setDragOffsets] = useState<ReadonlyMap<NodeId, Point2D>>(new Map());
  const [resizeOffsets, setResizeOffsets] = useState<{ id: NodeId; box: TransformBox2D } | null>(null);

  // Native trackpad & wheel gesture pipeline:
  // - Trackpad 2-finger pan (continuous 2D delta)
  // - Trackpad pinch / Ctrl+wheel (smooth exponential zoom at cursor)
  // - Discrete mouse wheel (stepped notch zoom at cursor)
  // - Safari gesture events (hardware-accelerated trackpad pinch)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const zoomAtCursor = (clientX: number, clientY: number, factor: number) => {
      const rect = container.getBoundingClientRect();
      const viewportPoint: Point2D = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      onCameraChange((prev) => {
        const safe = sanitizeCamera(prev);
        return zoomAtViewportPoint(safe, viewportPoint, safe.zoom * factor);
      });
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const deltaFactor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 800 : 1;
      const dx = e.deltaX * deltaFactor;
      const dy = e.deltaY * deltaFactor;

      // Trackpad pinch-to-zoom is synthesized by browsers as ctrlKey + wheel
      if (e.ctrlKey || e.metaKey) {
        const isDiscrete =
          e.deltaMode !== 0 ||
          (e.deltaX === 0 && e.deltaY % 1 === 0 && Math.abs(e.deltaY) >= 40);
        const k = isDiscrete ? 0.0015 : 0.01;
        zoomAtCursor(e.clientX, e.clientY, Math.exp(-dy * k));
        return;
      }

      if (e.shiftKey) {
        const panDx = dx !== 0 ? dx : dy;
        onCameraChange((prev) => panByScreenDelta(sanitizeCamera(prev), { x: -panDx, y: 0 }));
        return;
      }

      // pixel-mode streams with fractional deltas or any lateral motion are
      // trackpad scroll; whole single-axis ticks are a physical wheel
      const isTrackpadScroll =
        e.deltaX !== 0 ||
        (e.deltaMode === 0 && (e.deltaY % 1 !== 0 || Math.abs(e.deltaY) < 40));

      if (isTrackpadScroll) {
        onCameraChange((prev) =>
          panByScreenDelta(sanitizeCamera(prev), { x: -dx, y: -dy }),
        );
        return;
      }

      // wheel tick: scrolling down zooms out, scrolling up zooms in
      zoomAtCursor(e.clientX, e.clientY, Math.exp(-dy * 0.0015));
    };

    // Safari macOS proprietary trackpad pinch
    let lastGestureScale = 1;
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      lastGestureScale = 1;
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      const ge = e as Event & { clientX: number; clientY: number; scale: number };
      const factor = ge.scale / lastGestureScale;
      lastGestureScale = ge.scale;
      zoomAtCursor(ge.clientX, ge.clientY, factor);
    };

    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
      lastGestureScale = 1;
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("gesturestart", handleGestureStart, { passive: false });
    container.addEventListener("gesturechange", handleGestureChange, { passive: false });
    container.addEventListener("gestureend", handleGestureEnd, { passive: false });

    // Block browser-level tab zooming when Ctrl+Wheeling near edges
    const preventWindowZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", preventWindowZoom, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("gesturestart", handleGestureStart);
      container.removeEventListener("gesturechange", handleGestureChange);
      container.removeEventListener("gestureend", handleGestureEnd);
      window.removeEventListener("wheel", preventWindowZoom);
    };
  }, [onCameraChange]);

  // Spacebar tracking for Pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && !target.isContentEditable) {
          e.preventDefault();
          setIsSpacePressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const getScreenBounds = useCallback((): Point2D => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }, []);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point2D =>
      screenToWorld({ x: clientX, y: clientY }, camera, getScreenBounds()),
    [camera, getScreenBounds],
  );

  const createNodeAt = useCallback(
    (tool: ToolType, worldPoint: Point2D): boolean => {
      const spawnX = mode === "diagrams" ? snap16(worldPoint.x) : Math.round(worldPoint.x);
      const spawnY = mode === "diagrams" ? snap16(worldPoint.y) : Math.round(worldPoint.y);
      const timestamp = Date.now();

      if (tool === "rectangle") {
        const rectId = createId("rect");
        const node: CanvasNode = {
          id: rectId,
          type: "rectangle",
          x: spawnX - 100,
          y: spawnY - 40,
          width: 200,
          height: 80,
          rotation: 0,
          zIndex: 10,
          opacity: 1,
          parentId: null,
          isLocked: false,
          isVisible: true,
          style: {
            fillColor: "#0f141c",
            strokeColor: "#27272a",
            strokeWidth: 1,
            cornerRadius: 6,
            textColor: "#f4f4f5",
            fontSize: 13,
            textAlign: "center",
            verticalAlign: "middle",
          },
          data: { label: "Process" },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        onAddNode(node);
        return true;
      }

      if (tool === "diamond") {
        const diamondId = createId("diamond");
        const node: DiamondNode = {
          id: diamondId,
          type: "diamond",
          x: spawnX - 70,
          y: spawnY - 48,
          width: 140,
          height: 96,
          rotation: 0,
          zIndex: 10,
          opacity: 1,
          parentId: null,
          isLocked: false,
          isVisible: true,
          style: {
            fillColor: "#0f172a",
            strokeColor: "#38bdf8",
            strokeWidth: 1.5,
            textColor: "#f4f4f5",
            fontSize: 12,
          },
          data: { label: "Decision" },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        onAddNode(node);
        return true;
      }

      if (tool === "capsule") {
        const capsuleId = createId("capsule");
        const node: CapsuleNode = {
          id: capsuleId,
          type: "capsule",
          x: spawnX - 72,
          y: spawnY - 24,
          width: 144,
          height: 48,
          rotation: 0,
          zIndex: 10,
          opacity: 1,
          parentId: null,
          isLocked: false,
          isVisible: true,
          style: {
            fillColor: "#062b1e",
            strokeColor: "#10b981",
            strokeWidth: 1.5,
            textColor: "#a7f3d0",
            fontSize: 12,
          },
          data: { label: "Start / End" },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        onAddNode(node);
        return true;
      }

      if (tool === "cylinder") {
        const cylinderId = createId("cylinder");
        const node: CylinderNode = {
          id: cylinderId,
          type: "cylinder",
          x: spawnX - 72,
          y: spawnY - 48,
          width: 144,
          height: 96,
          rotation: 0,
          zIndex: 10,
          opacity: 1,
          parentId: null,
          isLocked: false,
          isVisible: true,
          style: {
            fillColor: "#181126",
            strokeColor: "#a855f7",
            strokeWidth: 1.5,
            textColor: "#e9d5ff",
            fontSize: 12,
          },
          data: { label: "Data Store" },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        onAddNode(node);
        return true;
      }

      if (tool === "sticker") {
        const stickerId = createId("sticker");
        const node: CanvasNode = {
          id: stickerId,
          type: "sticker",
          x: spawnX - 110,
          y: spawnY - 100,
          width: 220,
          height: 200,
          rotation: 0,
          zIndex: 10,
          opacity: 1,
          parentId: null,
          isLocked: false,
          isVisible: true,
          style: {
            fillColor: "#fef9c3",
            textColor: "#422006",
            fontSize: 14,
            fontFamily: "sans-serif",
            cornerRadius: 4,
          },
          data: {
            content: "New note...",
            stickerShape: "square",
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        onAddNode(node);
        return true;
      }

      if (tool === "card") {
        const cardId = createId("card");
        const node: CanvasNode = {
          id: cardId,
          type: "card",
          x: spawnX - 170,
          y: spawnY - 90,
          width: 340,
          height: 180,
          rotation: 0,
          zIndex: 10,
          opacity: 1,
          parentId: null,
          isLocked: false,
          isVisible: true,
          style: {
            fillColor: "#171717",
            strokeColor: "#262626",
            strokeWidth: 1,
            cornerRadius: 8,
            textColor: "#f5f5f5",
            fontSize: 13,
          },
          data: {
            title: "New Card",
            status: "todo",
            tags: [],
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        onAddNode(node);
        return true;
      }

      return false;
    },
    [mode, onAddNode],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    try {
      containerRef.current.setPointerCapture(e.pointerId);
    } catch {
      // Non-active pointer fallback
    }

    if (e.button === 1) {
      e.preventDefault();
    }

    const screenPoint: Point2D = { x: e.clientX, y: e.clientY };
    const screenBounds = getScreenBounds();
    const worldPoint = screenToWorld(screenPoint, camera, screenBounds);

    // Pan with middle click, Space pressed, or Pan tool
    const isPanAction =
      e.button === 1 || isSpacePressed || activeTool === "pan";

    if (isPanAction) {
      setDragState({
        mode: "pan",
        startScreen: screenPoint,
        startWorld: worldPoint,
        lastScreen: screenPoint,
      });
      return;
    }

    if (e.button !== 0) return;

    // Creation tools on background click
    if (createNodeAt(activeTool, worldPoint)) {
      onSelectTool("select");
      return;
    }

    // Rubberband marquee selection on empty canvas in select mode
    if (activeTool === "select") {
      setDragState({
        mode: "marquee",
        startScreen: screenPoint,
        startWorld: worldPoint,
        lastScreen: screenPoint,
        currentWorld: worldPoint,
      });

      if (!e.shiftKey) {
        onSelectNodeIds(new Set());
      }
      setConnectingSourceId(null);
      setConnectingSourceAnchor(null);
    }
  };

  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, handle: ResizeHandle, node: CanvasNode) => {
      if (!containerRef.current) return;
      try {
        containerRef.current.setPointerCapture(e.pointerId);
      } catch {
        // Non-active pointer fallback
      }

      const screenPoint: Point2D = { x: e.clientX, y: e.clientY };
      const screenBounds = getScreenBounds();
      const worldPoint = screenToWorld(screenPoint, camera, screenBounds);

      const initialBox: TransformBox2D = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        rotation: (node.rotation * Math.PI) / 180,
      };

      setDragState({
        mode: "resize",
        startScreen: screenPoint,
        startWorld: worldPoint,
        lastScreen: screenPoint,
        currentWorld: worldPoint,
        resizeHandle: handle,
        initialBox,
        resizeNodeId: node.id,
      });
    },
    [camera, getScreenBounds],
  );

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;

    const screenPoint: Point2D = { x: e.clientX, y: e.clientY };
    const screenBounds = getScreenBounds();
    const currentWorld = screenToWorld(screenPoint, camera, screenBounds);

    if (dragState.mode === "pan") {
      const deltaScreen: Point2D = {
        x: screenPoint.x - dragState.lastScreen.x,
        y: screenPoint.y - dragState.lastScreen.y,
      };
      onCameraChange((prev) => panByScreenDelta(prev, deltaScreen));
      setDragState({
        ...dragState,
        lastScreen: screenPoint,
      });
      return;
    }

    if (dragState.mode === "move" && dragState.initialNodePositions) {
      const deltaWorld: Point2D = {
        x: currentWorld.x - dragState.startWorld.x,
        y: currentWorld.y - dragState.startWorld.y,
      };

      const updated = new Map<NodeId, Point2D>();
      for (const [id, initPos] of dragState.initialNodePositions.entries()) {
        const rawX = initPos.x + deltaWorld.x;
        const rawY = initPos.y + deltaWorld.y;
        const posX = mode === "diagrams" ? snap16(rawX) : Math.round(rawX);
        const posY = mode === "diagrams" ? snap16(rawY) : Math.round(rawY);
        updated.set(id, { x: posX, y: posY });
      }
      setDragOffsets(updated);
      return;
    }

    if (
      dragState.mode === "resize" &&
      dragState.resizeHandle &&
      dragState.initialBox &&
      dragState.resizeNodeId
    ) {
      const targetNode = document?.nodes[dragState.resizeNodeId];
      const isImage = targetNode?.type === "image";
      const lockAspectRatio = isImage || e.shiftKey;

      const result = resizeTransformBox(
        dragState.initialBox,
        dragState.resizeHandle,
        currentWorld,
        {
          lockAspectRatio,
          isShiftPressed: e.shiftKey,
          minWidth: 40,
          minHeight: 30,
        },
      );

      let finalBox = result.box;
      if (mode === "diagrams") {
        finalBox = {
          ...finalBox,
          x: snap16(finalBox.x),
          y: snap16(finalBox.y),
          width: Math.max(32, snap16(finalBox.width)),
          height: Math.max(32, snap16(finalBox.height)),
        };
      }

      setResizeOffsets({
        id: dragState.resizeNodeId,
        box: finalBox,
      });
      return;
    }

    if (dragState.mode === "marquee") {
      setDragState({
        ...dragState,
        lastScreen: screenPoint,
        currentWorld,
      });

      const marqueeBounds: BoundingBox = {
        minX: Math.min(dragState.startWorld.x, currentWorld.x),
        minY: Math.min(dragState.startWorld.y, currentWorld.y),
        maxX: Math.max(dragState.startWorld.x, currentWorld.x),
        maxY: Math.max(dragState.startWorld.y, currentWorld.y),
        width: Math.abs(currentWorld.x - dragState.startWorld.x),
        height: Math.abs(currentWorld.y - dragState.startWorld.y),
      };

      if (marqueeBounds.width > 3 || marqueeBounds.height > 3) {
        const nextSelected = new Set<NodeId>(e.shiftKey ? selectedNodeIds : []);
        if (document) {
          for (const node of Object.values(document.nodes)) {
            if (node.type === "arrow") continue;
            if (activePageId && node.pageId && node.pageId !== activePageId) continue;
            const nodeBounds = computeGroupBounds([node]);
            if (aabbIntersects(marqueeBounds, nodeBounds)) {
              nextSelected.add(node.id);
            }
          }
        }
        onSelectNodeIds(nextSelected);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Release fallback
    }

    if (dragState?.mode === "move" && dragOffsets.size > 0) {
      onBatchMoveNodes(dragOffsets);
      setDragOffsets(new Map());
    }

    if (dragState?.mode === "resize" && resizeOffsets && onUpdateNode) {
      onUpdateNode(resizeOffsets.id, {
        x: Math.round(resizeOffsets.box.x),
        y: Math.round(resizeOffsets.box.y),
        width: Math.round(resizeOffsets.box.width),
        height: Math.round(resizeOffsets.box.height),
      });
      setResizeOffsets(null);
    }

    setDragState(null);
  };

  const handleNodeSelect = useCallback(
    (id: NodeId, e: React.PointerEvent) => {
      e.stopPropagation();

      // Pan with middle click, Space pressed, or Pan tool
      if (e.button === 1 || isSpacePressed || activeTool === "pan") {
        if (!containerRef.current) return;
        try {
          containerRef.current.setPointerCapture(e.pointerId);
        } catch {
          // fallback
        }
        const screenPoint: Point2D = { x: e.clientX, y: e.clientY };
        const screenBounds = getScreenBounds();
        const worldPoint = screenToWorld(screenPoint, camera, screenBounds);
        setDragState({
          mode: "pan",
          startScreen: screenPoint,
          startWorld: worldPoint,
          lastScreen: screenPoint,
        });
        return;
      }

      // If in connector creation mode or port clicked
      if (connectingSourceId !== null) {
        if (connectingSourceId !== id) {
          const defaultTargetAnchor: CompassAnchor =
            connectingSourceAnchor === "e"
              ? "w"
              : connectingSourceAnchor === "w"
                ? "e"
                : connectingSourceAnchor === "n"
                  ? "s"
                  : "n";

          onConnectNodes(
            connectingSourceId,
            id,
            undefined,
            connectingSourceAnchor ?? undefined,
            defaultTargetAnchor,
            mode === "mindmap" ? "bezier" : "orthogonal",
          );
        }
        setConnectingSourceId(null);
        setConnectingSourceAnchor(null);
        onSelectTool("select");
        return;
      }

      if (activeTool === "arrow") {
        setConnectingSourceId(id);
        setConnectingSourceAnchor("e");
        return;
      }

      const nextSelected = e.shiftKey
        ? new Set(selectedNodeIds).add(id)
        : new Set([id]);
      onSelectNodeIds(nextSelected);

      if (!document) return;

      const selected = document.nodes[id];
      if (!selected || selected.type === "arrow") return;

      const screenPoint: Point2D = { x: e.clientX, y: e.clientY };
      const screenBounds = getScreenBounds();
      const worldPoint = screenToWorld(screenPoint, camera, screenBounds);

      const initialPositions = new Map<NodeId, Point2D>();
      const moveTargets = nextSelected.has(id) ? nextSelected : new Set([id]);
      for (const nodeId of moveTargets) {
        const targetNode = document.nodes[nodeId];
        if (targetNode) {
          initialPositions.set(nodeId, { x: targetNode.x, y: targetNode.y });
        }
      }

      setDragState({
        mode: "move",
        startScreen: screenPoint,
        startWorld: worldPoint,
        lastScreen: screenPoint,
        initialNodePositions: initialPositions,
      });
    },
    [
      connectingSourceId,
      connectingSourceAnchor,
      activeTool,
      selectedNodeIds,
      onSelectNodeIds,
      document,
      camera,
      getScreenBounds,
      onConnectNodes,
      mode,
      onSelectTool,
      isSpacePressed,
    ],
  );

  // Merge live drag and resize positions into scene for instant reactive rendering, filtered by activePageId
  const renderedDocument: CanvasDocument | null = useMemo(() => {
    if (!document) return null;
    const modifiedNodes: Record<NodeId, CanvasNode> = {};
    for (const [id, node] of Object.entries(document.nodes)) {
      if (!activePageId || !node.pageId || node.pageId === activePageId) {
        modifiedNodes[id as NodeId] = node;
      }
    }

    if (dragOffsets.size > 0) {
      for (const [id, pos] of dragOffsets.entries()) {
        const existing = modifiedNodes[id];
        if (existing) {
          modifiedNodes[id] = {
            ...existing,
            x: pos.x,
            y: pos.y,
          };
        }
      }
    }

    if (resizeOffsets) {
      const existing = modifiedNodes[resizeOffsets.id];
      if (existing) {
        modifiedNodes[resizeOffsets.id] = {
          ...existing,
          x: Math.round(resizeOffsets.box.x),
          y: Math.round(resizeOffsets.box.y),
          width: Math.round(resizeOffsets.box.width),
          height: Math.round(resizeOffsets.box.height),
        };
      }
    }

    return {
      ...document,
      nodes: modifiedNodes,
    };
  }, [document, activePageId, dragOffsets, resizeOffsets]);

  const portSlots = useMemo(
    () => (renderedDocument ? buildPortSlotMap(renderedDocument) : EMPTY_PORT_SLOTS),
    [renderedDocument],
  );

  const selectedArrows = useMemo(() => {
    if (!renderedDocument) return [];
    return Object.values(renderedDocument.nodes).filter(
      (node): node is ArrowNode => node.type === "arrow" && selectedNodeIds.has(node.id),
    );
  }, [renderedDocument, selectedNodeIds]);

  const arrowsWithHandles = useMemo(() => {
    if (!renderedDocument) return [];
    const ids = new Set<NodeId>(selectedArrows.map((a) => a.id));
    if (hoveredArrowId && renderedDocument.nodes[hoveredArrowId]?.type === "arrow") {
      ids.add(hoveredArrowId);
    }
    return Array.from(ids)
      .map((id) => renderedDocument.nodes[id] as ArrowNode)
      .filter(Boolean);
  }, [renderedDocument, selectedArrows, hoveredArrowId]);

  // Dot grid parameters: 16px in diagrams mode, 24px in whiteboard/mindmap
  const gridBase = mode === "diagrams" ? 16 : 24;
  const gridSize = gridBase * camera.zoom;
  const gridOffsetX = (camera.x * camera.zoom) % gridSize;
  const gridOffsetY = (camera.y * camera.zoom) % gridSize;

  const cursorClass = dragState?.mode === "pan"
    ? "cursor-grabbing"
    : isSpacePressed || activeTool === "pan"
      ? "cursor-grab"
      : activeTool === "arrow" || connectingSourceId
        ? "cursor-crosshair"
        : activeTool === "select"
          ? "cursor-default"
          : "cursor-crosshair";

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[calc(100vh-2.5rem)] overflow-hidden overscroll-none bg-[#08090a] select-none touch-none ${cursorClass}`}
      style={{
        backgroundImage: "radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px)",
        backgroundSize: `${String(gridSize)}px ${String(gridSize)}px`,
        backgroundPosition: `${String(gridOffsetX)}px ${String(gridOffsetY)}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({
          clientPoint: { x: e.clientX, y: e.clientY },
          worldPoint: toWorld(e.clientX, e.clientY),
        });
      }}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
        }
      }}
    >
      {/* World Space Transformed Container */}
      {renderedDocument && (
        <div
          className="absolute inset-0 pointer-events-none origin-top-left"
          style={{
            transform: `matrix(${String(camera.zoom)}, 0, 0, ${String(camera.zoom)}, ${String(camera.x * camera.zoom)}, ${String(camera.y * camera.zoom)})`,
          }}
        >
          {/* SVG Layer for routed edge connectors */}
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
            {Object.values(renderedDocument.nodes)
              .filter((n): n is typeof n & { type: "arrow" } => n.type === "arrow")
              .map((arrow) => (
                <ConnectorRenderer
                  key={arrow.id}
                  arrow={arrow}
                  document={renderedDocument}
                  portSlots={portSlots}
                  isSelected={selectedNodeIds.has(arrow.id)}
                  onSelect={handleNodeSelect}
                  onHoverArrow={setHoveredArrowId}
                />
              ))}
          </svg>

          {/* HTML Nodes Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {Object.values(renderedDocument.nodes)
              .filter((n) => n.type !== "arrow")
              .map((node) => (
                <NodeRenderer
                  key={node.id}
                  node={node}
                  adapter={adapter}
                  mode={mode}
                  isSelected={selectedNodeIds.has(node.id)}
                  isPanActive={isSpacePressed || activeTool === "pan"}
                  onSelect={handleNodeSelect}
                  onUpdateData={onUpdateNodeData}
                  onUpdateStyle={onUpdateNodeStyle}
                  onStartConnect={(sourceId, anchor) => {
                    setConnectingSourceId(sourceId);
                    setConnectingSourceAnchor(anchor ?? "e");
                  }}
                />
              ))}
          </div>

          {/* 8-Point Selection Handles Layer */}
          {selectedNodeIds.size === 1 &&
            (() => {
              const [selectedId] = [...selectedNodeIds];
              const selectedNode = selectedId ? renderedDocument.nodes[selectedId] : undefined;
              if (selectedNode && selectedNode.type !== "arrow") {
                return (
                  <SelectionBox
                    node={selectedNode}
                    camera={camera}
                    onResizeStart={handleResizeStart}
                  />
                );
              }
              return null;
            })()}

          {arrowsWithHandles.length > 0 && (
            <ArrowSelectionOverlay
              arrows={arrowsWithHandles}
              document={renderedDocument}
              portSlots={portSlots}
              zoom={camera.zoom}
              toWorld={toWorld}
              onReconnect={onReconnectArrow}
            />
          )}

          {/* Rubberband / Marquee Bounding Box */}
          {dragState?.mode === "marquee" && dragState.currentWorld && (
            <div
              className="absolute pointer-events-none border border-dashed border-amber-500/80 bg-amber-500/5 z-40 rounded-sm"
              style={{
                left: Math.min(dragState.startWorld.x, dragState.currentWorld.x),
                top: Math.min(dragState.startWorld.y, dragState.currentWorld.y),
                width: Math.abs(dragState.currentWorld.x - dragState.startWorld.x),
                height: Math.abs(dragState.currentWorld.y - dragState.startWorld.y),
                borderWidth: `${String(Math.max(1, Math.round(1.5 / camera.zoom)))}px`,
              }}
            />
          )}
        </div>
      )}

      {/* Floating Status Badge when Connecting Nodes */}
      {connectingSourceId && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-neutral-900/95 border border-white/10 text-neutral-200 px-3 py-1 rounded text-xs font-mono shadow-2xl backdrop-blur-md pointer-events-none flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          <span>Click target node to connect</span>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          mode={mode}
          hasSelection={selectedNodeIds.size > 0}
          onClose={() => {
            setContextMenu(null);
          }}
          onCreateNode={(tool) => {
            createNodeAt(tool, contextMenu.worldPoint);
          }}
          onDeleteSelected={onDeleteSelected}
          onAddMindmapChild={onAddMindmapChild}
          onAddMindmapSibling={onAddMindmapSibling}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onZoomToFit={onZoomToFit}
          onResetZoom={onResetZoom}
        />
      )}

      {/* Floating Zoom Controls (bottom-right) */}
      <ZoomControls
        zoom={camera.zoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetZoom={onResetZoom}
        onZoomToFit={onZoomToFit}
      />

      {/* Floating Page Tabs Dock (bottom-left) */}
      {pages && activePageId && onSelectPage && onAddPage && onRenamePage && onDeletePage && (
        <PageTabsBar
          boardId={boardId}
          pages={pages}
          activePageId={activePageId}
          onSelectPage={onSelectPage}
          onAddPage={onAddPage}
          onRenamePage={onRenamePage}
          onDeletePage={onDeletePage}
        />
      )}
    </div>
  );
}
