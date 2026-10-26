import { describe, expect, it } from "vitest";
import type { CanvasDocument, NodeId } from "@talweg/core";
import {
  createBlankCanvas,
  createMicroservicesTemplate,
} from "./starterTemplates.js";
import { createCanvasNode } from "./createCanvasNode.js";
import {
  alignSelection,
  deleteSelection,
  descendantIds,
  duplicateSelection,
  groupBounds,
  groupSelection,
  movedWorldDocument,
  selectionRoots,
  ungroupSelection,
  worldDocument,
} from "./organizeCanvas.js";

function fixture(): CanvasDocument {
  const document = createBlankCanvas();
  const nodes = [
    ["a", 100, 50, 80],
    ["b", 310, 160, 120],
    ["c", 600, 260, 60],
  ].map(([id, x, y, width]) => {
    const created = createCanvasNode(
      "rectangle",
      { x: Number(x), y: Number(y) },
      "whiteboard",
      "dark",
    );
    if (!created) throw new Error("Missing fixture node");
    return {
      ...created,
      id: String(id) as NodeId,
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: 60,
      pageId: "page-1",
    };
  });
  return {
    ...document,
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
    rootNodeIds: nodes.map((node) => node.id),
  };
}
const ids = new Set(["a", "b", "c"] as NodeId[]);
const groupId = "group-test" as NodeId;

