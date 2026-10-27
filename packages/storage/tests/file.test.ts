import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type {
  CanvasDocument,
  DocumentId,
  NodeId,
  RectangleNode,
  PageId,
} from "@talweg/core";
import {
  base64ToUint8Array,
  deserializeTalwegFile,
  documentToYDoc,
  serializeTalwegFile,
  uint8ArrayToBase64,
} from "../src/index.js";
import type { StorageAsset, TalwegFileContainer } from "../src/index.js";

function makeDocument(): CanvasDocument {
  const rectNode: RectangleNode = {
    id: "rect-1" as NodeId,
    type: "rectangle",
    x: 100,
    y: 200,
    width: 150,
    height: 80,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    parentId: null,
    isLocked: false,
    isVisible: true,
    style: {
      fillColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 2,
    },
    data: {
      label: "Node 1",
    },
    createdAt: 1000,
    updatedAt: 1500,
  };

  return {
    id: "doc-sample-1" as DocumentId,
    schemaVersion: 1,
    name: "Sample Architecture",
    nodes: {
      [rectNode.id]: rectNode,
    },
    rootNodeIds: [rectNode.id],
    viewport: { x: 50, y: 75, zoom: 1.5 },
    grid: { enabled: true, size: 20, snapToGrid: true, gridType: "dots" },
    meta: {
      createdAt: 1000,
      updatedAt: 2000,
      version: 1,
      lastModifiedBy: "architect",
    },
  };
}

describe("base64 utilities", () => {
  it("encodes and decodes Uint8Array round-trip including chunks", () => {
    const bytes = new Uint8Array(20000);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (i * 31) % 256;
    }

    const base64 = uint8ArrayToBase64(bytes);
    const decoded = base64ToUint8Array(base64);

    expect(decoded.length).toBe(bytes.length);
    expect(decoded).toEqual(bytes);
  });
});

