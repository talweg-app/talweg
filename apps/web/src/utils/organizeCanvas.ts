import {
  computeGroupBounds,
  groupNodes,
  type CanvasDocument,
  type CanvasNode,
  type NodeId,
  type Point2D,
} from "@talweg/core";

export type Alignment =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "horizontal"
  | "vertical";

export function descendantIds(
  document: CanvasDocument,
  id: NodeId,
): Set<NodeId> {
  const ids = new Set<NodeId>();
  const visit = (current: NodeId) => {
    if (ids.has(current) || !document.nodes[current]) return;
    ids.add(current);
    const node = document.nodes[current];
    if (node.type === "group") node.data.childIds.forEach(visit);
  };
  visit(id);
  return ids;
}

export function selectionRoots(
  document: CanvasDocument,
  ids: ReadonlySet<NodeId>,
): CanvasNode[] {
  return [...ids].flatMap((id) => {
    const node = document.nodes[id];
    if (!node) return [];
    let parent = node.parentId;
    const visited = new Set<NodeId>([id]);
    while (parent && !visited.has(parent)) {
      if (ids.has(parent)) return [];
      visited.add(parent);
      parent = document.nodes[parent]?.parentId ?? null;
    }
    return [node];
  });
}

export function worldDocument(document: CanvasDocument): CanvasDocument {
  const nodes = Object.fromEntries(
    Object.values(document.nodes).map((node) => {
      let x = node.x;
      let y = node.y;
      let parent = node.parentId;
      const visited = new Set<NodeId>([node.id]);
      while (parent && !visited.has(parent)) {
        visited.add(parent);
        const group = document.nodes[parent];
        if (!group) break;
        x += group.x;
        y += group.y;
        parent = group.parentId;
      }
      return [node.id, { ...node, x, y }];
    }),
  );
  return { ...document, nodes };
}

export function groupBounds(document: CanvasDocument, node: CanvasNode) {
  const visited = new Set<NodeId>();
  const measure = (
    group: CanvasNode,
  ): { x: number; y: number; width: number; height: number } => {
    visited.add(group.id);
    const children =
      group.type === "group"
        ? group.data.childIds.flatMap((id) => {
            const child = document.nodes[id];
            if (!child || child.type === "arrow" || visited.has(id)) return [];
            return [
              child.type === "group" ? { ...child, ...measure(child) } : child,
            ];
          })
        : [];
    const bounds = computeGroupBounds(children.length ? children : [group]);
    visited.delete(group.id);
    return {
      x: bounds.minX - 24,
      y: bounds.minY - 44,
      width: bounds.width + 48,
      height: bounds.height + 68,
    };
  };
  return measure(node);
}

export function groupSelection(
  document: CanvasDocument,
  ids: ReadonlySet<NodeId>,
  id: NodeId,
  title: string,
): CanvasDocument {
  const nodes = selectionRoots(document, ids).filter(
    (node) => node.type !== "arrow",
  );
  if (
    nodes.length < 2 ||
    nodes.some(
      (node) =>
        node.parentId !== null ||
        (node.pageId ?? "page-1") !== (nodes[0]?.pageId ?? "page-1"),
    )
  )
    return document;
  const grouped = groupNodes(
    document,
    nodes.map((node) => node.id),
    id,
  );
  const group = grouped.nodes[id];
  if (!group) return document;
  return {
    ...grouped,
    nodes: {
      ...grouped.nodes,
      [id]: { ...group, pageId: nodes[0]?.pageId ?? "page-1", meta: { title } },
    },
  };
}

export function ungroupSelection(
  document: CanvasDocument,
  ids: ReadonlySet<NodeId>,
): CanvasDocument {
  const nodes = { ...document.nodes };
  let roots = [...document.rootNodeIds];
  for (const id of ids) {
    const group = nodes[id];
    if (group?.type !== "group") continue;
    for (const childId of group.data.childIds) {
      const child = nodes[childId];
      if (child)
        nodes[childId] = {
          ...child,
          x: child.x + group.x,
          y: child.y + group.y,
          parentId: group.parentId,
        };
    }
    const parent = group.parentId ? nodes[group.parentId] : null;
    if (parent?.type === "group")
      nodes[parent.id] = {
        ...parent,
        data: {
          ...parent.data,
          childIds: parent.data.childIds.flatMap((child) =>
            child === id ? [...group.data.childIds] : [child],
          ),
        },
      };
    roots = roots.flatMap((root) =>
      root === id ? [...group.data.childIds] : [root],
    );
    Reflect.deleteProperty(nodes, id);
  }
  return { ...document, nodes, rootNodeIds: roots };
}

export function movedWorldDocument(
  document: CanvasDocument,
  positions: ReadonlyMap<NodeId, Point2D>,
): CanvasDocument {
  const nodes = { ...document.nodes };
  for (const root of selectionRoots(document, new Set(positions.keys()))) {
    const point = positions.get(root.id);
    if (!point) continue;
    const dx = point.x - root.x;
    const dy = point.y - root.y;
    for (const id of descendantIds(document, root.id)) {
      const node = document.nodes[id];
      if (node) nodes[id] = { ...node, x: node.x + dx, y: node.y + dy };
    }
  }
  return { ...document, nodes };
}

