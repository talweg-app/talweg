import type { Point2D } from "@talweg/core";

export type ArrowHeadType = "none" | "arrow" | "triangle" | "diamond";

export interface ArrowHeadResult {
  readonly markerPath: string;
  readonly retractedPoint: Point2D;
}

const MIN_DIRECTION_LENGTH = 1e-4;
const CHEVRON_RATIO = 1.118;
const DIAMOND_RATIO = 0.7071;

function formatPoint(point: Point2D): string {
  return `${String(point.x)} ${String(point.y)}`;
}

export function computeArrowHead(
  type: ArrowHeadType,
  tip: Point2D,
  prev: Point2D,
  size = 10,
  strokeWidth = 2,
): ArrowHeadResult {
  if (type === "none") {
    return { markerPath: "", retractedPoint: tip };
  }

  const deltaX = tip.x - prev.x;
  const deltaY = tip.y - prev.y;
  const length = Math.hypot(deltaX, deltaY);

  if (length < MIN_DIRECTION_LENGTH) {
    return { markerPath: "", retractedPoint: tip };
  }

  const unitX = deltaX / length;
  const unitY = deltaY / length;
  const normalX = -unitY;
  const normalY = unitX;
  const effectiveSize = size + strokeWidth;
  const halfSize = effectiveSize / 2;

  switch (type) {
    case "arrow": {
      const tipOffset = CHEVRON_RATIO * strokeWidth;
      const pathTip = {
        x: tip.x - unitX * tipOffset,
        y: tip.y - unitY * tipOffset,
      };
      const left = {
        x: pathTip.x - unitX * effectiveSize + normalX * halfSize,
        y: pathTip.y - unitY * effectiveSize + normalY * halfSize,
      };
      const right = {
        x: pathTip.x - unitX * effectiveSize - normalX * halfSize,
        y: pathTip.y - unitY * effectiveSize - normalY * halfSize,
      };

      return {
        markerPath: `M ${formatPoint(left)} L ${formatPoint(pathTip)} L ${formatPoint(right)}`,
        retractedPoint: {
          x: tip.x - unitX * tipOffset * 2,
          y: tip.y - unitY * tipOffset * 2,
        },
      };
    }

    case "triangle": {
      const tipOffset = CHEVRON_RATIO * strokeWidth;
      const pathTip = {
        x: tip.x - unitX * tipOffset,
        y: tip.y - unitY * tipOffset,
      };
      const left = {
        x: pathTip.x - unitX * effectiveSize + normalX * halfSize,
        y: pathTip.y - unitY * effectiveSize + normalY * halfSize,
      };
      const right = {
        x: pathTip.x - unitX * effectiveSize - normalX * halfSize,
        y: pathTip.y - unitY * effectiveSize - normalY * halfSize,
      };

      return {
        markerPath: `M ${formatPoint(pathTip)} L ${formatPoint(left)} L ${formatPoint(right)} Z`,
        retractedPoint: {
          x: tip.x - unitX * (effectiveSize + tipOffset),
          y: tip.y - unitY * (effectiveSize + tipOffset),
        },
      };
    }

    case "diamond": {
      const tipOffset = DIAMOND_RATIO * strokeWidth;
      const pathTip = {
        x: tip.x - unitX * tipOffset,
        y: tip.y - unitY * tipOffset,
      };
      const left = {
        x: pathTip.x - unitX * halfSize + normalX * halfSize,
        y: pathTip.y - unitY * halfSize + normalY * halfSize,
      };
      const right = {
        x: pathTip.x - unitX * halfSize - normalX * halfSize,
        y: pathTip.y - unitY * halfSize - normalY * halfSize,
      };
      const tail = {
        x: pathTip.x - unitX * effectiveSize,
        y: pathTip.y - unitY * effectiveSize,
      };

      return {
        markerPath: `M ${formatPoint(pathTip)} L ${formatPoint(left)} L ${formatPoint(tail)} L ${formatPoint(right)} Z`,
        retractedPoint: {
          x: tip.x - unitX * (effectiveSize + tipOffset),
          y: tip.y - unitY * (effectiveSize + tipOffset),
        },
      };
    }
  }
}
