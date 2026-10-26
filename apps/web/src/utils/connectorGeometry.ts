import type {
  ArrowNode,
  BoundingBox,
  CanvasDocument,
  CanvasNode,
  NodeId,
  Point2D,
} from "@talweg/core";
import {
  type Anchor,
  type CompassFace,
  type CompassPort,
  type Direction,
  anchorForFace,
  distributeCompassPorts,
  getAnchorPoint,
  getDirectionVector,
  renderOrthogonalEdge,
  resolveAutoAnchors,
} from "@talweg/router";
import type { ArrowEndpoint } from "../types.js";

import { shapeAnchor } from "./shapeAnchors.js";

const FACE_BY_DIRECTION: Record<Direction, CompassFace> = {
  NORTH: "n",
  SOUTH: "s",
  EAST: "e",
  WEST: "w",
};

export interface ConnectorGeometry {
  readonly isBezier: boolean;
  readonly lineSvgPath: string;
  readonly startMarkerSvg: string | undefined;
  readonly endMarkerSvg: string | undefined;
  readonly sourcePoint: Point2D;
  readonly targetPoint: Point2D;
  readonly midpoint: Point2D;
  readonly labelAnchor?: Point2D;
}

export type PortSlotMap = ReadonlyMap<string, Anchor>;

interface ResolvedArrow {
  readonly sourceNode: CanvasNode;
  readonly targetNode: CanvasNode;
  readonly sourceBox: BoundingBox;
  readonly targetBox: BoundingBox;
  readonly sourceAnchor: Anchor;
  readonly targetAnchor: Anchor;
}

export function nodeToBoundingBox(node: CanvasNode): BoundingBox {
  return {
    minX: node.x,
    minY: node.y,
    maxX: node.x + node.width,
    maxY: node.y + node.height,
    width: node.width,
    height: node.height,
  };
}

function portKey(arrowId: NodeId, endpoint: ArrowEndpoint): string {
  return `${arrowId}:${endpoint}`;
}

