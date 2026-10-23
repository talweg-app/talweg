import type {
  BoundingBox,
  CanvasDocument,
  CanvasGroup,
  CanvasNode,
  GroupId,
  NodeId,
} from "./types.js";

export function computeGroupBounds(childNodes: readonly CanvasNode[]): BoundingBox {
  if (childNodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of childNodes) {
    const radians = (node.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const corners = [
      [0, 0],
      [node.width, 0],
      [node.width, node.height],
      [0, node.height],
    ] as const;

    for (const [offsetX, offsetY] of corners) {
      const x = node.x + offsetX * cos - offsetY * sin;
      const y = node.y + offsetX * sin + offsetY * cos;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function groupNodes(
  document: CanvasDocument,
  nodeIdsToGroup: readonly NodeId[],
  newGroupId: GroupId,
): CanvasDocument {
  if (nodeIdsToGroup.length === 0 || document.nodes[newGroupId]) return document;

  const children: CanvasNode[] = [];
  for (const nodeId of nodeIdsToGroup) {
    const node = document.nodes[nodeId];
    if (!node) return document;
    children.push(node);
  }

  const bounds = computeGroupBounds(children);
  const now = Date.now();
  const group: CanvasGroup = {
    id: newGroupId,
    type: "group",
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    zIndex: Math.max(...children.map((child) => child.zIndex)),
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {},
    data: {
      childIds: [...nodeIdsToGroup],
      boundingBoxMode: "dynamic",
    },
    createdAt: now,
    updatedAt: now,
  };

  const nodes: Record<NodeId, CanvasNode> = { ...document.nodes, [newGroupId]: group };

  for (const child of children) {
    nodes[child.id] = {
      ...child,
      x: child.x - bounds.minX,
      y: child.y - bounds.minY,
      parentId: newGroupId,
      updatedAt: now,
    };
  }

  const groupedIds = new Set<NodeId>(nodeIdsToGroup);
  const rootNodeIds = document.rootNodeIds.filter((nodeId) => !groupedIds.has(nodeId));
  rootNodeIds.push(newGroupId);

  return { ...document, nodes, rootNodeIds };
}

export function ungroupNodes(document: CanvasDocument, groupId: GroupId): CanvasDocument {
  const group = document.nodes[groupId];
  if (group?.type !== "group") return document;

  const nodes: Record<NodeId, CanvasNode> = {};
  for (const node of Object.values(document.nodes)) {
    if (node.id !== groupId) nodes[node.id] = node;
  }

  const restoredChildIds: NodeId[] = [];
  const now = Date.now();

  for (const childId of group.data.childIds) {
    const child = nodes[childId];
    if (!child) continue;

    nodes[childId] = {
      ...child,
      x: group.x + child.x,
      y: group.y + child.y,
      parentId: group.parentId,
      updatedAt: now,
    };
    restoredChildIds.push(childId);
  }

  const rootNodeIds = document.rootNodeIds.filter((nodeId) => nodeId !== groupId);
  if (group.parentId === null) {
    rootNodeIds.push(...restoredChildIds);
  }

  return { ...document, nodes, rootNodeIds };
}
