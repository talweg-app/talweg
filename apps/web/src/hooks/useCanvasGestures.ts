import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  panByScreenDelta,
  sanitizeCamera,
  zoomAtViewportPoint,
  type CameraViewport,
} from "@talweg/core";

export function useCanvasGestures(
  viewportRef: RefObject<HTMLDivElement | null>,
  onCameraChange: Dispatch<SetStateAction<CameraViewport>>,
): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let nativePinchActive = false;
    let lastGestureScale = 1;

    const zoomAtCursor = (clientX: number, clientY: number, factor: number) => {
      const bounds = viewport.getBoundingClientRect();
      const point = { x: clientX - bounds.left, y: clientY - bounds.top };
      onCameraChange((previous) => {
        const camera = sanitizeCamera(previous);
        return zoomAtViewportPoint(camera, point, camera.zoom * factor);
      });
    };

    const handleWheel = (event: WheelEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-testid=canvas-context-menu]")
      )
        return;
      event.preventDefault();
      if (nativePinchActive) return;

      const units =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? viewport.clientHeight
            : 1;
      const dx = event.deltaX * units;
      const dy = event.deltaY * units;

      if (event.ctrlKey || event.metaKey) {
        // pixel-mode ctrl+wheel is the browser's pinch stream, including coalesced samples
        const sensitivity = event.deltaMode === 0 ? 0.01 : 0.0015;
        zoomAtCursor(event.clientX, event.clientY, Math.exp(-dy * sensitivity));
        return;
      }

      if (event.shiftKey) {
        onCameraChange((previous) =>
          panByScreenDelta(sanitizeCamera(previous), { x: -(dx || dy), y: 0 }),
        );
        return;
      }

      const isTrackpadScroll =
        event.deltaX !== 0 ||
        (event.deltaMode === 0 &&
          (event.deltaY % 1 !== 0 || Math.abs(event.deltaY) < 40));
      if (isTrackpadScroll) {
        onCameraChange((previous) =>
          panByScreenDelta(sanitizeCamera(previous), { x: -dx, y: -dy }),
        );
        return;
      }
      zoomAtCursor(event.clientX, event.clientY, Math.exp(-dy * 0.0015));
    };

    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      nativePinchActive = true;
      lastGestureScale = 1;
    };

    const handleGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & {
        clientX: number;
        clientY: number;
        scale: number;
      };
      if (!Number.isFinite(gesture.scale) || gesture.scale <= 0) return;
      nativePinchActive = true;
      const factor = gesture.scale / lastGestureScale;
      lastGestureScale = gesture.scale;
      const bounds = viewport.getBoundingClientRect();
      const x = Number.isFinite(gesture.clientX)
        ? gesture.clientX
        : bounds.left + bounds.width / 2;
      const y = Number.isFinite(gesture.clientY)
        ? gesture.clientY
        : bounds.top + bounds.height / 2;
      zoomAtCursor(x, y, factor);
    };

    const resetGesture = () => {
      nativePinchActive = false;
      lastGestureScale = 1;
    };
    const handleGestureEnd = (event: Event) => {
      event.preventDefault();
      resetGesture();
    };
    const preventPageZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    viewport.addEventListener("gesturestart", handleGestureStart, {
      passive: false,
    });
    viewport.addEventListener("gesturechange", handleGestureChange, {
      passive: false,
    });
    viewport.addEventListener("gestureend", handleGestureEnd, {
      passive: false,
    });
    window.addEventListener("wheel", preventPageZoom, { passive: false });
    window.addEventListener("blur", resetGesture);
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("gesturestart", handleGestureStart);
      viewport.removeEventListener("gesturechange", handleGestureChange);
      viewport.removeEventListener("gestureend", handleGestureEnd);
      window.removeEventListener("wheel", preventPageZoom);
      window.removeEventListener("blur", resetGesture);
    };
  }, [viewportRef, onCameraChange]);
}
