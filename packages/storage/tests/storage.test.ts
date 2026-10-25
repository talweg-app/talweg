import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type {
  CanvasDocument,
  CanvasNode,
  DocumentId,
  NodeId,
} from "@talweg/core";
import {
  IndexedDBStorageAdapter,
  SCENE_META_KEY,
  SCENE_NODES_KEY,
  SCENE_ROOT_ORDER_KEY,
  STORAGE_DB_NAME,
  TRANSACTION_ORIGINS,
  applyDocumentToYDoc,
  createSceneDoc,
  createSceneUndoManager,
  documentToYDoc,
  toPlainValue,
  yDocToDocument,
} from "../src/index.js";
import type {
  StorageAsset,
  StorageChangeEvent,
  StorageDelta,
  StorageSnapshot,
} from "../src/index.js";

function documentId(value: string): DocumentId {
  return value as DocumentId;
}

function nodeId(value: string): NodeId {
  return value as NodeId;
}

const DOC_A = documentId("doc-a");
const DOC_B = documentId("doc-b");
const DOC_C = documentId("doc-c");

let adapters: IndexedDBStorageAdapter[] = [];

async function deleteStorageDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE_DB_NAME);

    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(
        new Error("Failed to delete the storage database", {
          cause: request.error,
        }),
      );
    };
    request.onblocked = () => {
      reject(new Error("Storage database deletion was blocked"));
    };
  });
}

async function createAdapter(): Promise<IndexedDBStorageAdapter> {
  const adapter = new IndexedDBStorageAdapter();
  adapters.push(adapter);
  await adapter.initialize();

  return adapter;
}

function emptySnapshot(id: DocumentId, clock = 0): StorageSnapshot {
  const document = new Y.Doc();
  const snapshot: StorageSnapshot = {
    meta: {
      documentId: id,
      name: "Test document",
      schemaVersion: 1,
      createdAt: 100,
      updatedAt: 100,
      nodeCount: 0,
    },
    clock,
    stateVector: Y.encodeStateVector(document),
    documentBlob: Y.encodeStateAsUpdate(document),
  };

  document.destroy();
  return snapshot;
}

function makeDelta(
  id: DocumentId,
  sequenceNumber: number,
  updateBlob: Uint8Array = new Uint8Array([sequenceNumber]),
): StorageDelta {
  return {
    documentId: id,
    sequenceNumber,
    updateBlob,
    origin: "local",
    timestamp: 1_000 + sequenceNumber,
  };
}

function sceneUpdates(count: number): Uint8Array[] {
  const document = new Y.Doc();
  const nodes = document.getMap("nodes");
  const updates: Uint8Array[] = [];

  document.on("update", (update: Uint8Array) => {
    updates.push(update);
  });

  for (let index = 0; index < count; index += 1) {
    const node = new Y.Map<unknown>();
    node.set("index", index);
    nodes.set(`node-${String(index)}`, node);
  }

  document.destroy();
  return updates;
}

function makeAsset(assetId: string, lastRetrieved: number): StorageAsset {
  const data = new ArrayBuffer(3);
  new Uint8Array(data).set([1, 2, 3]);

  return {
    assetId,
    mimeType: "image/png",
    data,
    size: data.byteLength,
    lastRetrieved,
  };
}

async function waitForEvent(
  events: readonly StorageChangeEvent[],
  predicate: (event: StorageChangeEvent) => boolean,
): Promise<StorageChangeEvent> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const event = events.find(predicate);

    if (event !== undefined) {
      return event;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 5);
    });
  }

  throw new Error("Timed out waiting for a storage event");
}

