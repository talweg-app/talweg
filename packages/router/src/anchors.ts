import type { BoundingBox, Point2D } from "@talweg/core";

export type Direction = "NORTH" | "SOUTH" | "EAST" | "WEST";

export interface Anchor {
  readonly point: Point2D;
  readonly direction: Direction;
  readonly offset?: Point2D;
}

export interface ResolvedAnchors {
  readonly sourceAnchor: Anchor;
  readonly targetAnchor: Anchor;
}

const DIRECTION_VECTORS: Record<Direction, Point2D> = {
  NORTH: { x: 0, y: -1 },
  SOUTH: { x: 0, y: 1 },
  EAST: { x: 1, y: 0 },
  WEST: { x: -1, y: 0 },
};

export function getAnchorPoint(rect: BoundingBox, anchor: Anchor): Point2D {
  const offsetX = anchor.offset?.x ?? 0;
  const offsetY = anchor.offset?.y ?? 0;

  return {
    x: rect.minX + anchor.point.x * rect.width + offsetX,
    y: rect.minY + anchor.point.y * rect.height + offsetY,
  };
}

export function getDirectionVector(direction: Direction): Point2D {
  return DIRECTION_VECTORS[direction];
}

export function resolveAutoAnchors(source: BoundingBox, target: BoundingBox): ResolvedAnchors {
  const sourceCenter: Point2D = {
    x: source.minX + source.width / 2,
    y: source.minY + source.height / 2,
  };
  const targetCenter: Point2D = {
    x: target.minX + target.width / 2,
    y: target.minY + target.height / 2,
  };

  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0
      ? {
          sourceAnchor: { point: { x: 1, y: 0.5 }, direction: "EAST" },
          targetAnchor: { point: { x: 0, y: 0.5 }, direction: "WEST" },
        }
      : {
          sourceAnchor: { point: { x: 0, y: 0.5 }, direction: "WEST" },
          targetAnchor: { point: { x: 1, y: 0.5 }, direction: "EAST" },
        };
  }

  return deltaY >= 0
    ? {
        sourceAnchor: { point: { x: 0.5, y: 1 }, direction: "SOUTH" },
        targetAnchor: { point: { x: 0.5, y: 0 }, direction: "NORTH" },
      }
    : {
        sourceAnchor: { point: { x: 0.5, y: 0 }, direction: "NORTH" },
        targetAnchor: { point: { x: 0.5, y: 1 }, direction: "SOUTH" },
      };
}
