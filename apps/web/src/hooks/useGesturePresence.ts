import { useEffect } from "react";
import type { BoundingBox, CanvasDocument, FreehandNode, NodeId, Point2D, TransformBox2D } from "@talweg/core";
import type { PeerGesture, PresencePatch } from "../utils/collaborationPresence.js";

export function useGesturePresence(update: ((patch: PresencePatch) => void) | undefined, document: CanvasDocument | null,
  positions: ReadonlyMap<NodeId, Point2D>, resize: { id: NodeId; box: TransformBox2D } | null,
  stroke: FreehandNode | null, marquee: BoundingBox | null) {
  useEffect(() => {
    if (!update) return;
    let gesture: PeerGesture | null = null;
    if (stroke) {
      const points = stroke.data.points;
      const count = Math.min(points.length, 256);
      gesture = { kind: "ink", color: stroke.meta?.automaticInk ? null : (stroke.style.strokeColor ?? null), width: stroke.style.strokeWidth ?? 2,
        points: Array.from({ length: count }, (_, index) => {
          const point = points[Math.round(index * (points.length - 1) / Math.max(1, count - 1))];
          return { x: stroke.x + (point?.x ?? 0) * stroke.width, y: stroke.y + (point?.y ?? 0) * stroke.height };
        }) };
    } else if (resize) gesture = { kind: "resize", boxes: [{ id: resize.id, ...resize.box }] };
    else if (positions.size) gesture = { kind: "move", boxes: [...positions].slice(0, 1000).flatMap(([id, point]) => {
      const node = document?.nodes[id];
      return node ? [{ id, ...point, width: node.width, height: node.height }] : [];
    }) };
    else if (marquee) gesture = { kind: "marquee", x: marquee.minX, y: marquee.minY, width: marquee.width, height: marquee.height };
    update({ gesture });
  }, [update, document, positions, resize, stroke, marquee]);
  useEffect(() => () => { update?.({ gesture: null }); }, [update]);
}
