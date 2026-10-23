import type { DocumentId } from "@talweg/core";
import * as Y from "yjs";
import { TRANSACTION_ORIGINS } from "./types.js";
import type {
  AssetRecord,
  CompactionStats,
  StorageAdapter,
  StorageAsset,
  StorageChangeEvent,
  StorageDelta,
  StorageSnapshot,
} from "./types.js";

export const STORAGE_DB_NAME = "talweg_storage_v1";
export const STORAGE_DB_VERSION = 1;

const SNAPSHOTS_STORE = "snapshots";
const DELTAS_STORE = "deltas";
const ASSETS_STORE = "assets";
const METADATA_STORE = "metadata";

const DOC_SEQUENCE_INDEX = "idx_doc_seq";
const DOC_TIME_INDEX = "idx_doc_time";
const LAST_RETRIEVED_INDEX = "idx_lastRetrieved";
const CHANNEL_PREFIX = "talweg_doc_sync_";
const DEFAULT_COMPACTION_THRESHOLD = 100;

function onRequestSuccess<T>(
  request: IDBRequest<T>,
  resolve: (value: T) => void,
): () => void {
  return () => {
    resolve(request.result);
  };
}

function onRequestFailure<T>(
  request: IDBRequest<T>,
  reject: (reason?: unknown) => void,
): () => void {
  return () => {
    reject(request.error);
  };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = onRequestSuccess(request, resolve);
    request.onerror = onRequestFailure(request, reject);
  });
}

function createSchema(database: IDBDatabase): void {
  database.createObjectStore(SNAPSHOTS_STORE);

  const deltas = database.createObjectStore(DELTAS_STORE, {
    keyPath: ["documentId", "sequenceNumber"],
  });
  deltas.createIndex(DOC_SEQUENCE_INDEX, ["documentId", "sequenceNumber"], { unique: true });
  deltas.createIndex(DOC_TIME_INDEX, ["documentId", "timestamp"]);

  const assets = database.createObjectStore(ASSETS_STORE, { keyPath: "assetId" });
  assets.createIndex(LAST_RETRIEVED_INDEX, "lastRetrieved");

  database.createObjectStore(METADATA_STORE, { keyPath: "key" });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_DB_NAME, STORAGE_DB_VERSION);

    request.onupgradeneeded = () => {
      createSchema(request.result);
    };
    request.onsuccess = onRequestSuccess(request, resolve);
    request.onerror = onRequestFailure(request, reject);
  });
}

export async function computeSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = ArrayBuffer.isView(data)
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isStorageAsset(val: unknown): val is StorageAsset {
  return typeof val === "object" && val !== null && "data" in val;
}

export class IndexedDBStorageAdapter implements StorageAdapter {
  private database: IDBDatabase | null = null;
  private readonly channels = new Map<string, BroadcastChannel>();

  async initialize(): Promise<void> {
    if (this.database !== null) {
      return;
    }

    this.database = await openDatabase();
  }

  close(): Promise<void> {
    for (const channel of this.channels.values()) {
      channel.close();
    }
    this.channels.clear();

    this.database?.close();
    this.database = null;

    return Promise.resolve();
  }

  async loadSnapshot(documentId: DocumentId): Promise<StorageSnapshot | null> {
    const store = this.getDatabase()
      .transaction(SNAPSHOTS_STORE, "readonly")
      .objectStore(SNAPSHOTS_STORE);
    const snapshot = await requestToPromise(
      store.get(documentId) as IDBRequest<StorageSnapshot | undefined>,
    );

    return snapshot ?? null;
  }

  listSnapshots(): Promise<StorageSnapshot[]> {
    const store = this.getDatabase()
      .transaction(SNAPSHOTS_STORE, "readonly")
      .objectStore(SNAPSHOTS_STORE);

    return requestToPromise(
      store.getAll() as IDBRequest<StorageSnapshot[]>,
    );
  }

  async saveSnapshot(snapshot: StorageSnapshot): Promise<void> {
    const store = this.getDatabase()
      .transaction(SNAPSHOTS_STORE, "readwrite")
      .objectStore(SNAPSHOTS_STORE);

    await requestToPromise(store.put(snapshot, snapshot.meta.documentId));
    this.broadcast({
      documentId: snapshot.meta.documentId,
      type: "snapshot_created",
      clock: snapshot.clock,
    });
  }

