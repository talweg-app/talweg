import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ArrowNode,
  type BoundingBox,
  type CameraViewport,
  type CanvasDocument,
  type CanvasNode,
  type CanvasPage,
  type CompassAnchor,
  type NodeId,
  type PageId,
  type Point2D,
  type ResizeHandle,
  type TransformBox2D,
  type TextRun,
  computeGroupBounds,
  panByScreenDelta,
  resizeTransformBox,
  screenToWorld,
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
import { readableTextColor } from "../utils/textRuns.js";
import { useTranslation } from "../hooks/useTranslation.js";
import { useCanvasGestures } from "../hooks/useCanvasGestures.js";
import { pageNodes } from "../utils/pageNodes.js";
import { resizeNodeContent } from "../utils/resizeNodeContent.js";
import { createCanvasNode } from "../utils/createCanvasNode.js";
import { ArrowSelectionOverlay } from "./ArrowSelectionOverlay.js";
import { ConnectorRenderer } from "./ConnectorRenderer.js";
import { ContextMenu, type ContextMenuState } from "./ContextMenu.js";
import { NodeRenderer } from "./NodeRenderer.js";
import { PageTabsBar } from "./PageTabsBar.js";
import { SelectionBox } from "./SelectionBox.js";
import { ZoomControls } from "./ZoomControls.js";

interface CanvasProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  onImportImage: (file: File | Blob, clientPoint?: Point2D) => Promise<void>;
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

const snap16 = (value: number): number => Math.round(value / 16) * 16;

const EMPTY_PORT_SLOTS: ReadonlyMap<string, Anchor> = new Map();

