import { describe, expect, it } from "vitest";
import type { NodeId } from "@talweg/core";
import {
  createSceneDoc,
  applyDocumentToYDoc,
  serializeTalwegFile,
  deserializeTalwegFile,
} from "@talweg/storage";
import { createBlankCanvas } from "./starterTemplates.js";
import { createFreehand, freehandColor, freehandPath } from "./freehand.js";
import { resizeNodeContent } from "./resizeNodeContent.js";

const id = "freehand-test" as NodeId;
describe("freehand strokes", () => {
  it("normalizes world points with padding and preserves their shape while resizing", () => {
    const node = createFreehand(
      [
        { x: -20, y: 10 },
        { x: 10, y: 60 },
      ],
      id,
      null,
      3,
      "dark",
    );
    expect(node.x).toBe(-24);
    expect(node.y).toBe(6);
    expect(
      node.data.points.every(
        (point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1,
      ),
    ).toBe(true);
    expect(freehandPath(node.data.points, node.width, node.height)).toBe(
      "M4,4 L34,54",
    );
    expect(
      freehandPath(node.data.points, node.width * 2, node.height * 2),
    ).toBe("M8,8 L68,108");
    const resized = resizeNodeContent(node, {
      x: node.x,
      y: node.y,
      width: node.width * 2,
      height: node.height * 2,
      rotation: 0,
    });
    expect(resized.data).toEqual(node.data);
    expect(resized.style.strokeWidth).toBe(3);
  });
  it("renders a tap as a finite dot and uses curves for longer strokes", () => {
    const dot = createFreehand([{ x: 20, y: 30 }], id, "#8caecc", 8, "light");
    expect(dot.width).toBeGreaterThan(0);
    expect(dot.height).toBeGreaterThan(0);
    expect(freehandPath(dot.data.points, dot.width, dot.height)).toBe(
      "M6,6 L6,6",
    );
    expect(
      freehandPath(
        [
          { x: 0, y: 0 },
          { x: 0.5, y: 1 },
          { x: 1, y: 0 },
        ],
        100,
        50,
      ),
    ).toBe("M0,0 Q50,50 75,25 L100,0");
    expect(freehandPath([], 100, 50)).toBe("");
  });
  it("adapts automatic ink to both themes and preserves an explicit color", () => {
    const node = createFreehand([{ x: 0, y: 0 }], id, null, 3, "dark");
    expect(freehandColor(node, "dark")).toBe("#eeeeeb");
    expect(freehandColor(node, "light")).toBe("#202223");
    const colored = createFreehand([{ x: 0, y: 0 }], id, "#cb8584", 5, "light");
    expect(freehandColor(colored, "dark")).toBe("#cb8584");
    expect(freehandColor(colored, "light")).toBe("#cb8584");
  });
  it("round-trips point data and ink settings through a portable project file", () => {
    const document = createBlankCanvas();
    const node = createFreehand(
      [
        { x: 12, y: 24 },
        { x: 31, y: 40 },
        { x: 40, y: 52 },
      ],
      id,
      null,
      5,
      "light",
    );
    document.nodes[id] = node;
    document.rootNodeIds = [...document.rootNodeIds, id];
    const scene = createSceneDoc();
    applyDocumentToYDoc(document, scene);
    try {
      const restored = deserializeTalwegFile(
        serializeTalwegFile(document, scene),
      );
      try {
        expect(restored.doc.nodes[id]).toEqual(node);
      } finally {
        restored.ydoc.destroy();
      }
    } finally {
      scene.destroy();
    }
  });
  it("ignores non-finite points and rejects an empty stroke", () => {
    expect(() => createFreehand([], id, null, 3, "dark")).toThrow();
    const node = createFreehand(
      [
        { x: NaN, y: 0 },
        { x: 4, y: 5 },
      ],
      id,
      null,
      3,
      "dark",
    );
    expect(node.data.points).toHaveLength(1);
  });
});
