import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  ArrowNode,
  CanvasDocument,
  CompassAnchor,
  NodeId,
  Point2D,
} from "@talweg/core";
import { anchorForFace, getAnchorPoint } from "@talweg/router";
import type { ArrowEndpoint } from "../types.js";
import {
  type ConnectorGeometry,
  type PortSlotMap,
  computeConnectorGeometry,
  nodeToBoundingBox,
} from "../utils/connectorGeometry.js";

import { useTranslation } from "../hooks/useTranslation.js";

const PORT_HIT_RADIUS = 30;
const COMPASS_FACES: readonly CompassAnchor[] = ["n", "s", "e", "w"];

interface PortHit {
  readonly nodeId: NodeId;
  readonly face: CompassAnchor;
  readonly point: Point2D;
}

interface DragState {
  readonly arrowId: NodeId;
  readonly endpoint: ArrowEndpoint;
  readonly anchorPoint: Point2D;
  readonly pointer: Point2D;
  readonly otherNodeId: NodeId;
}

interface ArrowSelectionOverlayProps {
  arrows: readonly ArrowNode[];
  document: CanvasDocument;
  portSlots: PortSlotMap;
  zoom: number;
  toWorld: (clientX: number, clientY: number) => Point2D;
  onReconnect: (
    arrowId: NodeId,
    endpoint: ArrowEndpoint,
    nodeId: NodeId,
    anchor: CompassAnchor,
  ) => void;
}

function findNearestPort(
  document: CanvasDocument,
  point: Point2D,
  excludedNodeId: NodeId,
): PortHit | null {
  let nearest: PortHit | null = null;
  let nearestDistance = PORT_HIT_RADIUS;

  for (const node of Object.values(document.nodes)) {
    if (node.type === "arrow" || !node.isVisible || node.id === excludedNodeId) continue;

    const box = nodeToBoundingBox(node);

    for (const face of COMPASS_FACES) {
      const portPoint = getAnchorPoint(box, anchorForFace(face));
      const distance = Math.hypot(portPoint.x - point.x, portPoint.y - point.y);

      if (distance <= nearestDistance) {
        nearest = { nodeId: node.id, face, point: portPoint };
        nearestDistance = distance;
      }
    }
  }

  return nearest;
}

function EndpointHandle({
  endpoint,
  point,
  zoom,
  active,
  onPointerDown,
}: {
  endpoint: ArrowEndpoint;
  point: Point2D;
  zoom: number;
  active: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useTranslation();
  const isSource = endpoint === "source";

  return (
    <button
      type="button"
      aria-label={t(isSource ? "canvas.reconnectSource" : "canvas.reconnectTarget")}
      data-arrow-endpoint={endpoint}
      className={`absolute rounded-full border-2 shadow-lg pointer-events-auto cursor-crosshair transition-colors ${
        isSource
          ? "bg-neutral-950 border-sky-400"
          : "bg-amber-400 border-neutral-950"
      } ${active ? "ring-2 ring-amber-300/80" : ""}`}
      style={{
        left: point.x,
        top: point.y,
        width: 10,
        height: 10,
        transform: `translate(-50%, -50%) scale(${String(1 / zoom)})`,
      }}
      onPointerDown={onPointerDown}
    />
  );
}

export function ArrowSelectionOverlay({
  arrows,
  document,
  portSlots,
  zoom,
  toWorld,
  onReconnect,
}: ArrowSelectionOverlayProps) {
  const dragRef = useRef<DragState | null>(null);
  const hoveredRef = useRef<PortHit | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hovered, setHovered] = useState<PortHit | null>(null);
  const isDragging = drag !== null;

  const geometries = useMemo(() => {
    const result = new Map<NodeId, ConnectorGeometry>();

    for (const arrow of arrows) {
      const geometry = computeConnectorGeometry(arrow, document, portSlots);
      if (geometry) result.set(arrow.id, geometry);
    }

    return result;
  }, [arrows, document, portSlots]);

  useEffect(() => {
    if (!isDragging) return;

    const clearDrag = () => {
      dragRef.current = null;
      hoveredRef.current = null;
      setDrag(null);
      setHovered(null);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;

      const pointer = toWorld(event.clientX, event.clientY);
      const next: DragState = { ...current, pointer };
      const hit = findNearestPort(document, pointer, current.otherNodeId);

      dragRef.current = next;
      hoveredRef.current = hit;
      setDrag(next);
      setHovered(hit);
    };

    const handlePointerUp = () => {
      const current = dragRef.current;
      const hit = hoveredRef.current;

      if (current && hit) {
        onReconnect(current.arrowId, current.endpoint, hit.nodeId, hit.face);
      }

      clearDrag();
    };

    const handlePointerCancel = () => {
      clearDrag();
    };

    const previousCursor = window.document.body.style.cursor;
    window.document.body.style.cursor = "crosshair";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [isDragging, document, toWorld, onReconnect]);

  const beginDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    arrow: ArrowNode,
    endpoint: ArrowEndpoint,
    anchorPoint: Point2D,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const next: DragState = {
      arrowId: arrow.id,
      endpoint,
      anchorPoint,
      pointer: toWorld(event.clientX, event.clientY),
      otherNodeId: endpoint === "source" ? arrow.data.targetId : arrow.data.sourceId,
    };

    dragRef.current = next;
    hoveredRef.current = null;
    setDrag(next);
    setHovered(null);
  };

  return (
    <div className="absolute inset-0 z-[70] pointer-events-none">
      {drag && (
        <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          <line
            x1={drag.anchorPoint.x}
            y1={drag.anchorPoint.y}
            x2={drag.pointer.x}
            y2={drag.pointer.y}
            stroke="#f59e0b"
            strokeWidth={1.5 / zoom}
            strokeDasharray={`${String(4 / zoom)} ${String(4 / zoom)}`}
          />
        </svg>
      )}

      {hovered && (
        <div
          className="absolute rounded-full border-2 border-emerald-400 bg-emerald-400/20 pointer-events-none"
          style={{
            left: hovered.point.x,
            top: hovered.point.y,
            width: 20,
            height: 20,
            transform: `translate(-50%, -50%) scale(${String(1 / zoom)})`,
            boxShadow: "0 0 16px 4px rgba(16, 185, 129, 0.75)",
          }}
        />
      )}

      {arrows.map((arrow) => {
        const geometry = geometries.get(arrow.id);
        if (!geometry) return null;

        const sourceDragged =
          drag?.arrowId === arrow.id && drag.endpoint === "source";
        const targetDragged =
          drag?.arrowId === arrow.id && drag.endpoint === "target";
        const sourcePoint = sourceDragged ? drag.pointer : geometry.sourcePoint;
        const targetPoint = targetDragged ? drag.pointer : geometry.targetPoint;

        return (
          <Fragment key={arrow.id}>
            <EndpointHandle
              endpoint="source"
              point={sourcePoint}
              zoom={zoom}
              active={sourceDragged}
              onPointerDown={(event) => {
                beginDrag(event, arrow, "source", geometry.targetPoint);
              }}
            />
            <EndpointHandle
              endpoint="target"
              point={targetPoint}
              zoom={zoom}
              active={targetDragged}
              onPointerDown={(event) => {
                beginDrag(event, arrow, "target", geometry.sourcePoint);
              }}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
