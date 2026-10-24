import { lazy, Suspense, useEffect } from "react";
import * as Y from "yjs";
import type { CanvasDocument, DocumentId } from "@talweg/core";
import {
  applyDocumentToYDoc,
  createSceneDoc,
  IndexedDBStorageAdapter,
} from "@talweg/storage";
import { WelcomeDashboard } from "./components/WelcomeDashboard.js";
import { LanguageProvider } from "./i18n.js";
import { useRoute } from "./routes/router.js";
import { clearActiveFileHandle } from "./utils/fileSystem.js";

import { markTemplateDraft } from "./utils/boardLibrary.js";

const CanvasView = lazy(() => import("./components/CanvasView.js"));

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
    markTemplateDraft(templateDoc.id);
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
        <Suspense fallback={
          <div className="w-screen h-screen bg-[#101112]" role="status" aria-label="Loading canvas" />
        }>
          <CanvasView
            key={route.boardId}
            documentId={route.boardId}
            pageId={route.pageId}
            onOpenDashboard={() => { navigate("/"); }}
          />
        </Suspense>
      )}
    </LanguageProvider>
  );
}
