import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import {
  type ArrowNode,
  type CanvasDocument,
  type CanvasNode,
  type CanvasPage,
  type CameraViewport,
  type DocumentId,
  type NodeId,
  type PageId,
  type Point2D,
  computeGroupBounds,
  zoomAtViewportPoint,
  sanitizeCamera,
  screenToWorld,
  zoomToBounds,
} from "@talweg/core";
import { parseCameraHash, useCameraUrlSync } from "./useCameraUrlSync.js";
import {
  IndexedDBStorageAdapter,
  SCENE_META_KEY,
  SCENE_NODES_KEY,
  SCENE_ROOT_ORDER_KEY,
  TRANSACTION_ORIGINS,
  applyDocumentToYDoc,
  createSceneDoc,
  createSceneUndoManager,
  toYValue,
  yDocToDocument,
  type StorageDelta,
} from "@talweg/storage";
import type {
  ArrowCurveStyle,
  ArrowEndpoint,
  CanvasMode,
  CompassAnchor,
  ToolType,
} from "../types.js";
import { getImageDimensions, setCachedAssetUrl } from "../utils/assets.js";
import { getLinkedFileHandle, type FileSaveState, type NativeFileSystemFileHandle, saveDocumentToFileSystem } from "../utils/fileSystem.js";
import { layoutMindmapTree } from "../utils/mindmap.js";
import { createId, createInitialScene } from "../utils/template.js";

import { promoteTemplateDraft } from "../utils/boardLibrary.js";

const DEFAULT_DOC_ID = "default-doc" as DocumentId;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 10000;
const BACKOFF_FACTOR = 1.5;

export interface UseCanvasReturn {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  document: CanvasDocument | null;
  camera: CameraViewport;
  adapter: IndexedDBStorageAdapter | null;
  selectedNodeIds: ReadonlySet<NodeId>;
  activeTool: ToolType;
  mode: CanvasMode;
  canUndo: boolean;
  canRedo: boolean;
  isLoaded: boolean;
  setCamera: React.Dispatch<React.SetStateAction<CameraViewport>>;
  setActiveTool: (tool: ToolType) => void;
  setMode: (mode: CanvasMode) => void;
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<ReadonlySet<NodeId>>>;
  addNode: (node: CanvasNode) => void;
  updateNode: (id: NodeId, updates: Partial<CanvasNode>) => void;
  updateNodeData: (id: NodeId, partialData: Record<string, unknown>) => void;
  moveNode: (id: NodeId, deltaX: number, deltaY: number) => void;
  batchMoveNodes: (positions: ReadonlyMap<NodeId, Point2D>) => void;
  deleteSelectedNodes: () => void;
  deleteNode: (id: NodeId) => void;
  connectNodes: (
    sourceId: NodeId,
    targetId: NodeId,
    label?: string,
    sourceAnchor?: CompassAnchor,
    targetAnchor?: CompassAnchor,
    curveStyle?: ArrowCurveStyle,
  ) => void;
  reconnectArrow: (
    arrowId: NodeId,
    endpoint: ArrowEndpoint,
    nodeId: NodeId,
    anchor: CompassAnchor,
  ) => void;
  undo: () => void;
  redo: () => void;
  saveToFile: () => Promise<boolean>;
  fileSaveState: FileSaveState;
  importImage: (file: File | Blob, clientPoint?: Point2D) => Promise<void>;
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  createMindmapChild: (parentId: NodeId) => void;
  createMindmapSibling: (nodeId: NodeId) => void;
  updateDocumentName: (name: string) => void;
  activePageId: PageId;
  pages: CanvasPage[];
  setActivePageId: (pageId: PageId) => void;
  addPage: (name?: string) => PageId;
  renamePage: (pageId: PageId, newName: string) => void;
  deletePage: (pageId: PageId) => void;
}

