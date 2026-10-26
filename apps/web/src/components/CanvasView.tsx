import { usePreferences } from "../hooks/usePreferences.js";
import { updatePreferences } from "../utils/preferences.js";
import {
  computeGroupBounds,
  zoomToBounds,
  type DocumentId,
  type PageId,
  type NodeId,
} from "@talweg/core";
import { ProjectNavigator } from "./ProjectNavigator.js";
import { worldDocument, groupBounds } from "../utils/organizeCanvas.js";
import { firstPageId } from "../utils/pageNodes.js";
import { navigate } from "../routes/router.js";
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

export default function CanvasView({
  documentId,
  pageId,
  onOpenDashboard,
}: CanvasViewProps) {
  const { t } = useTranslation();
  const preferences = usePreferences();
  const snapToGrid = preferences.snapToGrid;
  const changeSnapping = (value: boolean) => {
    updatePreferences({ snapToGrid: value });
  };
  const {
    collaboration,
    clipboardError,
    startHosting,
    approvePeer,
    stopSharing,
    saveIndependentCopy,
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
    groupSelected,
    ungroupSelected,
    duplicateSelected,
    organizeSelected,
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

  if (loadFailed && collaboration.phase !== "off")
    return (
      <div className="app-recovery" role="alert">
        <div className="app-recovery-content">
          <h1>{t(`collaboration.${collaboration.phase}`)}</h1>
          <p>{t("collaboration.joinFailed")}</p>
          <div className="app-recovery-actions">
            <button onClick={onOpenDashboard}>{t("library.back")}</button>
            <button
              onClick={() => {
                window.location.reload();
              }}
            >
              {t("library.retry")}
            </button>
          </div>
        </div>
      </div>
    );

  if (loadFailed)
    return (
      <div className="app-recovery" role="alert">
        <div className="app-recovery-content">
          <h1>{t("library.openFailed")}</h1>
          <p>{t("library.preserved")}</p>
          <div className="app-recovery-actions">
            <button onClick={onOpenDashboard}>{t("library.back")}</button>
            <button
              onClick={() => {
                window.location.reload();
              }}
            >
              {t("library.retry")}
            </button>
          </div>
        </div>
      </div>
    );

  if (!isLoaded) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[var(--canvas-bg)] text-[var(--ink-muted)] gap-3 font-mono text-xs">
        <div className="w-6 h-6 border-2 border-neutral-600 border-t-neutral-200 rounded-full animate-spin" />
        <span className="tracking-wider uppercase text-[10px]">
          {t(
            collaboration.phase !== "off"
              ? `collaboration.${collaboration.phase}`
              : "dashboard.loading",
          )}
        </span>
        {collaboration.phase !== "off" && (
          <button
            type="button"
            className="collaboration-stop"
            onClick={onOpenDashboard}
          >
            {t("library.back")}
          </button>
        )}
      </div>
    );
  }

  const selectedFirstId =
    selectedNodeIds.size > 0 ? [...selectedNodeIds][0] : undefined;

  const selectedNode = selectedFirstId
    ? document?.nodes[selectedFirstId]
    : undefined;
  return (
    <div className="flex flex-col w-screen h-screen overflow-clip bg-[var(--canvas-bg)] text-[var(--ink)] font-sans antialiased">
      <Header
        collaboration={collaboration}
        onStartHosting={startHosting}
        onApprovePeer={approvePeer}
        onSaveCopy={saveIndependentCopy}
        onFocusPeer={(id) => {
          const peer = collaboration.participants?.find(
            (member) => member.id === id,
          );
          const viewport = viewportRef.current;
          if (!peer || !viewport || peer.x === null || peer.y === null) return;
          setActivePageId(peer.pageId);
          setCamera({
            zoom: camera.zoom,
            x: viewport.clientWidth / (2 * camera.zoom) - peer.x,
            y: viewport.clientHeight / (2 * camera.zoom) - peer.y,
          });
        }}
        onStopSharing={() => {
          stopSharing();
          if (new URLSearchParams(window.location.search).has("room"))
            onOpenDashboard();
        }}
        document={document}
        adapter={adapter}
        mode={mode}
        camera={camera}
        onModeChange={setMode}
        snapToGrid={snapToGrid}
        onSnapToGrid={changeSnapping}
        onZoomToFit={zoomToFit}
        onUpdateTitle={updateDocumentName}
        onOpenDashboard={onOpenDashboard}
        onResetZoom={resetZoom}
        onSave={saveToFile}
        fileSaveState={fileSaveState}
      />

      <NodeLinksContext.Provider value={document}>
        <main className="flex-1 min-h-0 relative w-full overflow-clip">
          {document && (
            <ProjectNavigator
              document={document}
              pages={pages}
              activePageId={activePageId}
              onPage={(id) => {
                setActivePageId(id);
                const params = new URLSearchParams(window.location.search);
                params.delete("node");
                const search = params.size ? `?${params.toString()}` : "";
                navigate(
                  `/board/${encodeURIComponent(documentId)}/page/${encodeURIComponent(id)}${search}${window.location.hash}`,
                );
              }}
              onFocusNode={(id: NodeId) => {
                const world = worldDocument(document);
                const node = world.nodes[id];
                const viewport = viewportRef.current?.getBoundingClientRect();
                if (!node || !viewport) return;
                const page = node.pageId ?? firstPageId(document);
                setActivePageId(page);
                setSelectedNodeIds(new Set([id]));
                const connection =
                  node.type === "arrow"
                    ? computeGroupBounds(
                        [node.data.sourceId, node.data.targetId].flatMap(
                          (id) => {
                            const endpoint = world.nodes[id];
                            return endpoint ? [endpoint] : [];
                          },
                        ),
                      )
                    : null;
                const bounds = connection
                  ? {
                      x: connection.minX,
                      y: connection.minY,
                      width: connection.width,
                      height: connection.height,
                    }
                  : node.type === "group"
                    ? groupBounds(world, node)
                    : node;
                setCamera(
                  zoomToBounds(
                    {
                      minX: bounds.x,
                      minY: bounds.y,
                      maxX: bounds.x + bounds.width,
                      maxY: bounds.y + bounds.height,
                      width: bounds.width,
                      height: bounds.height,
                    },
                    { width: viewport.width, height: viewport.height },
                    100,
                    0.2,
                    1.2,
                  ),
                );
                const params = new URLSearchParams(window.location.search);
                params.set("node", id);
                navigate(
                  `/board/${encodeURIComponent(documentId)}/page/${encodeURIComponent(page)}?${params.toString()}`,
                );
              }}
            />
          )}

          <Canvas
            viewportRef={viewportRef}
            onImportImage={importImage}
            document={document}
            camera={camera}
            onCameraChange={setCamera}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            mode={mode}
            snapToGrid={snapToGrid}
            selectedNodeIds={selectedNodeIds}
            onSelectNodeIds={setSelectedNodeIds}
            onAddNode={addNode}
            onUpdateNode={updateNode}
            onUpdateNodeData={updateNodeData}
            onUpdateNodeStyle={(id, style) => {
              const current = document?.nodes[id];
              if (current) {
                updateNode(id, {
                  ...(current.type === "freehand" &&
                  style.strokeColor !== undefined
                    ? { meta: { ...current.meta, automaticInk: false } }
                    : {}),
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
            onGroup={groupSelected}
            onUngroup={ungroupSelected}
            onDuplicate={duplicateSelected}
            onAlign={organizeSelected}
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

          {clipboardError && (
            <div className="clipboard-notice" role="status">
              {t(`clipboard.${clipboardError}`)}
            </div>
          )}
          <div className="remote-presence-layer" aria-hidden="true">
            {preferences.showCursors &&
              collaboration.participants
                ?.filter(
                  (peer) =>
                    peer.id !== collaboration.selfId &&
                    peer.pageId === activePageId,
                )
                .map((peer) => (
                  <div key={peer.id}>
                    {peer.x !== null && peer.y !== null && (
                      <div
                        className="remote-cursor"
                        data-testid="remote-cursor"
                        style={{
                          left: (peer.x + camera.x) * camera.zoom,
                          top: (peer.y + camera.y) * camera.zoom,
                          color: peer.color,
                        }}
                      >
                        <svg width="15" height="20" viewBox="0 0 15 20">
                          <path
                            d="M1 1L13 12L7 13L4 18Z"
                            fill="currentColor"
                            stroke="var(--canvas-bg)"
                          />
                        </svg>
                        <span style={{ background: peer.color }}>
                          {peer.name}
                        </span>
                      </div>
                    )}
                    {peer.selected.map((id) => {
                      const node = document
                        ? worldDocument(document).nodes[id as NodeId]
                        : undefined;
                      return node && node.type !== "arrow" ? (
                        <div
                          key={id}
                          className="remote-selection"
                          style={{
                            left: (node.x + camera.x) * camera.zoom,
                            top: (node.y + camera.y) * camera.zoom,
                            width: node.width * camera.zoom,
                            height: node.height * camera.zoom,
                            borderColor: peer.color,
                          }}
                        />
                      ) : null;
                    })}
                  </div>
                ))}
          </div>
          <Toolbar
            onOpenInsert={() =>
              window.dispatchEvent(new Event("talweg:insert"))
            }
            activeTool={activeTool}
            mode={mode}
            onSelectTool={setActiveTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            hasSelection={selectedNodeIds.size > 0}
            canBranch={
              selectedNodeIds.size === 1 &&
              !!selectedNode &&
              selectedNode.type !== "arrow"
            }
            onDeleteSelected={deleteSelectedNodes}
            onAddMindmapChild={() => {
              if (selectedFirstId) createMindmapChild(selectedFirstId);
            }}
            onAddMindmapSibling={() => {
              if (selectedFirstId) createMindmapSibling(selectedFirstId);
            }}
          />
        </main>
      </NodeLinksContext.Provider>
    </div>
  );
}
