import type { FreehandNode, NodeId, Point2D } from "@talweg/core";
import type { Theme } from "../themeContext.js";

export function freehandPath(
  points: readonly Point2D[],
  width: number,
  height: number,
): string {
  const first = points[0];
  if (!first) return "";
  const coordinate = (value: number) => String(Math.round(value * 100) / 100);
  const pair = (point: Point2D) =>
    `${coordinate(point.x * width)},${coordinate(point.y * height)}`;
  let path = `M${pair(first)}`;
  for (let index = 1; index < points.length - 1; index++) {
    const current = points[index];
    const next = points[index + 1];
    if (current && next)
      path += ` Q${pair(current)} ${pair({ x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 })}`;
  }
  return `${path} L${pair(points.at(-1) ?? first)}`;
}

export function freehandColor(node: FreehandNode, theme: Theme): string {
  return node.meta?.automaticInk
    ? theme === "light"
      ? "#202223"
      : "#eeeeeb"
    : (node.style.strokeColor ?? "#8caecc");
}

export function createFreehand(
  points: readonly Point2D[],
  id: NodeId,
  color: string | null,
  strokeWidth: number,
  theme: Theme,
): FreehandNode {
  const safe = points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
  );
  if (!safe.length) throw new Error("A stroke needs at least one finite point");
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of safe) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const padding = Math.max(4, strokeWidth / 2 + 2);
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  const now = Date.now();
  return {
    id,
    type: "freehand",
    x: minX - padding,
    y: minY - padding,
    width,
    height,
    rotation: 0,
    zIndex: 20,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    createdAt: now,
    updatedAt: now,
    meta: { automaticInk: color === null },
    style: {
      strokeColor: color ?? (theme === "light" ? "#202223" : "#eeeeeb"),
      strokeWidth,
      strokeDash: "solid",
      fillColor: "transparent",
    },
    data: {
      points: safe.map((point) => ({
        x: (point.x - minX + padding) / width,
        y: (point.y - minY + padding) / height,
      })),
    },
  };
}
