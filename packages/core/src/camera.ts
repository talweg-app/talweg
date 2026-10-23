import type { BoundingBox, CameraViewport, Point2D, Size2D } from "./types.js";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8.0;
export const DEFAULT_ZOOM_STEPS: readonly number[] = [0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0];

const ORIGIN: Point2D = { x: 0, y: 0 };
const IDENTITY_CAMERA: CameraViewport = { x: 0, y: 0, zoom: 1.0 };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function sanitizeCamera(camera: CameraViewport): CameraViewport {
  // a single NaN leaks into matrix(NaN) and blanks the whole canvas
  if (
    !Number.isFinite(camera.x) ||
    !Number.isFinite(camera.y) ||
    !Number.isFinite(camera.zoom) ||
    camera.zoom <= 0
  ) {
    return IDENTITY_CAMERA;
  }
  return camera;
}

export function screenToWorld(
  point: Point2D,
  camera: CameraViewport,
  screenBounds: Point2D = ORIGIN,
): Point2D {
  return {
    x: (point.x - screenBounds.x) / camera.zoom - camera.x,
    y: (point.y - screenBounds.y) / camera.zoom - camera.y,
  };
}

export function worldToScreen(
  point: Point2D,
  camera: CameraViewport,
  screenBounds: Point2D = ORIGIN,
): Point2D {
  return {
    x: (point.x + camera.x) * camera.zoom + screenBounds.x,
    y: (point.y + camera.y) * camera.zoom + screenBounds.y,
  };
}

export function viewportToWorld(viewportPoint: Point2D, camera: CameraViewport): Point2D {
  return {
    x: viewportPoint.x / camera.zoom - camera.x,
    y: viewportPoint.y / camera.zoom - camera.y,
  };
}

export function worldToViewport(worldPoint: Point2D, camera: CameraViewport): Point2D {
  return {
    x: (worldPoint.x + camera.x) * camera.zoom,
    y: (worldPoint.y + camera.y) * camera.zoom,
  };
}

export function getViewportWorldBounds(
  viewportWidth: number,
  viewportHeight: number,
  camera: CameraViewport,
): BoundingBox {
  const width = viewportWidth / camera.zoom;
  const height = viewportHeight / camera.zoom;
  const minX = -camera.x;
  const minY = -camera.y;

  return {
    minX,
    minY,
    maxX: minX + width,
    maxY: minY + height,
    width,
    height,
  };
}

export function panByScreenDelta(camera: CameraViewport, deltaScreen: Point2D): CameraViewport {
  return {
    x: camera.x + deltaScreen.x / camera.zoom,
    y: camera.y + deltaScreen.y / camera.zoom,
    zoom: camera.zoom,
  };
}

export function preserveFocalPoint(
  currentCameraCoord: number,
  requestedCameraCoord: number,
  requestedZoom: number,
  clampedZoom: number,
  currentZoom: number,
): number {
  if (requestedZoom === currentZoom) return currentCameraCoord;

  const clampedScaleDelta = 1 / clampedZoom - 1 / currentZoom;
  const requestedScaleDelta = 1 / requestedZoom - 1 / currentZoom;

  return (
    currentCameraCoord +
    ((requestedCameraCoord - currentCameraCoord) * clampedScaleDelta) / requestedScaleDelta
  );
}

export function zoomAtViewportPoint(
  camera: CameraViewport,
  viewportPoint: Point2D,
  targetZoom: number,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
): CameraViewport {
  const nextZoom = clamp(targetZoom, minZoom, maxZoom);
  if (nextZoom === camera.zoom) return camera;

  const scaleDelta = 1 / nextZoom - 1 / camera.zoom;

  return {
    x: camera.x + viewportPoint.x * scaleDelta,
    y: camera.y + viewportPoint.y * scaleDelta,
    zoom: nextZoom,
  };
}

export function zoomAtScreenPoint(
  camera: CameraViewport,
  screenPoint: Point2D,
  targetZoom: number,
  screenBounds: Point2D = ORIGIN,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
): CameraViewport {
  const viewportPoint: Point2D = {
    x: screenPoint.x - screenBounds.x,
    y: screenPoint.y - screenBounds.y,
  };

  return zoomAtViewportPoint(camera, viewportPoint, targetZoom, minZoom, maxZoom);
}

export function getNextZoomIn(
  currentZoom: number,
  steps: readonly number[] = DEFAULT_ZOOM_STEPS,
  baseZoom = 1.0,
): number {
  const [firstStep, ...remainingSteps] = steps;
  if (firstStep === undefined) return currentZoom;

  let lowerStep = firstStep * baseZoom;

  for (const step of remainingSteps) {
    const upperStep = step * baseZoom;
    const midpoint = (upperStep - lowerStep) / 2;

    if (upperStep - currentZoom > midpoint) return upperStep;
    lowerStep = upperStep;
  }

  return lowerStep;
}

export function getNextZoomOut(
  currentZoom: number,
  steps: readonly number[] = DEFAULT_ZOOM_STEPS,
  baseZoom = 1.0,
): number {
  const [lastStep, ...earlierSteps] = [...steps].reverse();
  if (lastStep === undefined) return currentZoom;

  let upperStep = lastStep * baseZoom;

  for (const step of earlierSteps) {
    const lowerStep = step * baseZoom;
    const midpoint = (upperStep - lowerStep) / 2;

    if (upperStep - currentZoom < midpoint) return lowerStep;
    upperStep = lowerStep;
  }

  return upperStep;
}

export function zoomToBounds(
  bounds: BoundingBox,
  viewport: Size2D,
  padding = 40,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
): CameraViewport {
  const availableWidth = Math.max(viewport.width - padding * 2, 1);
  const availableHeight = Math.max(viewport.height - padding * 2, 1);
  const zoom = clamp(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
    minZoom,
    maxZoom,
  );

  return {
    x: -bounds.minX + (viewport.width - bounds.width * zoom) / (2 * zoom),
    y: -bounds.minY + (viewport.height - bounds.height * zoom) / (2 * zoom),
    zoom,
  };
}
