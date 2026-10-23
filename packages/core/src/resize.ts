import type { Point2D, ResizeHandle } from "./types.js";

export interface NormalizedAnchor {
  readonly u: number;
  readonly v: number;
}

export interface TransformBox2D {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface ResizeOptions {
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly lockAspectRatio?: boolean;
  readonly isShiftPressed?: boolean;
}

export interface ResizeResult {
  readonly box: TransformBox2D;
  readonly anchorWorld: Point2D;
}

export const HANDLE_TOPOLOGY: Readonly<
  Record<ResizeHandle, { handle: NormalizedAnchor; anchor: NormalizedAnchor }>
> = {
  nw: { handle: { u: 0.0, v: 0.0 }, anchor: { u: 1.0, v: 1.0 } },
  n: { handle: { u: 0.5, v: 0.0 }, anchor: { u: 0.5, v: 1.0 } },
  ne: { handle: { u: 1.0, v: 0.0 }, anchor: { u: 0.0, v: 1.0 } },
  e: { handle: { u: 1.0, v: 0.5 }, anchor: { u: 0.0, v: 0.5 } },
  se: { handle: { u: 1.0, v: 1.0 }, anchor: { u: 0.0, v: 0.0 } },
  s: { handle: { u: 0.5, v: 1.0 }, anchor: { u: 0.5, v: 0.0 } },
  sw: { handle: { u: 0.0, v: 1.0 }, anchor: { u: 1.0, v: 0.0 } },
  w: { handle: { u: 0.0, v: 0.5 }, anchor: { u: 1.0, v: 0.5 } },
};

export function resizeTransformBox(
  initialBox: TransformBox2D,
  handle: ResizeHandle,
  currentWorldPoint: Point2D,
  options: ResizeOptions = {},
): ResizeResult {
  const minW = options.minWidth ?? 40;
  const minH = options.minHeight ?? 30;
  const lockAspect = options.lockAspectRatio === true || options.isShiftPressed === true;

  const { handle: hNorm, anchor: aNorm } = HANDLE_TOPOLOGY[handle];
  const theta = initialBox.rotation;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const cx0 = initialBox.x + cosT * (initialBox.width / 2) - sinT * (initialBox.height / 2);
  const cy0 = initialBox.y + sinT * (initialBox.width / 2) + cosT * (initialBox.height / 2);

  const axWorld = cx0 + cosT * ((aNorm.u - 0.5) * initialBox.width) - sinT * ((aNorm.v - 0.5) * initialBox.height);
  const ayWorld = cy0 + sinT * ((aNorm.u - 0.5) * initialBox.width) + cosT * ((aNorm.v - 0.5) * initialBox.height);

  const dxW = currentWorldPoint.x - axWorld;
  const dyW = currentWorldPoint.y - ayWorld;
  const dxL = cosT * dxW + sinT * dyW;
  const dyL = -sinT * dxW + cosT * dyW;

  let wCand = initialBox.width;
  let hCand = initialBox.height;

  if (hNorm.u === 0.0) {
    wCand = -dxL;
  } else if (hNorm.u === 1.0) {
    wCand = dxL;
  }

  if (hNorm.v === 0.0) {
    hCand = -dyL;
  } else if (hNorm.v === 1.0) {
    hCand = dyL;
  }

  let wClamped = Math.max(wCand, minW);
  let hClamped = Math.max(hCand, minH);

  if (lockAspect) {
    const safeHeight = Math.max(1, initialBox.height);
    const baseAspect = initialBox.width / safeHeight;
    const isCorner = hNorm.u !== 0.5 && hNorm.v !== 0.5;

    if (isCorner) {
      const scale = Math.max(wClamped / initialBox.width, hClamped / initialBox.height);
      wClamped = Math.max(initialBox.width * scale, minW, minH * baseAspect);
      hClamped = wClamped / baseAspect;
    } else if (hNorm.u === 0.5) {
      wClamped = Math.max(hClamped * baseAspect, minW);
      hClamped = wClamped / baseAspect;
    } else {
      hClamped = Math.max(wClamped / baseAspect, minH);
      wClamped = hClamped * baseAspect;
    }
  }

  const cxNew = axWorld - (cosT * ((aNorm.u - 0.5) * wClamped) - sinT * ((aNorm.v - 0.5) * hClamped));
  const cyNew = ayWorld - (sinT * ((aNorm.u - 0.5) * wClamped) + cosT * ((aNorm.v - 0.5) * hClamped));

  const xNew = cxNew - (cosT * (wClamped / 2) - sinT * (hClamped / 2));
  const yNew = cyNew - (sinT * (wClamped / 2) + cosT * (hClamped / 2));

  return {
    box: {
      x: xNew,
      y: yNew,
      width: wClamped,
      height: hClamped,
      rotation: theta,
    },
    anchorWorld: { x: axWorld, y: ayWorld },
  };
}
