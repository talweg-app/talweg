import type { CanvasDocument, NodeId, Point2D } from "@talweg/core";
import {
  descendantIds,
  groupBounds,
  selectionRoots,
} from "./organizeCanvas.js";
import { pageNodes } from "./pageNodes.js";

export interface AlignmentGuide {
  axis: "x" | "y";
  position: number;
  from: number;
  to: number;
}

// The document and drag positions are already in world coordinates.
export function alignmentGuides(
  document: CanvasDocument,
  positions: ReadonlyMap<NodeId, Point2D>,
  zoom: number,
): AlignmentGuide[] {
  const roots = selectionRoots(document, new Set(positions.keys()));
  const excluded = new Set(
    roots.flatMap((node) => [...descendantIds(document, node.id)]),
  );
  const moving = roots
    .filter((node) => node.type !== "arrow")
    .map((node) => {
      const box = node.type === "group" ? groupBounds(document, node) : node;
      const position = positions.get(node.id) ?? node;
      return {
        x: box.x + position.x - node.x,
        y: box.y + position.y - node.y,
        width: box.width,
        height: box.height,
      };
    });
  if (!moving.length) return [];
  const left = Math.min(...moving.map((box) => box.x));
  const right = Math.max(...moving.map((box) => box.x + box.width));
  const top = Math.min(...moving.map((box) => box.y));
  const bottom = Math.max(...moving.map((box) => box.y + box.height));
  const selected = {
    x: [left, (left + right) / 2, right],
    y: [top, (top + bottom) / 2, bottom],
  };
  const nearest: Partial<
    Record<"x" | "y", { distance: number; guide: AlignmentGuide }>
  > = {};
  for (const node of Object.values(
    pageNodes(document, document.activePageId),
  )) {
    if (excluded.has(node.id) || node.type === "arrow" || !node.isVisible)
      continue;
    if (
      node.type === "group" &&
      [...descendantIds(document, node.id)].some((id) => excluded.has(id))
    )
      continue;
    const box = node.type === "group" ? groupBounds(document, node) : node;
    const targets = {
      x: [box.x, box.x + box.width / 2, box.x + box.width],
      y: [box.y, box.y + box.height / 2, box.y + box.height],
    };
    for (const axis of ["x", "y"] as const) {
      for (const position of targets[axis]) {
        for (const value of selected[axis]) {
          const distance = Math.abs(value - position);
          if (
            distance > 6 / zoom ||
            (nearest[axis] && distance >= nearest[axis].distance)
          )
            continue;
          nearest[axis] = {
            distance,
            guide: {
              axis,
              position,
              from: axis === "x" ? Math.min(top, box.y) : Math.min(left, box.x),
              to:
                axis === "x"
                  ? Math.max(bottom, box.y + box.height)
                  : Math.max(right, box.x + box.width),
            },
          };
        }
      }
    }
  }
  return Object.values(nearest).map((match) => match.guide);
}
