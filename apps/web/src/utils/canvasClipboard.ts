import type {
  CanvasDocument,
  CanvasNode,
  DocumentId,
  NodeId,
  PageId,
  Point2D,
} from "@talweg/core";
import type { IndexedDBStorageAdapter } from "@talweg/storage";
import { uint8ArrayToBase64, base64ToUint8Array } from "@talweg/storage";
import {
  descendantIds,
  selectionRoots,
  worldDocument,
} from "./organizeCanvas.js";

export const FRAGMENT_PREFIX = "talweg-fragment:1\n";
export interface CanvasFragment {
  version: 1;
  source: DocumentId;
  nodes: CanvasNode[];
  roots: NodeId[];
  assets: { id: string; mimeType: string; bytes: string }[];
}
export async function copyFragment(
  document: CanvasDocument,
  selected: ReadonlySet<NodeId>,
  adapter: IndexedDBStorageAdapter,
): Promise<string> {
  const ids = new Set(selected);
  for (const id of selected) {
    const node = document.nodes[id];
    if (node?.type === "arrow") {
      ids.add(node.data.sourceId);
      ids.add(node.data.targetId);
    }
  }
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
  const displayed = worldDocument(document);
  const nodes = [...copied].flatMap((id) => {
    const source = document.nodes[id];
    if (!source) return [];
    const node = structuredClone(source);
    const world = displayed.nodes[id];
    if (node.parentId && !copied.has(node.parentId) && world) {
      node.x = world.x;
      node.y = world.y;
      node.parentId = null;
    }
    return [node];
  });
  const assets: CanvasFragment["assets"] = [];
  const assetIds = new Set(
    nodes.flatMap((node) => [
      ...(node.type === "image" ? [node.data.assetId] : []),
      ...Array.from(
        (node.note ?? "").matchAll(/asset:([a-f\d]{64})/g),
        (match) => match[1] ?? "",
      ),
    ]),
  );
  for (const id of assetIds) {
    const asset = await adapter.getAsset(id);
    if (!asset) throw new Error("Missing image");
    assets.push({
      id,
      mimeType: asset.mimeType,
      bytes: uint8ArrayToBase64(new Uint8Array(asset.data)),
    });
  }
  const fragment: CanvasFragment = {
    version: 1,
    source: document.id,
    nodes,
    roots: nodes.filter((node) => !node.parentId).map((node) => node.id),
    assets,
  };
  const text = FRAGMENT_PREFIX + JSON.stringify(fragment);
  if (text.length > 64 * 1024 * 1024) throw new Error("Fragment too large");
  return text;
}
function validStyle(style: unknown): boolean {
  return typeof style === "object" && style !== null && !Array.isArray(style);
}
export function parseFragment(text: string): CanvasFragment {
  if (!text.startsWith(FRAGMENT_PREFIX) || text.length > 64 * 1024 * 1024)
    throw new Error("Invalid fragment");
  const fragment = JSON.parse(text.slice(FRAGMENT_PREFIX.length)) as Omit<
    CanvasFragment,
    "version"
  > & { version: number };
  if (
    fragment.version !== 1 ||
    typeof fragment.source !== "string" ||
    !Array.isArray(fragment.nodes) ||
    fragment.nodes.length > 10000 ||
    !Array.isArray(fragment.roots) ||
    !Array.isArray(fragment.assets)
  )
    throw new Error("Invalid fragment");
  const ids = new Set<NodeId>();
  const supported = new Set([
    "rectangle",
    "ellipse",
    "diamond",
    "capsule",
    "cylinder",
    "text",
    "sticker",
    "card",
    "markdown",
    "table",
    "checklist",
    "image",
    "freehand",
    "group",
    "arrow",
  ]);
  for (const node of fragment.nodes) {
    if (
      typeof node.id !== "string" ||
      ids.has(node.id) ||
      !supported.has(node.type) ||
      ![
        node.x,
        node.y,
        node.width,
        node.height,
        node.rotation,
        node.zIndex,
        node.opacity,
      ].every(Number.isFinite) ||
      node.width < 0 ||
      node.height < 0 ||
      !validStyle(node.style)
    )
      throw new Error("Invalid node");
    if (
      node.type === "table" &&
      (!Array.isArray(node.data.cells) ||
        node.data.cells.some(
          (row) =>
            !Array.isArray(row) || row.some((cell) => typeof cell !== "string"),
        ))
    )
      throw new Error("Invalid table");
    if (
      (node.type === "text" && typeof node.data.text !== "string") ||
      (node.type === "image" && typeof node.data.assetId !== "string") ||
      (node.type === "checklist" &&
        (!Array.isArray(node.data.items) ||
          node.data.items.some(
            (item) =>
              typeof item.id !== "string" || typeof item.text !== "string",
          ))) ||
      (node.type === "freehand" &&
        (!Array.isArray(node.data.points) ||
          node.data.points.some((point: unknown) => {
            const coordinate = point as { x: number; y: number };
            return (
              !Number.isFinite(coordinate.x) || !Number.isFinite(coordinate.y)
            );
          }))) ||
      (node.type === "group" && !Array.isArray(node.data.childIds))
    )
      throw new Error("Invalid content");
    if (
      node.note !== undefined &&
      node.note !== null &&
      typeof node.note !== "string"
    )
      throw new Error("Invalid note");
    const content: unknown = node.data;
    if (content !== undefined && content !== null) {
      if (typeof content !== "object" || Array.isArray(content))
        throw new Error("Invalid content");
      const fields = content as Record<string, unknown>;
      for (const key of ["label", "text", "title", "content"])
        if (fields[key] !== undefined && typeof fields[key] !== "string")
          throw new Error("Invalid text");
    }
    ids.add(node.id);
  }
  for (const node of fragment.nodes) {
    if (
      (node.parentId && !ids.has(node.parentId)) ||
      (node.type === "group" &&
        node.data.childIds.some((id) => !ids.has(id))) ||
      (node.type === "arrow" &&
        (!ids.has(node.data.sourceId) || !ids.has(node.data.targetId)))
    )
      throw new Error("Dangling reference");
    const visited = new Set([node.id]);
    let parent = node.parentId;
    while (parent) {
      if (visited.has(parent)) throw new Error("Cyclic group");
      visited.add(parent);
      parent =
        fragment.nodes.find((node) => node.id === parent)?.parentId ?? null;
    }
  }
  if (fragment.roots.some((id) => !ids.has(id)))
    throw new Error("Invalid roots");
  for (const asset of fragment.assets)
    if (
      !/^[a-f\d]{64}$/.test(asset.id) ||
      typeof asset.bytes !== "string" ||
      !asset.mimeType.startsWith("image/")
    )
      throw new Error("Invalid asset");
  return fragment as CanvasFragment;
}
export async function storeFragmentAssets(
  fragment: CanvasFragment,
  adapter: IndexedDBStorageAdapter,
): Promise<void> {
  for (const asset of fragment.assets) {
    const bytes = base64ToUint8Array(asset.bytes);
    const id = await adapter.saveAsset(
      new Blob([bytes.buffer as ArrayBuffer], { type: asset.mimeType }),
    );
    if (id !== asset.id) throw new Error("Image checksum mismatch");
  }
}
export function pasteFragment(
  document: CanvasDocument,
  fragment: CanvasFragment,
  pageId: PageId,
  at: Point2D,
): { document: CanvasDocument; selected: Set<NodeId> } {
  const mapping = new Map(
    fragment.nodes.map((node) => [
      node.id,
      `${node.type}-${crypto.randomUUID()}` as NodeId,
    ]),
  );
  const roots = fragment.nodes.filter(
    (node) => !node.parentId && node.type !== "arrow",
  );
  const minX = roots.length ? Math.min(...roots.map((node) => node.x)) : 0;
  const minY = roots.length ? Math.min(...roots.map((node) => node.y)) : 0;
  const dx = at.x - minX;
  const dy = at.y - minY;
  const rewrite = (href: string): string => {
    if (!href.startsWith("/board/")) return href;
    const url = new URL(href, "https://talweg.invalid");
    const old = url.searchParams.get("node") as NodeId | null;
    if (!old || !mapping.has(old)) return href;
    url.pathname = `/board/${encodeURIComponent(document.id)}/page/${encodeURIComponent(pageId)}`;
    url.searchParams.set("node", mapping.get(old) ?? old);
    url.searchParams.delete("room");
    url.hash = "";
    return url.pathname + url.search;
  };
  const nodes = { ...document.nodes };
  const added: NodeId[] = [];
  const selected = new Set<NodeId>();
  for (const original of fragment.nodes) {
    const id = mapping.get(original.id);
    if (!id) continue;
    const parentId = original.parentId
      ? (mapping.get(original.parentId) ?? null)
      : null;
    let node: CanvasNode = {
      ...structuredClone(original),
      id,
      parentId,
      pageId,
      x: original.x + (parentId ? 0 : dx),
      y: original.y + (parentId ? 0 : dy),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (node.type === "table")
      node = {
        ...node,
        data: {
          ...node.data,
          rowIds: node.data.cells.map(() => crypto.randomUUID()),
          columnIds: Array.from(
            { length: node.data.cells[0]?.length ?? 1 },
            () => crypto.randomUUID(),
          ),
        },
      };
    if (node.type === "group")
      node = {
        ...node,
        data: {
          ...node.data,
          childIds: node.data.childIds.flatMap((id) => mapping.get(id) ?? []),
        },
      };
    if (node.type === "arrow")
      node = {
        ...node,
        data: {
          ...node.data,
          sourceId: mapping.get(node.data.sourceId) ?? node.data.sourceId,
          targetId: mapping.get(node.data.targetId) ?? node.data.targetId,
        },
      };
    if (node.type === "checklist")
      node = {
        ...node,
        data: {
          ...node.data,
          items: node.data.items.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
          })),
        },
      };
    if (node.textRuns)
      node.textRuns = Object.fromEntries(
        Object.entries(node.textRuns).map(([field, runs]) => [
          field,
          runs.map((run) =>
            run.href ? { ...run, href: rewrite(run.href) } : run,
          ),
        ]),
      );
    if (node.note)
      node.note = node.note.replace(
        /\]\((\/board\/[^\s)]+)\)/g,
        (_match: string, href: string) => `](${rewrite(href)})`,
      );
    nodes[id] = node;
    if (!parentId) {
      added.push(id);
      selected.add(id);
    }
  }
  return {
    document: {
      ...document,
      nodes,
      rootNodeIds: [...document.rootNodeIds, ...added],
    },
    selected,
  };
}
