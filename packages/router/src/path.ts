import type { Point2D } from "@talweg/core";

const GEOMETRY_EPSILON = 1e-6;
const DEFAULT_CORNER_RADIUS = 8;

function at(points: readonly Point2D[], index: number): Point2D {
  return points[index]!;
}

function formatPoint(x: number, y: number): string {
  return `${String(x)} ${String(y)}`;
}

function pointsMatch(first: Point2D, second: Point2D): boolean {
  return (
    Math.abs(first.x - second.x) < GEOMETRY_EPSILON &&
    Math.abs(first.y - second.y) < GEOMETRY_EPSILON
  );
}

function isCollinear(first: Point2D, middle: Point2D, last: Point2D): boolean {
  return (
    (Math.abs(first.x - middle.x) < GEOMETRY_EPSILON &&
      Math.abs(middle.x - last.x) < GEOMETRY_EPSILON) ||
    (Math.abs(first.y - middle.y) < GEOMETRY_EPSILON &&
      Math.abs(middle.y - last.y) < GEOMETRY_EPSILON)
  );
}

export function simplifyPath(points: readonly Point2D[]): Point2D[] {
  if (points.length <= 2) {
    return [...points];
  }

  const result: Point2D[] = [at(points, 0)];

  for (let index = 1; index < points.length; index += 1) {
    const point = at(points, index);
    const previous = at(result, result.length - 1);

    if (pointsMatch(point, previous)) {
      continue;
    }

    result.push(point);

    while (
      result.length >= 3 &&
      isCollinear(at(result, result.length - 3), at(result, result.length - 2), at(result, result.length - 1))
    ) {
      result.splice(result.length - 2, 1);
    }
  }

  return result;
}

export function buildRoundedSvgPath(points: readonly Point2D[], radius = DEFAULT_CORNER_RADIUS): string {
  if (points.length < 2) {
    return "";
  }

  if (points.length === 2 || radius <= 0) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${formatPoint(point.x, point.y)}`)
      .join(" ");
  }

  const first = at(points, 0);
  let path = `M ${formatPoint(first.x, first.y)}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = at(points, index - 1);
    const current = at(points, index);
    const next = at(points, index + 1);

    const incomingX = previous.x - current.x;
    const incomingY = previous.y - current.y;
    const outgoingX = next.x - current.x;
    const outgoingY = next.y - current.y;
    const incomingLength = Math.hypot(incomingX, incomingY);
    const outgoingLength = Math.hypot(outgoingX, outgoingY);

    if (incomingLength === 0 || outgoingLength === 0) {
      path += ` L ${formatPoint(current.x, current.y)}`;
      continue;
    }

    const effectiveRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
    const startX = current.x + (incomingX / incomingLength) * effectiveRadius;
    const startY = current.y + (incomingY / incomingLength) * effectiveRadius;
    const endX = current.x + (outgoingX / outgoingLength) * effectiveRadius;
    const endY = current.y + (outgoingY / outgoingLength) * effectiveRadius;

    path += ` L ${formatPoint(startX, startY)} Q ${formatPoint(current.x, current.y)} ${formatPoint(endX, endY)}`;
  }

  const last = at(points, points.length - 1);
  return `${path} L ${formatPoint(last.x, last.y)}`;
}
