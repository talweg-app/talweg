import { describe, expect, it } from "vitest";
import type { CanvasDocument, NodeId } from "@talweg/core";
import { createBlankCanvas } from "./starterTemplates.js";
import { createCanvasNode } from "./createCanvasNode.js";
import { alignmentGuides } from "./alignmentGuides.js";
import { groupSelection, worldDocument } from "./organizeCanvas.js";
const a = "a" as NodeId;
const b = "b" as NodeId;
function fixture(): CanvasDocument {
  const document = createBlankCanvas();
  const nodes = [a, b].map((id, i) => {
    const node = createCanvasNode(
      "rectangle",
      { x: 100 + i * 300, y: 100 + i * 100 },
      "whiteboard",
      "dark",
    );
    if (!node) throw new Error("Missing fixture");
    return {
      ...node,
      id,
      x: 100 + i * 300,
      y: 100 + i * 100,
      width: 80,
      height: 60,
      pageId: "page-1",
    };
  });
  return {
    ...document,
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    rootNodeIds: [a, b],
  };
}
describe("live alignment guides", () => {
  it("shows a nearby edge during movement without snapping or editing positions", () => {
    const document = fixture();
    const point = { x: 400, y: 104 };
    expect(alignmentGuides(document, new Map([[b, point]]), 1)).toContainEqual({
      axis: "y",
      position: 100,
      from: 100,
      to: 480,
    });
    expect(point).toEqual({ x: 400, y: 104 });
    expect(document.nodes[b]?.y).toBe(200);
  });
  it("uses a screen-pixel tolerance at different zoom levels", () => {
    const positions = new Map([[b, { x: 400, y: 104 }]]);
    expect(alignmentGuides(fixture(), positions, 2)).toEqual([]);
    expect(alignmentGuides(fixture(), positions, 0.5)).toHaveLength(1);
  });
  it("ignores hidden nodes and other pages", () => {
    const document = fixture();
    const node = document.nodes[a];
    if (!node) throw new Error("Missing fixture");
    const positions = new Map([[b, { x: 400, y: 100 }]]);
    node.isVisible = false;
    expect(alignmentGuides(document, positions, 1)).toEqual([]);
    node.isVisible = true;
    node.pageId = "another-page";
    expect(alignmentGuides(document, positions, 1)).toEqual([]);
  });
  it("does not align a moving group against its own children", () => {
    const group = "group" as NodeId;
    const document = worldDocument(
      groupSelection(fixture(), new Set([a, b]), group, ""),
    );
    const node = document.nodes[group];
    if (!node) throw new Error("Missing group");
    expect(
      alignmentGuides(
        document,
        new Map([[group, { x: node.x, y: node.y }]]),
        1,
      ),
    ).toEqual([]);
  });
});
