import type { BoundingBox, Point2D } from "@talweg/core";
import type { Anchor } from "./anchors.js";
import { getAnchorPoint, getDirectionVector, resolveAutoAnchors } from "./anchors.js";
import type { ArrowHeadType } from "./markers.js";
import { computeArrowHead } from "./markers.js";
import { buildRoundedSvgPath, simplifyPath } from "./path.js";

const DEFAULT_BUFFER = 24;
const DEFAULT_BEND_PENALTY = 50;
const DEFAULT_CORNER_RADIUS = 10;
const OBSTACLE_SEARCH_MARGIN = 64;
const DEFAULT_MARKER_SIZE = 10;
const DEFAULT_STROKE_WIDTH = 2;
const GEOMETRY_EPSILON = 1e-6;
const TRACK_SCALE = 1_000;

export interface RouteOptions {
  readonly buffer?: number;
  readonly bendPenalty?: number;
  readonly cornerRadius?: number;
  readonly startArrow?: ArrowHeadType;
  readonly endArrow?: ArrowHeadType;
  readonly markerSize?: number;
  readonly strokeWidth?: number;
}

export interface RenderedOrthogonalEdge {
  readonly lineSvgPath: string;
  startMarkerSvg?: string;
  endMarkerSvg?: string;
  readonly waypoints: Point2D[];
}

interface SearchState {
  readonly nodeIndex: number;
  readonly directionX: number;
  readonly directionY: number;
}

interface SearchRecord {
  readonly state: SearchState;
  readonly cost: number;
  readonly parentKey: string | null;
}

export function aabbIntersects(first: BoundingBox, second: BoundingBox): boolean {
  return (
    first.minX <= second.maxX &&
    first.maxX >= second.minX &&
    first.minY <= second.maxY &&
    first.maxY >= second.minY
  );
}

function inflateBox(box: BoundingBox, margin: number): BoundingBox {
  return {
    minX: box.minX - margin,
    minY: box.minY - margin,
    maxX: box.maxX + margin,
    maxY: box.maxY + margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  };
}

function trackKey(point: Point2D): string {
  return `${String(Math.round(point.x * TRACK_SCALE))}:${String(Math.round(point.y * TRACK_SCALE))}`;
}

function isStrictlyInsideBox(point: Point2D, box: BoundingBox): boolean {
  const insetX = Math.min(point.x - box.minX, box.maxX - point.x);
  const insetY = Math.min(point.y - box.minY, box.maxY - point.y);

  return Math.min(insetX, insetY) > GEOMETRY_EPSILON;
}

function segmentCrossesBoxInterior(start: Point2D, end: Point2D, box: BoundingBox): boolean {
  if (start.y === end.y) {
    const sideInset = Math.min(start.y - box.minY, box.maxY - start.y);
    const overlap =
      Math.min(Math.max(start.x, end.x), box.maxX) -
      Math.max(Math.min(start.x, end.x), box.minX);

    return Math.min(sideInset, overlap) > GEOMETRY_EPSILON;
  }

  const sideInset = Math.min(start.x - box.minX, box.maxX - start.x);
  const overlap =
    Math.min(Math.max(start.y, end.y), box.maxY) -
    Math.max(Math.min(start.y, end.y), box.minY);

  return Math.min(sideInset, overlap) > GEOMETRY_EPSILON;
}

function isSegmentBlocked(
  start: Point2D,
  end: Point2D,
  obstacles: readonly BoundingBox[],
): boolean {
  for (const obstacle of obstacles) {
    if (segmentCrossesBoxInterior(start, end, obstacle)) {
      return true;
    }
  }

  return false;
}

function manhattanDistance(first: Point2D, second: Point2D): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function stateKey(nodeIndex: number, directionX: number, directionY: number): string {
  return `${String(nodeIndex)}:${String(directionX)},${String(directionY)}`;
}

function at(points: readonly Point2D[], index: number): Point2D {
  return points[index]!;
}

function coordinateAt(values: readonly number[], index: number): number {
  return values[index]!;
}

