import { describe, expect, it } from "vitest";
import {
  aabbIntersects,
  anchorForFace,
  buildRoundedSvgPath,
  computeArrowHead,
  distributeCompassPorts,
  getAnchorPoint,
  getDirectionVector,
  renderOrthogonalEdge,
  resolveAutoAnchors,
  routeOrthogonal,
  simplifyPath,
} from "../src/index.js";
import type {
  Anchor,
  BoundingBox,
  CompassFace,
  CompassPort,
  Direction,
  Point2D,
} from "../src/index.js";

function box(x: number, y: number, width: number, height: number): BoundingBox {
  return { minX: x, minY: y, maxX: x + width, maxY: y + height, width, height };
}

const EAST: Anchor = { point: { x: 1, y: 0.5 }, direction: "EAST" };
const WEST: Anchor = { point: { x: 0, y: 0.5 }, direction: "WEST" };
const SOUTH: Anchor = { point: { x: 0.5, y: 1 }, direction: "SOUTH" };
const NORTH: Anchor = { point: { x: 0.5, y: 0 }, direction: "NORTH" };

function expectOrthogonal(points: readonly Point2D[]): void {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;

    expect(current.x === previous.x || current.y === previous.y).toBe(true);
  }
}

function segmentCrossesBox(start: Point2D, end: Point2D, rect: BoundingBox): boolean {
  const overlapX =
    Math.min(Math.max(start.x, end.x), rect.maxX) - Math.max(Math.min(start.x, end.x), rect.minX);
  const overlapY =
    Math.min(Math.max(start.y, end.y), rect.maxY) - Math.max(Math.min(start.y, end.y), rect.minY);

  if (start.x === end.x) {
    return start.x > rect.minX && start.x < rect.maxX && overlapY > 0;
  }

  return start.y > rect.minY && start.y < rect.maxY && overlapX > 0;
}

function expectNoObstacleCrossing(points: readonly Point2D[], obstacle: BoundingBox): void {
  for (let index = 1; index < points.length; index += 1) {
    expect(segmentCrossesBox(points[index - 1]!, points[index]!, obstacle)).toBe(false);
  }
}

function parsePathNumbers(path: string): number[] {
  return path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
}

function expectPathPoint(numbers: readonly number[], pointIndex: number, x: number, y: number): void {
  expect(numbers[pointIndex * 2]).toBeCloseTo(x, 4);
  expect(numbers[pointIndex * 2 + 1]).toBeCloseTo(y, 4);
}

describe("anchors", () => {
  it("computes absolute anchor points from normalized coordinates", () => {
    const rect = box(10, 20, 100, 50);

    expect(getAnchorPoint(rect, { point: { x: 0.5, y: 0.5 }, direction: "NORTH" })).toEqual({
      x: 60,
      y: 45,
    });
  });

  it("applies pixel offsets to anchor points", () => {
    const rect = box(10, 20, 100, 50);

    expect(
      getAnchorPoint(rect, {
        point: { x: 1, y: 0 },
        direction: "EAST",
        offset: { x: 5, y: -5 },
      }),
    ).toEqual({ x: 115, y: 15 });
  });

  it("maps every direction to an axis-aligned unit vector", () => {
    const expected: Record<Direction, Point2D> = {
      NORTH: { x: 0, y: -1 },
      SOUTH: { x: 0, y: 1 },
      EAST: { x: 1, y: 0 },
      WEST: { x: -1, y: 0 },
    };

    for (const [direction, vector] of Object.entries(expected)) {
      expect(getDirectionVector(direction as Direction)).toEqual(vector);
    }
  });

  it("selects horizontal anchors for a target on the right", () => {
    const source = box(0, 0, 100, 50);
    const target = box(150, 0, 100, 50);

    expect(resolveAutoAnchors(source, target)).toEqual({
      sourceAnchor: EAST,
      targetAnchor: WEST,
    });
  });

  it("selects horizontal anchors for a target on the left", () => {
    const source = box(0, 0, 100, 50);
    const target = box(-150, 0, 100, 50);

    expect(resolveAutoAnchors(source, target)).toEqual({
      sourceAnchor: WEST,
      targetAnchor: EAST,
    });
  });

  it("prefers horizontal anchors when the displacement axes tie", () => {
    const source = box(0, 0, 100, 50);
    const target = box(150, 150, 100, 50);

    expect(resolveAutoAnchors(source, target)).toEqual({
      sourceAnchor: EAST,
      targetAnchor: WEST,
    });
  });

  it("selects vertical anchors for a target below", () => {
    const source = box(0, 0, 100, 50);
    const target = box(25, 150, 100, 50);

    expect(resolveAutoAnchors(source, target)).toEqual({
      sourceAnchor: SOUTH,
      targetAnchor: NORTH,
    });
  });

  it("selects vertical anchors for a target above", () => {
    const source = box(0, 0, 100, 50);
    const target = box(25, -150, 100, 50);

    expect(resolveAutoAnchors(source, target)).toEqual({
      sourceAnchor: NORTH,
      targetAnchor: SOUTH,
    });
  });
});

