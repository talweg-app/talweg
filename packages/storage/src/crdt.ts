import type { CanvasDocument, CanvasNode, DocumentId, NodeId } from "@talweg/core";
import * as Y from "yjs";
import { TRANSACTION_ORIGINS } from "./types.js";

export const SCENE_NODES_KEY = "nodes";
export const SCENE_ROOT_ORDER_KEY = "rootOrder";
export const SCENE_META_KEY = "documentMeta";

export type SceneNodeMap = Y.Map<unknown>;
export type SceneNodesMap = Y.Map<SceneNodeMap>;
export type SceneRootOrder = Y.Array<string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toYValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return structuredClone(value);
  }

  if (isRecord(value)) {
    const map = new Y.Map<unknown>();

    for (const [key, nested] of Object.entries(value)) {
      if (nested !== undefined) {
        map.set(key, toYValue(nested));
      }
    }

    return map;
  }

  return value;
}

export function toPlainValue(value: unknown): unknown {
  if (value instanceof Y.Map) {
    const record: Record<string, unknown> = {};

    value.forEach((nested, key) => {
      if (key !== "__proto__" && key !== "constructor" && key !== "prototype") {
        record[key] = toPlainValue(nested);
      }
    });

    return record;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toPlainValue(item));
  }

  return value;
}

export function applyDocumentToYDoc(document: CanvasDocument, target: Y.Doc): void {
  const nodes = target.getMap<SceneNodeMap>(SCENE_NODES_KEY);
  const rootOrder = target.getArray<string>(SCENE_ROOT_ORDER_KEY);
  const metadata = target.getMap<unknown>(SCENE_META_KEY);

  target.transact(() => {
    nodes.clear();
    rootOrder.delete(0, rootOrder.length);
    metadata.clear();

    metadata.set("id", document.id);
    metadata.set("schemaVersion", document.schemaVersion);
    metadata.set("name", document.name);
    metadata.set("viewport", toYValue(document.viewport));
    metadata.set("grid", toYValue(document.grid));
    metadata.set("meta", toYValue(document.meta));
    if (document.activePageId !== undefined) {
      metadata.set("activePageId", document.activePageId);
    }
    if (document.pages !== undefined) {
      metadata.set("pages", toYValue(document.pages));
    }

    for (const node of Object.values(document.nodes)) {
      const nodeMap = new Y.Map<unknown>();

      for (const [key, value] of Object.entries(node)) {
        if (value !== undefined) {
          nodeMap.set(key, toYValue(value));
        }
      }

      nodes.set(node.id, nodeMap);
    }

    rootOrder.push([...document.rootNodeIds]);
  }, TRANSACTION_ORIGINS.STORAGE_HYDRATION);
}

export function documentToYDoc(document: CanvasDocument, target: Y.Doc = new Y.Doc()): Y.Doc {
  applyDocumentToYDoc(document, target);
  return target;
}

export function createSceneDoc(source?: CanvasDocument): Y.Doc {
  const document = new Y.Doc();

  if (source !== undefined) {
    applyDocumentToYDoc(source, document);
  }

  return document;
}

export function yDocToDocument(document: Y.Doc): CanvasDocument {
  const nodesMap = document.getMap<SceneNodeMap>(SCENE_NODES_KEY);
  const rootOrder = document.getArray<string>(SCENE_ROOT_ORDER_KEY);
  const metadata = document.getMap<unknown>(SCENE_META_KEY);
  const nodes: Record<NodeId, CanvasNode> = {};

  nodesMap.forEach((nodeMap, nodeId) => {
    nodes[nodeId as NodeId] = toPlainValue(nodeMap) as CanvasNode;
  });

  const rawActivePageId = metadata.get("activePageId");
  const rawPages = metadata.get("pages");
  const activePageId = typeof rawActivePageId === "string" ? rawActivePageId : undefined;
  const pages = (rawPages !== undefined ? toPlainValue(rawPages) : undefined) as
    | CanvasDocument["pages"]
    | undefined;

  return {
    id: metadata.get("id") as DocumentId,
    schemaVersion: metadata.get("schemaVersion") as number,
    name: metadata.get("name") as string,
    nodes,
    rootNodeIds: rootOrder.toArray() as NodeId[],
    viewport: toPlainValue(metadata.get("viewport")) as CanvasDocument["viewport"],
    grid: toPlainValue(metadata.get("grid")) as CanvasDocument["grid"],
    meta: toPlainValue(metadata.get("meta")) as CanvasDocument["meta"],
    ...(activePageId !== undefined ? { activePageId } : {}),
    ...(pages !== undefined ? { pages } : {}),
  };
}

export function createSceneUndoManager(
  nodesMap: SceneNodesMap,
  rootOrderArray: SceneRootOrder,
): Y.UndoManager {
  return new Y.UndoManager([nodesMap, rootOrderArray], {
    trackedOrigins: new Set([TRANSACTION_ORIGINS.LOCAL_USER]),
    captureTimeout: 300,
  });
}
