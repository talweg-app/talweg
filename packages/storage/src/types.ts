import type { CanvasDocument, DocumentId } from "@talweg/core";
import type * as Y from "yjs";

export const TRANSACTION_ORIGINS = {
  LOCAL_USER: "talweg:origin:local-user",
  REMOTE_SYNC: "talweg:origin:remote-sync",
  STORAGE_HYDRATION: "talweg:origin:storage-hydration",
  SYSTEM_RECONCILE: "talweg:origin:system-reconcile",
  UNDO_MANAGER: "talweg:origin:undo-manager",
} as const;

export type TransactionOrigin =
  (typeof TRANSACTION_ORIGINS)[keyof typeof TRANSACTION_ORIGINS];

export interface StorageSnapshotMeta {
  readonly documentId: DocumentId;
  readonly name: string;
  readonly schemaVersion: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly nodeCount: number;
}

export interface StorageSnapshot {
  readonly meta: StorageSnapshotMeta;
  readonly clock: number;
  readonly stateVector: Uint8Array;
  readonly documentBlob: Uint8Array;
}

export interface StorageDelta {
  readonly documentId: DocumentId;
  readonly sequenceNumber: number;
  readonly updateBlob: Uint8Array;
  readonly origin: string;
  readonly timestamp: number;
}

export interface StorageAsset {
  readonly assetId: string;
  readonly mimeType: string;
  readonly data: ArrayBuffer;
  readonly size: number;
  readonly lastRetrieved: number;
}

export interface AssetRecord {
  readonly id: string;
  readonly assetId?: string;
  readonly mimeType: string;
  readonly data: ArrayBuffer;
  readonly createdAt: number;
  readonly byteLength?: number;
  readonly size?: number;
  readonly lastRetrieved?: number;
}

export interface TalwegFileMetadata {
  readonly documentId: string;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly appVersion?: string;
}

export interface TalwegSceneSnapshot {
  readonly viewport: {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
  };
  readonly grid: {
    readonly enabled: boolean;
    readonly size: number;
    readonly snapToGrid: boolean;
    readonly gridType?: string;
  };
  readonly nodeCount: number;
  readonly nodes?: Record<string, unknown>;
  readonly rootNodeIds?: readonly string[];
}

export interface TalwegFileAsset {
  readonly mimeType: string;
  readonly base64Data: string;
}

export interface TalwegFileContainer {
  readonly schemaVersion: 1;
  readonly metadata: TalwegFileMetadata;
  readonly sceneSnapshot: TalwegSceneSnapshot;
  readonly crdtUpdate: string;
  readonly assets: Record<string, TalwegFileAsset>;
}

export interface DeserializedAsset {
  readonly id: string;
  readonly assetId: string;
  readonly mimeType: string;
  readonly base64Data: string;
  readonly data: ArrayBuffer;
}

export interface DeserializedTalwegFile {
  readonly schemaVersion: number;
  readonly metadata: TalwegFileMetadata;
  readonly sceneSnapshot: TalwegSceneSnapshot;
  readonly crdtUpdate: Uint8Array;
  readonly doc: CanvasDocument;
  readonly ydoc: Y.Doc;
  readonly assets: Record<string, DeserializedAsset>;
  readonly rawContainer: TalwegFileContainer;
}

export interface AssetInputItem {
  readonly id?: string;
  readonly assetId?: string;
  readonly mimeType?: string;
  readonly base64Data?: string;
  readonly data?: ArrayBuffer | Uint8Array;
}

export type AssetInputMap =
  | Record<string, AssetInputItem>
  | Map<string, AssetInputItem>
  | readonly AssetInputItem[];

export type StorageChangeType = "delta_appended" | "snapshot_created" | "compacted";

export interface StorageChangeEvent {
  readonly documentId: DocumentId;
  readonly type: StorageChangeType;
  readonly clock: number;
  readonly sourceTabId?: string;
}

export interface CompactionStats {
  readonly documentId: DocumentId;
  readonly deltasPruned: number;
  readonly bytesReclaimed: number;
  readonly newSnapshotClock: number;
  readonly durationMs: number;
}

export interface StorageAdapter {
  initialize(): Promise<void>;

  loadSnapshot(documentId: DocumentId): Promise<StorageSnapshot | null>;

  listSnapshots(): Promise<StorageSnapshot[]>;

  saveSnapshot(snapshot: StorageSnapshot): Promise<void>;

  loadDeltas(documentId: DocumentId, sinceClock: number): Promise<StorageDelta[]>;

  saveDeltas(deltas: readonly StorageDelta[]): Promise<void>;

  saveAsset(
    input: Blob | ArrayBuffer | Uint8Array | StorageAsset,
    customMimeType?: string,
  ): Promise<string>;

  getAsset(hash: string): Promise<AssetRecord | null>;

  loadAsset(assetId: string): Promise<StorageAsset | null>;

  pruneAssets(maxAgeMs: number, preserveIds: ReadonlySet<string>): Promise<number>;

  compact(documentId: DocumentId, thresholdDeltas?: number): Promise<CompactionStats | null>;

  subscribe(documentId: DocumentId, listener: (event: StorageChangeEvent) => void): () => void;

  close(): Promise<void>;
}