describe("ports", () => {
  it("places a lone port at the face midpoint by default", () => {
    expect(anchorForFace("n")).toEqual({
      point: { x: 0.5, y: 0 },
      direction: "NORTH",
    });
    expect(anchorForFace("s")).toEqual({
      point: { x: 0.5, y: 1 },
      direction: "SOUTH",
    });
    expect(anchorForFace("e")).toEqual({
      point: { x: 1, y: 0.5 },
      direction: "EAST",
    });
    expect(anchorForFace("w")).toEqual({
      point: { x: 0, y: 0.5 },
      direction: "WEST",
    });
  });

  it("places an explicit slot on every face", () => {
    const faces: readonly CompassFace[] = ["n", "s", "e", "w"];

    for (const face of faces) {
      const anchor = anchorForFace(face, 0.25);

      if (face === "n" || face === "s") {
        expect(anchor.point.x).toBe(0.25);
      } else {
        expect(anchor.point.y).toBe(0.25);
      }
    }
  });

  it("distributes ports sharing one face with the slot formula", () => {
    const node = box(100, 50, 80, 120);
    const ports: readonly CompassPort[] = [
      { id: "bottom", face: "w", order: 30 },
      { id: "top", face: "w", order: 10 },
      { id: "middle", face: "w", order: 20 },
    ];

    const anchors = distributeCompassPorts(ports);

    expect(getAnchorPoint(node, anchors.get("top")!)).toEqual({ x: 100, y: 80 });
    expect(getAnchorPoint(node, anchors.get("middle")!)).toEqual({ x: 100, y: 110 });
    expect(getAnchorPoint(node, anchors.get("bottom")!)).toEqual({ x: 100, y: 140 });
  });

  it("distributes horizontal slots on north and south faces", () => {
    const node = box(0, 0, 120, 60);
    const ports: readonly CompassPort[] = [
      { id: "left", face: "n", order: 0 },
      { id: "right", face: "n", order: 1 },
      { id: "south", face: "s", order: 0 },
    ];

    const anchors = distributeCompassPorts(ports);

    expect(getAnchorPoint(node, anchors.get("left")!)).toEqual({ x: 40, y: 0 });
    expect(getAnchorPoint(node, anchors.get("right")!)).toEqual({ x: 80, y: 0 });
    expect(getAnchorPoint(node, anchors.get("south")!)).toEqual({ x: 60, y: 60 });
  });

  it("keeps face groups independent and resolves order ties by id", () => {
    const ports: readonly CompassPort[] = [
      { id: "b-east", face: "e", order: 0 },
      { id: "a-east", face: "e", order: 0 },
      { id: "only-north", face: "n", order: 0 },
    ];

    const anchors = distributeCompassPorts(ports);

    expect(anchors.get("a-east")).toEqual(anchorForFace("e", 1 / 3));
    expect(anchors.get("b-east")).toEqual(anchorForFace("e", 2 / 3));
    expect(anchors.get("only-north")).toEqual(anchorForFace("n", 0.5));
  });

  it("returns no anchors for an empty port list", () => {
    expect(distributeCompassPorts([]).size).toBe(0);
  });
});