  async loadDeltas(documentId: DocumentId, sinceClock: number): Promise<StorageDelta[]> {
    const store = this.getDatabase()
      .transaction(DELTAS_STORE, "readonly")
      .objectStore(DELTAS_STORE);
    const range = IDBKeyRange.bound(
      [documentId, sinceClock + 1],
      [documentId, Number.POSITIVE_INFINITY],
    );

    return requestToPromise(
      store.index(DOC_SEQUENCE_INDEX).getAll(range) as IDBRequest<StorageDelta[]>,
    );
  }

  async saveDeltas(deltas: readonly StorageDelta[]): Promise<void> {
    if (deltas.length === 0) {
      return;
    }

    const store = this.getDatabase()
      .transaction(DELTAS_STORE, "readwrite")
      .objectStore(DELTAS_STORE);

    await Promise.all(deltas.map((delta) => requestToPromise(store.put(delta))));

    const latestClocks = new Map<DocumentId, number>();

    for (const delta of deltas) {
      latestClocks.set(
        delta.documentId,
        Math.max(latestClocks.get(delta.documentId) ?? 0, delta.sequenceNumber),
      );
    }

    for (const [documentId, clock] of latestClocks) {
      this.broadcast({
        documentId,
        type: "delta_appended",
        clock,
      });
    }
  }

  async saveAsset(
    input: Blob | ArrayBuffer | Uint8Array | StorageAsset,
    customMimeType?: string,
  ): Promise<string> {
    const database = this.getDatabase();

    let data: ArrayBuffer;
    let mimeType: string;
    let explicitId: string | undefined;
    let createdAt = Date.now();
    let lastRetrieved = Date.now();

    if (input instanceof Blob) {
      data = await input.arrayBuffer();
      mimeType = customMimeType ?? (input.type !== "" ? input.type : "application/octet-stream");
    } else if (input instanceof ArrayBuffer) {
      data = input;
      mimeType = customMimeType ?? "application/octet-stream";
    } else if (ArrayBuffer.isView(input)) {
      data = input.buffer.slice(
        input.byteOffset,
        input.byteOffset + input.byteLength,
      ) as ArrayBuffer;
      mimeType = customMimeType ?? "application/octet-stream";
    } else if (isStorageAsset(input)) {
      data = input.data;
      mimeType = customMimeType ?? (typeof input.mimeType === "string" && input.mimeType !== "" ? input.mimeType : "application/octet-stream");
      explicitId = input.assetId;
      lastRetrieved = input.lastRetrieved;
      if ("createdAt" in input && typeof input.createdAt === "number") {
        createdAt = input.createdAt;
      }
    } else {
      throw new Error("Invalid asset input: expected Blob, ArrayBuffer, Uint8Array, or StorageAsset");
    }

    const hash = explicitId ?? (await computeSha256(data));

    const record: AssetRecord & StorageAsset = {
      id: hash,
      assetId: hash,
      mimeType,
      data,
      byteLength: data.byteLength,
      size: data.byteLength,
      createdAt,
      lastRetrieved,
    };

    const store = database.transaction(ASSETS_STORE, "readwrite").objectStore(ASSETS_STORE);
    await requestToPromise(store.put(record));

    return hash;
  }

  async getAsset(hash: string): Promise<AssetRecord | null> {
    const database = this.getDatabase();
    const store = database.transaction(ASSETS_STORE, "readonly").objectStore(ASSETS_STORE);
    const asset = await requestToPromise(
      store.get(hash) as IDBRequest<AssetRecord | undefined>,
    );

    return asset ?? null;
  }

  async loadAsset(assetId: string): Promise<StorageAsset | null> {
    const database = this.getDatabase();
    const store = database.transaction(ASSETS_STORE, "readonly").objectStore(ASSETS_STORE);
    const asset = await requestToPromise(
      store.get(assetId) as IDBRequest<StorageAsset | undefined>,
    );

    if (asset === undefined) {
      return null;
    }

    const touched: StorageAsset = { ...asset, lastRetrieved: Date.now() };
    const writeStore = database
      .transaction(ASSETS_STORE, "readwrite")
      .objectStore(ASSETS_STORE);
    await requestToPromise(writeStore.put(touched));

    return touched;
  }