function makeDocument(): CanvasDocument {
  const rectangleId = nodeId("node-1");
  const groupId = nodeId("group-1");

  return {
    id: documentId("scene-doc"),
    schemaVersion: 1,
    name: "Scene",
    nodes: {
      [rectangleId]: {
        id: rectangleId,
        type: "rectangle",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0,
        zIndex: 1,
        zIndexKey: "a0",
        opacity: 1,
        parentId: null,
        isLocked: false,
        isVisible: true,
        style: {
          fillColor: "#ffffff",
          strokeWidth: 2,
          cornerRadius: [4, 4, 0, 0],
        },
        data: { label: "Card", aspectRatioLocked: true },
        meta: {
          tags: ["alpha", "beta"],
          tagObjects: [{ id: "tag-1", label: "Alpha", color: "#ffffff" }],
          nested: { enabled: true },
        },
        createdAt: 100,
        updatedAt: 200,
      },
      [groupId]: {
        id: groupId,
        type: "group",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        rotation: 0,
        zIndex: 2,
        opacity: 0.5,
        parentId: null,
        isLocked: true,
        isVisible: false,
        style: {},
        data: {
          childIds: [rectangleId],
          boundingBoxMode: "dynamic",
          padding: 8,
          isCollapsed: false,
        },
        createdAt: 101,
        updatedAt: 201,
      },
    },
    rootNodeIds: [rectangleId, groupId],
    viewport: { x: 10, y: 20, zoom: 1.5 },
    grid: { enabled: true, size: 20, snapToGrid: false, gridType: "lines" },
    meta: {
      createdAt: 100,
      updatedAt: 200,
      lastModifiedBy: "user-1",
      version: 3,
    },
  };
}

beforeEach(async () => {
  await deleteStorageDatabase();
});

afterEach(async () => {
  await Promise.all(adapters.map((adapter) => adapter.close()));
  adapters = [];
});

describe("IndexedDBStorageAdapter lifecycle", () => {
  it("initializes idempotently and closes idempotently", async () => {
    const uninitializedAdapter = new IndexedDBStorageAdapter();
    await uninitializedAdapter.close();

    const adapter = await createAdapter();
    await adapter.initialize();
    await adapter.close();
    await adapter.close();

    await expect(adapter.loadSnapshot(DOC_A)).rejects.toThrow(
      "not initialized",
    );
  });

  it("saves, replaces, and loads snapshots", async () => {
    const adapter = await createAdapter();

    expect(await adapter.loadSnapshot(DOC_A)).toBeNull();

    const first = emptySnapshot(DOC_A, 1);
    await adapter.saveSnapshot(first);
    expect(await adapter.loadSnapshot(DOC_A)).toEqual(first);

    const second = emptySnapshot(DOC_A, 5);
    await adapter.saveSnapshot(second);
    expect(await adapter.loadSnapshot(DOC_A)).toEqual(second);
    expect(await adapter.loadSnapshot(DOC_B)).toBeNull();

    const list = await adapter.listSnapshots();
    expect(list).toEqual([second]);
  });

  it("appends deltas and filters them by document and clock", async () => {
    const adapter = await createAdapter();
    const first = makeDelta(DOC_A, 1);
    const second = makeDelta(DOC_A, 2);
    const third = makeDelta(DOC_A, 3);
    const other = makeDelta(DOC_B, 1);

    await adapter.saveDeltas([]);
    await adapter.saveDeltas([second, other, first, third]);

    expect(await adapter.loadDeltas(DOC_A, 0)).toEqual([first, second, third]);
    expect(await adapter.loadDeltas(DOC_A, 1)).toEqual([second, third]);
    expect(await adapter.loadDeltas(DOC_A, 3)).toEqual([]);
    expect(await adapter.loadDeltas(DOC_B, 0)).toEqual([other]);
  });

  it("rejects when an IndexedDB request fails", async () => {
    const adapter = await createAdapter();
    const getAllSpy = vi
      .spyOn(IDBIndex.prototype, "getAll")
      .mockImplementation(function (this: IDBIndex): IDBRequest<unknown[]> {
        const request = {
          result: [],
          error: new DOMException("Request failed", "UnknownError"),
          onsuccess: null,
          onerror: null,
        } as unknown as IDBRequest<unknown[]>;

        queueMicrotask(() => {
          request.onerror?.call(request, new Event("error"));
        });

        return request;
      });

    try {
      await expect(adapter.loadDeltas(DOC_A, 0)).rejects.toBeDefined();
    } finally {
      getAllSpy.mockRestore();
    }
  });
});