describe("simplifyPath", () => {
  it("returns short paths unchanged", () => {
    expect(simplifyPath([])).toEqual([]);
    expect(simplifyPath([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
    expect(simplifyPath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it("removes consecutive duplicate points", () => {
    expect(
      simplifyPath([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("collapses collinear horizontal points", () => {
    expect(
      simplifyPath([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("collapses collinear vertical points", () => {
    expect(
      simplifyPath([
        { x: 0, y: 0 },
        { x: 0, y: 5 },
        { x: 0, y: 10 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ]);
  });

  it("preserves real corners", () => {
    expect(
      simplifyPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it("collapses runs of duplicates and collinear points together", () => {
    expect(
      simplifyPath([
        { x: 0, y: 0 },
        { x: 0, y: 5 },
        { x: 0, y: 5 },
        { x: 0, y: 10 },
        { x: 5, y: 10 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 5, y: 10 },
    ]);
  });
});

describe("buildRoundedSvgPath", () => {
  it("returns an empty string for fewer than two points", () => {
    expect(buildRoundedSvgPath([])).toBe("");
    expect(buildRoundedSvgPath([{ x: 1, y: 2 }])).toBe("");
  });

  it("builds a straight path for two points", () => {
    expect(
      buildRoundedSvgPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
    ).toBe("M 0 0 L 100 0");
  });

  it("skips rounding when the radius is zero or negative", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];

    expect(buildRoundedSvgPath(points, 0)).toBe("M 0 0 L 100 0 L 100 100");
    expect(buildRoundedSvgPath(points, -4)).toBe("M 0 0 L 100 0 L 100 100");
  });

  it("rounds a right angle with the default radius", () => {
    expect(
      buildRoundedSvgPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]),
    ).toBe("M 0 0 L 92 0 Q 100 0 100 8 L 100 100");
  });

  it("honors a custom radius", () => {
    expect(
      buildRoundedSvgPath(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
        10,
      ),
    ).toBe("M 0 0 L 90 0 Q 100 0 100 10 L 100 100");
  });

  it("clamps the radius to half of the shortest adjacent segment", () => {
    expect(
      buildRoundedSvgPath(
        [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 100 },
        ],
        10,
      ),
    ).toBe("M 0 0 L 3 0 Q 6 0 6 3 L 6 100");
  });

  it("rounds multiple corners", () => {
    const path = buildRoundedSvgPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      10,
    );

    expect(path.match(/Q/g)).toHaveLength(2);
    expect(path.startsWith("M 0 0")).toBe(true);
    expect(path.endsWith("L 0 100")).toBe(true);
  });

  it("falls back to a straight segment for a zero-length incoming arm", () => {
    const path = buildRoundedSvgPath([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ]);

    expect(path).toBe("M 0 0 L 0 0 L 0 10");
    expect(path).not.toContain("NaN");
  });

  it("falls back to a straight segment for a zero-length outgoing arm", () => {
    const path = buildRoundedSvgPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
    ]);

    expect(path).toBe("M 0 0 L 10 0 L 10 0");
    expect(path).not.toContain("NaN");
  });
});

describe("computeArrowHead", () => {
  const tip = { x: 200, y: 100 };
  const previous = { x: 100, y: 100 };

  it("leaves the line endpoint untouched for no marker", () => {
    const result = computeArrowHead("none", tip, previous);

    expect(result.markerPath).toBe("");
    expect(result.retractedPoint).toBe(tip);
  });

  it("handles a degenerate segment", () => {
    const result = computeArrowHead("triangle", tip, tip);

    expect(result.markerPath).toBe("");
    expect(result.retractedPoint).toBe(tip);
  });

  it("builds an open chevron and retracts the line", () => {
    const result = computeArrowHead("arrow", tip, previous, 10, 2);
    const numbers = parsePathNumbers(result.markerPath);

    expect(result.markerPath.endsWith("Z")).toBe(false);
    expectPathPoint(numbers, 0, 185.764, 106);
    expectPathPoint(numbers, 1, 197.764, 100);
    expectPathPoint(numbers, 2, 185.764, 94);
    expect(result.retractedPoint.x).toBeCloseTo(195.528, 3);
    expect(result.retractedPoint.y).toBeCloseTo(100, 3);
  });

  it("builds a filled triangle and retracts to its base", () => {
    const result = computeArrowHead("triangle", tip, previous, 10, 2);
    const numbers = parsePathNumbers(result.markerPath);

    expect(result.markerPath.endsWith("Z")).toBe(true);
    expectPathPoint(numbers, 0, 197.764, 100);
    expectPathPoint(numbers, 1, 185.764, 106);
    expectPathPoint(numbers, 2, 185.764, 94);
    expect(result.retractedPoint.x).toBeCloseTo(185.764, 3);
    expect(result.retractedPoint.y).toBeCloseTo(100, 3);
  });

  it("builds a diamond and retracts to its tail", () => {
    const result = computeArrowHead("diamond", tip, previous, 10, 2);
    const numbers = parsePathNumbers(result.markerPath);

    expect(result.markerPath.endsWith("Z")).toBe(true);
    expectPathPoint(numbers, 0, 198.5858, 100);
    expectPathPoint(numbers, 1, 192.5858, 106);
    expectPathPoint(numbers, 2, 186.5858, 100);
    expectPathPoint(numbers, 3, 192.5858, 94);
    expect(result.retractedPoint.x).toBeCloseTo(186.5858, 3);
    expect(result.retractedPoint.y).toBeCloseTo(100, 3);
  });

  it("honors custom marker size and stroke width", () => {
    const result = computeArrowHead("triangle", tip, previous, 4, 1);

    expect(result.retractedPoint.x).toBeCloseTo(200 - (5 + 1.118), 3);
  });

  it("rotates the marker for a vertical approach", () => {
    const result = computeArrowHead("diamond", { x: 100, y: 200 }, { x: 100, y: 100 }, 10, 2);
    const numbers = parsePathNumbers(result.markerPath);

    expectPathPoint(numbers, 0, 100, 198.5858);
    expectPathPoint(numbers, 1, 94, 192.5858);
    expectPathPoint(numbers, 2, 100, 186.5858);
    expectPathPoint(numbers, 3, 106, 192.5858);  });
});

describe("aabbIntersects", () => {
  const base = box(0, 0, 100, 100);

  it("accepts overlapping and touching boxes", () => {
    expect(aabbIntersects(base, box(50, 50, 100, 100))).toBe(true);
    expect(aabbIntersects(base, box(-20, 20, 50, 50))).toBe(true);
    expect(aabbIntersects(base, box(100, 100, 10, 10))).toBe(true);
  });

  it("rejects boxes separated on any axis", () => {
    expect(aabbIntersects(base, box(101, 0, 10, 10))).toBe(false);
    expect(aabbIntersects(base, box(-20, 0, 10, 10))).toBe(false);
    expect(aabbIntersects(base, box(0, 101, 10, 10))).toBe(false);
    expect(aabbIntersects(base, box(0, -20, 10, 10))).toBe(false);
  });
});

describe("routeOrthogonal", () => {
  const source = box(50, 50, 100, 60);
  const target = box(300, 200, 120, 80);

  it("routes horizontally between aligned anchors", () => {
    const points = routeOrthogonal(source, target, EAST, WEST);

    expect(points[0]).toEqual({ x: 150, y: 80 });
    expect(points.at(-1)).toEqual({ x: 300, y: 240 });
    expect(points.length).toBeGreaterThanOrEqual(3);
    expectOrthogonal(points);
  });

  it("routes vertically between aligned anchors", () => {
    const upper = box(100, 50, 80, 40);
    const lower = box(120, 250, 60, 50);
    const points = routeOrthogonal(upper, lower, SOUTH, NORTH);

    expect(points[0]).toEqual({ x: 140, y: 90 });
    expect(points.at(-1)).toEqual({ x: 150, y: 250 });
    expectOrthogonal(points);
  });

  it("bends around an intermediate obstacle", () => {
    const obstacle = box(210, 60, 80, 100);
    const points = routeOrthogonal(source, target, EAST, WEST, [obstacle]);

    expect(points[0]).toEqual({ x: 150, y: 80 });
    expect(points.at(-1)).toEqual({ x: 300, y: 240 });
    expectOrthogonal(points);
    expectNoObstacleCrossing(points, obstacle);
    expect(points.some((point) => point.y <= obstacle.minY || point.y >= obstacle.maxY)).toBe(true);
  });

  it("bends around an obstacle on a vertical route", () => {
    const upper = box(100, 50, 80, 40);
    const lower = box(120, 250, 60, 50);
    const obstacle = box(90, 140, 120, 40);
    const points = routeOrthogonal(upper, lower, SOUTH, NORTH, [obstacle]);

    expect(points[0]).toEqual({ x: 140, y: 90 });
    expect(points.at(-1)).toEqual({ x: 150, y: 250 });
    expectOrthogonal(points);
    expectNoObstacleCrossing(points, obstacle);
    expect(points.some((point) => point.x <= obstacle.minX || point.x >= obstacle.maxX)).toBe(true);
  });

  it("ignores obstacles outside the source-target search box", () => {
    const left = box(0, 0, 60, 40);
    const right = box(300, 0, 60, 40);
    const distant = [
      box(-600, -600, 50, 50),
      box(1_000, -600, 50, 50),
      box(-600, 600, 50, 50),
      box(1_000, 600, 50, 50),
    ];

    const points = routeOrthogonal(left, right, EAST, WEST, distant);

    expect(points).toEqual([
      { x: 60, y: 20 },
      { x: 300, y: 20 },
    ]);
  });

  it("accepts custom buffer and bend penalty options", () => {
    const obstacle = box(190, 60, 80, 100);
    const points = routeOrthogonal(source, target, EAST, WEST, [obstacle], {
      buffer: 5,
      bendPenalty: 0,
    });

    expectOrthogonal(points);
    expectNoObstacleCrossing(points, obstacle);
    expect(points[0]).toEqual({ x: 150, y: 80 });
    expect(points.at(-1)).toEqual({ x: 300, y: 240 });
  });

  it("supports a zero buffer", () => {
    const left = box(0, 0, 60, 40);
    const right = box(200, 0, 60, 40);
    const points = routeOrthogonal(left, right, EAST, WEST, [], { buffer: 0 });

    expect(points).toEqual([
      { x: 60, y: 20 },
      { x: 200, y: 20 },
    ]);
  });

  it("returns an orthogonal fallback when no route exists", () => {
    const start = box(0, 0, 50, 50);
    const end = box(300, 200, 50, 50);
    const enclosingObstacle = box(250, 180, 150, 90);
    const points = routeOrthogonal(start, end, EAST, WEST, [enclosingObstacle]);

    expect(points).toEqual([
      { x: 50, y: 25 },
      { x: 276, y: 25 },
      { x: 276, y: 225 },
      { x: 300, y: 225 },
    ]);
    expectOrthogonal(points);
  });
});

describe("renderOrthogonalEdge", () => {
  const source = box(50, 50, 100, 60);
  const target = box(300, 200, 120, 80);

  it("resolves anchors automatically when none are provided", () => {
    const alignedSource = box(50, 50, 100, 100);
    const alignedTarget = box(300, 50, 100, 100);
    const edge = renderOrthogonalEdge(alignedSource, alignedTarget);

    expect(edge.waypoints[0]).toEqual({ x: 150, y: 100 });
    expect(edge.waypoints.at(-1)).toEqual({ x: 300, y: 100 });
    expect(edge.lineSvgPath).toBe("M 150 100 L 300 100");
    expect(edge.startMarkerSvg).toBeUndefined();
    expect(edge.endMarkerSvg).toBeUndefined();
  });

  it("resolves anchors automatically when only one anchor is provided", () => {
    const belowTarget = box(75, 250, 100, 60);
    const edge = renderOrthogonalEdge(source, belowTarget, EAST);

    expect(edge.waypoints[0]).toEqual({ x: 100, y: 110 });
    expect(edge.waypoints.at(-1)).toEqual({ x: 125, y: 250 });
  });

  it("uses explicit anchors and rounds corners", () => {
    const edge = renderOrthogonalEdge(source, target, EAST, WEST);

    expect(edge.waypoints[0]).toEqual({ x: 150, y: 80 });
    expect(edge.waypoints.at(-1)).toEqual({ x: 300, y: 240 });
    expect(edge.lineSvgPath).toContain("Q");
    expect(edge.startMarkerSvg).toBeUndefined();
    expect(edge.endMarkerSvg).toBeUndefined();
  });

  it("renders start and end markers with custom dimensions and a straight line", () => {
    const edge = renderOrthogonalEdge(source, target, EAST, WEST, [], {
      startArrow: "arrow",
      endArrow: "triangle",
      markerSize: 12,
      strokeWidth: 3,
      cornerRadius: 0,
    });

    expect(edge.startMarkerSvg).toBeDefined();
    expect(edge.startMarkerSvg!.endsWith("Z")).toBe(false);
    expect(edge.endMarkerSvg).toBeDefined();
    expect(edge.endMarkerSvg!.endsWith("Z")).toBe(true);
    expect(edge.lineSvgPath).not.toContain("Q");
    expect(edge.waypoints[0]).not.toEqual({ x: 150, y: 80 });
    expect(edge.waypoints.at(-1)).not.toEqual({ x: 300, y: 240 });
    expect(edge.lineSvgPath).toContain(String(edge.waypoints.at(-1)!.x));
  });

  it("omits markers explicitly set to none", () => {
    const edge = renderOrthogonalEdge(source, target, EAST, WEST, [], {
      startArrow: "none",
      endArrow: "none",
    });

    expect(edge.startMarkerSvg).toBeUndefined();
    expect(edge.endMarkerSvg).toBeUndefined();
  });

  it("handles a degenerate path with identical anchors", () => {
    const sameNode = box(0, 0, 50, 50);
    const centerAnchor: Anchor = { point: { x: 0.5, y: 0.5 }, direction: "EAST" };
    const edge = renderOrthogonalEdge(
      sameNode,
      sameNode,
      centerAnchor,
      centerAnchor,
      [],
      { endArrow: "arrow" },
    );

    expect(edge.waypoints).toEqual([{ x: 25, y: 25 }]);
    expect(edge.lineSvgPath).toBe("");
    expect(edge.endMarkerSvg).toBeUndefined();
  });
});

describe("ports inside a curved shape's bounding box", () => {
  it("extends horizontal exit stubs beyond the bounding box before routing", () => {
    const points = routeOrthogonal(box(0, 0, 100, 100), box(300, 0, 100, 100), { ...EAST, point: { x: 1, y: .25 }, offset: { x: -30, y: 0 } }, { ...WEST, point: { x: 0, y: .75 }, offset: { x: 30, y: 0 } });
    expect(points[0]).toEqual({ x: 70, y: 25 });
    expect(points.at(-1)).toEqual({ x: 330, y: 75 });
    expect(points[1]?.x).toBeGreaterThan(100);
    expect(points.at(-2)?.x).toBeLessThan(300);
    expectOrthogonal(points);
  });
  it("extends vertical exit stubs beyond the bounding box before routing", () => {
    const points = routeOrthogonal(box(0, 0, 100, 100), box(0, 300, 100, 100), { ...SOUTH, point: { x: .25, y: 1 }, offset: { x: 0, y: -30 } }, { ...NORTH, point: { x: .75, y: 0 }, offset: { x: 0, y: 30 } });
    expect(points[0]).toEqual({ x: 25, y: 70 });
    expect(points.at(-1)).toEqual({ x: 75, y: 330 });
    expect(points[1]?.y).toBeGreaterThan(100);
    expect(points.at(-2)?.y).toBeLessThan(300);
    expectOrthogonal(points);
  });
});