function centerOf(node: CanvasNode): Point2D {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function orderOnFace(face: CompassFace, otherNode: CanvasNode): number {
  const center = centerOf(otherNode);
  return face === "e" || face === "w" ? center.y : center.x;
}

function resolveArrow(
  arrow: ArrowNode,
  document: CanvasDocument,
): ResolvedArrow | null {
  const sourceNode = document.nodes[arrow.data.sourceId];
  const targetNode = document.nodes[arrow.data.targetId];

  if (!sourceNode || !targetNode) return null;

  const sourceBox = nodeToBoundingBox(sourceNode);
  const targetBox = nodeToBoundingBox(targetNode);
  const sourceAnchor = arrow.data.sourceAnchor
    ? anchorForFace(arrow.data.sourceAnchor)
    : undefined;
  const targetAnchor = arrow.data.targetAnchor
    ? anchorForFace(arrow.data.targetAnchor)
    : undefined;
  const automatic = resolveAutoAnchors(sourceBox, targetBox);
  return {
    sourceNode,
    targetNode,
    sourceBox,
    targetBox,
    sourceAnchor: sourceAnchor ?? automatic.sourceAnchor,
    targetAnchor: targetAnchor ?? automatic.targetAnchor,
  };
}

export function stabilizeConnections(document: CanvasDocument): CanvasDocument {
  let nodes = document.nodes;
  for (const node of Object.values(document.nodes)) {
    if (
      node.type !== "arrow" ||
      (node.data.sourceAnchor && node.data.targetAnchor)
    )
      continue;
    const resolved = resolveArrow(node, document);
    if (!resolved) continue;
    if (nodes === document.nodes) nodes = { ...nodes };
    nodes[node.id] = {
      ...node,
      data: {
        ...node.data,
        sourceAnchor: FACE_BY_DIRECTION[resolved.sourceAnchor.direction],
        targetAnchor: FACE_BY_DIRECTION[resolved.targetAnchor.direction],
      },
    };
  }
  return nodes === document.nodes ? document : { ...document, nodes };
}

export function buildPortSlotMap(document: CanvasDocument): PortSlotMap {
  const portsByNode = new Map<string, CompassPort[]>();

  for (const node of Object.values(document.nodes)) {
    if (node.type !== "arrow") continue;

    const resolved = resolveArrow(node, document);
    if (!resolved) continue;

    const sourceFace = FACE_BY_DIRECTION[resolved.sourceAnchor.direction];
    const targetFace = FACE_BY_DIRECTION[resolved.targetAnchor.direction];
    const sourcePorts = portsByNode.get(resolved.sourceNode.id) ?? [];
    const targetPorts = portsByNode.get(resolved.targetNode.id) ?? [];

    sourcePorts.push({
      id: portKey(node.id, "source"),
      face: sourceFace,
      order: orderOnFace(sourceFace, resolved.targetNode),
    });
    targetPorts.push({
      id: portKey(node.id, "target"),
      face: targetFace,
      order: orderOnFace(targetFace, resolved.sourceNode),
    });

    portsByNode.set(resolved.sourceNode.id, sourcePorts);
    portsByNode.set(resolved.targetNode.id, targetPorts);
  }

  const slots = new Map<string, Anchor>();

  for (const ports of portsByNode.values()) {
    for (const [id, anchor] of distributeCompassPorts(ports)) {
      slots.set(id, anchor);
    }
  }

  return slots;
}

function bezierPath(
  sourcePoint: Point2D,
  targetPoint: Point2D,
  sourceAnchor: Anchor,
  targetAnchor: Anchor,
): string {
  const reach = Math.max(30, Math.abs(targetPoint.x - sourcePoint.x) * 0.5);
  const sourceDirection = getDirectionVector(sourceAnchor.direction);
  const targetDirection = getDirectionVector(targetAnchor.direction);
  const controlStart: Point2D = {
    x: sourcePoint.x + sourceDirection.x * reach,
    y: sourcePoint.y + sourceDirection.y * reach,
  };
  const controlEnd: Point2D = {
    x: targetPoint.x + targetDirection.x * reach,
    y: targetPoint.y + targetDirection.y * reach,
  };

  return [
    `M ${String(sourcePoint.x)} ${String(sourcePoint.y)}`,
    `C ${String(controlStart.x)} ${String(controlStart.y)},`,
    `${String(controlEnd.x)} ${String(controlEnd.y)},`,
    `${String(targetPoint.x)} ${String(targetPoint.y)}`,
  ].join(" ");
}

function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
  );
}