describe("IndexedDBStorageAdapter compaction", () => {
  it("compacts deltas into a snapshot and prunes the oplog", async () => {
    const adapter = await createAdapter();
    const updates = sceneUpdates(2);
    const first = makeDelta(DOC_A, 1, updates[0]);
    const second = makeDelta(DOC_A, 2, updates[1]);

    await adapter.saveSnapshot(emptySnapshot(DOC_A, 0));
    await adapter.saveDeltas([first, second]);

    expect(await adapter.compact(DOC_A)).toBeNull();
    expect(await adapter.compact(DOC_A, 5)).toBeNull();

    const stats = await adapter.compact(DOC_A, 2);

    expect(stats).not.toBeNull();
    expect(stats).toMatchObject({
      documentId: DOC_A,
      deltasPruned: 2,
      newSnapshotClock: 2,
      bytesReclaimed:
        first.updateBlob.byteLength + second.updateBlob.byteLength,
    });
    expect(stats!.durationMs).toBeGreaterThanOrEqual(0);

    const snapshot = await adapter.loadSnapshot(DOC_A);

    expect(snapshot).not.toBeNull();
    expect(snapshot!.clock).toBe(2);
    expect(snapshot!.meta.nodeCount).toBe(2);
    expect(snapshot!.meta.name).toBe("Test document");
    expect(snapshot!.meta.updatedAt).toBeGreaterThanOrEqual(100);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, snapshot!.documentBlob);
    expect(restored.getMap(SCENE_NODES_KEY).size).toBe(2);
    restored.destroy();

    expect(await adapter.loadDeltas(DOC_A, 0)).toEqual([]);

    const third = makeDelta(DOC_A, 3, sceneUpdates(1)[0]);
    const stale = makeDelta(DOC_A, 1, new Uint8Array([99]));
    await adapter.saveDeltas([stale, third]);
    expect(await adapter.loadDeltas(DOC_A, 2)).toEqual([third]);

    const secondStats = await adapter.compact(DOC_A, 1);

    expect(secondStats).toMatchObject({
      documentId: DOC_A,
      deltasPruned: 2,
      newSnapshotClock: 3,
    });
    expect(await adapter.loadDeltas(DOC_A, 0)).toEqual([]);
    expect((await adapter.loadSnapshot(DOC_A))!.meta.nodeCount).toBe(2);
  });

  it("returns null when there is no snapshot or no delta", async () => {
    const adapter = await createAdapter();

    expect(await adapter.compact(DOC_A)).toBeNull();

    await adapter.saveSnapshot(emptySnapshot(DOC_C, 4));
    expect(await adapter.compact(DOC_C, 0)).toBeNull();
  });
});

describe("IndexedDBStorageAdapter assets", () => {
  it("saves, touches, and loads assets", async () => {
    const adapter = await createAdapter();
    const beforeLoad = Date.now();
    const asset = makeAsset("asset-1", beforeLoad - 10_000);

    expect(await adapter.loadAsset("missing")).toBeNull();

    await adapter.saveAsset(asset);

    const loaded = await adapter.loadAsset(asset.assetId);

    expect(loaded).not.toBeNull();
    expect(loaded!.assetId).toBe(asset.assetId);
    expect(loaded!.mimeType).toBe(asset.mimeType);
    expect(loaded!.size).toBe(asset.size);
    expect(new Uint8Array(loaded!.data)).toEqual(new Uint8Array(asset.data));
    expect(loaded!.lastRetrieved).toBeGreaterThanOrEqual(beforeLoad);
  });

  it("prunes stale assets while preserving requested ids", async () => {
    const adapter = await createAdapter();
    const now = Date.now();
    const preserved = makeAsset("preserved", now - 60_000);
    const removable = makeAsset("removable", now - 60_000);
    const fresh = makeAsset("fresh", now);

    await adapter.saveAsset(preserved);
    await adapter.saveAsset(removable);
    await adapter.saveAsset(fresh);

    expect(
      await adapter.pruneAssets(30_000, new Set([preserved.assetId])),
    ).toBe(1);
    expect(await adapter.loadAsset(removable.assetId)).toBeNull();
    expect(await adapter.loadAsset(preserved.assetId)).not.toBeNull();
    expect(await adapter.loadAsset(fresh.assetId)).not.toBeNull();

    expect(await adapter.pruneAssets(30_000, new Set())).toBe(0);
  });
});

