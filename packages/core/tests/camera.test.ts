import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZOOM_STEPS,
  clamp,
  getNextZoomIn,
  getNextZoomOut,
  getViewportWorldBounds,
  panByScreenDelta,
  preserveFocalPoint,
  sanitizeCamera,
  screenToWorld,
  viewportToWorld,
  worldToScreen,
  worldToViewport,
  zoomAtScreenPoint,
  zoomAtViewportPoint,
  zoomToBounds,
} from "../src/index.js";
import type { BoundingBox, CameraViewport, Point2D, Size2D } from "../src/index.js";

function box(x: number, y: number, width: number, height: number): BoundingBox {
  return { minX: x, minY: y, maxX: x + width, maxY: y + height, width, height };
}

function expectCentered(bounds: BoundingBox, camera: CameraViewport, viewport: Size2D): void {
  const center: Point2D = {
    x: bounds.minX + bounds.width / 2,
    y: bounds.minY + bounds.height / 2,
  };
  const projected = worldToViewport(center, camera);

  expect(projected.x).toBeCloseTo(viewport.width / 2, 6);
  expect(projected.y).toBeCloseTo(viewport.height / 2, 6);
}

describe("clamp", () => {
  it("bounds a value on both sides", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe("coordinate conversion", () => {
  const camera = { x: -200, y: -100, zoom: 2 };
  const screenBounds = { x: 50, y: 30 };

  it("round-trips screen and world points with a container offset", () => {
    const screenPoint = { x: 450, y: 330 };
    const worldPoint = screenToWorld(screenPoint, camera, screenBounds);

    expect(worldPoint).toEqual({ x: 400, y: 250 });
    expect(worldToScreen(worldPoint, camera, screenBounds)).toEqual(screenPoint);
  });

  it("round-trips screen and world points without an offset", () => {
    const worldPoint = { x: 123.5, y: -42 };

    expect(screenToWorld(worldToScreen(worldPoint, camera), camera)).toEqual(worldPoint);
    expect(worldToScreen(screenToWorld(worldPoint, camera), camera)).toEqual(worldPoint);
  });

  it("round-trips viewport and world points", () => {
    const viewportPoint = { x: 300, y: 200 };
    const worldPoint = viewportToWorld(viewportPoint, camera);

    expect(worldPoint).toEqual({ x: 350, y: 200 });
    expect(worldToViewport(worldPoint, camera)).toEqual(viewportPoint);
  });

  it("computes the visible world bounds", () => {
    expect(getViewportWorldBounds(800, 600, { x: -100, y: -50, zoom: 2 })).toEqual({
      minX: 100,
      minY: 50,
      maxX: 500,
      maxY: 350,
      width: 400,
      height: 300,
    });
  });
});

describe("sanitizeCamera", () => {
  it("returns a finite camera unchanged", () => {
    const camera = { x: -240.5, y: 80, zoom: 1.75 };
    expect(sanitizeCamera(camera)).toBe(camera);
  });

  it("replaces non-finite coordinates with the identity camera", () => {
    expect(sanitizeCamera({ x: Number.NaN, y: 0, zoom: 1 })).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(sanitizeCamera({ x: 0, y: Number.NEGATIVE_INFINITY, zoom: 1 })).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(sanitizeCamera({ x: 0, y: 0, zoom: Number.NaN })).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("replaces non-positive zoom with the identity camera", () => {
    expect(sanitizeCamera({ x: 120, y: -60, zoom: 0 })).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(sanitizeCamera({ x: 120, y: -60, zoom: -2 })).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe("panByScreenDelta", () => {
  it("converts screen pixels into world-space camera movement", () => {
    const camera = { x: 100, y: 50, zoom: 2 };
    const nextCamera = panByScreenDelta(camera, { x: 40, y: -60 });

    expect(nextCamera).toEqual({ x: 120, y: 20, zoom: 2 });

    const initialScreen = worldToViewport({ x: 0, y: 0 }, camera);
    const nextScreen = worldToViewport({ x: 0, y: 0 }, nextCamera);

    expect(nextScreen.x - initialScreen.x).toBe(40);
    expect(nextScreen.y - initialScreen.y).toBe(-60);
  });
});

describe("zoomAtViewportPoint", () => {
  const camera = { x: 0, y: 0, zoom: 1 };
  const cursor = { x: 300, y: 200 };

  it("keeps the world point under the cursor fixed", () => {
    const initialWorld = viewportToWorld(cursor, camera);
    const nextCamera = zoomAtViewportPoint(camera, cursor, 2.5);

    expect(nextCamera).toEqual({ x: -180, y: -120, zoom: 2.5 });
    expect(viewportToWorld(cursor, nextCamera).x).toBeCloseTo(initialWorld.x, 6);
    expect(viewportToWorld(cursor, nextCamera).y).toBeCloseTo(initialWorld.y, 6);
    expect(worldToViewport(initialWorld, nextCamera).x).toBeCloseTo(cursor.x, 6);
    expect(worldToViewport(initialWorld, nextCamera).y).toBeCloseTo(cursor.y, 6);
  });

  it("preserves the focal point when clamping to the maximum zoom", () => {
    const initialWorld = viewportToWorld(cursor, camera);
    const nextCamera = zoomAtViewportPoint(camera, cursor, 100);
    const worldAfterZoom = viewportToWorld(cursor, nextCamera);

    expect(nextCamera.zoom).toBe(8);
    expect(worldAfterZoom.x).toBeCloseTo(initialWorld.x, 6);
    expect(worldAfterZoom.y).toBeCloseTo(initialWorld.y, 6);
  });

  it("preserves the focal point when clamping to the minimum zoom", () => {
    const initialWorld = viewportToWorld(cursor, camera);
    const nextCamera = zoomAtViewportPoint(camera, cursor, 0.01);
    const worldAfterZoom = viewportToWorld(cursor, nextCamera);

    expect(nextCamera.zoom).toBe(0.1);
    expect(worldAfterZoom.x).toBeCloseTo(initialWorld.x, 6);
    expect(worldAfterZoom.y).toBeCloseTo(initialWorld.y, 6);
  });

  it("returns the same camera when the target equals the current zoom", () => {
    expect(zoomAtViewportPoint(camera, cursor, 1)).toBe(camera);
  });

  it("returns the same camera when the clamped target equals the current zoom", () => {
    const maxedCamera = { x: 10, y: 20, zoom: 8 };

    expect(zoomAtViewportPoint(maxedCamera, cursor, 100)).toBe(maxedCamera);
  });

  it("honors custom zoom limits", () => {
    expect(zoomAtViewportPoint(camera, cursor, 3, 0.5, 2).zoom).toBe(2);
  });
});

describe("zoomAtScreenPoint", () => {
  const camera = { x: 0, y: 0, zoom: 1 };
  const screenBounds = { x: 50, y: 30 };
  const screenPoint = { x: 350, y: 230 };

  it("accounts for the container offset", () => {
    const initialWorld = screenToWorld(screenPoint, camera, screenBounds);
    const nextCamera = zoomAtScreenPoint(camera, screenPoint, 2, screenBounds);

    expect(nextCamera).toEqual({ x: -150, y: -100, zoom: 2 });
    expect(screenToWorld(screenPoint, nextCamera, screenBounds).x).toBeCloseTo(initialWorld.x, 6);
    expect(screenToWorld(screenPoint, nextCamera, screenBounds).y).toBeCloseTo(initialWorld.y, 6);
  });

  it("defaults to a zero screen offset", () => {
    expect(zoomAtScreenPoint(camera, { x: 300, y: 200 }, 2)).toEqual({
      x: -150,
      y: -100,
      zoom: 2,
    });
  });
});

describe("preserveFocalPoint", () => {
  it("keeps the current coordinate when the requested zoom does not change", () => {
    expect(preserveFocalPoint(10, 99, 2, 2, 2)).toBe(10);
  });

  it("returns the requested coordinate when no clamping occurs", () => {
    expect(preserveFocalPoint(0, -180, 2.5, 2.5, 1)).toBeCloseTo(-180, 6);
  });

  it("scales the requested coordinate to the clamped zoom", () => {
    const corrected = preserveFocalPoint(0, -180, 2.5, 2, 1);
    const camera = { x: corrected, y: 0, zoom: 2 };

    expect(corrected).toBeCloseTo(-150, 6);
    expect(viewportToWorld({ x: 300, y: 200 }, camera).x).toBeCloseTo(300, 6);
  });
});

describe("discrete zoom steps", () => {
  it("advances to the next zoom-in step", () => {
    expect(getNextZoomIn(1)).toBe(2);
    expect(getNextZoomIn(1.2)).toBe(2);
    expect(getNextZoomIn(1.6)).toBe(4);
    expect(getNextZoomIn(8)).toBe(8);
  });

  it("advances to the next zoom-out step", () => {
    expect(getNextZoomOut(1)).toBe(0.5);
    expect(getNextZoomOut(1.4)).toBe(0.5);
    expect(getNextZoomOut(1.8)).toBe(1);
    expect(getNextZoomOut(0.1)).toBe(0.1);
  });

  it("scales the ladder by the base zoom", () => {
    expect(getNextZoomIn(2, DEFAULT_ZOOM_STEPS, 2)).toBe(4);
    expect(getNextZoomOut(2, DEFAULT_ZOOM_STEPS, 2)).toBe(1);
    expect(getNextZoomIn(100, DEFAULT_ZOOM_STEPS, 2)).toBe(16);
  });

  it("returns the current zoom for an empty ladder", () => {
    expect(getNextZoomIn(2, [])).toBe(2);
    expect(getNextZoomOut(2, [])).toBe(2);
  });

  it("returns the only step for a single-step ladder", () => {
    expect(getNextZoomIn(2, [1])).toBe(1);
    expect(getNextZoomOut(2, [1])).toBe(1);
  });
});

describe("zoomToBounds", () => {
  const viewport = { width: 1000, height: 600 };
  const bounds = box(100, 100, 200, 100);

  it("fits and centers the bounds with padding", () => {
    const camera = zoomToBounds(bounds, viewport, 50);

    expect(camera.zoom).toBeCloseTo(4.5, 6);
    expectCentered(bounds, camera, viewport);
  });

  it("uses default padding when none is provided", () => {
    const camera = zoomToBounds(bounds, viewport);

    expect(camera.zoom).toBeCloseTo(4.6, 6);
    expectCentered(bounds, camera, viewport);
  });

  it("fits based on the limiting viewport dimension", () => {
    const tallBounds = box(0, 0, 100, 200);
    const camera = zoomToBounds(tallBounds, viewport, 50);

    expect(camera.zoom).toBeCloseTo(2.5, 6);
    expectCentered(tallBounds, camera, viewport);
  });

  it("clamps to the minimum zoom for oversized bounds", () => {
    const hugeBounds = box(0, 0, 10000, 10000);
    const camera = zoomToBounds(hugeBounds, viewport, 50);

    expect(camera.zoom).toBe(0.1);
    expectCentered(hugeBounds, camera, viewport);
  });

  it("clamps to the maximum zoom for tiny bounds", () => {
    const tinyBounds = box(0, 0, 1, 1);
    const camera = zoomToBounds(tinyBounds, viewport, 50);

    expect(camera.zoom).toBe(8);
    expectCentered(tinyBounds, camera, viewport);
  });

  it("honors custom zoom limits", () => {
    expect(zoomToBounds(bounds, viewport, 50, 2, 3).zoom).toBe(3);
  });

  it("keeps at least one usable pixel when padding exceeds the viewport", () => {
    const smallViewport = { width: 20, height: 20 };
    const camera = zoomToBounds(box(0, 0, 1, 1), smallViewport, 40);

    expect(camera.zoom).toBe(1);
    expectCentered(box(0, 0, 1, 1), camera, smallViewport);
  });

  it("clamps zero-sized bounds to the maximum zoom", () => {
    const zeroBounds = box(0, 0, 0, 0);
    const camera = zoomToBounds(zeroBounds, viewport, 50);

    expect(camera.zoom).toBe(8);
    expectCentered(zeroBounds, camera, viewport);
  });

  it("calibrates auto-framing with 60px padding and max 100% scale", () => {
    const sceneBounds = box(80, 80, 860, 400);
    const standardDesktop = { width: 1440, height: 860 };
    const framed = zoomToBounds(sceneBounds, standardDesktop, 60, 0.1, 1.0);

    expect(framed.zoom).toBe(1.0);
    expectCentered(sceneBounds, framed, standardDesktop);
  });
});

describe("desktop wheel zoom dynamics", () => {
  it("computes cursor-anchored exponential zoom factor clamped between 0.1 and 4.0", () => {
    const camera = { x: 0, y: 0, zoom: 1.0 };
    const cursor = { x: 500, y: 300 };

    // Scroll up (zoom in)
    const dyUp = -100;
    const factorUp = Math.exp(-dyUp * 0.003);
    const zoomedIn = zoomAtViewportPoint(camera, cursor, camera.zoom * factorUp, 0.1, 4.0);
    expect(zoomedIn.zoom).toBeCloseTo(1.34985, 4);

    // Extreme zoom in clamped at 4.0
    const extremeZoomIn = zoomAtViewportPoint(camera, cursor, 10.0, 0.1, 4.0);
    expect(extremeZoomIn.zoom).toBe(4.0);

    // Extreme zoom out clamped at 0.1
    const extremeZoomOut = zoomAtViewportPoint(camera, cursor, 0.001, 0.1, 4.0);
    expect(extremeZoomOut.zoom).toBe(0.1);
  });
});