describe("serializeTalwegFile and deserializeTalwegFile", () => {
  it("preserves page metadata and node membership when reopening a native file", () => {
    const doc = makeDocument();
    const first = "page-lesson" as PageId, second = "page-practice" as PageId;
    doc.pages = {
      [first]: { id: first, name: "Lesson", order: 0, createdAt: 1000, updatedAt: 1500 },
      [second]: { id: second, name: "Practice", order: 1, createdAt: 1000, updatedAt: 1500 },
    };
    doc.activePageId = second;
    const node = Object.values(doc.nodes)[0];
    if (!node) throw new Error("Missing fixture node");
    node.pageId = first;
    const scene = documentToYDoc(doc);
    const recovered = deserializeTalwegFile(serializeTalwegFile(doc, scene));
    try {
      expect(recovered.doc.pages).toEqual(doc.pages);
      expect(recovered.doc.activePageId).toBe(second);
      expect(recovered.doc.nodes[node.id]?.pageId).toBe(first);
    } finally { scene.destroy(); recovered.ydoc.destroy(); }
  });

  it("serializes and deserializes a document with Y.Doc and assets", () => {
    const doc = makeDocument();
    const ydoc = documentToYDoc(doc);
    const binaryData = new Uint8Array([10, 20, 30, 40]);

    const serialized = serializeTalwegFile(doc, ydoc, {
      "asset-img-1": {
        mimeType: "image/png",
        data: binaryData,
      },
      "asset-img-2": {
        mimeType: "image/jpeg",
        base64Data: "AQIDBA==",
      },
    });

    const parsedJson = JSON.parse(serialized) as TalwegFileContainer;
    expect(parsedJson.schemaVersion).toBe(1);
    expect(parsedJson.metadata.documentId).toBe("doc-sample-1");
    expect(parsedJson.metadata.title).toBe("Sample Architecture");
    expect(parsedJson.sceneSnapshot.nodeCount).toBe(1);
    expect(typeof parsedJson.crdtUpdate).toBe("string");
    expect(parsedJson.assets["asset-img-1"]?.mimeType).toBe("image/png");

    const deserialized = deserializeTalwegFile(serialized);

    expect(deserialized.schemaVersion).toBe(1);
    expect(deserialized.metadata.documentId).toBe(doc.id);
    expect(deserialized.metadata.title).toBe(doc.name);
    expect(deserialized.doc.id).toBe(doc.id);
    expect(deserialized.doc.name).toBe(doc.name);
    const rect = deserialized.doc.nodes["rect-1" as NodeId] as RectangleNode;
    expect(rect.data?.label).toBe("Node 1");
    expect(deserialized.doc.viewport).toEqual(doc.viewport);
    expect(deserialized.doc.grid).toEqual(doc.grid);
    expect(deserialized.doc.meta.lastModifiedBy).toBe("architect");

    expect(deserialized.assets["asset-img-1"]?.mimeType).toBe("image/png");
    expect(new Uint8Array(deserialized.assets["asset-img-1"]!.data)).toEqual(binaryData);
    expect(deserialized.assets["asset-img-2"]?.mimeType).toBe("image/jpeg");
    expect(new Uint8Array(deserialized.assets["asset-img-2"]!.data)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("handles assets passed as Map, StorageAsset array, and undefined", () => {
    const doc = makeDocument();
    const ydoc = documentToYDoc(doc);

    const assetMap = new Map([
      ["map-asset-1", { mimeType: "image/svg+xml", data: new Uint8Array([60, 115, 118, 103]) }],
    ]);
    const serializedMap = serializeTalwegFile(doc, ydoc, assetMap);
    const deserializedMap = deserializeTalwegFile(serializedMap);
    expect(deserializedMap.assets["map-asset-1"]?.mimeType).toBe("image/svg+xml");

    const storageAssets: StorageAsset[] = [
      {
        assetId: "array-asset-1",
        mimeType: "text/plain",
        data: new Uint8Array([1, 2]).buffer,
        size: 2,
        lastRetrieved: 0,
      },
    ];
    const serializedArray = serializeTalwegFile(doc, ydoc, storageAssets);
    const deserializedArray = deserializeTalwegFile(serializedArray);
    expect(deserializedArray.assets["array-asset-1"]?.mimeType).toBe("text/plain");

    const serializedNoAssets = serializeTalwegFile(doc, ydoc);
    const deserializedNoAssets = deserializeTalwegFile(serializedNoAssets);
    expect(Object.keys(deserializedNoAssets.assets).length).toBe(0);
  });

  it("deserializes from binary Uint8Array, ArrayBuffer, and parsed object", () => {
    const doc = makeDocument();
    const ydoc = documentToYDoc(doc);
    const serialized = serializeTalwegFile(doc, ydoc);

    const uint8 = new TextEncoder().encode(serialized);
    const fromUint8 = deserializeTalwegFile(uint8);
    expect(fromUint8.doc.id).toBe(doc.id);

    const arrayBuf = uint8.buffer;
    const fromArrayBuffer = deserializeTalwegFile(arrayBuf);
    expect(fromArrayBuffer.doc.id).toBe(doc.id);

    const objectForm = JSON.parse(serialized) as Record<string, unknown>;
    const fromObject = deserializeTalwegFile(objectForm);
    expect(fromObject.doc.id).toBe(doc.id);
  });

  it("supports spec format with talwegSchemaVersion and nested crdt.updateBlob", () => {
    const doc = makeDocument();
    const ydoc = documentToYDoc(doc);
    const updateBlob = uint8ArrayToBase64(Y.encodeStateAsUpdate(ydoc));

    const specContainer = {
      talwegSchemaVersion: 1,
      metadata: {
        documentId: "spec-doc-1",
        title: "Spec Board",
        createdAt: 500,
        updatedAt: 600,
        appVersion: "1.0.0",
      },
      crdt: {
        format: "yjs-update-v1",
        updateBlob,
      },
      sceneSnapshot: {
        viewport: { x: 0, y: 0, zoom: 1 },
        grid: { enabled: true, size: 16, snapToGrid: false },
        nodeCount: 1,
      },
      assets: {},
    };

    const deserialized = deserializeTalwegFile(specContainer);
    expect(deserialized.schemaVersion).toBe(1);
    expect(deserialized.metadata.title).toBe("Spec Board");
    expect(deserialized.doc.id).toBe("spec-doc-1");
  });

  it("falls back to sceneSnapshot when Y.Doc has no nodes", () => {
    const emptyYDoc = new Y.Doc();
    const updateBlob = uint8ArrayToBase64(Y.encodeStateAsUpdate(emptyYDoc));

    const containerWithSnapshot = {
      schemaVersion: 1,
      metadata: {
        documentId: "fallback-doc",
        name: "Fallback Name",
        createdAt: 100,
        updatedAt: 200,
      },
      crdtUpdate: updateBlob,
      sceneSnapshot: {
        viewport: { x: 10, y: 20, zoom: 2 },
        grid: { enabled: false, size: 24, snapToGrid: false, gridType: "lines" },
        nodeCount: 1,
        nodes: {
          "n-1": {
            id: "n-1",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            parentId: null,
            isLocked: false,
            isVisible: true,
            style: {},
            data: {},
            createdAt: 100,
            updatedAt: 100,
          },
        },
        rootNodeIds: ["n-1"],
      },
      assets: {},
    };

    const deserialized = deserializeTalwegFile(containerWithSnapshot);
    expect(deserialized.doc.nodes["n-1" as NodeId]).toBeDefined();
    expect(deserialized.doc.rootNodeIds).toEqual(["n-1"]);
    expect(deserialized.doc.name).toBe("Fallback Name");
    expect(deserialized.doc.viewport).toEqual({ x: 10, y: 20, zoom: 2 });
  });

  it("throws for invalid inputs and malformed formats", () => {
    expect(() => deserializeTalwegFile(12345 as unknown as string)).toThrow("unsupported data type");
    expect(() => deserializeTalwegFile("{ malformed json")).toThrow("invalid JSON");
    expect(() => deserializeTalwegFile(new Uint8Array([0, 1, 2]))).toThrow("invalid binary JSON");
    expect(() => deserializeTalwegFile(new Uint8Array([0, 1, 2]).buffer)).toThrow("invalid binary JSON");
    expect(() => deserializeTalwegFile("null")).toThrow("root container must be an object");
    expect(() => deserializeTalwegFile("[]")).toThrow("root container must be an object");

    expect(() => deserializeTalwegFile(JSON.stringify({ schemaVersion: 2, crdtUpdate: "abc" }))).toThrow(
      "Unsupported .talweg file schema version",
    );
    expect(() => deserializeTalwegFile(JSON.stringify({ crdtUpdate: "abc" }))).toThrow(
      "Unsupported .talweg file schema version: undefined",
    );
    expect(() => deserializeTalwegFile(JSON.stringify({ schemaVersion: 1 }))).toThrow(
      "missing or invalid crdtUpdate",
    );
  });

  it("handles asset normalization edge cases", () => {
    const doc = makeDocument();
    const ydoc = documentToYDoc(doc);

    const assetRecords = [
      {
        id: "record-1",
        mimeType: "",
        data: new Uint8Array([1, 2, 3]).buffer,
        createdAt: 100,
      },
      {
        id: "record-2",
        mimeType: "text/plain",
        base64Data: "AQID",
        data: new Uint8Array([]).buffer,
        createdAt: 100,
      },
      {
        mimeType: "text/plain",
        data: new Uint8Array([]).buffer,
      } as unknown as StorageAsset,
    ];

    const serialized = serializeTalwegFile(doc, ydoc, assetRecords);
    const deserialized = deserializeTalwegFile(serialized);

    expect(deserialized.assets["record-1"]?.mimeType).toBe("application/octet-stream");
    expect(deserialized.assets["record-2"]?.base64Data).toBe("AQID");

    const objectAssets = {
      "raw-buf": {
        mimeType: "",
        data: new Uint8Array([5, 6]).buffer,
      },
      "empty-val": {
        mimeType: "",
      },
    };

    const serializedObj = serializeTalwegFile(doc, ydoc, objectAssets);
    const deserializedObj = deserializeTalwegFile(serializedObj);
    expect(deserializedObj.assets["raw-buf"]?.mimeType).toBe("application/octet-stream");
  });

  it("handles minimal containers and document without meta or nodes", () => {
    const minimalDoc: CanvasDocument = {
      id: "doc-min" as DocumentId,
      schemaVersion: 1,
      name: "",
      nodes: {},
      rootNodeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      grid: { enabled: false, size: 20, snapToGrid: false, gridType: "dots" },
      meta: {
        createdAt: 0,
        updatedAt: 0,
        version: 1,
      },
    };

    const emptyYDoc = new Y.Doc();
    const updateBlob = uint8ArrayToBase64(Y.encodeStateAsUpdate(emptyYDoc));

    const minimalContainer = {
      schemaVersion: 1,
      crdtUpdate: updateBlob,
      assets: {
        "asset-no-mime": {
          base64Data: "AQID",
        },
        "invalid-asset": null,
      },
    };

    const deserialized = deserializeTalwegFile(minimalContainer);
    expect(deserialized.doc.id).toBe("doc-imported");
    expect(deserialized.doc.name).toBe("Untitled Document");
    expect(deserialized.assets["asset-no-mime"]?.mimeType).toBe("application/octet-stream");
    expect(deserialized.assets["invalid-asset"]).toBeUndefined();

    const serializedMin = serializeTalwegFile(minimalDoc, emptyYDoc);
    const deserializedMin = deserializeTalwegFile(serializedMin);
    expect(deserializedMin.doc.id).toBe("doc-min");

    const containerWithoutAssets = {
      schemaVersion: 1,
      crdtUpdate: updateBlob,
    };
    const deserializedNoAssets = deserializeTalwegFile(containerWithoutAssets);
    expect(Object.keys(deserializedNoAssets.assets).length).toBe(0);

    const docWithMeta: CanvasDocument = {
      ...minimalDoc,
      id: "doc-meta-test" as DocumentId,
      name: "Doc With Meta",
      meta: {
        createdAt: 12345,
        updatedAt: 67890,
        version: 2,
        lastModifiedBy: "user-42",
      },
    };
    const yWithMeta = documentToYDoc(docWithMeta);
    const updateWithMeta = uint8ArrayToBase64(Y.encodeStateAsUpdate(yWithMeta));
    const containerWithoutOuterMeta = {
      schemaVersion: 1,
      crdtUpdate: updateWithMeta,
    };
    const deserWithoutOuterMeta = deserializeTalwegFile(containerWithoutOuterMeta);
    expect(deserWithoutOuterMeta.doc.id).toBe("doc-meta-test");
    expect(deserWithoutOuterMeta.doc.name).toBe("Doc With Meta");
    expect(deserWithoutOuterMeta.doc.meta.createdAt).toBe(12345);
    expect(deserWithoutOuterMeta.doc.meta.updatedAt).toBe(67890);
    expect(deserWithoutOuterMeta.doc.meta.version).toBe(2);
    expect(deserWithoutOuterMeta.doc.meta.lastModifiedBy).toBe("user-42");
    expect(deserWithoutOuterMeta.metadata.title).toBe("Doc With Meta");

    const containerWithName = {
      schemaVersion: 1,
      metadata: {
        documentId: "doc-name-test",
        name: "Name From Meta",
        createdAt: 1111,
        updatedAt: 2222,
      },
      crdtUpdate: updateBlob,
    };
    const deserWithName = deserializeTalwegFile(containerWithName);
    expect(deserWithName.doc.name).toBe("Name From Meta");

    const containerWithMaliciousAssets = {
      schemaVersion: 1,
      crdtUpdate: updateBlob,
      assets: {
        __proto__: { base64Data: "AQID", mimeType: "image/png" },
        constructor: { base64Data: "AQID", mimeType: "image/png" },
        prototype: { base64Data: "AQID", mimeType: "image/png" },
        safeAsset: { base64Data: "AQID", mimeType: "image/png" },
      },
    };
    const deserMalicious = deserializeTalwegFile(containerWithMaliciousAssets);
    expect(deserMalicious.assets.safeAsset).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(deserMalicious.assets, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(deserMalicious.assets, "constructor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(deserMalicious.assets, "prototype")).toBe(false);
  });
});