export function routeOrthogonal(
  source: BoundingBox,
  target: BoundingBox,
  sourceAnchor: Anchor,
  targetAnchor: Anchor,
  obstacles: readonly BoundingBox[] = [],
  options: RouteOptions = {},
): Point2D[] {
  const buffer = options.buffer ?? DEFAULT_BUFFER;
  const bendPenalty = options.bendPenalty ?? DEFAULT_BEND_PENALTY;

  const start = getAnchorPoint(source, sourceAnchor);
  const end = getAnchorPoint(target, targetAnchor);
  const startDirection = getDirectionVector(sourceAnchor.direction);
  const endDirection = getDirectionVector(targetAnchor.direction);

  const startStub: Point2D = {
    x: start.x + startDirection.x * buffer,
    y: start.y + startDirection.y * buffer,
  };
  const endStub: Point2D = {
    x: end.x + endDirection.x * buffer,
    y: end.y + endDirection.y * buffer,
  };

  const searchMinX = Math.min(source.minX, target.minX) - OBSTACLE_SEARCH_MARGIN;
  const searchMinY = Math.min(source.minY, target.minY) - OBSTACLE_SEARCH_MARGIN;
  const searchMaxX = Math.max(source.maxX, target.maxX) + OBSTACLE_SEARCH_MARGIN;
  const searchMaxY = Math.max(source.maxY, target.maxY) + OBSTACLE_SEARCH_MARGIN;
  const searchBox: BoundingBox = {
    minX: searchMinX,
    minY: searchMinY,
    maxX: searchMaxX,
    maxY: searchMaxY,
    width: searchMaxX - searchMinX,
    height: searchMaxY - searchMinY,
  };

  const nearbyObstacles = obstacles.filter((box) => aabbIntersects(box, searchBox));
  const inflatedObstacles = [source, target, ...nearbyObstacles].map((box) =>
    inflateBox(box, buffer),
  );

  const xTracks = new Set<number>([start.x, end.x, startStub.x, endStub.x]);
  const yTracks = new Set<number>([start.y, end.y, startStub.y, endStub.y]);

  for (const box of inflatedObstacles) {
    xTracks.add(box.minX);
    xTracks.add(box.maxX);
    yTracks.add(box.minY);
    yTracks.add(box.maxY);
  }

  const xCoordinates = [...xTracks].sort((first, second) => first - second);
  const yCoordinates = [...yTracks].sort((first, second) => first - second);

  const nodes: Point2D[] = [];
  const adjacency: number[][] = [];
  const nodeIndices = new Map<string, number>();

  function getOrAddNode(point: Point2D): number {
    const key = trackKey(point);
    const existing = nodeIndices.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const index = nodes.length;
    nodes.push(point);
    adjacency.push([]);
    nodeIndices.set(key, index);

    return index;
  }

  function findNode(x: number, y: number): number | undefined {
    return nodeIndices.get(trackKey({ x, y }));
  }

  function addDirectedEdge(from: number, to: number): void {
    adjacency[from]!.push(to);
  }

  function connect(first: number, second: number): void {
    if (isSegmentBlocked(at(nodes, first), at(nodes, second), inflatedObstacles)) {
      return;
    }

    addDirectedEdge(first, second);
    addDirectedEdge(second, first);
  }

  for (const x of xCoordinates) {
    for (const y of yCoordinates) {
      const point: Point2D = { x, y };
      const insideObstacle = inflatedObstacles.some((box) => isStrictlyInsideBox(point, box));

      if (!insideObstacle) {
        getOrAddNode(point);
      }
    }
  }

  const startIndex = getOrAddNode(start);
  const startStubIndex = getOrAddNode(startStub);
  const endStubIndex = getOrAddNode(endStub);
  const endIndex = getOrAddNode(end);

  for (let xIndex = 0; xIndex < xCoordinates.length; xIndex += 1) {
    for (let yIndex = 0; yIndex < yCoordinates.length; yIndex += 1) {
      const currentIndex = findNode(coordinateAt(xCoordinates, xIndex), coordinateAt(yCoordinates, yIndex));

      if (currentIndex === undefined) {
        continue;
      }

      if (xIndex + 1 < xCoordinates.length) {
        const rightIndex = findNode(
          coordinateAt(xCoordinates, xIndex + 1),
          coordinateAt(yCoordinates, yIndex),
        );

        if (rightIndex !== undefined) {
          connect(currentIndex, rightIndex);
        }
      }

      if (yIndex + 1 < yCoordinates.length) {
        const lowerIndex = findNode(
          coordinateAt(xCoordinates, xIndex),
          coordinateAt(yCoordinates, yIndex + 1),
        );

        if (lowerIndex !== undefined) {
          connect(currentIndex, lowerIndex);
        }
      }
    }
  }

  addDirectedEdge(startIndex, startStubIndex);
  addDirectedEdge(endStubIndex, endIndex);

  const startState: SearchState = { nodeIndex: startIndex, directionX: 0, directionY: 0 };
  const initialKey = stateKey(startState.nodeIndex, 0, 0);
  const records = new Map<string, SearchRecord>();
  const open = new Map<string, number>();

  records.set(initialKey, { state: startState, cost: 0, parentKey: null });
  open.set(initialKey, manhattanDistance(at(nodes, startIndex), end));

  let goalKey: string | null = null;

  while (open.size > 0) {
    let bestKey: string | undefined;
    let bestScore = Infinity;

    for (const [key, score] of open) {
      if (score < bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    const currentKey = bestKey!;
    open.delete(currentKey);

    const record = records.get(currentKey)!;
    const { state } = record;

    if (state.nodeIndex === endIndex) {
      goalKey = currentKey;
      break;
    }

    const currentPoint = at(nodes, state.nodeIndex);
    const hasDirection = state.directionX !== 0 || state.directionY !== 0;

    for (const neighborIndex of adjacency[state.nodeIndex]!) {
      const neighborPoint = at(nodes, neighborIndex);
      const stepX = neighborPoint.x - currentPoint.x;
      const stepY = neighborPoint.y - currentPoint.y;
      const distance = Math.abs(stepX) + Math.abs(stepY);

      if (distance === 0) {
        continue;
      }

      const directionX = Math.sign(stepX);
      const directionY = Math.sign(stepY);
      const reverses =
        hasDirection &&
        state.directionX === -directionX &&
        state.directionY === -directionY;

      if (reverses) {
        continue;
      }

      const turns =
        hasDirection &&
        (state.directionX !== directionX || state.directionY !== directionY);
      const cost = record.cost + distance + (turns ? bendPenalty : 0);
      const neighborKey = stateKey(neighborIndex, directionX, directionY);
      const existing = records.get(neighborKey);

      if (existing === undefined || cost < existing.cost) {
        records.set(neighborKey, {
          state: { nodeIndex: neighborIndex, directionX, directionY },
          cost,
          parentKey: currentKey,
        });
        open.set(neighborKey, cost + manhattanDistance(neighborPoint, end));
      }
    }
  }

  if (goalKey === null) {
    const fallback = [
      start,
      startStub,
      { x: endStub.x, y: startStub.y },
      endStub,
      end,
    ];

    return simplifyPath(fallback);
  }

  const path: Point2D[] = [];
  let cursor: string | null = goalKey;

  while (cursor !== null) {
    const record: SearchRecord = records.get(cursor)!;
    path.push(at(nodes, record.state.nodeIndex));
    cursor = record.parentKey;
  }

  path.reverse();
  return simplifyPath(path);
}

export function renderOrthogonalEdge(
  source: BoundingBox,
  target: BoundingBox,
  sourceAnchor?: Anchor,
  targetAnchor?: Anchor,
  obstacles: readonly BoundingBox[] = [],
  options: RouteOptions = {},
): RenderedOrthogonalEdge {
  const anchors =
    sourceAnchor !== undefined && targetAnchor !== undefined
      ? { sourceAnchor, targetAnchor }
      : resolveAutoAnchors(source, target);

  const waypoints = [
    ...routeOrthogonal(
      source,
      target,
      anchors.sourceAnchor,
      anchors.targetAnchor,
      obstacles,
      options,
    ),
  ];

  const markerSize = options.markerSize ?? DEFAULT_MARKER_SIZE;
  const strokeWidth = options.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  let startMarkerSvg: string | undefined;
  let endMarkerSvg: string | undefined;

  if (waypoints.length >= 2) {
    const endArrow = options.endArrow;

    if (endArrow !== undefined && endArrow !== "none") {
      const endTip = at(waypoints, waypoints.length - 1);
      const endPrevious = at(waypoints, waypoints.length - 2);
      const endMarker = computeArrowHead(endArrow, endTip, endPrevious, markerSize, strokeWidth);

      endMarkerSvg = endMarker.markerPath;
      waypoints[waypoints.length - 1] = endMarker.retractedPoint;
    }

    const startArrow = options.startArrow;

    if (startArrow !== undefined && startArrow !== "none") {
      const startTip = at(waypoints, 0);
      const startNext = at(waypoints, 1);
      const startMarker = computeArrowHead(startArrow, startTip, startNext, markerSize, strokeWidth);

      startMarkerSvg = startMarker.markerPath;
      waypoints[0] = startMarker.retractedPoint;
    }
  }

  const lineSvgPath = buildRoundedSvgPath(waypoints, options.cornerRadius ?? DEFAULT_CORNER_RADIUS);
  const rendered: RenderedOrthogonalEdge = { lineSvgPath, waypoints };

  if (startMarkerSvg !== undefined) {
    rendered.startMarkerSvg = startMarkerSvg;
  }

  if (endMarkerSvg !== undefined) {
    rendered.endMarkerSvg = endMarkerSvg;
  }

  return rendered;
}