describe("IndexedDBStorageAdapter broadcast", () => {
  it("publishes snapshot, delta, and compaction events to other adapters", async () => {
    const writer = await createAdapter();
    const reader = await createAdapter();
    const events: StorageChangeEvent[] = [];
    const unsubscribe = reader.subscribe(DOC_A, (event) => {
      events.push(event);
    });

    const snapshot = emptySnapshot(DOC_A, 0);
    await writer.saveSnapshot(snapshot);

    const snapshotEvent = await waitForEvent(
      events,
      (event) => event.type === "snapshot_created",
    );
    expect(snapshotEvent).toEqual({
      documentId: DOC_A,
      type: "snapshot_created",
      clock: 0,
    });

    const updates = sceneUpdates(2);
    await writer.saveDeltas([
      makeDelta(DOC_A, 1, updates[0]),
      makeDelta(DOC_A, 2, updates[1]),
    ]);

    const deltaEvent = await waitForEvent(
      events,
      (event) => event.type === "delta_appended" && event.clock === 2,
    );
    expect(deltaEvent.documentId).toBe(DOC_A);
    expect(
      events.filter((event) => event.type === "delta_appended"),
    ).toHaveLength(1);

    await writer.compact(DOC_A, 2);

    const compactedEvent = await waitForEvent(
      events,
      (event) => event.type === "compacted",
    );
    expect(compactedEvent.clock).toBe(2);

    unsubscribe();
  });
});

describe("scene graph CRDT binding", () => {
  it("round-trips a CanvasDocument through Yjs maps and arrays", () => {
    const document = makeDocument();
    const yDoc = documentToYDoc(document);
    const nodes = yDoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
    const rectangle = nodes.get("node-1");

    expect(nodes).toBeInstanceOf(Y.Map);
    expect(rectangle).toBeInstanceOf(Y.Map);
    expect(rectangle!.get("style")).toBeInstanceOf(Y.Map);
    expect(rectangle!.get("data")).toBeInstanceOf(Y.Map);
    expect(rectangle!.get("meta")).toBeInstanceOf(Y.Map);
    expect(yDoc.getArray<string>(SCENE_ROOT_ORDER_KEY)).toBeInstanceOf(Y.Array);
    expect(yDoc.getMap<unknown>(SCENE_META_KEY).get("name")).toBe("Scene");
    expect(yDocToDocument(yDoc)).toEqual(document);

    const decoded = new Y.Doc();
    Y.applyUpdate(decoded, Y.encodeStateAsUpdate(yDoc));
    expect(yDocToDocument(decoded)).toEqual(document);
    decoded.destroy();
  });

  it("creates empty scene documents and populates supplied targets", () => {
    const empty = createSceneDoc();

    expect(empty.getMap(SCENE_NODES_KEY).size).toBe(0);
    expect(empty.getArray(SCENE_ROOT_ORDER_KEY).length).toBe(0);

    const target = createSceneDoc();
    const populated = documentToYDoc(makeDocument(), target);

    expect(populated).toBe(target);
    expect(target.getMap(SCENE_NODES_KEY).size).toBe(2);
  });

  it("clears previous scene state when applying a document", () => {
    const document = makeDocument();
    const rectangleId = nodeId("node-1");
    const smaller: CanvasDocument = {
      ...document,
      nodes: { [rectangleId]: document.nodes[rectangleId]! },
      rootNodeIds: [rectangleId],
    };
    const target = createSceneDoc(document);

    applyDocumentToYDoc(smaller, target);
    const converted = yDocToDocument(target);

    expect(Object.keys(converted.nodes)).toEqual([rectangleId]);
    expect(converted.rootNodeIds).toEqual([rectangleId]);
  });

  it("skips undefined node properties when encoding", () => {
    const document = makeDocument();
    const rectangleId = nodeId("node-1");
    const rectangle = document.nodes[rectangleId]!;
    const nodeWithUndefined = {
      ...rectangle,
      meta: undefined,
      style: { ...rectangle.style, optional: undefined },
    } as unknown as CanvasNode;
    const source: CanvasDocument = {
      ...document,
      nodes: { [rectangleId]: nodeWithUndefined },
      rootNodeIds: [rectangleId],
    };
    const converted = yDocToDocument(documentToYDoc(source));

    expect(converted.nodes[rectangleId]).not.toHaveProperty("meta");
    expect(converted.nodes[rectangleId]!.style).not.toHaveProperty("optional");
  });

  it("round-trips activePageId and pages when present", () => {
    const document = makeDocument();
    const docWithPages: CanvasDocument = {
      ...document,
      activePageId: "page-2",
      pages: {
        "page-1": {
          id: "page-1",
          name: "Page 1",
          order: 0,
          createdAt: 100,
          updatedAt: 100,
        },
        "page-2": {
          id: "page-2",
          name: "Page 2",
          order: 1,
          createdAt: 200,
          updatedAt: 200,
          viewport: { x: 50, y: 50, zoom: 1.5 },
        },
      },
    };

    const yDoc = documentToYDoc(docWithPages);
    const roundTripped = yDocToDocument(yDoc);
    expect(roundTripped.activePageId).toBe("page-2");
    expect(roundTripped.pages).toEqual(docWithPages.pages);
    yDoc.destroy();
  });
});

