import { describe, expect, it } from "vitest";
import { formatCameraHash, parseCameraHash } from "./useCameraUrlSync.js";

describe("useCameraUrlSync", () => {
  it("formats camera coordinates and zoom into a URL hash", () => {
    const hash = formatCameraHash({ x: 120.4, y: -45.8, zoom: 1.25 });
    expect(hash).toBe("#cam=120,-46,1.25");
  });

  it("parses valid camera hash string", () => {
    const cam = parseCameraHash("#cam=250,-100,0.75");
    expect(cam).toEqual({
      x: 250,
      y: -100,
      zoom: 0.75,
    });
  });

  it("returns null for empty or invalid hash formats", () => {
    expect(parseCameraHash("")).toBeNull();
    expect(parseCameraHash("#invalid")).toBeNull();
    expect(parseCameraHash("#cam=abc,def,1")).toBeNull();
    expect(parseCameraHash("#cam=100,200,-1")).toBeNull();
  });
});
