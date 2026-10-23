import { useEffect, useRef } from "react";
import type { CameraViewport } from "@talweg/core";

const CAM_HASH_REGEX = /^#cam=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/;

export function parseCameraHash(rawHash?: string): CameraViewport | null {
  const hash = rawHash ?? (typeof window !== "undefined" ? window.location.hash : "");

  if (!hash) return null;

  const match = CAM_HASH_REGEX.exec(hash);
  if (!match) return null;

  const x = parseFloat(match[1] ?? "");
  const y = parseFloat(match[2] ?? "");
  const zoom = parseFloat(match[3] ?? "");

  if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(zoom) || zoom <= 0) {
    return null;
  }

  return { x, y, zoom };
}

export function formatCameraHash(camera: CameraViewport): string {
  const x = Math.round(camera.x);
  const y = Math.round(camera.y);
  const zoom = Math.round(camera.zoom * 100) / 100;
  return `#cam=${String(x)},${String(y)},${String(zoom)}`;
}

export function useCameraUrlSync(camera: CameraViewport, enabled = true): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef<CameraViewport>(camera);
  const isFirstRunRef = useRef(true);
  cameraRef.current = camera;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const currentCam = cameraRef.current;
      const hash = formatCameraHash(currentCam);
      if (window.location.hash !== hash) {
        const newUrl = `${window.location.pathname}${window.location.search}${hash}`;
        window.history.replaceState(window.history.state, "", newUrl);
      }
    }, 250);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [camera.x, camera.y, camera.zoom, enabled]);
}