export function Canvas({
  viewportRef: containerRef,
  onImportImage,
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
  const { t } = useTranslation();
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".canvas-empty-state button")) return;
      setHintDismissed(true);
    };
    window.addEventListener("pointerdown", dismiss, { capture: true, once: true });
    window.addEventListener("keydown", dismiss, { capture: true, once: true });
    window.addEventListener("wheel", dismiss, { capture: true, passive: true, once: true });
    return () => {
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("keydown", dismiss, true);
      window.removeEventListener("wheel", dismiss, true);
    };
  }, []);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagePointRef = useRef<Point2D | undefined>(undefined);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [connectingSourceId, setConnectingSourceId] = useState<NodeId | null>(null);
  const [connectingSourceAnchor, setConnectingSourceAnchor] = useState<CompassAnchor | null>(null);
  const [hoveredArrowId, setHoveredArrowId] = useState<NodeId | null>(null);
  const [labelLayer, setLabelLayer] = useState<SVGSVGElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Local optimistic drag and resize positions for zero-latency 60fps interaction
  const [dragOffsets, setDragOffsets] = useState<ReadonlyMap<NodeId, Point2D>>(new Map());
  const [resizeOffsets, setResizeOffsets] = useState<{ id: NodeId; box: TransformBox2D } | null>(null);

  useCanvasGestures(containerRef, onCameraChange);
  useEffect(() => {
    setConnectingSourceId(null);
    setConnectingSourceAnchor(null);
    setContextMenu(null);
    setDragState(null);
    setDragOffsets(new Map());
    setResizeOffsets(null);
  }, [activePageId]);

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

  useEffect(() => {
    const openInsert = () => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      onSelectNodeIds(new Set());
      setContextMenu({ clientPoint: { x, y }, worldPoint: toWorld(x, y), nodeId: null });
    };
    window.addEventListener("talweg:insert", openInsert);
    return () => { window.removeEventListener("talweg:insert", openInsert); };
  }, [onSelectNodeIds, toWorld]);

  const createNodeAt = useCallback(
    (tool: ToolType, worldPoint: Point2D): boolean => {
      if (tool === "image") {
        const bounds = containerRef.current?.getBoundingClientRect();
        imagePointRef.current = { x: (worldPoint.x + camera.x) * camera.zoom + (bounds?.left ?? 0), y: (worldPoint.y + camera.y) * camera.zoom + (bounds?.top ?? 0) };
        imageInputRef.current?.click();
        return true;
      }
      const node = createCanvasNode(tool, worldPoint, mode);
      if (!node) return false;
      onAddNode(node);
      onSelectTool("select");
      return true;
    },
    [mode, onAddNode, onSelectTool, camera, containerRef],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || e.button === 2) return;
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
          for (const node of Object.values(pageNodes(document, activePageId))) {
            if (node.type === "arrow") continue;
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
      const resized = document?.nodes[resizeOffsets.id];
      onUpdateNode(resizeOffsets.id, {
        ...(resized ? resizeNodeContent(resized, resizeOffsets.box) : {}),
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
    const modifiedNodes = pageNodes(document, activePageId);

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
          ...resizeNodeContent(existing, resizeOffsets.box),
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

  const sceneNodes = useMemo(() => {
    const arrows: ArrowNode[] = [];
    const shapes: CanvasNode[] = [];
    for (const node of Object.values(renderedDocument?.nodes ?? {})) {
      if (node.type === "arrow") arrows.push(node);
      else shapes.push(node);
    }
    return { arrows, shapes };
  }, [renderedDocument]);

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
      data-testid="canvas"
      className={`relative w-full h-full overflow-hidden overscroll-none bg-[#101112] select-none touch-none ${cursorClass}`}
      style={{
        backgroundImage: "radial-gradient(circle, rgba(255, 255, 255, 0.055) 1px, transparent 1px)",
        backgroundSize: `${String(gridSize)}px ${String(gridSize)}px`,
        backgroundPosition: `${String(gridOffsetX)}px ${String(gridOffsetY)}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => {
        e.preventDefault();
        const target = e.target instanceof Element ? e.target.closest("[data-node-id]") : null;
        const nodeId = target?.getAttribute("data-node-id") as NodeId | null;
        if (nodeId && !selectedNodeIds.has(nodeId)) onSelectNodeIds(new Set([nodeId]));
        if (!nodeId) onSelectNodeIds(new Set());
        setDragState(null);
        setContextMenu({
          nodeId,
          cellKey: e.target instanceof Element ? e.target.closest("[data-table-cell]")?.getAttribute("data-table-cell") ?? null : null,
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
      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden aria-label={t("canvas.importImages")} onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = "";
        for (const file of files) void onImportImage(file, imagePointRef.current);
      }} />
      {/* World Space Transformed Container */}
      {renderedDocument && (
        <div
          data-testid="canvas-world"
          className="absolute inset-0 pointer-events-none origin-top-left"
          style={{
            transform: `matrix(${String(camera.zoom)}, 0, 0, ${String(camera.zoom)}, ${String(camera.x * camera.zoom)}, ${String(camera.y * camera.zoom)})`,
          }}
        >
          {/* SVG Layer for routed edge connectors */}
          <svg focusable="false" className="canvas-connector-layer absolute inset-0 w-full h-full overflow-visible pointer-events-none">
            {sceneNodes.arrows
              .map((arrow) => (
                <ConnectorRenderer
                  key={arrow.id}
                  arrow={arrow}
                  labelLayer={labelLayer}
                  document={renderedDocument}
                  portSlots={portSlots}
                  isSelected={selectedNodeIds.has(arrow.id)}
                  onSelect={handleNodeSelect}
                  onEditLabel={(id, point) => {
                    onSelectNodeIds(new Set([id]));
                    setContextMenu({ nodeId: id, clientPoint: point, worldPoint: toWorld(point.x, point.y) });
                  }}
                  onHoverArrow={setHoveredArrowId}
                />
              ))}
          </svg>

          {/* HTML Nodes Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {sceneNodes.shapes
              .map((node) => (
                <NodeRenderer
                  key={node.id}
                  node={node}
                  adapter={adapter}
                  isSelected={selectedNodeIds.has(node.id)}
                  isPanActive={isSpacePressed || activeTool === "pan"}
                  onSelect={handleNodeSelect}
                  onUpdateData={onUpdateNodeData}
                  onUpdateRuns={(id, field, runs: TextRun[]) => {
                    const node = document?.nodes[id];
                    if (node && JSON.stringify(node.textRuns?.[field] ?? []) !== JSON.stringify(runs)) onUpdateNode?.(id, { textRuns: { ...node.textRuns, [field]: runs } });
                  }}
                  onUpdateNote={(id, note) => { onUpdateNode?.(id, { note }); }}
                  onStartConnect={(sourceId, anchor) => {
                    setConnectingSourceId(sourceId);
                    setConnectingSourceAnchor(anchor ?? "e");
                  }}
                />
              ))}
          </div>

          <svg data-testid="canvas-label-layer" ref={setLabelLayer} focusable="false" className="canvas-connector-layer absolute inset-0 w-full h-full overflow-visible pointer-events-none" style={{ zIndex: 2147483646 }} />

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

      {!hintDismissed && renderedDocument && sceneNodes.shapes.length === 0 && sceneNodes.arrows.length === 0 && (
        <div className="canvas-empty-state">
          <div className="canvas-empty-symbol"><Plus size={22} strokeWidth={1.2} /></div>
          <h2>{t("canvas.emptyTitle")}</h2>
          <p>{t("canvas.emptyDescription")}</p>
          <button type="button" onPointerDown={(event) => { event.stopPropagation(); }} onClick={() => { setHintDismissed(true); window.dispatchEvent(new Event("talweg:insert")); }}><Plus size={13} />{t("canvas.emptyAction")}</button>
        </div>
      )}

      {/* Floating Status Badge when Connecting Nodes */}
      {connectingSourceId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#16181c] border border-white/[0.08] text-neutral-300 px-3 h-8 flex items-center rounded text-xs shadow-md pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/90 mr-1.5" />
          <span>{t("canvas.connectHint")}</span>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          mode={mode}
          nodes={contextMenu.nodeId && document
            ? [...selectedNodeIds].map((id) => {
                const node = document.nodes[id];
                if (node?.type === "table" && contextMenu.cellKey) return { ...node, style: { ...node.style, ...node.data.cellStyles?.[contextMenu.cellKey] } };
                return node;
              }).filter((node): node is CanvasNode => !!node)
            : []}
          onEditNote={(id) => {
            const node = document?.nodes[id];
            if (node && typeof node.note !== "string") onUpdateNode?.(id, { note: "" });
            window.dispatchEvent(new CustomEvent("talweg:edit-note", { detail: id }));
          }}
          onRemoveNote={(id) => { onUpdateNode?.(id, { note: null }); }}
          onUpdateLabel={(id, label) => { onUpdateNodeData(id, { label }); }}
          onUpdateStyle={(style) => {
            for (const id of selectedNodeIds) {
              const node = document?.nodes[id];
              const nextStyle = { ...style };
              if (node?.type === "table" && style.fillColor) nextStyle.textColor = readableTextColor(style.fillColor);
              if (node?.type === "table" && contextMenu.cellKey) {
                onUpdateNodeData(id, { cellStyles: { ...node.data.cellStyles, [contextMenu.cellKey]: { ...node.data.cellStyles?.[contextMenu.cellKey], ...nextStyle } } });
              } else onUpdateNodeStyle(id, nextStyle);
            }
          }}
          onTableScope={() => { setContextMenu({ ...contextMenu, cellKey: null }); }}
          onDuplicate={() => {
            if (!document) return;
            const copies = [...selectedNodeIds].flatMap((id) => {
              const node = document.nodes[id];
              if (!node || node.type === "arrow") return [];
              const timestamp = Date.now();
              return [{ ...structuredClone(node), id: createId(node.type), x: node.x + 24, y: node.y + 24, createdAt: timestamp, updatedAt: timestamp }];
            });
            copies.forEach(onAddNode);
            onSelectNodeIds(new Set(copies.map((node) => node.id)));
          }}
          onArrange={(front) => {
            if (!document || !onUpdateNode) return;
            const layers = Object.values(document.nodes).map((node) => node.zIndex);
            const layer = front ? Math.max(...layers, 0) + 1 : Math.min(...layers, 0) - 1;
            for (const id of selectedNodeIds) onUpdateNode(id, { zIndex: layer });
          }}
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