export function connectorLabelPoint(
  points: readonly Point2D[],
  boxes: readonly BoundingBox[],
  labelWidth: number,
): Point2D {
  const segments = points.slice(1).map((point, index) => {
    const start = points[index] ?? point;
    return {
      start,
      end: point,
      length: Math.hypot(point.x - start.x, point.y - start.y),
    };
  });
  const length = segments.reduce((total, segment) => total + segment.length, 0);
  const candidates: { point: Point2D; distance: number }[] = [];
  let traveled = 0;
  for (const segment of segments) {
    for (const fraction of [0.5, 0.25, 0.75]) {
      const along = traveled + segment.length * fraction;
      candidates.push({
        point: {
          x: segment.start.x + (segment.end.x - segment.start.x) * fraction,
          y: segment.start.y + (segment.end.y - segment.start.y) * fraction,
        },
        distance: Math.abs(along - length / 2),
      });
    }
    if (
      traveled <= length / 2 &&
      traveled + segment.length >= length / 2 &&
      segment.length > 0
    ) {
      const fraction = (length / 2 - traveled) / segment.length;
      candidates.push({
        point: {
          x: segment.start.x + (segment.end.x - segment.start.x) * fraction,
          y: segment.start.y + (segment.end.y - segment.start.y) * fraction,
        },
        distance: 0,
      });
    }
    traveled += segment.length;
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const isClear = (point: Point2D) =>
    !boxes.some(
      (box) =>
        point.x + labelWidth / 2 + 8 > box.minX &&
        point.x - labelWidth / 2 - 8 < box.maxX &&
        point.y + 14 > box.minY &&
        point.y - 14 < box.maxY,
    );
  const clear = candidates.find(({ point }) => isClear(point));
  if (clear) return clear.point;
  const middle = candidates[0]?.point ?? points[0] ?? { x: 0, y: 0 };
  for (const offset of [-24, 24, -40, 40, -60, 60, -80, 80]) {
    const point = { x: middle.x, y: middle.y + offset };
    if (isClear(point)) return point;
  }
  return middle;
}

export function computeConnectorGeometry(
  arrow: ArrowNode,
  document: CanvasDocument,
  portSlots: PortSlotMap,
): ConnectorGeometry | null {
  const resolved = resolveArrow(arrow, document);
  if (!resolved) return null;

  const sourceAnchor = shapeAnchor(
    resolved.sourceNode,
    portSlots.get(portKey(arrow.id, "source")) ?? resolved.sourceAnchor,
  );
  const targetAnchor = shapeAnchor(
    resolved.targetNode,
    portSlots.get(portKey(arrow.id, "target")) ?? resolved.targetAnchor,
  );
  const sourcePoint = getAnchorPoint(resolved.sourceBox, sourceAnchor);
  const targetPoint = getAnchorPoint(resolved.targetBox, targetAnchor);
  const midpoint: Point2D = {
    x: (sourcePoint.x + targetPoint.x) / 2,
    y: (sourcePoint.y + targetPoint.y) / 2,
  };

  // stacked or overlapping endpoints push the obstacle router into degenerate
  // zigzags, so those pairs fall back to the smooth curve
  const hasDegenerateRoute =
    boxesIntersect(resolved.sourceBox, resolved.targetBox) ||
    resolved.sourceBox.width === 0 ||
    resolved.sourceBox.height === 0 ||
    resolved.targetBox.width === 0 ||
    resolved.targetBox.height === 0;

  if (arrow.data.curveStyle === "bezier" || hasDegenerateRoute) {
    return {
      isBezier: true,
      lineSvgPath: bezierPath(
        sourcePoint,
        targetPoint,
        sourceAnchor,
        targetAnchor,
      ),
      startMarkerSvg: undefined,
      endMarkerSvg: undefined,
      sourcePoint,
      targetPoint,
      midpoint,
    };
  }

  const obstacles: BoundingBox[] = [];

  for (const node of Object.values(document.nodes)) {
    if (
      node.type === "arrow" ||
      node.type === "group" ||
      node.type === "freehand"
    )
      continue;
    if (
      node.id === resolved.sourceNode.id ||
      node.id === resolved.targetNode.id
    )
      continue;
    obstacles.push(nodeToBoundingBox(node));
  }

  const edge = renderOrthogonalEdge(
    resolved.sourceBox,
    resolved.targetBox,
    sourceAnchor,
    targetAnchor,
    obstacles,
    {
      cornerRadius: 10,
      endArrow: arrow.data.endArrow ?? "arrow",
      startArrow: arrow.data.startArrow ?? "none",
      strokeWidth: arrow.style.strokeWidth ?? 1.5,
    },
  );
  const waypoints = edge.waypoints;
  const routeMidpoint = connectorLabelPoint(
    waypoints,
    Object.values(document.nodes)
      .filter(
        (node) =>
          node.type !== "arrow" &&
          node.type !== "group" &&
          node.type !== "freehand",
      )
      .map(nodeToBoundingBox),
    (arrow.data.label?.length ?? 0) * 7 + 12,
  );

  return {
    isBezier: false,
    lineSvgPath: edge.lineSvgPath,
    startMarkerSvg: edge.startMarkerSvg,
    endMarkerSvg: edge.endMarkerSvg,
    sourcePoint,
    targetPoint,
    midpoint: routeMidpoint,
    labelAnchor: connectorLabelPoint(waypoints, [], 0),
  };
}