export function alignSelection(
  document: CanvasDocument,
  ids: ReadonlySet<NodeId>,
  alignment: Alignment,
): CanvasDocument {
  const world = worldDocument(document);
  const selected = selectionRoots(world, ids).filter(
    (node) => node.type !== "arrow" && !node.isLocked,
  );
  if (selected.length < 2) return document;
  const boxes = selected.map((node) => ({
    node,
    box:
      node.type === "group"
        ? groupBounds(world, node)
        : { x: node.x, y: node.y, width: node.width, height: node.height },
  }));
  const left = Math.min(...boxes.map((item) => item.box.x));
  const top = Math.min(...boxes.map((item) => item.box.y));
  const right = Math.max(...boxes.map((item) => item.box.x + item.box.width));
  const bottom = Math.max(...boxes.map((item) => item.box.y + item.box.height));
  const positions = new Map<NodeId, Point2D>();
  if (alignment === "horizontal" || alignment === "vertical") {
    if (boxes.length < 3) return document;
    const horizontal = alignment === "horizontal";
    const sorted = [...boxes].sort((a, b) =>
      horizontal ? a.box.x - b.box.x : a.box.y - b.box.y,
    );
    const total = sorted.reduce(
      (sum, item) => sum + (horizontal ? item.box.width : item.box.height),
      0,
    );
    const gap =
      ((horizontal ? right - left : bottom - top) - total) /
      (sorted.length - 1);
    let cursor = horizontal ? left : top;
    for (const { node, box } of sorted) {
      positions.set(node.id, {
        x: horizontal ? node.x + cursor - box.x : node.x,
        y: horizontal ? node.y : node.y + cursor - box.y,
      });
      cursor += (horizontal ? box.width : box.height) + gap;
    }
  } else {
    for (const { node, box } of boxes) {
      let x = node.x;
      let y = node.y;
      if (alignment === "left") x += left - box.x;
      if (alignment === "center") x += (left + right - box.width) / 2 - box.x;
      if (alignment === "right") x += right - box.width - box.x;
      if (alignment === "top") y += top - box.y;
      if (alignment === "middle") y += (top + bottom - box.height) / 2 - box.y;
      if (alignment === "bottom") y += bottom - box.height - box.y;
      positions.set(node.id, { x, y });
    }
  }
  const nodes = { ...document.nodes };
  for (const [id, point] of positions) {
    const node = document.nodes[id];
    const displayed = world.nodes[id];
    if (node && displayed)
      nodes[id] = {
        ...node,
        x: node.x + point.x - displayed.x,
        y: node.y + point.y - displayed.y,
      };
  }
  return { ...document, nodes };
}

export function deleteSelection(
  document: CanvasDocument,
  ids: ReadonlySet<NodeId>,
): CanvasDocument {
  const removed = new Set(
    [...ids].flatMap((id) => [...descendantIds(document, id)]),
  );
  for (const node of Object.values(document.nodes))
    if (
      node.type === "arrow" &&
      (removed.has(node.data.sourceId) || removed.has(node.data.targetId))
    )
      removed.add(node.id);
  const nodes = Object.fromEntries(
    Object.values(document.nodes)
      .filter((node) => !removed.has(node.id))
      .map((node) => [
        node.id,
        node.type === "group"
          ? {
              ...node,
              data: {
                ...node.data,
                childIds: node.data.childIds.filter((id) => !removed.has(id)),
              },
            }
          : node,
      ]),
  );
  return {
    ...document,
    nodes,
    rootNodeIds: document.rootNodeIds.filter((id) => !removed.has(id)),
  };
}

export function duplicateSelection(
  document: CanvasDocument,
  ids: ReadonlySet<NodeId>,
  createId: (type: string) => NodeId,
): { document: CanvasDocument; selected: Set<NodeId> } {
  const roots = selectionRoots(document, ids).filter(
    (node) => node.type !== "arrow",
  );
  const copied = new Set(
    roots.flatMap((node) => [...descendantIds(document, node.id)]),
  );
  for (const node of Object.values(document.nodes))
    if (
      node.type === "arrow" &&
      copied.has(node.data.sourceId) &&
      copied.has(node.data.targetId)
    )
      copied.add(node.id);
  const mapping = new Map(
    [...copied].map((id) => [id, createId(document.nodes[id]?.type ?? "node")]),
  );
  const nodes = { ...document.nodes };
  const rootIds = new Set(roots.map((node) => node.id));
  const additions: NodeId[] = [];
  const displayed = worldDocument(document);
  for (const oldId of copied) {
    const node = document.nodes[oldId];
    const id = mapping.get(oldId);
    if (!node || !id) continue;
    const parentId = node.parentId
      ? (mapping.get(node.parentId) ?? null)
      : null;
    const world = displayed.nodes[oldId] ?? node;
    let copy: CanvasNode = {
      ...structuredClone(node),
      id,
      parentId,
      x: parentId ? node.x : world.x + 24,
      y: parentId ? node.y : world.y + 24,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (copy.type === "group")
      copy = {
        ...copy,
        data: {
          ...copy.data,
          childIds: copy.data.childIds.flatMap(
            (child) => mapping.get(child) ?? [],
          ),
        },
      };
    if (copy.type === "arrow")
      copy = {
        ...copy,
        data: {
          ...copy.data,
          sourceId: mapping.get(copy.data.sourceId) ?? copy.data.sourceId,
          targetId: mapping.get(copy.data.targetId) ?? copy.data.targetId,
        },
      };
    nodes[id] = copy;
    if (!parentId) additions.push(id);
  }
  return {
    document: {
      ...document,
      nodes,
      rootNodeIds: [...document.rootNodeIds, ...additions],
    },
    selected: new Set([...rootIds].flatMap((id) => mapping.get(id) ?? [])),
  };
}