describe("organizing canvas content", () => {
  it("groups without moving children, moves them together, and ungroups into the same world positions", () => {
    const before = fixture();
    const grouped = groupSelection(before, ids, groupId, "Lesson");
    expect(grouped.rootNodeIds).toEqual([groupId]);
    const world = worldDocument(grouped);
    for (const id of ids)
      expect([world.nodes[id]?.x, world.nodes[id]?.y]).toEqual([
        before.nodes[id]?.x,
        before.nodes[id]?.y,
      ]);
    expect(grouped.nodes[groupId]?.meta?.title).toBe("Lesson");
    const preview = movedWorldDocument(
      world,
      new Map([
        [
          groupId,
          {
            x: (world.nodes[groupId]?.x ?? 0) + 90,
            y: (world.nodes[groupId]?.y ?? 0) - 30,
          },
        ],
      ]),
    );
    expect(preview.nodes["a" as NodeId]?.x).toBe(190);
    const parent = grouped.nodes[groupId];
    if (!parent) throw new Error("Missing group");
    const moved = {
      ...grouped,
      nodes: {
        ...grouped.nodes,
        [groupId]: { ...parent, x: parent.x + 90, y: parent.y - 30 },
      },
    };
    const restored = ungroupSelection(moved, new Set([groupId]));
    for (const id of ids) {
      expect(restored.nodes[id]?.parentId).toBeNull();
      expect(restored.nodes[id]?.x).toBe((before.nodes[id]?.x ?? 0) + 90);
      expect(restored.nodes[id]?.y).toBe((before.nodes[id]?.y ?? 0) - 30);
    }
  });
  it("supports nested groups and avoids moving a selected child twice", () => {
    const document = fixture();
    const first = groupSelection(
      document,
      new Set(["a", "b"] as NodeId[]),
      groupId,
      "Inside",
    );
    const outerId = "outer" as NodeId;
    const nested = groupSelection(
      first,
      new Set([groupId, "c" as NodeId]),
      outerId,
      "Outside",
    );
    const world = worldDocument(nested);
    expect(world.nodes["b" as NodeId]?.x).toBe(
      document.nodes["b" as NodeId]?.x,
    );
    expect(
      selectionRoots(nested, new Set([outerId, groupId, "a" as NodeId])).map(
        (node) => node.id,
      ),
    ).toEqual([outerId]);
    const inner = world.nodes[groupId];
    const outer = world.nodes[outerId];
    if (!inner || !outer) throw new Error("Missing group");
    const innerBox = groupBounds(world, inner);
    const outerBox = groupBounds(world, outer);
    expect(outerBox.y).toBeLessThan(innerBox.y);
    expect(outerBox.x + outerBox.width).toBeGreaterThan(
      innerBox.x + innerBox.width,
    );
    const restored = ungroupSelection(nested, new Set([groupId]));
    expect(descendantIds(restored, outerId)).toEqual(
      new Set([outerId, ...ids]),
    );
    expect(worldDocument(restored).nodes["a" as NodeId]?.x).toBe(
      document.nodes["a" as NodeId]?.x,
    );
  });
  it.each(["left", "center", "right", "top", "middle", "bottom"] as const)(
    "aligns %s using the full selection",
    (alignment) => {
      const aligned = worldDocument(alignSelection(fixture(), ids, alignment));
      const values = Object.values(aligned.nodes).map((node) => {
        if (alignment === "left") return node.x;
        if (alignment === "center") return node.x + node.width / 2;
        if (alignment === "right") return node.x + node.width;
        if (alignment === "top") return node.y;
        if (alignment === "middle") return node.y + node.height / 2;
        return node.y + node.height;
      });
      expect(new Set(values).size).toBe(1);
    },
  );
  it("tidies into an evenly spaced row without changing order, size or the selection center", () => {
    const before = fixture();
    const next = alignSelection(before, ids, "tidy");
    const [a, b, c] = [...ids].map((id) => next.nodes[id]);
    if (!a || !b || !c) throw new Error("Missing fixture");
    expect(
      new Set([a.y + a.height / 2, b.y + b.height / 2, c.y + c.height / 2])
        .size,
    ).toBe(1);
    expect(b.x - a.x - a.width).toBe(c.x - b.x - b.width);
    expect(a.x).toBe(100);
    expect(c.x + c.width).toBe(660);
    expect(before.nodes["b" as NodeId]?.y).toBe(160);
    expect([a.width, b.width, c.width]).toEqual([80, 120, 60]);
  });
  it("chooses a column for staggered wide cards instead of spreading them off to the sides", () => {
    const before = fixture();
    for (const [index, node] of Object.values(before.nodes).entries()) {
      node.width = 200;
      node.x = index ? 300 : 100;
      node.y = [160, 50, 270][index] ?? 0;
    }
    const next = alignSelection(before, ids, "tidy");
    expect(
      new Set(Object.values(next.nodes).map((node) => node.x + node.width / 2))
        .size,
    ).toBe(1);
    expect(Math.min(...Object.values(next.nodes).map((node) => node.y))).toBe(
      50,
    );
    expect(
      Math.max(
        ...Object.values(next.nodes).map((node) => node.y + node.height),
      ),
    ).toBe(330);
  });
  it("tidies an overlapping column with usable gaps and keeps its center", () => {
    const before = fixture();
    for (const [index, node] of Object.values(before.nodes).entries()) {
      node.x = index * 2 + 100;
      node.y = index * 20;
    }
    const next = alignSelection(before, ids, "tidy");
    const [a, b, c] = [...ids].map((id) => next.nodes[id]);
    if (!a || !b || !c) throw new Error("Missing fixture");
    expect(
      new Set([a.x + a.width / 2, b.x + b.width / 2, c.x + c.width / 2]).size,
    ).toBe(1);
    expect(b.y - a.y - a.height).toBe(24);
    expect(c.y - b.y - b.height).toBe(24);
    expect((a.y + c.y + c.height) / 2).toBe(50);
  });
  it("distributes equal edge gaps for differently sized nodes and preserves the outer edges", () => {
    const aligned = alignSelection(fixture(), ids, "horizontal");
    const [a, b, c] = [...ids].map((id) => aligned.nodes[id]);
    if (!a || !b || !c) throw new Error("Missing node");
    expect(a.x).toBe(100);
    expect(c.x + c.width).toBe(660);
    expect(b.x - a.x - a.width).toBe(c.x - b.x - b.width);
  });
  it("aligns children in world coordinates while preserving their parent", () => {
    const grouped = groupSelection(fixture(), ids, groupId, "Group");
    const aligned = alignSelection(grouped, ids, "right");
    expect(
      new Set(
        Object.values(worldDocument(aligned).nodes)
          .filter((node) => node.type !== "group")
          .map((node) => node.x + node.width),
      ).size,
    ).toBe(1);
    expect(aligned.nodes["a" as NodeId]?.parentId).toBe(groupId);
  });
  it("deletes grouped content and attached arrows, and duplicates internal connections with new ids", () => {
    const document = createMicroservicesTemplate();
    const shapes = new Set(
      Object.values(document.nodes)
        .filter((node) => node.type !== "arrow")
        .map((node) => node.id),
    );
    const grouped = groupSelection(document, shapes, groupId, "Architecture");
    let serial = 0;
    const copied = duplicateSelection(
      grouped,
      new Set([groupId]),
      (type) => `${type}-copy-${String(serial++)}` as NodeId,
    );
    const newGroup = [...copied.selected][0];
    expect(newGroup).toBeDefined();
    const newIds = newGroup
      ? descendantIds(copied.document, newGroup)
      : new Set<NodeId>();
    const oldArrows = Object.values(document.nodes).filter(
      (node) => node.type === "arrow",
    );
    const arrows = Object.values(copied.document.nodes).filter(
      (node) => node.type === "arrow" && !document.nodes[node.id],
    );
    expect(arrows.length).toBe(oldArrows.length);
    for (const arrow of arrows)
      if (arrow.type === "arrow") {
        expect(newIds.has(arrow.data.sourceId)).toBe(true);
        expect(newIds.has(arrow.data.targetId)).toBe(true);
      }
    const deleted = deleteSelection(copied.document, new Set([groupId]));
    for (const id of Object.keys(grouped.nodes))
      expect(deleted.nodes[id as NodeId]).toBeUndefined();
    expect(Object.keys(deleted.nodes).length).toBeGreaterThan(0);
  });
  it("rejects grouping across pages and handles malformed cyclic parent references", () => {
    const document = fixture();
    const b = document.nodes["b" as NodeId];
    if (!b) throw new Error("Missing node");
    document.nodes[b.id] = { ...b, pageId: "page-other" };
    expect(groupSelection(document, ids, groupId, "Invalid")).toBe(document);
    document.nodes[b.id] = { ...b, parentId: b.id };
    expect(worldDocument(document).nodes[b.id]?.x).toBe(b.x);
    expect(selectionRoots(document, new Set([b.id]))).toHaveLength(1);
  });
});