export function useCanvas(
  documentId: DocumentId = DEFAULT_DOC_ID,
  initialPageId?: PageId,
): UseCanvasReturn {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [docState, setDocState] = useState<CanvasDocument | null>(null);
  const [camera, setCamera] = useState<CameraViewport>(() => {
    return parseCameraHash() ?? { x: 0, y: 0, zoom: 1.0 };
  });
  const [activePageId, setActivePageId] = useState<PageId>(initialPageId ?? "page-1");
  const [selectedNodeIds, setSelectedNodeIds] = useState<ReadonlySet<NodeId>>(new Set());
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [mode, setMode] = useState<CanvasMode>("whiteboard");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [adapterState, setAdapterState] = useState<IndexedDBStorageAdapter | null>(null);

  useCameraUrlSync(camera, isLoaded);

  const [storageError, setStorageError] = useState(false);
  const [fileSaveState, setFileSaveState] = useState<FileSaveState>("browser");
  const fileWritesRef = useRef<Promise<void>>(Promise.resolve());
  const ydocRef = useRef<Y.Doc | null>(null);
  const adapterRef = useRef<IndexedDBStorageAdapter | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const clockRef = useRef(0);
  const pendingDeltasRef = useRef<StorageDelta[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const disposedRef = useRef(false);

  const cameraRef = useRef<CameraViewport>(camera);
  cameraRef.current = camera;

  const initialPageIdRef = useRef(initialPageId);
  initialPageIdRef.current = initialPageId;

  const mouseScreenRef = useRef<Point2D>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      mouseScreenRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseCameraHash();
      if (parsed) {
        setCamera(parsed);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const flushDeltas = useCallback(async () => {
    const deltas = pendingDeltasRef.current;
    const adapter = adapterRef.current;
    if (deltas.length === 0 || !adapter) return;

    pendingDeltasRef.current = [];
    try {
      await adapter.saveDeltas(deltas);
      if (adapterRef.current === adapter) setStorageError(false);
    } catch (error) {
      if (adapterRef.current === adapter) {
        pendingDeltasRef.current.unshift(...deltas);
        setStorageError(true);
      }
      console.error("[Talweg] Could not save canvas changes:", error);
    }
  }, []);

  useEffect(() => {
    setIsLoaded(false);
    setSelectedNodeIds(new Set());
    const storageDisposedRef = { current: false };
    const adapter = new IndexedDBStorageAdapter();
    adapterRef.current = adapter;

    async function initializeScene() {
      try {
        await adapter.initialize();
        if (storageDisposedRef.current) return;

        const snapshot = await adapter.loadSnapshot(documentId);
        const deltas = await adapter.loadDeltas(documentId, snapshot?.clock ?? -1);

        let ydoc = createSceneDoc();
        ydocRef.current = ydoc;

        try {
          if (snapshot !== null) {
            Y.applyUpdate(ydoc, snapshot.documentBlob, TRANSACTION_ORIGINS.STORAGE_HYDRATION);
            for (const delta of deltas) {
              try {
                Y.applyUpdate(ydoc, delta.updateBlob, TRANSACTION_ORIGINS.STORAGE_HYDRATION);
              } catch (deltaErr) {
                console.warn("[Talweg] Skipping corrupted delta:", deltaErr);
              }
            }
            clockRef.current = deltas.length > 0 ? (deltas[deltas.length - 1]?.sequenceNumber ?? snapshot.clock) : snapshot.clock;
          } else if (deltas.length > 0) {
            for (const delta of deltas) {
              try {
                Y.applyUpdate(ydoc, delta.updateBlob, TRANSACTION_ORIGINS.STORAGE_HYDRATION);
              } catch (deltaErr) {
                console.warn("[Talweg] Skipping corrupted delta:", deltaErr);
              }
            }
            clockRef.current = deltas[deltas.length - 1]?.sequenceNumber ?? 0;
          } else {
            const seed = createInitialScene(documentId);
            applyDocumentToYDoc(seed, ydoc);
            const stateVector = Y.encodeStateVector(ydoc);
            const documentBlob = Y.encodeStateAsUpdate(ydoc);

            await adapter.saveSnapshot({
              meta: {
                documentId,
                name: seed.name,
                schemaVersion: seed.schemaVersion,
                createdAt: seed.meta.createdAt,
                updatedAt: seed.meta.updatedAt,
                nodeCount: Object.keys(seed.nodes).length,
              },
              clock: 0,
              stateVector,
              documentBlob,
            });
            clockRef.current = 0;
          }
        } catch (err) {
          console.error("[Talweg] Corrupted snapshot in IndexedDB. Re-initializing clean document:", err);
          ydoc.destroy();
          ydoc = createSceneDoc();
          ydocRef.current = ydoc;
          const seed = createInitialScene(documentId);
          applyDocumentToYDoc(seed, ydoc);
          clockRef.current = 0;
        }

        const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
        const rootOrderArray = ydoc.getArray<string>(SCENE_ROOT_ORDER_KEY);
        const undoManager = createSceneUndoManager(nodesMap, rootOrderArray);
        undoManagerRef.current = undoManager;

        const updateUndoState = () => {
          setCanUndo(undoManager.canUndo());
          setCanRedo(undoManager.canRedo());
        };

        undoManager.on("stack-item-added", updateUndoState);
        undoManager.on("stack-item-popped", updateUndoState);

        let initializing = true;
        let fileWriteRunning = false;
        let pendingFileWrite: { document: CanvasDocument; update: Uint8Array; handle: NativeFileSystemFileHandle } | null = null;
        const flushLinkedFile = async () => {
          fileWriteRunning = true;
          try {
            while (pendingFileWrite) {
              const pending = pendingFileWrite;
              pendingFileWrite = null;
              const scene = createSceneDoc();
              try {
                Y.applyUpdate(scene, pending.update);
                await saveDocumentToFileSystem(pending.document, scene, { adapter, linkedHandle: pending.handle, autoSave: true });
              } finally { scene.destroy(); }
            }
            if (!storageDisposedRef.current) setFileSaveState("file");
          } catch (error) {
            pendingFileWrite = null;
            console.error("[Talweg] Linked file could not be saved", error);
            if (!storageDisposedRef.current) setFileSaveState("error");
          } finally { fileWriteRunning = false; }
        };
        ydoc.on("update", (update: Uint8Array, origin: unknown) => {
          const currentDoc = yDocToDocument(ydoc);
          setDocState(currentDoc);

          if (origin === TRANSACTION_ORIGINS.LOCAL_USER || origin === undoManager) {
            if (!initializing) {
              promoteTemplateDraft(documentId);
              const handle = getLinkedFileHandle(documentId);
              if (handle) {
                pendingFileWrite = { document: currentDoc, update: Y.encodeStateAsUpdate(ydoc), handle };
                setFileSaveState("saving");
                if (!fileWriteRunning) fileWritesRef.current = flushLinkedFile();
              }
            }
            clockRef.current += 1;
            pendingDeltasRef.current.push({
              documentId,
              sequenceNumber: clockRef.current,
              updateBlob: update,
              origin: TRANSACTION_ORIGINS.LOCAL_USER,
              timestamp: Date.now(),
            });
            // start the IndexedDB transaction before navigation can discard a timer
            void flushDeltas();

            // Broadcast local edit update to WebSocket room
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(new Uint8Array([2, ...update]));
            }
          }
        });

        const initialParsedDoc = yDocToDocument(ydoc);
        setDocState(initialParsedDoc);

        if (initialParsedDoc.pages && Object.keys(initialParsedDoc.pages).length > 0) {
          const requestedPageId = initialPageIdRef.current;
          if (requestedPageId && initialParsedDoc.pages[requestedPageId]) {
            setActivePageId(requestedPageId);
          } else if (initialParsedDoc.activePageId && initialParsedDoc.pages[initialParsedDoc.activePageId]) {
            setActivePageId(initialParsedDoc.activePageId);
          } else {
            const firstId = Object.keys(initialParsedDoc.pages)[0] ?? "page-1";
            setActivePageId(firstId);
          }
        } else {
          const defaultPage: CanvasPage = {
            id: "page-1",
            name: "Page 1",
            order: 0,
            createdAt: initialParsedDoc.meta.createdAt,
            updatedAt: initialParsedDoc.meta.updatedAt,
          };
          const metaMap = ydoc.getMap<unknown>(SCENE_META_KEY);
          // hydration origin skips the delta log, so pages never reach storage
          // and later page deltas chain on origins absent from the snapshot
          ydoc.transact(() => {
            metaMap.set("pages", toYValue({ "page-1": defaultPage }));
            metaMap.set("activePageId", "page-1");
          }, TRANSACTION_ORIGINS.LOCAL_USER);
          setActivePageId("page-1");
        }

        const linkedNodeId = new URLSearchParams(window.location.search).get("node") as NodeId | null;
        const linkedNode = linkedNodeId ? initialParsedDoc.nodes[linkedNodeId] : undefined;
        if (linkedNodeId && linkedNode) {
          setSelectedNodeIds(new Set([linkedNodeId]));
          if (linkedNode.pageId) setActivePageId(linkedNode.pageId);
        }
        setFileSaveState(getLinkedFileHandle(documentId) ? "file" : "browser");
        initializing = false;
        const urlCamera = parseCameraHash();
        if (linkedNode) {
          setCamera(zoomToBounds(computeGroupBounds([linkedNode]), { width: window.innerWidth, height: window.innerHeight - 56 }, 80, .2, 1.2));
        } else if (urlCamera) {
          setCamera(urlCamera);
        } else {
          const allNodes = Object.values(initialParsedDoc.nodes).filter(
            (node) => node.type !== "arrow",
          );
          if (allNodes.length > 0) {
            const bounds = computeGroupBounds(allNodes);
            if (bounds.width > 0 && bounds.height > 0) {
              const viewportSize = {
                width: typeof window !== "undefined" ? window.innerWidth : 1200,
                height: typeof window !== "undefined" ? window.innerHeight - 40 : 800,
              };
              // small scenes read better above 100% scale, hence the 1.8 ceiling
              setCamera(zoomToBounds(bounds, viewportSize, 60, 0.2, 1.8));
            } else {
              setCamera(initialParsedDoc.viewport);
            }
          } else {
            setCamera(initialParsedDoc.viewport);
          }
        }
      } catch (err) {
        console.error("[Talweg] Unexpected error during initialization:", err);
      } finally {
        if (!storageDisposedRef.current) {
          setAdapterState(adapter);
          setIsLoaded(true);
        }
      }
    }

    void initializeScene();

    return () => {
      storageDisposedRef.current = true;
      void flushDeltas();
      undoManagerRef.current?.destroy();
      ydocRef.current?.destroy();
      setAdapterState(null);
      adapterRef.current = null;
      void fileWritesRef.current.then(() => adapter.close());
    };
  }, [documentId, flushDeltas]);

  // tab navigation swaps the route page without remounting the board
  useEffect(() => {
    if (initialPageId) {
      setActivePageId(initialPageId);
    }
  }, [initialPageId]);

  // Real-time WebSocket room synchronization with exponential backoff & auto-reconnect
  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded) return;

    const searchParams = new URLSearchParams(window.location.search);
    const roomId = searchParams.get("room");
    if (!roomId) return;

    const ydoc = ydocRef.current;
    if (!ydoc) return;

    disposedRef.current = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/talweg-sync?room=${encodeURIComponent(roomId)}`;

    const scheduleReconnect = () => {
      if (disposedRef.current) return;
      if (reconnectTimerRef.current !== null) return;

      const delay = Math.min(
        INITIAL_RECONNECT_DELAY_MS * Math.pow(BACKOFF_FACTOR, retryCountRef.current),
        MAX_RECONNECT_DELAY_MS,
      );
      retryCountRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposedRef.current) return;

      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }

      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposedRef.current) {
          ws.close();
          return;
        }
        retryCountRef.current = 0;

        // 1. Send local state vector to request delta from peers (SYNC_STEP_1)
        const sv = Y.encodeStateVector(ydoc);
        ws.send(new Uint8Array([0, ...sv]));

        // 2. Send local state update so new or empty peers receive our nodes (SYNC_STEP_2)
        const fullUpdate = Y.encodeStateAsUpdate(ydoc);
        if (fullUpdate.length > 0) {
          ws.send(new Uint8Array([1, ...fullUpdate]));
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        const data = event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : event.data instanceof Uint8Array
            ? event.data
            : null;
        if (!data || data.length === 0) return;

        // SYNC_STEP_1: Remote peer sent its state vector; reply with diff update
        if (data[0] === 0) {
          const remoteVector = data.subarray(1);
          const diff = Y.encodeStateAsUpdate(ydoc, remoteVector);
          if (diff.length > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(new Uint8Array([1, ...diff]));
          }
          return;
        }

        // SYNC_STEP_2 or SYNC_UPDATE or raw binary update
        const updateData = (data[0] === 1 || data[0] === 2) ? data.subarray(1) : data;
        try {
          Y.applyUpdate(ydoc, updateData, TRANSACTION_ORIGINS.REMOTE_SYNC);
        } catch {
          // If untagged state vector was received, reply with diff
          try {
            const diff = Y.encodeStateAsUpdate(ydoc, data);
            if (diff.length > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(new Uint8Array([1, ...diff]));
            }
          } catch {
            // ignore invalid packets
          }
        }
      };

      ws.onclose = () => {
        if (disposedRef.current) return;
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (disposedRef.current) return;
        scheduleReconnect();
      };
    };

    const handleOnline = () => {
      if (disposedRef.current) return;
      retryCountRef.current = 0;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      connect();
    };

    window.addEventListener("online", handleOnline);
    connect();

    return () => {
      disposedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      window.removeEventListener("online", handleOnline);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isLoaded, documentId]);



  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  const saveToFile = useCallback(async () => {
    if (!docState || !ydocRef.current) return false;
    const saved = await saveDocumentToFileSystem(docState, ydocRef.current, { adapter: adapterRef.current });
    if (saved.success) {
      promoteTemplateDraft(docState.id);
      setFileSaveState(getLinkedFileHandle(docState.id) ? "file" : "browser");
    }
    return saved.success;
  }, [docState]);

  const addNode = useCallback(
    (node: CanvasNode) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;

      const nodeWithPage: CanvasNode = {
        ...node,
        pageId: node.pageId ?? activePageId,
      };

      ydoc.transact(() => {
        const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
        const rootOrder = ydoc.getArray<string>(SCENE_ROOT_ORDER_KEY);

        const nodeMap = new Y.Map<unknown>();
        for (const [key, value] of Object.entries(nodeWithPage)) {
          if (value !== undefined) {
            nodeMap.set(key, toYValue(value));
          }
        }

        nodesMap.set(nodeWithPage.id, nodeMap);
        rootOrder.push([nodeWithPage.id]);
      }, TRANSACTION_ORIGINS.LOCAL_USER);

      setSelectedNodeIds(new Set([nodeWithPage.id]));
    },
    [activePageId],
  );

  const pagesList = useMemo((): CanvasPage[] => {
    if (!docState?.pages || Object.keys(docState.pages).length === 0) {
      return [
        {
          id: "page-1",
          name: "Page 1",
          order: 0,
          createdAt: docState?.meta.createdAt ?? 1700000000000,
          updatedAt: docState?.meta.updatedAt ?? 1700000000000,
        },
      ];
    }
    return Object.values(docState.pages).sort((a, b) => a.order - b.order);
  }, [docState?.pages, docState?.meta.createdAt, docState?.meta.updatedAt]);

  const selectPage = useCallback((pageId: PageId) => {
    setActivePageId(pageId);
    setSelectedNodeIds(new Set());
    const ydoc = ydocRef.current;
    if (ydoc) {
      const metaMap = ydoc.getMap<unknown>(SCENE_META_KEY);
      ydoc.transact(() => {
        metaMap.set("activePageId", pageId);
      }, TRANSACTION_ORIGINS.LOCAL_USER);
    }
  }, []);

  const addPage = useCallback((name?: string): PageId => {
    const ydoc = ydocRef.current;
    if (!ydoc) return "page-1";
    const currentDoc = yDocToDocument(ydoc);
    const existingPages: Record<PageId, CanvasPage> = currentDoc.pages && Object.keys(currentDoc.pages).length > 0
      ? { ...currentDoc.pages }
      : {
          "page-1": {
            id: "page-1",
            name: "Page 1",
            order: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        };
    const count = Object.keys(existingPages).length;
    const newPageId: PageId = `page-${Date.now().toString(36)}`;
    const newPage: CanvasPage = {
      id: newPageId,
      name: name ?? `Page ${String(count + 1)}`,
      order: count,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    existingPages[newPageId] = newPage;
    const metaMap = ydoc.getMap<unknown>(SCENE_META_KEY);
    ydoc.transact(() => {
      metaMap.set("pages", toYValue(existingPages));
      metaMap.set("activePageId", newPageId);
    }, TRANSACTION_ORIGINS.LOCAL_USER);
    setActivePageId(newPageId);
    setSelectedNodeIds(new Set());
    return newPageId;
  }, []);

  const renamePage = useCallback((pageId: PageId, newName: string): void => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const currentDoc = yDocToDocument(ydoc);
    const existingPages = currentDoc.pages;
    if (!existingPages?.[pageId]) return;
    const updatedPages: Record<PageId, CanvasPage> = {
      ...existingPages,
      [pageId]: {
        ...existingPages[pageId],
        name: newName.trim() || existingPages[pageId].name,
        updatedAt: Date.now(),
      },
    };
    const metaMap = ydoc.getMap<unknown>(SCENE_META_KEY);
    ydoc.transact(() => {
      metaMap.set("pages", toYValue(updatedPages));
    }, TRANSACTION_ORIGINS.LOCAL_USER);
  }, []);

  const deletePage = useCallback((pageId: PageId): void => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const currentDoc = yDocToDocument(ydoc);
    const existingPages = currentDoc.pages;
    if (!existingPages || Object.keys(existingPages).length <= 1) return;
    const remaining: Record<PageId, CanvasPage> = {};
    for (const [id, page] of Object.entries(existingPages)) {
      if (id !== pageId) {
        remaining[id] = page;
      }
    }
    const remainingList = Object.values(remaining).sort((a, b) => a.order - b.order);
    const nextActiveId = remainingList[0]?.id ?? "page-1";

    const metaMap = ydoc.getMap<unknown>(SCENE_META_KEY);
    const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
    ydoc.transact(() => {
      for (const [nodeId, node] of Object.entries(currentDoc.nodes)) {
        if (node.pageId === pageId) {
          nodesMap.delete(nodeId);
        }
      }
      metaMap.set("pages", toYValue(remaining));
      metaMap.set("activePageId", nextActiveId);
    }, TRANSACTION_ORIGINS.LOCAL_USER);
    setActivePageId(nextActiveId);
    setSelectedNodeIds(new Set());
  }, []);

  const updateNode = useCallback((id: NodeId, updates: Partial<CanvasNode>) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    ydoc.transact(() => {
      const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
      const nodeMap = nodesMap.get(id);
      if (!nodeMap) return;

      for (const [key, value] of Object.entries(updates as Record<string, unknown>)) {
        if (value !== undefined) {
          nodeMap.set(key, toYValue(value));
        }
      }
      nodeMap.set("updatedAt", Date.now());
    }, TRANSACTION_ORIGINS.LOCAL_USER);
  }, []);

  const updateNodeData = useCallback((id: NodeId, partialData: Record<string, unknown>) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    ydoc.transact(() => {
      const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
      const nodeMap = nodesMap.get(id);
      if (!nodeMap) return;

      const existingData = nodeMap.get("data");
      if (existingData instanceof Y.Map) {
        for (const [key, value] of Object.entries(partialData)) {
          if (value !== undefined) {
            existingData.set(key, toYValue(value));
          }
        }
      } else {
        const dataMap = new Y.Map<unknown>();
        for (const [key, value] of Object.entries(partialData)) {
          if (value !== undefined) {
            dataMap.set(key, toYValue(value));
          }
        }
        nodeMap.set("data", dataMap);
      }
      nodeMap.set("updatedAt", Date.now());
    }, TRANSACTION_ORIGINS.LOCAL_USER);
  }, []);

  const moveNode = useCallback((id: NodeId, deltaX: number, deltaY: number) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    ydoc.transact(() => {
      const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
      const nodeMap = nodesMap.get(id);
      if (!nodeMap) return;

      const currentX = (nodeMap.get("x") as number | undefined) ?? 0;
      const currentY = (nodeMap.get("y") as number | undefined) ?? 0;

      nodeMap.set("x", currentX + deltaX);
      nodeMap.set("y", currentY + deltaY);
      nodeMap.set("updatedAt", Date.now());
    }, TRANSACTION_ORIGINS.LOCAL_USER);
  }, []);

  const batchMoveNodes = useCallback((positions: ReadonlyMap<NodeId, Point2D>) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    ydoc.transact(() => {
      const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
      for (const [id, point] of positions.entries()) {
        const nodeMap = nodesMap.get(id);
        if (!nodeMap) continue;

        nodeMap.set("x", point.x);
        nodeMap.set("y", point.y);
      }
    }, TRANSACTION_ORIGINS.LOCAL_USER);
  }, []);

  const deleteNode = useCallback((id: NodeId) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    ydoc.transact(() => {
      const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
      const rootOrder = ydoc.getArray<string>(SCENE_ROOT_ORDER_KEY);

      nodesMap.delete(id);
      const rootArray = rootOrder.toArray();
      const index = rootArray.indexOf(id);
      if (index !== -1) {
        rootOrder.delete(index, 1);
      }

      nodesMap.forEach((candidateMap, candidateId) => {
        if (candidateMap.get("type") === "arrow") {
          const data = candidateMap.get("data");
          if (data instanceof Y.Map) {
            const sourceId: unknown = data.get("sourceId");
            const targetId: unknown = data.get("targetId");
            if (sourceId === id || targetId === id) {
              nodesMap.delete(candidateId);
              const edgeIndex = rootOrder.toArray().indexOf(candidateId);
              if (edgeIndex !== -1) {
                rootOrder.delete(edgeIndex, 1);
              }
            }
          }
        }
      });
    }, TRANSACTION_ORIGINS.LOCAL_USER);

    setSelectedNodeIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const deleteSelectedNodes = useCallback(() => {
    for (const id of selectedNodeIds) {
      deleteNode(id);
    }
    setSelectedNodeIds(new Set());
  }, [deleteNode, selectedNodeIds]);

  const connectNodes = useCallback(
    (
      sourceId: NodeId,
      targetId: NodeId,
      label?: string,
      sourceAnchor?: CompassAnchor,
      targetAnchor?: CompassAnchor,
      curveStyle?: ArrowCurveStyle,
    ) => {
      if (sourceId === targetId) return;

      const arrowId = createId("arrow");
      const timestamp = Date.now();
      const effectiveCurve: ArrowCurveStyle =
        curveStyle ?? (mode === "mindmap" ? "bezier" : "orthogonal");

      const arrowNode: ArrowNode = {
        id: arrowId,
        type: "arrow",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        zIndex: 5,
        opacity: 1,
        parentId: null,
        isLocked: false,
        isVisible: true,
        style: {
          strokeColor: effectiveCurve === "bezier" ? "#818cf8" : "#38bdf8",
          strokeWidth: 1.5,
        },
        data: {
          sourceId,
          targetId,
          startArrow: "none",
          endArrow: effectiveCurve === "bezier" ? "none" : "arrow",
          ...(label ? { label } : {}),
          ...(sourceAnchor ? { sourceAnchor } : {}),
          ...(targetAnchor ? { targetAnchor } : {}),
          curveStyle: effectiveCurve,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      addNode(arrowNode);
    },
    [addNode, mode],
  );

  const reconnectArrow = useCallback(
    (
      arrowId: NodeId,
      endpoint: ArrowEndpoint,
      nodeId: NodeId,
      anchor: CompassAnchor,
    ) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;

      const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
      const arrowMap = nodesMap.get(arrowId);
      if (arrowMap?.get("type") !== "arrow") return;

      const data = arrowMap.get("data");
      if (!(data instanceof Y.Map)) return;
      const dataMap = data as Y.Map<unknown>;

      const nodeMap = nodesMap.get(nodeId);
      if (nodeMap?.get("type") === "arrow") return;

      const endpointKey = endpoint === "source" ? "sourceId" : "targetId";
      const anchorKey = endpoint === "source" ? "sourceAnchor" : "targetAnchor";
      const oppositeId = dataMap.get(endpoint === "source" ? "targetId" : "sourceId");
      if (typeof oppositeId === "string" && oppositeId === nodeId) return;

      ydoc.transact(() => {
        dataMap.set(endpointKey, nodeId);
        dataMap.set(anchorKey, anchor);
        arrowMap.set("updatedAt", Date.now());
      }, TRANSACTION_ORIGINS.LOCAL_USER);
    },
    [],
  );

  const updateZoom = useCallback((target: (zoom: number) => number) => {
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setCamera((prev) => {
      const safe = sanitizeCamera(prev);
      return zoomAtViewportPoint(safe, { x: bounds.width / 2, y: bounds.height / 2 }, target(safe.zoom));
    });
  }, []);

  const resetZoom = useCallback(() => {
    updateZoom(() => 1);
  }, [updateZoom]);

  const zoomIn = useCallback(() => {
    updateZoom((zoom) => zoom * 1.1);
  }, [updateZoom]);

  const zoomOut = useCallback(() => {
    updateZoom((zoom) => zoom / 1.1);
  }, [updateZoom]);

  const zoomToFit = useCallback(() => {
    if (!docState) return;
    const allNodes = Object.values(docState.nodes).filter((node) => node.type !== "arrow");
    if (allNodes.length === 0) return;

    const bounds = computeGroupBounds(allNodes);
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const viewport = viewportRef.current;
    if (!viewport) return;
    const viewportSize = { width: viewport.clientWidth, height: viewport.clientHeight };
    setCamera(zoomToBounds(bounds, viewportSize, 60, 0.2, 1.8));
  }, [docState]);

  const hasAutoFramedRef = useRef(false);

  useEffect(() => {
    hasAutoFramedRef.current = false;
  }, [documentId]);

  // a camera hash in the url is an explicit user viewport; autoframe only when it is absent
  const shouldAutoFrameRef = useRef(parseCameraHash() === null);

  useEffect(() => {
    if (isLoaded && docState && !hasAutoFramedRef.current && shouldAutoFrameRef.current) {
      hasAutoFramedRef.current = true;
      const allNodes = Object.values(docState.nodes).filter((node) => node.type !== "arrow");
      if (allNodes.length > 0) {
        zoomToFit();
      }
    }
  }, [isLoaded, docState, zoomToFit]);

  const createMindmapChild = useCallback(
    (parentId: NodeId) => {
      const ydoc = ydocRef.current;
      if (!docState || !ydoc) return;
      const parent = docState.nodes[parentId];
      if (!parent) return;

      const childId = createId("node");
      const timestamp = Date.now();
      const childNode: CanvasNode = {
        id: childId,
        type: "rectangle",
        x: parent.x + parent.width + 120,
        y: parent.y,
        width: 140,
        height: 44,
        rotation: 0,
        zIndex: parent.zIndex + 1,
        opacity: 1,
        parentId: null,
        isLocked: false,
        isVisible: true,
        style: {
          fillColor: "#0f141c",
          strokeColor: "#818cf8",
          strokeWidth: 1,
          cornerRadius: 6,
          textColor: "#f4f4f5",
          fontSize: 12,
          textAlign: "center",
          verticalAlign: "middle",
        },
        data: {
          label: "Subtopic",
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const arrowId = createId("arrow");
      const arrowNode: ArrowNode = {
        id: arrowId,
        type: "arrow",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        zIndex: 5,
        opacity: 1,
        parentId: null,
        isLocked: false,
        isVisible: true,
        style: {
          strokeColor: "#818cf8",
          strokeWidth: 1.5,
        },
        data: {
          sourceId: parentId,
          targetId: childId,
          startArrow: "none",
          endArrow: "none",
          curveStyle: "bezier",
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const simulatedDoc: CanvasDocument = {
        ...docState,
        nodes: {
          ...docState.nodes,
          [childId]: childNode,
          [arrowId]: arrowNode,
        },
      };

      const newPositions = layoutMindmapTree(simulatedDoc, parentId);
      const placed = newPositions.get(childId);
      if (placed) {
        childNode.x = placed.x;
        childNode.y = placed.y;
      }

      ydoc.transact(() => {
        const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
        const rootOrder = ydoc.getArray<string>(SCENE_ROOT_ORDER_KEY);

        const childMap = new Y.Map<unknown>();
        for (const [key, val] of Object.entries(childNode)) {
          if (val !== undefined) childMap.set(key, toYValue(val));
        }
        nodesMap.set(childId, childMap);
        rootOrder.push([childId]);

        const arrowMap = new Y.Map<unknown>();
        for (const [key, val] of Object.entries(arrowNode)) {
          if (val !== undefined) arrowMap.set(key, toYValue(val));
        }
        nodesMap.set(arrowId, arrowMap);
        rootOrder.push([arrowId]);

        for (const [id, pos] of newPositions.entries()) {
          if (id === childId) continue;
          const existingMap = nodesMap.get(id);
          if (existingMap instanceof Y.Map) {
            existingMap.set("x", pos.x);
            existingMap.set("y", pos.y);
            existingMap.set("updatedAt", timestamp);
          }
        }
      }, TRANSACTION_ORIGINS.LOCAL_USER);

      setSelectedNodeIds(new Set([childId]));
    },
    [docState],
  );

  const createMindmapSibling = useCallback(
    (nodeId: NodeId) => {
      if (!docState) return;
      const node = docState.nodes[nodeId];
      if (!node) return;

      let parentId: NodeId | null = null;
      for (const candidate of Object.values(docState.nodes)) {
        if (candidate.type === "arrow" && candidate.data.targetId === nodeId) {
          parentId = candidate.data.sourceId;
          break;
        }
      }

      if (parentId) {
        createMindmapChild(parentId);
        return;
      }

      const siblingId = createId("node");
      const timestamp = Date.now();
      const siblingNode: CanvasNode = {
        id: siblingId,
        type: "rectangle",
        x: node.x,
        y: node.y + node.height + 32,
        width: node.width,
        height: node.height,
        rotation: 0,
        zIndex: node.zIndex,
        opacity: 1,
        parentId: null,
        isLocked: false,
        isVisible: true,
        style: {
          fillColor: "#0f141c",
          strokeColor: "#818cf8",
          strokeWidth: 1,
          cornerRadius: 6,
          textColor: "#f4f4f5",
          fontSize: 12,
          textAlign: "center",
          verticalAlign: "middle",
        },
        data: {
          label: "Main Topic",
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      addNode(siblingNode);
      setSelectedNodeIds(new Set([siblingId]));
    },
    [docState, createMindmapChild, addNode],
  );

  const updateDocumentName = useCallback((name: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    ydoc.transact(() => {
      const metadata = ydoc.getMap<unknown>(SCENE_META_KEY);
      metadata.set("name", name);
      metadata.set("updatedAt", Date.now());
    }, TRANSACTION_ORIGINS.LOCAL_USER);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveToFile();
        return;
      }

      if (isInput) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedNodes();
        return;
      }

      if (mode === "mindmap" && selectedNodeIds.size === 1) {
        const [selectedId] = [...selectedNodeIds];
        if (selectedId && e.key === "Tab") {
          e.preventDefault();
          createMindmapChild(selectedId);
          return;
        }
        if (selectedId && e.key === "Enter") {
          e.preventDefault();
          createMindmapSibling(selectedId);
          return;
        }
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("select");
          break;
        case "h":
          setActiveTool("pan");
          break;
        case "r":
          setActiveTool("rectangle");
          break;
        case "s":
          setActiveTool("sticker");
          break;
        case "c":
          setActiveTool("card");
          break;
        case "a":
          setActiveTool("arrow");
          break;
        case "d":
          setActiveTool("diamond");
          break;
        case "t":
          setActiveTool("capsule");
          break;
        case "b":
          setActiveTool("cylinder");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    undo,
    redo,
    saveToFile,
    deleteSelectedNodes,
    mode,
    selectedNodeIds,
    createMindmapChild,
    createMindmapSibling,
  ]);

  const ingestImageFile = useCallback(
    async (file: File | Blob, clientPoint?: Point2D) => {
      const ydoc = ydocRef.current;
      const adapter = adapterRef.current;
      if (!ydoc || !adapter || !file.type.startsWith("image/")) return;

      try {
        const assetId = await adapter.saveAsset(file);
        const objectUrl = URL.createObjectURL(file);
        setCachedAssetUrl(assetId, objectUrl);

        const dims = await getImageDimensions(file);
        let displayW = dims.width;
        let displayH = dims.height;
        const maxDimension = 500;
        if (displayW > maxDimension || displayH > maxDimension) {
          if (displayW >= displayH) {
            displayH = (displayH * maxDimension) / displayW;
            displayW = maxDimension;
          } else {
            displayW = (displayW * maxDimension) / displayH;
            displayH = maxDimension;
          }
        }

        const screenPoint = clientPoint ?? mouseScreenRef.current;
        const bounds = viewportRef.current?.getBoundingClientRect();
        const screenBounds = { x: bounds?.left ?? 0, y: bounds?.top ?? 0 };
        const worldPoint = screenToWorld(screenPoint, cameraRef.current, screenBounds);

        const imageId = createId("image");
        const timestamp = Date.now();
        const imageNode: CanvasNode = {
          id: imageId,
          type: "image",
          x: Math.round(worldPoint.x - displayW / 2),
          y: Math.round(worldPoint.y - displayH / 2),
          width: Math.round(displayW),
          height: Math.round(displayH),
          rotation: 0,
          zIndex: 10,
          opacity: 1,
          parentId: null,
          isLocked: false,
          isVisible: true,
          style: {
            cornerRadius: 8,
          },
          data: {
            assetId,
            naturalWidth: dims.width,
            naturalHeight: dims.height,
            mimeType: file.type || "image/png",
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        addNode(imageNode);
      } catch {
        console.error("[Talweg] Could not import image");
      }
    },
    [addNode],
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);

      if (isInput) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void ingestImageFile(file);
            break;
          }
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (imageFile) {
        e.preventDefault();
        void ingestImageFile(imageFile, { x: e.clientX, y: e.clientY });
      }
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [ingestImageFile]);

  return {
    importImage: ingestImageFile,
    viewportRef,
    document: docState,
    camera,
    adapter: adapterState,
    selectedNodeIds,
    activeTool,
    mode,
    canUndo,
    canRedo,
    isLoaded,
    setCamera,
    setActiveTool,
    setMode,
    setSelectedNodeIds,
    addNode,
    updateNode,
    updateNodeData,
    moveNode,
    batchMoveNodes,
    deleteSelectedNodes,
    deleteNode,
    connectNodes,
    reconnectArrow,
    undo,
    redo,
    saveToFile,
    fileSaveState: storageError ? "browser-error" : fileSaveState,
    resetZoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    createMindmapChild,
    createMindmapSibling,
    updateDocumentName,
    activePageId,
    pages: pagesList,
    setActivePageId: selectPage,
    addPage,
    renamePage,
    deletePage,
  };
}
