import type { CanvasDocument, NodeId, Point2D } from "@talweg/core";

const GAP_X = 140;
const GAP_Y = 28;

export function findMindmapRoot(document: CanvasDocument, nodeId: NodeId): NodeId {
  const parentMap = new Map<NodeId, NodeId>();
  for (const node of Object.values(document.nodes)) {
    if (node.type === "arrow") {
      parentMap.set(node.data.targetId, node.data.sourceId);
    }
  }

  let current = nodeId;
  const visited = new Set<NodeId>([current]);
  while (parentMap.has(current)) {
    const parent = parentMap.get(current);
    if (!parent || visited.has(parent)) break;
    visited.add(parent);
    current = parent;
  }
  return current;
}

export function layoutMindmapTree(
  document: CanvasDocument,
  rootId?: NodeId,
): Map<NodeId, Point2D> {
  const childrenMap = new Map<NodeId, NodeId[]>();
  const parentMap = new Map<NodeId, NodeId>();

  for (const node of Object.values(document.nodes)) {
    if (node.type === "arrow") {
      const { sourceId, targetId } = node.data;
      const existing = childrenMap.get(sourceId);
      if (existing) {
        existing.push(targetId);
      } else {
        childrenMap.set(sourceId, [targetId]);
      }
      parentMap.set(targetId, sourceId);
    }
  }

  const effectiveRootId = rootId
    ? findMindmapRoot(document, rootId)
    : (Object.keys(document.nodes).find((id) => {
        const node = document.nodes[id as NodeId];
        return node && node.type !== "arrow" && !parentMap.has(id as NodeId);
      }) as NodeId | undefined);

  const positions = new Map<NodeId, Point2D>();
  if (!effectiveRootId) return positions;

  const rootNode = document.nodes[effectiveRootId];
  if (!rootNode) return positions;

  function getSubtreeHeight(id: NodeId): number {
    const node = document.nodes[id];
    if (!node) return 0;
    const children = childrenMap.get(id) ?? [];
    if (children.length === 0) {
      return node.height;
    }
    let total = 0;
    for (let i = 0; i < children.length; i++) {
      const childId = children[i];
      if (childId) {
        total += getSubtreeHeight(childId);
        if (i > 0) total += GAP_Y;
      }
    }
    return Math.max(node.height, total);
  }

  function placeSubtree(id: NodeId, x: number, centerY: number) {
    const node = document.nodes[id];
    if (!node) return;

    const y = Math.round(centerY - node.height / 2);
    positions.set(id, { x: Math.round(x), y });

    const children = childrenMap.get(id) ?? [];
    if (children.length === 0) return;

    let totalChildrenHeight = 0;
    const subtreeHeights = children.map((cId) => {
      const h = getSubtreeHeight(cId);
      totalChildrenHeight += h;
      return h;
    });
    totalChildrenHeight += (children.length - 1) * GAP_Y;

    let currentY = centerY - totalChildrenHeight / 2;
    const childX = x + node.width + GAP_X;

    for (let i = 0; i < children.length; i++) {
      const childId = children[i];
      const subHeight = subtreeHeights[i] ?? 0;
      if (childId) {
        const childCenterY = currentY + subHeight / 2;
        placeSubtree(childId, childX, childCenterY);
        currentY += subHeight + GAP_Y;
      }
    }
  }

  placeSubtree(effectiveRootId, rootNode.x, rootNode.y + rootNode.height / 2);
  return positions;
}
