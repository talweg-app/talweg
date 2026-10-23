import type { CanvasDocument, CanvasNode, DocumentId, NodeId } from "@talweg/core";
import * as Y from "yjs";
import { yDocToDocument } from "./crdt.js";
import { TRANSACTION_ORIGINS } from "./types.js";
import type {
  AssetInputItem,
  AssetInputMap,
  DeserializedAsset,
  DeserializedTalwegFile,
  TalwegFileAsset,
  TalwegFileContainer,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64FromData(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return uint8ArrayToBase64(bytes);
}

function isAssetArray(val: unknown): val is readonly AssetInputItem[] {
  return Array.isArray(val);
}

function normalizeAssetsForSerialization(
  input?: AssetInputMap,
): Record<string, TalwegFileAsset> {
  const result: Record<string, TalwegFileAsset> = {};
  if (!input) {
    return result;
  }

  let entries: [string, AssetInputItem][];

  if (isAssetArray(input)) {
    entries = input.map((item) => {
      const id = typeof item.assetId === "string" && item.assetId !== ""
        ? item.assetId
        : (typeof item.id === "string" ? item.id : "");
      return [id, item];
    });
  } else if (input instanceof Map) {
    entries = Array.from(input.entries());
  } else {
    entries = Object.entries(input);
  }

  for (const [key, val] of entries) {
    if (key === "") {
      continue;
    }
    const base64 = typeof val.base64Data === "string"
      ? val.base64Data
      : (val.data ? toBase64FromData(val.data) : "");
    result[key] = {
      mimeType: typeof val.mimeType === "string" && val.mimeType !== "" ? val.mimeType : "application/octet-stream",
      base64Data: base64,
    };
  }

  return result;
}

export function serializeTalwegFile(
  doc: CanvasDocument,
  ydoc: Y.Doc,
  assets?: AssetInputMap,
): string {
  const crdtBytes = Y.encodeStateAsUpdate(ydoc);
  const crdtBase64 = uint8ArrayToBase64(crdtBytes);
  const assetsMap = normalizeAssetsForSerialization(assets);

  const container: TalwegFileContainer = {
    schemaVersion: 1,
    metadata: {
      documentId: doc.id,
      title: doc.name,
      createdAt: doc.meta.createdAt,
      updatedAt: doc.meta.updatedAt,
      appVersion: "0.1.0",
    },
    sceneSnapshot: {
      viewport: {
        x: doc.viewport.x,
        y: doc.viewport.y,
        zoom: doc.viewport.zoom,
      },
      grid: {
        enabled: doc.grid.enabled,
        size: doc.grid.size,
        snapToGrid: doc.grid.snapToGrid,
        gridType: doc.grid.gridType,
      },
      nodeCount: Object.keys(doc.nodes).length,
      nodes: doc.nodes,
      rootNodeIds: doc.rootNodeIds,
    },
    crdtUpdate: crdtBase64,
    assets: assetsMap,
  };

  return JSON.stringify(container, null, 2);
}

export function deserializeTalwegFile(
  fileData: string | ArrayBuffer | Uint8Array | Record<string, unknown>,
): DeserializedTalwegFile {
  let parsedRaw: unknown;

  if (typeof fileData === "string") {
    try {
      parsedRaw = JSON.parse(fileData);
    } catch (err) {
      throw new Error("Failed to deserialize .talweg file: invalid JSON", { cause: err });
    }
  } else if (fileData instanceof Uint8Array) {
    try {
      parsedRaw = JSON.parse(new TextDecoder().decode(fileData));
    } catch (err) {
      throw new Error("Failed to deserialize .talweg file: invalid binary JSON", { cause: err });
    }
  } else if (fileData instanceof ArrayBuffer) {
    try {
      parsedRaw = JSON.parse(new TextDecoder().decode(new Uint8Array(fileData)));
    } catch (err) {
      throw new Error("Failed to deserialize .talweg file: invalid binary JSON", { cause: err });
    }
  } else if (isRecord(fileData)) {
    parsedRaw = fileData;
  } else {
    throw new Error("Failed to deserialize .talweg file: unsupported data type");
  }

  if (!isRecord(parsedRaw)) {
    throw new Error("Failed to deserialize .talweg file: root container must be an object");
  }

  const parsed = parsedRaw;

  const schemaVer = typeof parsed.schemaVersion === "number"
    ? parsed.schemaVersion
    : (typeof parsed.talwegSchemaVersion === "number" ? parsed.talwegSchemaVersion : undefined);

  if (schemaVer !== 1) {
    throw new Error(`Unsupported .talweg file schema version: ${String(schemaVer)}`);
  }

  let crdtBase64: string | undefined;
  if (typeof parsed.crdtUpdate === "string") {
    crdtBase64 = parsed.crdtUpdate;
  } else if (isRecord(parsed.crdt) && typeof parsed.crdt.updateBlob === "string") {
    crdtBase64 = parsed.crdt.updateBlob;
  }

  if (crdtBase64 === undefined) {
    throw new Error("Failed to deserialize .talweg file: missing or invalid crdtUpdate");
  }

  const crdtBytes = base64ToUint8Array(crdtBase64);
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, crdtBytes, TRANSACTION_ORIGINS.STORAGE_HYDRATION);

  const docFromY = yDocToDocument(ydoc);
  const yMeta = docFromY as {
    id?: DocumentId;
    schemaVersion?: number;
    name?: string;
    viewport?: CanvasDocument["viewport"];
    grid?: CanvasDocument["grid"];
    meta?: CanvasDocument["meta"];
  };
  const metaObj = isRecord(parsed.metadata) ? parsed.metadata : {};
  const snapshotObj = isRecord(parsed.sceneSnapshot) ? parsed.sceneSnapshot : {};

  const docId = (typeof metaObj.documentId === "string"
    ? metaObj.documentId
    : (yMeta.id ?? "doc-imported")) as DocumentId;
  const docTitle = (typeof metaObj.title === "string" && metaObj.title !== "" ? metaObj.title : undefined)
    ?? (typeof metaObj.name === "string" && metaObj.name !== "" ? metaObj.name : undefined)
    ?? (typeof yMeta.name === "string" && yMeta.name !== "" ? yMeta.name : "Untitled Document");
  const metaRecord = isRecord(yMeta.meta) ? yMeta.meta : undefined;
  const docCreatedAt = typeof metaObj.createdAt === "number"
    ? metaObj.createdAt
    : (typeof metaRecord?.createdAt === "number" ? metaRecord.createdAt : Date.now());
  const docUpdatedAt = typeof metaObj.updatedAt === "number"
    ? metaObj.updatedAt
    : (typeof metaRecord?.updatedAt === "number" ? metaRecord.updatedAt : Date.now());
  const docVersion = typeof metaRecord?.version === "number" ? metaRecord.version : 1;
  const lastModifiedBy = typeof metaRecord?.lastModifiedBy === "string" ? metaRecord.lastModifiedBy : undefined;
  const appVersion = typeof metaObj.appVersion === "string" ? metaObj.appVersion : "0.1.0";

  const doc: CanvasDocument = {
    id: docId,
    schemaVersion: typeof yMeta.schemaVersion === "number" ? yMeta.schemaVersion : 1,
    name: docTitle,
    nodes: Object.keys(docFromY.nodes).length > 0
      ? docFromY.nodes
      : (isRecord(snapshotObj.nodes) ? (snapshotObj.nodes as unknown as Record<NodeId, CanvasNode>) : {}),
    rootNodeIds: docFromY.rootNodeIds.length > 0
      ? docFromY.rootNodeIds
      : (Array.isArray(snapshotObj.rootNodeIds) ? (snapshotObj.rootNodeIds as NodeId[]) : []),
    viewport: isRecord(snapshotObj.viewport)
      ? (snapshotObj.viewport as unknown as CanvasDocument["viewport"])
      : (yMeta.viewport ?? { x: 0, y: 0, zoom: 1 }),
    grid: isRecord(snapshotObj.grid)
      ? (snapshotObj.grid as unknown as CanvasDocument["grid"])
      : (yMeta.grid ?? { enabled: true, size: 20, snapToGrid: false, gridType: "dots" }),
    meta: {
      createdAt: docCreatedAt,
      updatedAt: docUpdatedAt,
      version: docVersion,
      ...(lastModifiedBy ? { lastModifiedBy } : {}),
    },
  };

  const assetsObj = isRecord(parsed.assets) ? parsed.assets : {};
  const deserializedAssets: Record<string, DeserializedAsset> = {};

  for (const [key, val] of Object.entries(assetsObj)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    if (isRecord(val) && typeof val.base64Data === "string") {
      const dataBytes = base64ToUint8Array(val.base64Data);
      deserializedAssets[key] = {
        id: key,
        assetId: key,
        mimeType: typeof val.mimeType === "string" && val.mimeType !== "" ? val.mimeType : "application/octet-stream",
        base64Data: val.base64Data,
        data: dataBytes.buffer.slice(
          dataBytes.byteOffset,
          dataBytes.byteOffset + dataBytes.byteLength,
        ) as ArrayBuffer,
      };
    }
  }

  return {
    schemaVersion: 1,
    metadata: {
      documentId: docId,
      title: docTitle,
      createdAt: docCreatedAt,
      updatedAt: docUpdatedAt,
      appVersion,
    },
    sceneSnapshot: {
      viewport: doc.viewport,
      grid: doc.grid,
      nodeCount: Object.keys(doc.nodes).length,
      nodes: doc.nodes,
      rootNodeIds: doc.rootNodeIds,
    },
    crdtUpdate: crdtBytes,
    doc,
    ydoc,
    assets: deserializedAssets,
    rawContainer: parsed as unknown as TalwegFileContainer,
  };
}
