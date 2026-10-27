import { readPreferences } from "../utils/preferences.js";
import { stabilizeConnections } from "../utils/connectorGeometry.js";
import { copyBoard } from "../utils/copyBoard.js";
import {
  upgradeSharedScene,
  patchSharedMap,
  editTableCell,
  resizeSharedTable,
  changeTableStructure,
  pasteTableGrid,
} from "../utils/sharedEditing.js";
import { useCanvasClipboard } from "./useCanvasClipboard.js";
import { createInvitation, storedInvitation } from "../utils/invitation.js";
import { PeerSession, type PeerState } from "../utils/peerSession.js";
import {
  worldDocument,
  selectionRoots,
  groupSelection,
  ungroupSelection,
  alignSelection,
  deleteSelection,
  duplicateSelection,
  type Alignment,
} from "../utils/organizeCanvas.js";
import {
  ProjectStorageAdapter,
  type LibraryState,
} from "../utils/projectStorage.js";
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
import {
  getLinkedFileHandle,
  type FileSaveState,
  type NativeFileSystemFileHandle,
  saveDocumentToFileSystem,
} from "../utils/fileSystem.js";
import { createId } from "../utils/template.js";

import { firstPageId, pageNodes } from "../utils/pageNodes.js";
import {
  markTemplateDraft,
  promoteTemplateDraft,
} from "../utils/boardLibrary.js";

const DEFAULT_DOC_ID = "default-doc" as DocumentId;

function pinConnectionSides(scene: Y.Doc, document: CanvasDocument): void {
  const fixed = stabilizeConnections(document);
  if (fixed === document) return;
  const nodes = scene.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
  for (const node of Object.values(fixed.nodes)) {
    if (node.type !== "arrow" || node.data === document.nodes[node.id]?.data)
      continue;
    const data = nodes.get(node.id)?.get("data");
    if (data instanceof Y.Map)
      patchSharedMap(data, {
        sourceAnchor: node.data.sourceAnchor,
        targetAnchor: node.data.targetAnchor,
      });
  }
}

export interface UseCanvasReturn {
  collaboration: PeerState;
  clipboardError: string;
  startHosting: () => Promise<void>;
  approvePeer: (id: string, accept: boolean) => void;
  stopSharing: () => void;
  saveIndependentCopy: () => Promise<string>;
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
  loadFailed: boolean;
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
  groupSelected: () => void;
  ungroupSelected: () => void;
  duplicateSelected: () => void;
  organizeSelected: (alignment: Alignment) => void;
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
  const [activePageId, setActivePageId] = useState<PageId>(
    initialPageId ?? "page-1",
  );
  const activePageRef = useRef(activePageId);
  activePageRef.current = activePageId;
  const [selectedNodeIds, setSelectedNodeIds] = useState<ReadonlySet<NodeId>>(
    new Set(),
  );
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [mode, setMode] = useState<CanvasMode>("whiteboard");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [adapterState, setAdapterState] =
    useState<IndexedDBStorageAdapter | null>(null);

  useCameraUrlSync(camera, isLoaded);