  async pruneAssets(maxAgeMs: number, preserveIds: ReadonlySet<string>): Promise<number> {
    const database = this.getDatabase();
    const cutoff = Date.now() - maxAgeMs;
    const store = database.transaction(ASSETS_STORE, "readonly").objectStore(ASSETS_STORE);
    const assets = await requestToPromise(
      store.index(LAST_RETRIEVED_INDEX).getAll(
        IDBKeyRange.upperBound(cutoff),
      ) as IDBRequest<StorageAsset[]>,
    );
    const removable = assets.filter((asset) => !preserveIds.has(asset.assetId));

    if (removable.length === 0) {
      return 0;
    }

    const writeStore = database
      .transaction(ASSETS_STORE, "readwrite")
      .objectStore(ASSETS_STORE);
    await Promise.all(
      removable.map((asset) => requestToPromise(writeStore.delete(asset.assetId))),
    );

    return removable.length;
  }

  async compact(
    documentId: DocumentId,
    thresholdDeltas?: number,
  ): Promise<CompactionStats | null> {
    const startedAt = Date.now();
    const snapshot = await this.loadSnapshot(documentId);

    if (snapshot === null) {
      return null;
    }

    const deltas = await this.loadDeltas(documentId, Number.NEGATIVE_INFINITY);

    if (deltas.length === 0) {
      return null;
    }

    const threshold = thresholdDeltas ?? DEFAULT_COMPACTION_THRESHOLD;

    if (deltas.length < threshold) {
      return null;
    }

    const pendingDeltas = deltas.filter((delta) => delta.sequenceNumber > snapshot.clock);
    const document = new Y.Doc();

    try {
      Y.applyUpdate(document, snapshot.documentBlob, TRANSACTION_ORIGINS.STORAGE_HYDRATION);

      for (const delta of pendingDeltas) {
        Y.applyUpdate(document, delta.updateBlob, TRANSACTION_ORIGINS.STORAGE_HYDRATION);
      }

      const documentBlob = Y.encodeStateAsUpdate(document);
      const stateVector = Y.encodeStateVector(document);
      const newClock = Math.max(
        snapshot.clock,
        ...deltas.map((delta) => delta.sequenceNumber),
      );
      const newSnapshot: StorageSnapshot = {
        meta: {
          ...snapshot.meta,
          updatedAt: Date.now(),
          nodeCount: document.getMap<Y.Map<unknown>>("nodes").size,
        },
        clock: newClock,
        stateVector,
        documentBlob,
      };
      const bytesReclaimed = deltas.reduce(
        (total, delta) => total + delta.updateBlob.byteLength,
        0,
      );
      const transaction = this.getDatabase().transaction(
        [SNAPSHOTS_STORE, DELTAS_STORE],
        "readwrite",
      );
      const snapshotStore = transaction.objectStore(SNAPSHOTS_STORE);
      const deltaStore = transaction.objectStore(DELTAS_STORE);

      await Promise.all([
        requestToPromise(snapshotStore.put(newSnapshot, documentId)),
        requestToPromise(
          deltaStore.delete(
            IDBKeyRange.bound(
              [documentId, Number.NEGATIVE_INFINITY],
              [documentId, newClock],
            ),
          ),
        ),
      ]);

      const stats: CompactionStats = {
        documentId,
        deltasPruned: deltas.length,
        bytesReclaimed,
        newSnapshotClock: newClock,
        durationMs: Date.now() - startedAt,
      };

      this.broadcast({ documentId, type: "compacted", clock: newClock });
      return stats;
    } finally {
      document.destroy();
    }
  }

  subscribe(
    documentId: DocumentId,
    listener: (event: StorageChangeEvent) => void,
  ): () => void {
    const channel = this.getChannel(documentId);
    const handler = (event: MessageEvent<StorageChangeEvent>): void => {
      listener(event.data);
    };

    channel.addEventListener("message", handler);

    return () => {
      channel.removeEventListener("message", handler);
    };
  }

  private getDatabase(): IDBDatabase {
    if (this.database === null) {
      throw new Error("IndexedDBStorageAdapter is not initialized");
    }

    return this.database;
  }

  private getChannel(documentId: DocumentId): BroadcastChannel {
    const existing = this.channels.get(documentId);

    if (existing !== undefined) {
      return existing;
    }

    const channel = new BroadcastChannel(`${CHANNEL_PREFIX}${documentId}`);
    this.channels.set(documentId, channel);

    return channel;
  }

  private broadcast(event: StorageChangeEvent): void {
    this.getChannel(event.documentId).postMessage(event);
  }
}
