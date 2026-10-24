import { useEffect } from "react";
import * as Y from "yjs";
import type { CanvasDocument, DocumentId, PageId } from "@talweg/core";
import {
  applyDocumentToYDoc,
  createSceneDoc,
  IndexedDBStorageAdapter,
} from "@talweg/storage";
import { Canvas } from "./components/Canvas.js";
import { Header } from "./components/Header.js";
import { Toolbar } from "./components/Toolbar.js";
import { WelcomeDashboard } from "./components/WelcomeDashboard.js";
import { useCanvas } from "./hooks/useCanvas.js";
import { LanguageProvider } from "./hooks/useTranslation.js";
import { useRoute } from "./routes/router.js";
import { clearActiveFileHandle } from "./utils/fileSystem.js";

interface CanvasViewProps {
  documentId: DocumentId;
  pageId?: PageId | undefined;
  onOpenDashboard: () => void;
}

function CanvasView({ documentId, pageId, onOpenDashboard }: CanvasViewProps) {
  const {
    document,
    camera,
    adapter,
    setCamera,
    activeTool,
    setActiveTool,
    mode,
    setMode,
    selectedNodeIds,
    setSelectedNodeIds,
    addNode,
    updateNode,
    updateNodeData,
    batchMoveNodes,
    deleteSelectedNodes,
    connectNodes,
    reconnectArrow,
    undo,
    redo,
    saveToFile,
    resetZoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    canUndo,
    canRedo,
    isLoaded,
    createMindmapChild,
    createMindmapSibling,
    updateDocumentName,
    activePageId,
    pages,
    setActivePageId,
    addPage,
    renamePage,
    deletePage,
  } = useCanvas(documentId, pageId);

  if (!isLoaded) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 gap-3 font-mono text-xs">
        <div className="w-6 h-6 border-2 border-neutral-600 border-t-neutral-200 rounded-full animate-spin" />
        <span className="tracking-wider uppercase text-[10px]">Initializing local workspace...</span>
      </div>
    );
  }

  const selectedFirstId = selectedNodeIds.size > 0 ? [...selectedNodeIds][0] : undefined;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans antialiased">
      <Header
        document={document}
        mode={mode}
        camera={camera}
        onModeChange={setMode}
        onUpdateTitle={updateDocumentName}
        onOpenDashboard={onOpenDashboard}
        onResetZoom={resetZoom}
        onSave={() => {
          void saveToFile();
        }}
      />

      <main className="flex-1 min-h-0 relative w-full overflow-hidden">
        <Canvas
          document={document}
          camera={camera}
          onCameraChange={setCamera}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          mode={mode}
          selectedNodeIds={selectedNodeIds}
          onSelectNodeIds={setSelectedNodeIds}
          onAddNode={addNode}
          onUpdateNode={updateNode}
          onUpdateNodeData={updateNodeData}
          onUpdateNodeStyle={(id, style) => {
            const current = document?.nodes[id];
            if (current) {
              updateNode(id, {
                style: {
                  ...current.style,
                  ...style,
                },
              });
            }
          }}
          onBatchMoveNodes={batchMoveNodes}
          onConnectNodes={connectNodes}
          onReconnectArrow={reconnectArrow}
          onResetZoom={resetZoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomToFit={zoomToFit}
          onDeleteSelected={deleteSelectedNodes}
          onAddMindmapChild={() => {
            if (selectedFirstId) createMindmapChild(selectedFirstId);
          }}
          onAddMindmapSibling={() => {
            if (selectedFirstId) createMindmapSibling(selectedFirstId);
          }}
          adapter={adapter}
          boardId={documentId}
          activePageId={activePageId}
          pages={pages}
          onSelectPage={setActivePageId}
          onAddPage={addPage}
          onRenamePage={renamePage}
          onDeletePage={deletePage}
        />

        <Toolbar
          onOpenInsert={() => window.dispatchEvent(new Event("talweg:insert"))}
          activeTool={activeTool}
          mode={mode}
          onSelectTool={setActiveTool}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          hasSelection={selectedNodeIds.size > 0}
          onDeleteSelected={deleteSelectedNodes}
          onAddMindmapChild={() => {
            if (selectedFirstId) createMindmapChild(selectedFirstId);
          }}
          onAddMindmapSibling={() => {
            if (selectedFirstId) createMindmapSibling(selectedFirstId);
          }}
        />
      </main>
    </div>
  );
}

export function App() {
  const { route, navigate } = useRoute();

  useEffect(() => {
    if (route.type === "board") {
      localStorage.setItem("talweg_active_doc", route.boardId);
    }
  }, [route]);

  const handleSelectBoard = (docId: DocumentId) => {
    clearActiveFileHandle();
    navigate(`/board/${encodeURIComponent(docId)}`);
  };

  const handleCreateFromTemplate = async (templateDoc: CanvasDocument) => {
    const tempYdoc = createSceneDoc();
    applyDocumentToYDoc(templateDoc, tempYdoc);
    const stateVector = Y.encodeStateVector(tempYdoc);
    const documentBlob = Y.encodeStateAsUpdate(tempYdoc);
    const adapter = new IndexedDBStorageAdapter();
    try {
      await adapter.initialize();
      await adapter.saveSnapshot({
        meta: {
          documentId: templateDoc.id,
          name: templateDoc.name,
          schemaVersion: templateDoc.schemaVersion,
          createdAt: templateDoc.meta.createdAt,
          updatedAt: templateDoc.meta.updatedAt,
          nodeCount: Object.keys(templateDoc.nodes).length,
        },
        clock: 0,
        stateVector,
        documentBlob,
      });
    } finally {
      await adapter.close();
    }
    clearActiveFileHandle();
    navigate(`/board/${encodeURIComponent(templateDoc.id)}`);
  };

  const handleImportSuccess = (doc: CanvasDocument) => {
    clearActiveFileHandle();
    navigate(`/board/${encodeURIComponent(doc.id)}`);
  };

  return (
    <LanguageProvider>
      {route.type === "dashboard" ? (
        <WelcomeDashboard
          isStandalone
          onSelectBoard={handleSelectBoard}
          onCreateFromTemplate={(template) => {
            void handleCreateFromTemplate(template);
          }}
          onImportSuccess={handleImportSuccess}
        />
      ) : (
        <CanvasView
          key={route.boardId}
          documentId={route.boardId}
          pageId={route.pageId}
          onOpenDashboard={() => {
            navigate("/");
          }}
        />
      )}
    </LanguageProvider>
  );
}