  const [clipboardError, setClipboardError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [libraryState, setLibraryState] = useState<LibraryState>("browser");
  const [fileSaveState, setFileSaveState] = useState<FileSaveState>("browser");
  const fileWritesRef = useRef<Promise<void>>(Promise.resolve());
  const ydocRef = useRef<Y.Doc | null>(null);
  const adapterRef = useRef<IndexedDBStorageAdapter | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const clockRef = useRef(0);
  const pendingDeltasRef = useRef<StorageDelta[]>([]);
  const [collaboration, setCollaboration] = useState<PeerState>({
    phase: "off",
    host: false,
    room: "",
  });
  const peerSessionRef = useRef<PeerSession | null>(null);
  const guestRoom = new URLSearchParams(window.location.search).get("room");

  const cameraRef = useRef<CameraViewport>(camera);
  cameraRef.current = camera;

  useEffect(() => {
    peerSessionRef.current?.setPresence({
      pageId: activePageId,
      x: null,
      y: null,
      selected: [...selectedNodeIds],
    });
  }, [activePageId, selectedNodeIds, collaboration.phase]);

  const initialPageIdRef = useRef(initialPageId);
  initialPageIdRef.current = initialPageId;

  const selectedIdsRef = useRef(selectedNodeIds);
  selectedIdsRef.current = selectedNodeIds;
  const mouseScreenRef = useRef<Point2D>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
  });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      mouseScreenRef.current = { x: e.clientX, y: e.clientY };
      const bounds = viewportRef.current?.getBoundingClientRect();
      const inside =
        bounds &&
        e.clientX >= bounds.left &&
        e.clientX <= bounds.right &&
        e.clientY >= bounds.top &&
        e.clientY <= bounds.bottom;
      const point = inside
        ? screenToWorld(
            { x: e.clientX, y: e.clientY },
            cameraRef.current,
            bounds,
          )
        : null;
      peerSessionRef.current?.setPresence({
        pageId: activePageRef.current,
        x: point?.x ?? null,
        y: point?.y ?? null,
        selected: [...selectedIdsRef.current],
      });
    };
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
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
    const sceneDisposed = () => storageDisposedRef.current;
    const adapter = guestRoom
      ? new IndexedDBStorageAdapter()
      : new ProjectStorageAdapter((state) => {
          if (!storageDisposedRef.current) setLibraryState(state);
        });
    adapterRef.current = adapter;

    async function initializeScene() {
      try {
        await adapter.initialize();
        if (storageDisposedRef.current) return;

        const snapshot = await adapter.loadSnapshot(documentId);
        const deltas = await adapter.loadDeltas(
          documentId,
          snapshot?.clock ?? -1,
        );

        const ydoc = createSceneDoc();
        ydocRef.current = ydoc;

        try {
          if (snapshot !== null) {
            Y.applyUpdate(
              ydoc,
              snapshot.documentBlob,
              TRANSACTION_ORIGINS.STORAGE_HYDRATION,
            );
            for (const delta of deltas) {
              try {
                Y.applyUpdate(
                  ydoc,
                  delta.updateBlob,
                  TRANSACTION_ORIGINS.STORAGE_HYDRATION,
                );
              } catch (deltaErr) {
                console.warn("[Talweg] Skipping corrupted delta:", deltaErr);
              }
            }
            clockRef.current =
              deltas.length > 0
                ? (deltas[deltas.length - 1]?.sequenceNumber ?? snapshot.clock)
                : snapshot.clock;
          } else if (deltas.length > 0) {
            for (const delta of deltas) {
              try {
                Y.applyUpdate(
                  ydoc,
                  delta.updateBlob,
                  TRANSACTION_ORIGINS.STORAGE_HYDRATION,
                );
              } catch (deltaErr) {
                console.warn("[Talweg] Skipping corrupted delta:", deltaErr);
              }
            }
            clockRef.current = deltas[deltas.length - 1]?.sequenceNumber ?? 0;
          } else if (!guestRoom) {
            throw new Error(
              "Project was not found in the library or browser cache",
            );
          }
        } catch (err) {
          throw new Error(
            "Stored project is unreadable; the original data has been preserved",
            { cause: err },
          );
        }

        if (
          guestRoom &&
          snapshot &&
          sessionStorage.getItem(`talweg-ended:${guestRoom}`)
        )
          setCollaboration({ phase: "ended", host: false, room: guestRoom });
        if (
          guestRoom &&
          !(snapshot && sessionStorage.getItem(`talweg-ended:${guestRoom}`))
        ) {
          markTemplateDraft(documentId);
          const invitation = storedInvitation(guestRoom);
          if (!invitation) {
            setCollaboration({
              phase: "unavailable",
              host: false,
              room: guestRoom,
            });
            throw new Error("Missing invitation");
          }
          const session = new PeerSession(
            ydoc,
            adapter,
            { invitation, host: false },
            (state) => {
              if (!storageDisposedRef.current) setCollaboration(state);
            },
          );
          peerSessionRef.current = session;
          if (snapshot) void session.ready.catch(() => undefined);
          else await session.ready;
          if (sceneDisposed()) return;
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
        let pendingFileWrite: {
          document: CanvasDocument;
          update: Uint8Array;
          handle: NativeFileSystemFileHandle;
        } | null = null;
        const flushLinkedFile = async () => {
          fileWriteRunning = true;
          try {
            while (pendingFileWrite) {
              const pending = pendingFileWrite;
              pendingFileWrite = null;
              const scene = createSceneDoc();
              try {
                Y.applyUpdate(scene, pending.update);
                await saveDocumentToFileSystem(pending.document, scene, {
                  adapter,
                  linkedHandle: pending.handle,
                  autoSave: true,
                });
              } finally {
                scene.destroy();
              }
            }
            if (!storageDisposedRef.current) setFileSaveState("file");
          } catch (error) {
            pendingFileWrite = null;
            console.error("[Talweg] Linked file could not be saved", error);
            if (!storageDisposedRef.current) setFileSaveState("error");
          } finally {
            fileWriteRunning = false;
          }
        };
        ydoc.on("update", (update: Uint8Array, origin: unknown) => {
          const currentDoc = yDocToDocument(ydoc);
          setDocState(currentDoc);

          if (
            origin === TRANSACTION_ORIGINS.LOCAL_USER ||
            origin === undoManager ||
            origin === TRANSACTION_ORIGINS.REMOTE_SYNC
          ) {
            if (!initializing) {
              if (!guestRoom) promoteTemplateDraft(documentId);
              const handle = getLinkedFileHandle(documentId);
              if (handle) {
                pendingFileWrite = {
                  document: currentDoc,
                  update: Y.encodeStateAsUpdate(ydoc),
                  handle,
                };
                setFileSaveState("saving");
                if (!fileWriteRunning)
                  fileWritesRef.current = flushLinkedFile();
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
          }
        });

        if (guestRoom) {
          const synced = yDocToDocument(ydoc);
          await adapter.saveSnapshot({
            meta: {
              documentId,
              name: synced.name,
              schemaVersion: synced.schemaVersion,
              createdAt: synced.meta.createdAt,
              updatedAt: Date.now(),
              nodeCount: Object.keys(synced.nodes).length,
            },
            clock: clockRef.current,
            documentBlob: Y.encodeStateAsUpdate(ydoc),
            stateVector: Y.encodeStateVector(ydoc),
          });
        }
        ydoc.transact(() => {
          upgradeSharedScene(ydoc);
        }, TRANSACTION_ORIGINS.LOCAL_USER);
        let initialParsedDoc = yDocToDocument(ydoc);
        const unassigned = Object.values(initialParsedDoc.nodes).filter(
          (node) => !node.pageId,
        );
        if (unassigned.length) {
          const originalPage = firstPageId(initialParsedDoc);
          ydoc.transact(() => {
            for (const node of unassigned) {
              const source =
                node.type === "arrow"
                  ? initialParsedDoc.nodes[node.data.sourceId]
                  : undefined;
              nodesMap
                .get(node.id)
                ?.set("pageId", source?.pageId ?? originalPage);
            }
          }, TRANSACTION_ORIGINS.LOCAL_USER);
          initialParsedDoc = yDocToDocument(ydoc);
        }
        setDocState(initialParsedDoc);

        if (
          initialParsedDoc.pages &&
          Object.keys(initialParsedDoc.pages).length > 0
        ) {
          let preferredPage: string | null = null;
          try {
            preferredPage = localStorage.getItem(`talweg-page:${documentId}`);
          } catch {
            /* the first page remains available without browser storage */
          }
          const requestedPageId = initialPageIdRef.current ?? preferredPage;
          if (requestedPageId && initialParsedDoc.pages[requestedPageId]) {
            setActivePageId(requestedPageId);
          } else if (
            initialParsedDoc.activePageId &&
            initialParsedDoc.pages[initialParsedDoc.activePageId]
          ) {
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

        undoManager.clear();
        updateUndoState();
        const linkedNodeId = new URLSearchParams(window.location.search).get(
          "node",
        ) as NodeId | null;
        const linkedNode = linkedNodeId
          ? worldDocument(initialParsedDoc).nodes[linkedNodeId]
          : undefined;
        if (linkedNodeId && linkedNode) {
          setSelectedNodeIds(new Set([linkedNodeId]));
          if (linkedNode.pageId) setActivePageId(linkedNode.pageId);
        }
        setFileSaveState(getLinkedFileHandle(documentId) ? "file" : "browser");
        initializing = false;
        const urlCamera = parseCameraHash();
        if (linkedNode) {
          setCamera(
            zoomToBounds(
              computeGroupBounds([linkedNode]),
              { width: window.innerWidth, height: window.innerHeight - 56 },
              80,
              0.2,
              1.2,
            ),
          );
        } else if (urlCamera) {
          setCamera(urlCamera);
        } else {
          const openingPage =
            initialPageIdRef.current ??
            initialParsedDoc.activePageId ??
            firstPageId(initialParsedDoc);
          const allNodes = Object.values(
            pageNodes(worldDocument(initialParsedDoc), openingPage),
          ).filter((node) => node.type !== "arrow");
          if (allNodes.length > 0) {
            const bounds = computeGroupBounds(allNodes);
            if (bounds.width > 0 && bounds.height > 0) {
              const viewportSize = {
                width: typeof window !== "undefined" ? window.innerWidth : 1200,
                height:
                  typeof window !== "undefined" ? window.innerHeight - 40 : 800,
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
        if (!storageDisposedRef.current) setLoadFailed(true);
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
      peerSessionRef.current?.close();
      peerSessionRef.current = null;
      undoManagerRef.current?.destroy();
      ydocRef.current?.destroy();
      setAdapterState(null);
      adapterRef.current = null;
      void fileWritesRef.current.then(() => adapter.close());
    };
  }, [documentId, flushDeltas, guestRoom]);

  // tab navigation swaps the route page without remounting the board
  useEffect(() => {
    if (initialPageId && initialPageId !== activePageRef.current) {
      setActivePageId(initialPageId);
      setSelectedNodeIds(new Set());
    }
  }, [initialPageId]);

  const startHosting = useCallback(async () => {
    const scene = ydocRef.current;
    const adapter = adapterRef.current;
    if (!scene || !adapter) return;
    peerSessionRef.current?.close();
    const response = await fetch("/api/peer-config").catch(() => null);
    const config =
      response?.ok &&
      response.headers.get("content-type")?.includes("application/json")
        ? ((await response.json()) as { localRelay?: boolean })
        : {};
    const relay = config.localRelay
      ? `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/talweg-relay`
      : readPreferences().relayUrl || undefined;
    const { invitation, privateKey } = await createInvitation(relay);
    const session = new PeerSession(
      scene,
      adapter,
      { invitation, privateKey, host: true },
      setCollaboration,
    );
    peerSessionRef.current = session;
    try {
      await session.ready;
    } catch {
      /* the panel displays the connection error */
    }
  }, []);
  const stopSharing = useCallback(() => {
    const session = peerSessionRef.current;
    peerSessionRef.current = null;
    void session?.end().catch(() => undefined);
    setCollaboration({ phase: "off", host: false, room: "" });
  }, []);

  const saveIndependentCopy = useCallback(async (): Promise<string> => {
    const scene = ydocRef.current;
    if (!scene) throw new Error("Board unavailable");
    const id = `doc-${crypto.randomUUID()}` as DocumentId;
    const copy = copyBoard(yDocToDocument(scene), id, guestRoom ?? undefined);
    const copiedScene = createSceneDoc(copy);
    const storage = new ProjectStorageAdapter();
    try {
      await storage.initialize();
      await storage.saveSnapshot({
        meta: {
          documentId: id,
          name: copy.name,
          schemaVersion: copy.schemaVersion,
          createdAt: copy.meta.createdAt,
          updatedAt: copy.meta.updatedAt,
          nodeCount: Object.keys(copy.nodes).length,
        },
        clock: 0,
        documentBlob: Y.encodeStateAsUpdate(copiedScene),
        stateVector: Y.encodeStateVector(copiedScene),
      });
      await storage.flush();
      return `/board/${encodeURIComponent(id)}`;
    } finally {
      copiedScene.destroy();
      await storage.close();
    }
  }, [guestRoom]);

  useEffect(() => {
    const boundary = () => {
      undoManagerRef.current?.stopCapturing();
    };
    window.addEventListener("talweg:text-edit-boundary", boundary);
    return () => {
      window.removeEventListener("talweg:text-edit-boundary", boundary);
    };
  }, []);

  useEffect(() => {
    const flush = (event: Event) => {
      const scene = ydocRef.current,
        adapter = adapterRef.current;
      if (!scene || !adapter || scene.getMap(SCENE_META_KEY).get("id") !== documentId) return;
      const doc = yDocToDocument(scene);
      const pending = adapter
        .saveSnapshot({
          meta: {
            documentId: doc.id,
            name: doc.name,
            schemaVersion: doc.schemaVersion,
            createdAt: doc.meta.createdAt,
            updatedAt: Date.now(),
            nodeCount: Object.keys(doc.nodes).length,
          },
          clock: clockRef.current,
          documentBlob: Y.encodeStateAsUpdate(scene),
          stateVector: Y.encodeStateVector(scene),
        })
        .then(async () => {
          await fileWritesRef.current;
          if (adapter instanceof ProjectStorageAdapter) {
            await adapter.flush();
            if (adapter.hasPendingWrites) throw new Error("save");
          }
        });
      (
        event as CustomEvent<{ waitUntil: (value: Promise<unknown>) => void }>
      ).detail.waitUntil(pending);
    };
    window.addEventListener("talweg:flush", flush);
    return () => {
      window.removeEventListener("talweg:flush", flush);
    };
  }, []);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  const editScene = useCallback(
    (edit: (document: CanvasDocument) => CanvasDocument) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      const before = yDocToDocument(ydoc);
      const after = edit(before);
      if (after === before) return;
      undoManagerRef.current?.stopCapturing();
      ydoc.transact(() => {
        const nodes = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
        for (const id of Object.keys(before.nodes))
          if (!after.nodes[id as NodeId]) nodes.delete(id);
        for (const node of Object.values(after.nodes)) {
          const previous = before.nodes[node.id];
          if (node === previous) continue;
          let entry = nodes.get(node.id);
          if (!entry) {
            entry = new Y.Map<unknown>();
            nodes.set(node.id, entry);
          }
          for (const [key, value] of Object.entries(
            node as unknown as Record<string, unknown>,
          )) {
            if (
              value !== undefined &&
              JSON.stringify(value) !==
                JSON.stringify(
                  (
                    previous as unknown as Record<string, unknown> | undefined
                  )?.[key],
                )
            )
              patchSharedMap(entry, { [key]: value });
          }
          entry.set("updatedAt", Date.now());
        }
        if (
          JSON.stringify(before.rootNodeIds) !==
          JSON.stringify(after.rootNodeIds)
        ) {
          const order = ydoc.getArray<string>(SCENE_ROOT_ORDER_KEY);
          order.delete(0, order.length);
          order.push([...after.rootNodeIds]);
        }
        upgradeSharedScene(ydoc);
      }, TRANSACTION_ORIGINS.LOCAL_USER);
      undoManagerRef.current?.stopCapturing();
    },
    [],
  );

  useCanvasClipboard({
    document: docState,
    selected: selectedNodeIds,
    page: activePageId,
    adapter: adapterState,
    edit: editScene,
    select: setSelectedNodeIds,
    error: setClipboardError,
    point: () => {
      const bounds = viewportRef.current?.getBoundingClientRect();
      const pointer = mouseScreenRef.current;
      if (bounds)
        return screenToWorld(
          pointer.x >= bounds.left &&
            pointer.x <= bounds.right &&
            pointer.y >= bounds.top &&
            pointer.y <= bounds.bottom
            ? pointer
            : {
                x: bounds.left + bounds.width / 2,
                y: bounds.top + bounds.height / 2,
              },
          cameraRef.current,
          bounds,
        );
      return { x: 0, y: 0 };
    },
  });

  const groupSelected = useCallback(() => {
    editScene((current) => {
      const id = createId("group");
      const next = groupSelection(current, selectedNodeIds, id, "");
      if (next !== current) setSelectedNodeIds(new Set([id]));
      return next;
    });
  }, [editScene, selectedNodeIds]);
  const ungroupSelected = useCallback(() => {
    editScene((current) => {
      const children = [...selectedNodeIds].flatMap((id) => {
        const node = current.nodes[id];
        return node?.type === "group" ? [...node.data.childIds] : [id];
      });
      const next = ungroupSelection(current, selectedNodeIds);
      setSelectedNodeIds(new Set(children));
      return next;
    });
  }, [editScene, selectedNodeIds]);
  const duplicateSelected = useCallback(() => {
    editScene((current) => {
      const next = duplicateSelection(current, selectedNodeIds, createId);
      setSelectedNodeIds(next.selected);
      return next.document;
    });
  }, [editScene, selectedNodeIds]);
  const organizeSelected = useCallback(
    (alignment: Alignment) => {
      editScene((current) =>
        alignSelection(current, selectedNodeIds, alignment),
      );
    },
    [editScene, selectedNodeIds],
  );

  const saveToFile = useCallback(async () => {
    if (!docState || !ydocRef.current) return false;
    const saved = await saveDocumentToFileSystem(docState, ydocRef.current, {
      adapter: adapterRef.current,
    });
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

      undoManagerRef.current?.stopCapturing();
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
        upgradeSharedScene(ydoc);
      }, TRANSACTION_ORIGINS.LOCAL_USER);

      undoManagerRef.current?.stopCapturing();
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

  const selectPage = useCallback(
    (pageId: PageId) => {
      setActivePageId(pageId);
      setSelectedNodeIds(new Set());
      try {
        localStorage.setItem(`talweg-page:${documentId}`, pageId);
      } catch {
        /* navigation remains available without browser storage */
      }
    },
    [documentId],
  );

  const addPage = useCallback((name?: string): PageId => {
    const ydoc = ydocRef.current;
    if (!ydoc) return "page-1";
    const currentDoc = yDocToDocument(ydoc);
    const existingPages: Record<PageId, CanvasPage> =
      currentDoc.pages && Object.keys(currentDoc.pages).length > 0
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
    const newPageId: PageId = `page-${crypto.randomUUID()}`;
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
      patchSharedMap(metaMap, { pages: existingPages });
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
      patchSharedMap(metaMap, { pages: updatedPages });
    }, TRANSACTION_ORIGINS.LOCAL_USER);
  }, []);

  const deletePage = useCallback(
    (pageId: PageId): void => {
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
      const remainingList = Object.values(remaining).sort(
        (a, b) => a.order - b.order,
      );
      const nextActiveId = remaining[activePageId]
        ? activePageId
        : (remainingList[0]?.id ?? "page-1");

      const metaMap = ydoc.getMap<unknown>(SCENE_META_KEY);
      const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
      ydoc.transact(() => {
        for (const [nodeId, node] of Object.entries(currentDoc.nodes)) {
          if (node.pageId === pageId) {
            nodesMap.delete(nodeId);
          }
        }
        const sharedPages = metaMap.get("pages");
        if (sharedPages instanceof Y.Map)
          for (const id of sharedPages.keys())
            if (!remaining[id]) sharedPages.delete(id);
        metaMap.set("activePageId", nextActiveId);
      }, TRANSACTION_ORIGINS.LOCAL_USER);
      setActivePageId(nextActiveId);
      if (pageId === activePageId) setSelectedNodeIds(new Set());
    },
    [activePageId],
  );

  const updateNode = useCallback((id: NodeId, updates: Partial<CanvasNode>) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    ydoc.transact(() => {
      const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
      const nodeMap = nodesMap.get(id);
      if (!nodeMap) return;

      const stored = yDocToDocument(ydoc);
      const node = stored.nodes[id];
      const worldDocumentBefore = worldDocument(stored);
      if (
        [updates.x, updates.y, updates.width, updates.height].some(
          (value) => value !== undefined,
        )
      )
        pinConnectionSides(ydoc, worldDocumentBefore);
      const world = worldDocumentBefore.nodes[id];
      const local = { ...updates };
      if (node && world) {
        if (updates.x !== undefined) local.x = node.x + updates.x - world.x;
        if (updates.y !== undefined) local.y = node.y + updates.y - world.y;
      }
      patchSharedMap(nodeMap, local);
      nodeMap.set("updatedAt", Date.now());
    }, TRANSACTION_ORIGINS.LOCAL_USER);
  }, []);

  const updateNodeData = useCallback(
    (id: NodeId, partialData: Record<string, unknown>) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;

      ydoc.transact(() => {
        const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
        const nodeMap = nodesMap.get(id);
        if (!nodeMap) return;

        const existingData = nodeMap.get("data");
        const cell = partialData._cell as
          { row: string; column: string; text: string } | undefined;
        if (cell) {
          editTableCell(ydoc, id, cell.row, cell.column, cell.text);
          return;
        }
        const grid = partialData._grid as
          { row: string; column: string; text: string } | undefined;
        if (grid) {
          try {
            pasteTableGrid(ydoc, id, grid.row, grid.column, grid.text);
          } catch {
            setClipboardError("rangeTooLarge");
          }
          return;
        }
        const action = partialData._tableAction as
          { kind: string; id: string } | undefined;
        if (action) {
          changeTableStructure(ydoc, id, action);
          return;
        }
        if (Array.isArray(partialData.cells)) {
          const current = yDocToDocument(ydoc).nodes[id];
          if (current?.type === "table")
            resizeSharedTable(ydoc, current, partialData.cells as string[][]);
          delete partialData.cells;
        }
        if (existingData instanceof Y.Map)
          patchSharedMap(existingData, partialData);
        else nodeMap.set("data", toYValue(partialData));
        nodeMap.set("updatedAt", Date.now());
      }, TRANSACTION_ORIGINS.LOCAL_USER);
    },
    [],
  );

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

  const batchMoveNodes = useCallback(
    (positions: ReadonlyMap<NodeId, Point2D>) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;

      ydoc.transact(() => {
        const nodesMap = ydoc.getMap<Y.Map<unknown>>(SCENE_NODES_KEY);
        const stored = yDocToDocument(ydoc);
        const world = worldDocument(stored);
        pinConnectionSides(ydoc, world);
        for (const node of selectionRoots(stored, new Set(positions.keys()))) {
          const id = node.id;
          const point = positions.get(id);
          const displayed = world.nodes[id];
          if (!point || !displayed) continue;
          const nodeMap = nodesMap.get(id);
          if (!nodeMap) continue;

          nodeMap.set("x", node.x + point.x - displayed.x);
          nodeMap.set("y", node.y + point.y - displayed.y);
        }
      }, TRANSACTION_ORIGINS.LOCAL_USER);
    },
    [],
  );

  const deleteNode = useCallback(
    (id: NodeId) => {
      editScene((current) => deleteSelection(current, new Set([id])));
      setSelectedNodeIds(
        (previous) =>
          new Set([...previous].filter((selected) => selected !== id)),
      );
    },
    [editScene],
  );

  const deleteSelectedNodes = useCallback(() => {
    editScene((current) => deleteSelection(current, selectedNodeIds));
    setSelectedNodeIds(new Set());
  }, [editScene, selectedNodeIds]);

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

      const scene = ydocRef.current;
      if (scene) {
        const current = worldDocument(yDocToDocument(scene));
        const fixed = stabilizeConnections({
          ...current,
          nodes: { ...current.nodes, [arrowId]: arrowNode },
        });
        addNode(fixed.nodes[arrowId] ?? arrowNode);
      }
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
      const oppositeId = dataMap.get(
        endpoint === "source" ? "targetId" : "sourceId",
      );
      if (typeof oppositeId === "string" && oppositeId === nodeId) return;

      ydoc.transact(() => {
        pinConnectionSides(ydoc, worldDocument(yDocToDocument(ydoc)));
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
      return zoomAtViewportPoint(
        safe,
        { x: bounds.width / 2, y: bounds.height / 2 },
        target(safe.zoom),
      );
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
    const allNodes = Object.values(
      pageNodes(worldDocument(docState), activePageId),
    ).filter((node) => node.type !== "arrow");
    if (allNodes.length === 0) return;

    const bounds = computeGroupBounds(allNodes);
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const viewport = viewportRef.current;
    if (!viewport) return;
    const viewportSize = {
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    };
    setCamera(zoomToBounds(bounds, viewportSize, 60, 0.2, 1.8));
  }, [docState, activePageId]);

  const hasAutoFramedRef = useRef(false);

  useEffect(() => {
    hasAutoFramedRef.current = false;
  }, [documentId]);

  // a camera hash in the url is an explicit user viewport; autoframe only when it is absent
  const shouldAutoFrameRef = useRef(parseCameraHash() === null);

  useEffect(() => {
    if (
      isLoaded &&
      docState &&
      !hasAutoFramedRef.current &&
      shouldAutoFrameRef.current
    ) {
      hasAutoFramedRef.current = true;
      const allNodes = Object.values(
        pageNodes(worldDocument(docState), activePageId),
      ).filter((node) => node.type !== "arrow");
      if (allNodes.length > 0) {
        zoomToFit();
      }
    }
  }, [isLoaded, docState, activePageId, zoomToFit]);

  const createMindmapChild = useCallback(
    (parentId: NodeId) => {
      const ydoc = ydocRef.current;
      if (!docState || !ydoc) return;
      const displayed = worldDocument(docState);
      const parent = displayed.nodes[parentId];
      if (!parent || parent.type === "arrow") return;
      const parentPage = parent.pageId ?? firstPageId(docState);

      const childId = createId("node");
      const timestamp = Date.now();
      const childNode: CanvasNode = {
        id: childId,
        pageId: parentPage,
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
        pageId: parentPage,
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
          sourceAnchor: "e",
          targetAnchor: "w",
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      childNode.y = parent.y + (parent.height - childNode.height) / 2;
      const neighbors = Object.values(pageNodes(displayed, parentPage)).filter(
        (node) =>
          node.type !== "arrow" && node.type !== "group" && node.isVisible,
      );
      for (let attempt = 0; attempt <= neighbors.length; attempt++) {
        const blocking = neighbors.find(
          (node) =>
            childNode.x < node.x + node.width + 24 &&
            childNode.x + childNode.width + 24 > node.x &&
            childNode.y < node.y + node.height + 24 &&
            childNode.y + childNode.height + 24 > node.y,
        );
        if (!blocking) break;
        childNode.y = blocking.y + blocking.height + 28;
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
      }, TRANSACTION_ORIGINS.LOCAL_USER);

      setSelectedNodeIds(new Set([childId]));
    },
    [docState],
  );

  const createMindmapSibling = useCallback(
    (nodeId: NodeId) => {
      if (!docState) return;
      const node = worldDocument(docState).nodes[nodeId];
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
      const shortcutKey =
        (e.ctrlKey || e.metaKey) && /^Key[A-Z]$/.test(e.code)
          ? e.code.slice(3).toLowerCase()
          : e.key.toLowerCase();
      const activeElement = document.activeElement;
      const isControl =
        activeElement instanceof HTMLElement &&
        activeElement.closest(
          'button, a[href], [role="button"], [role="tab"], [role="menuitem"]',
        );
      if (
        isControl &&
        !e.ctrlKey &&
        !e.metaKey &&
        [
          " ",
          "Enter",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "F2",
        ].includes(e.key)
      )
        return;
      const isCanvasText =
        activeElement instanceof HTMLElement &&
        activeElement.isContentEditable &&
        activeElement.hasAttribute("data-rich-text");
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement &&
          activeElement.isContentEditable);

      if (
        isInput &&
        shortcutKey !== "s" &&
        !(
          isCanvasText &&
          (e.ctrlKey || e.metaKey) &&
          ["z", "y"].includes(shortcutKey)
        )
      )
        return;
      if (
        (e.ctrlKey || e.metaKey) &&
        shortcutKey === "a" &&
        !isInput &&
        docState
      ) {
        e.preventDefault();
        setSelectedNodeIds(
          new Set(
            Object.values(pageNodes(docState, activePageId))
              .filter((node) => node.isVisible)
              .map((node) => node.id),
          ),
        );
        return;
      }
      if (
        !isInput &&
        selectedNodeIds.size &&
        docState &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const world = worldDocument(docState);
        batchMoveNodes(
          new Map(
            selectionRoots(world, selectedNodeIds)
              .filter((node) => node.type !== "arrow" && !node.isLocked)
              .map((node) => [node.id, { x: node.x + dx, y: node.y + dy }]),
          ),
        );
        return;
      }
      if ((e.ctrlKey || e.metaKey) && shortcutKey === "g" && !isInput) {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && shortcutKey === "d" && !isInput) {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && shortcutKey === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && shortcutKey === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && shortcutKey === "s") {
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

      if (
        mode === "mindmap" &&
        selectedNodeIds.size === 1 &&
        [...selectedNodeIds].every(
          (id) => docState?.nodes[id]?.type !== "arrow",
        )
      ) {
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

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (shortcutKey) {
        case "escape":
          setActiveTool("select");
          setSelectedNodeIds(new Set());
          break;
        case "p":
          setActiveTool("pen");
          break;
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
          setActiveTool(e.shiftKey ? "capsule" : "text");
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
    groupSelected,
    ungroupSelected,
    duplicateSelected,
    selectedNodeIds,
    createMindmapChild,
    createMindmapSibling,
    docState,
    activePageId,
    batchMoveNodes,
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
        const worldPoint = screenToWorld(
          screenPoint,
          cameraRef.current,
          screenBounds,
        );

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
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement &&
          activeElement.isContentEditable);

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

      const imageFile = Array.from(files).find((f) =>
        f.type.startsWith("image/"),
      );
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

  const displayedDocument = useMemo(
    () => (docState ? { ...docState, activePageId } : null),
    [docState, activePageId],
  );
  return {
    collaboration,
    clipboardError,
    startHosting,
    approvePeer: (id, accept) => {
      peerSessionRef.current?.approve(id, accept);
    },
    stopSharing,
    saveIndependentCopy,
    importImage: ingestImageFile,
    viewportRef,
    document: displayedDocument,
    camera,
    adapter: adapterState,
    selectedNodeIds,
    activeTool,
    mode,
    canUndo,
    canRedo,
    isLoaded,
    loadFailed,
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
    groupSelected,
    ungroupSelected,
    duplicateSelected,
    organizeSelected,
    deleteNode,
    connectNodes,
    reconnectArrow,
    undo,
    redo,
    saveToFile,
    fileSaveState: storageError
      ? "browser-error"
      : fileSaveState === "browser"
        ? libraryState
        : fileSaveState,
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