describe("scene undo manager", () => {
  it("tracks local origins and ignores remote origins", () => {
    const yDoc = createSceneDoc(makeDocument());
    const nodes = yDoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
    const rootOrder = yDoc.getArray<string>(SCENE_ROOT_ORDER_KEY);
    const undoManager = createSceneUndoManager(nodes, rootOrder);

    expect(undoManager.captureTimeout).toBe(300);

    yDoc.transact(() => {
      nodes.set("remote-1", new Y.Map());
    }, TRANSACTION_ORIGINS.REMOTE_SYNC);
    undoManager.stopCapturing();

    expect(undoManager.undoStack.length).toBe(0);
    expect(nodes.has("remote-1")).toBe(true);

    yDoc.transact(() => {
      nodes.set("local-1", new Y.Map());
    }, TRANSACTION_ORIGINS.LOCAL_USER);
    undoManager.stopCapturing();

    expect(undoManager.undoStack.length).toBe(1);

    undoManager.undo();
    expect(nodes.has("local-1")).toBe(false);
    expect(nodes.has("remote-1")).toBe(true);

    undoManager.redo();
    expect(nodes.has("local-1")).toBe(true);

    yDoc.transact(() => {
      rootOrder.push(["local-root"]);
    }, TRANSACTION_ORIGINS.LOCAL_USER);
    undoManager.stopCapturing();

    expect(rootOrder.toArray()).toContain("local-root");
    undoManager.undo();
    expect(rootOrder.toArray()).not.toContain("local-root");

    yDoc.transact(() => {
      nodes.set("local-2", new Y.Map());
    }, TRANSACTION_ORIGINS.LOCAL_USER);
    undoManager.stopCapturing();

    undoManager.undo();
    expect(nodes.has("local-2")).toBe(false);
    expect(nodes.has("remote-1")).toBe(true);

    undoManager.destroy();
    yDoc.destroy();
  });

  it("safely filters out prototype pollution keys in toPlainValue", () => {
    const yDoc = new Y.Doc();
    const map = yDoc.getMap<unknown>("testMap");
    map.set("validKey", "hello");
    map.set("__proto__", "malicious");
    map.set("constructor", "malicious");
    map.set("prototype", "malicious");

    const plain = toPlainValue(map) as Record<string, unknown>;
    expect(plain.validKey).toBe("hello");
    expect(Object.prototype.hasOwnProperty.call(plain, "__proto__")).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(plain, "constructor")).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(plain, "prototype")).toBe(
      false,
    );
    yDoc.destroy();
  });
});

it("projects shared text, orders and stable table cells without losing plain document compatibility", () => {
  const scene = createSceneDoc();
  const nodes = scene.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
  const node = new Y.Map<unknown>();
  nodes.set("table-shared", node);
  node.set("id", "table-shared");
  node.set("type", "table");
  const rows = new Y.Array<string>();
  rows.push(["r1", "r2"]);
  const columns = new Y.Array<string>();
  columns.push(["c1", "c2"]);
  const data = new Y.Map<unknown>();
  node.set("data", data);
  data.set("rowIds", rows);
  data.set("columnIds", columns);
  const cells = new Y.Map<unknown>();
  data.set("cells", cells);
  const row = new Y.Map<unknown>();
  cells.set("r1", row);
  row.set("c1", new Y.Text("shared"));
  node.set("note", new Y.Text("note"));
  const extra = scene.getText("extra");
  extra.insert(0, "plain");
  expect(toPlainValue(extra)).toBe("plain");
  expect(toPlainValue(rows)).toEqual(["r1", "r2"]);
  const document = yDocToDocument(scene);
  const projected = document.nodes["table-shared" as NodeId];
  expect(projected?.type === "table" && projected.data.cells).toEqual([
    ["shared", ""],
    ["", ""],
  ]);
  expect(projected?.note).toBe("note");
  scene.destroy();
});
