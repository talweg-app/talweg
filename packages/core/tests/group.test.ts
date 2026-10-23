import { describe, expect, it } from "vitest";
import { computeGroupBounds, groupNodes, ungroupNodes } from "../src/index.js";
import type {
  CanvasDocument,
  CanvasGroup,
  CanvasNode,
  DocumentId,
  GroupId,
  NodeId,
  RectangleNode,
} from "../src/index.js";

interface NodeOverrides {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  parentId?: GroupId | null;
}

function rectangle(id: string, overrides: NodeOverrides = {}): RectangleNode {
  return {
    id: id as NodeId,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 0,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {},
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function documentWith(
  nodes: readonly CanvasNode[],
  rootNodeIds: readonly NodeId[] = nodes.map((node) => node.id),
): CanvasDocument {
  const nodesById: Record<NodeId, CanvasNode> = {};
  for (const node of nodes) nodesById[node.id] = node;

  return {
    id: "doc-1" as DocumentId,
    schemaVersion: 1,
    name: "Test document",
    nodes: nodesById,
    rootNodeIds,
    viewport: { x: 0, y: 0, zoom: 1 },
    grid: { enabled: true, size: 10, snapToGrid: false, gridType: "dots" },
    meta: { createdAt: 0, updatedAt: 0, version: 1 },
  };
}

function requireGroup(document: CanvasDocument, groupId: GroupId): CanvasGroup {
  const node = document.nodes[groupId];
  if (node?.type !== "group") throw new Error(`missing group ${groupId}`);
  return node;
}

function requireNode(document: CanvasDocument, nodeId: NodeId): CanvasNode {
  const node = document.nodes[nodeId];
  if (!node) throw new Error(`missing node ${nodeId}`);
  return node;
}

describe("computeGroupBounds", () => {
  it("wraps multiple unrotated nodes in a single AABB", () => {
    const bounds = computeGroupBounds([
      rectangle("a", { x: 100, y: 100, width: 50, height: 50 }),
      rectangle("b", { x: 200, y: 150, width: 50, height: 50 }),
    ]);

    expect(bounds).toEqual({
      minX: 100,
      minY: 100,
      maxX: 250,
      maxY: 200,
      width: 150,
      height: 100,
    });
  });

  it("accounts for node rotation", () => {
    const bounds = computeGroupBounds([
      rectangle("rotated", { x: 10, y: 20, width: 100, height: 50, rotation: 90 }),
    ]);

    expect(bounds.minX).toBeCloseTo(-40, 6);
    expect(bounds.minY).toBeCloseTo(20, 6);
    expect(bounds.maxX).toBeCloseTo(10, 6);
    expect(bounds.maxY).toBeCloseTo(120, 6);
    expect(bounds.width).toBeCloseTo(50, 6);
    expect(bounds.height).toBeCloseTo(100, 6);
  });

  it("returns a zero box for an empty node list", () => {
    expect(computeGroupBounds([])).toEqual({
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    });
  });
});

describe("groupNodes", () => {
  const groupId = "group-1" as GroupId;

  it("creates a group and moves children into local coordinates", () => {
    const first = rectangle("a", { x: 100, y: 100, width: 50, height: 50, zIndex: 2 });
    const second = rectangle("b", { x: 200, y: 150, width: 50, height: 50, zIndex: 5 });
    const outside = rectangle("c", { x: 500, y: 500 });
    const document = documentWith([first, second, outside]);
    const startedAt = Date.now();

    const grouped = groupNodes(document, [first.id, second.id], groupId);
    const group = requireGroup(grouped, groupId);

    expect(group).toMatchObject({
      x: 100,
      y: 100,
      width: 150,
      height: 100,
      rotation: 0,
      zIndex: 5,
      opacity: 1,
      parentId: null,
      isLocked: false,
      isVisible: true,
    });
    expect(group.data.childIds).toEqual([first.id, second.id]);
    expect(group.data.boundingBoxMode).toBe("dynamic");
    expect(group.createdAt).toBeGreaterThanOrEqual(startedAt);
    expect(group.updatedAt).toBe(group.createdAt);

    expect(requireNode(grouped, first.id)).toMatchObject({ x: 0, y: 0, parentId: groupId });
    expect(requireNode(grouped, second.id)).toMatchObject({
      x: 100,
      y: 50,
      parentId: groupId,
    });
    expect(requireNode(grouped, first.id).updatedAt).toBe(group.createdAt);
    expect(requireNode(grouped, outside.id)).toBe(outside);
    expect(grouped.rootNodeIds).toEqual([outside.id, groupId]);
    expect(document.nodes[first.id]).toBe(first);
  });

  it("wraps a single node with zero local offset", () => {
    const node = rectangle("a", { x: 30, y: 40, width: 20, height: 10 });
    const grouped = groupNodes(documentWith([node]), [node.id], groupId);
    const group = requireGroup(grouped, groupId);

    expect(group).toMatchObject({ x: 30, y: 40, width: 20, height: 10 });
    expect(requireNode(grouped, node.id)).toMatchObject({ x: 0, y: 0, parentId: groupId });
  });

  it("returns the document unchanged for an empty selection", () => {
    const document = documentWith([rectangle("a")]);

    expect(groupNodes(document, [], groupId)).toBe(document);
  });

  it("returns the document unchanged when a selected node is missing", () => {
    const document = documentWith([rectangle("a")]);

    expect(groupNodes(document, ["missing" as NodeId], groupId)).toBe(document);
  });

  it("returns the document unchanged when the group id is already taken", () => {
    const existing = rectangle("a");
    const document = documentWith([existing]);

    expect(groupNodes(document, [existing.id], existing.id)).toBe(document);
  });
});

describe("ungroupNodes", () => {
  const groupId = "group-1" as GroupId;

  function groupedDocument(): {
    document: CanvasDocument;
    first: RectangleNode;
    second: RectangleNode;
    outside: RectangleNode;
  } {
    const first = rectangle("a", { x: 100, y: 100, width: 50, height: 50 });
    const second = rectangle("b", { x: 200, y: 150, width: 50, height: 50 });
    const outside = rectangle("c", { x: 500, y: 500 });
    const document = documentWith([first, second, outside]);

    return {
      document: groupNodes(document, [first.id, second.id], groupId),
      first,
      second,
      outside,
    };
  }

  it("restores children to their original coordinates and removes the group", () => {
    const { document, first, second, outside } = groupedDocument();
    const ungrouped = ungroupNodes(document, groupId);

    expect(ungrouped.nodes[groupId]).toBeUndefined();
    expect(requireNode(ungrouped, first.id)).toMatchObject({
      x: 100,
      y: 100,
      parentId: null,
    });
    expect(requireNode(ungrouped, second.id)).toMatchObject({
      x: 200,
      y: 150,
      parentId: null,
    });
    expect(ungrouped.rootNodeIds).toEqual([outside.id, first.id, second.id]);
  });

  it("returns the document unchanged for a missing group", () => {
    const { document } = groupedDocument();

    expect(ungroupNodes(document, "missing" as GroupId)).toBe(document);
  });

  it("returns the document unchanged when the id belongs to a non-group node", () => {
    const { document, first } = groupedDocument();

    expect(ungroupNodes(document, first.id)).toBe(document);
  });

  it("skips child ids that no longer resolve", () => {
    const { document, first } = groupedDocument();
    const group = requireGroup(document, groupId);
    const withMissingChild: CanvasGroup = {
      ...group,
      data: { ...group.data, childIds: [first.id, "missing" as NodeId] },
    };
    const corrupted: CanvasDocument = {
      ...document,
      nodes: { ...document.nodes, [groupId]: withMissingChild },
      rootNodeIds: [groupId],
    };

    expect(ungroupNodes(corrupted, groupId).rootNodeIds).toEqual([first.id]);
  });

  it("keeps children nested when the group itself is nested", () => {
    const { document, first } = groupedDocument();
    const parent = rectangle("parent");
    const group = requireGroup(document, groupId);
    const nested: CanvasDocument = {
      ...document,
      nodes: {
        ...document.nodes,
        [groupId]: { ...group, parentId: parent.id },
        [parent.id]: parent,
      },
      rootNodeIds: [parent.id],
    };

    const ungrouped = ungroupNodes(nested, groupId);

    expect(requireNode(ungrouped, first.id).parentId).toBe(parent.id);
    expect(ungrouped.rootNodeIds).toEqual([parent.id]);
  });
});

describe("moving a group", () => {
  it("changes only the group position and leaves children untouched", () => {
    const groupId = "group-1" as GroupId;
    const first = rectangle("a", { x: 100, y: 100 });
    const second = rectangle("b", { x: 300, y: 250 });
    const grouped = groupNodes(documentWith([first, second]), [first.id, second.id], groupId);
    const group = requireGroup(grouped, groupId);
    const firstBefore = requireNode(grouped, first.id);
    const secondBefore = requireNode(grouped, second.id);

    const moved: CanvasDocument = {
      ...grouped,
      nodes: { ...grouped.nodes, [groupId]: { ...group, x: 900, y: 800 } },
    };

    expect(requireGroup(moved, groupId)).toMatchObject({ x: 900, y: 800 });
    expect(requireNode(moved, first.id)).toBe(firstBefore);
    expect(requireNode(moved, second.id)).toBe(secondBefore);
    expect(requireNode(moved, first.id)).toMatchObject({ x: 0, y: 0, parentId: groupId });
    expect(requireNode(moved, second.id)).toMatchObject({ x: 200, y: 150, parentId: groupId });
  });
});
