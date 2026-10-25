import type { DocumentId, PageId } from "@talweg/core";
import { Canvas } from "./Canvas.js";
import { Header } from "./Header.js";
import { Toolbar } from "./Toolbar.js";
import { useTranslation } from "../hooks/useTranslation.js";
import { useCanvas } from "../hooks/useCanvas.js";

import { NodeLinksContext } from "./NodeLinks.js";

interface CanvasViewProps {
  documentId: DocumentId;
  pageId?: PageId | undefined;
  onOpenDashboard: () => void;
}

export default function CanvasView({ documentId, pageId, onOpenDashboard }: CanvasViewProps) {
  const { t } = useTranslation();
  const {
    importImage,
    viewportRef,
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
    fileSaveState,
    resetZoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    canUndo,
    canRedo,
    isLoaded,
    loadFailed,
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

  if (loadFailed) return <div className="app-recovery" role="alert"><div className="app-recovery-content"><h1>{t("library.openFailed")}</h1><p>{t("library.preserved")}</p><div className="app-recovery-actions"><button onClick={onOpenDashboard}>{t("library.back")}</button><button onClick={() => { window.location.reload(); }}>{t("library.retry")}</button></div></div></div>;

  if (!isLoaded) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[var(--canvas-bg)] text-[var(--ink-muted)] gap-3 font-mono text-xs">
        <div className="w-6 h-6 border-2 border-neutral-600 border-t-neutral-200 rounded-full animate-spin" />
        <span className="tracking-wider uppercase text-[10px]">{t("dashboard.loading")}</span>
      </div>
    );
  }

  const selectedFirstId = selectedNodeIds.size > 0 ? [...selectedNodeIds][0] : undefined;

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[var(--canvas-bg)] text-[var(--ink)] font-sans antialiased">
      <Header
        document={document}
        adapter={adapter}
        mode={mode}
        camera={camera}
        onModeChange={setMode}
        onUpdateTitle={updateDocumentName}
        onOpenDashboard={onOpenDashboard}
        onResetZoom={resetZoom}
        onSave={saveToFile}
        fileSaveState={fileSaveState}
      />

      <NodeLinksContext.Provider value={document}><main className="flex-1 min-h-0 relative w-full overflow-hidden">
        <Canvas
          viewportRef={viewportRef}
          onImportImage={importImage}
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
      </main></NodeLinksContext.Provider>
    </div>
  );
}

