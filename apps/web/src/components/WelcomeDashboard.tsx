import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  Clock,
  FolderOpen,
  GitBranch,
  Layers,
  Layout,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import type { CanvasDocument, DocumentId } from "@talweg/core";
import {
  IndexedDBStorageAdapter,
  type StorageSnapshot,
} from "@talweg/storage";
import { useTranslation } from "../hooks/useTranslation.js";
import {
  importTalwegDocument,
  openDocumentFromFileSystem,
} from "../utils/fileSystem.js";
import {
  createBlankCanvas,
  createMicroservicesTemplate,
  createSprintMindmapTemplate,
} from "../utils/starterTemplates.js";

interface WelcomeDashboardProps {
  isOpen?: boolean;
  isStandalone?: boolean;
  currentDocumentId?: DocumentId;
  onClose?: () => void;
  onSelectBoard: (documentId: DocumentId) => void;
  onCreateFromTemplate: (templateDoc: CanvasDocument) => void;
  onImportSuccess: (doc: CanvasDocument) => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${String(diffMin)}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${String(diffHour)}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${String(diffDay)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function WelcomeDashboard({
  isOpen = true,
  isStandalone = false,
  currentDocumentId,
  onClose,
  onSelectBoard,
  onCreateFromTemplate,
  onImportSuccess,
}: WelcomeDashboardProps) {
  const { t } = useTranslation();
  const [recentBoards, setRecentBoards] = useState<StorageSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isStandalone && !isOpen) return;

    let isMounted = true;
    async function fetchBoards() {
      setIsLoading(true);
      const adapter = new IndexedDBStorageAdapter();
      try {
        await adapter.initialize();
        const snapshots = await adapter.listSnapshots();
        if (isMounted) {
          snapshots.sort((a, b) => b.meta.updatedAt - a.meta.updatedAt);
          setRecentBoards(snapshots);
        }
      } catch {
        // Fallback silently if storage unavailable
      } finally {
        await adapter.close();
        if (isMounted) setIsLoading(false);
      }
    }

    void fetchBoards();

    const focusTimer = setTimeout(() => {
      if (!isStandalone && closeButtonRef.current) {
        closeButtonRef.current.focus();
      } else {
        const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        firstFocusable?.focus();
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isStandalone) {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      isMounted = false;
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isStandalone, onClose]);

  if (!isStandalone && !isOpen) return null;

  const handleOpenFromFile = async () => {
    const fileResult = await openDocumentFromFileSystem();
    if (!fileResult) return;

    const adapter = new IndexedDBStorageAdapter();
    try {
      await adapter.initialize();
      const { doc } = await importTalwegDocument(fileResult.text, adapter);
      onImportSuccess(doc);
    } catch {
      // Ignore file import cancel/failure
    } finally {
      await adapter.close();
    }
  };

  return (
    <div
      ref={dialogRef}
      role={isStandalone ? "region" : "dialog"}
      aria-modal={isStandalone ? undefined : "true"}
      aria-labelledby="welcome-dashboard-title"
      className={
        isStandalone
          ? "min-h-screen w-full bg-[#08090a] flex flex-col p-6 sm:p-12 overflow-y-auto antialiased select-none text-neutral-100"
          : "fixed inset-0 z-50 bg-[#08090a]/95 backdrop-blur-xl flex flex-col p-6 sm:p-12 overflow-y-auto antialiased select-none text-neutral-100"
      }
    >
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-10">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center shadow-md">
              <img src="/favicon.svg" alt="Talweg" className="w-5 h-5 opacity-95" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  id="welcome-dashboard-title"
                  className="text-base font-semibold font-mono tracking-tight text-neutral-100"
                >
                  {t("dashboard.title")}
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v0.1 Local-First
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-sans mt-0.5">
                {t("dashboard.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void handleOpenFromFile();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-white/10 shadow-sm transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>{t("dashboard.openFromComputer")}</span>
            </button>

            {!isStandalone && onClose && (
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-md flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer border border-white/10"
                title={t("dashboard.close")}
                aria-label={t("dashboard.close")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Starter Templates */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-neutral-300">
              {t("dashboard.templates")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Template 1: Blank Canvas */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                onCreateFromTemplate(createBlankCanvas());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onCreateFromTemplate(createBlankCanvas());
                }
              }}
              className="group bg-neutral-900/50 hover:bg-neutral-900 border border-white/10 hover:border-sky-500/50 rounded-lg p-4 transition-all cursor-pointer flex flex-col justify-between h-36 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="w-8 h-8 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition">
                  <Layout className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 border border-white/5">
                  Whiteboard
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-neutral-100 group-hover:text-sky-300 transition flex items-center gap-1.5">
                  {t("dashboard.blankTitle")}
                  <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                </h3>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                  {t("dashboard.blankDesc")}
                </p>
              </div>
            </div>

            {/* Template 2: Microservices Architecture */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                onCreateFromTemplate(createMicroservicesTemplate());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onCreateFromTemplate(createMicroservicesTemplate());
                }
              }}
              className="group bg-neutral-900/50 hover:bg-neutral-900 border border-white/10 hover:border-emerald-500/50 rounded-lg p-4 transition-all cursor-pointer flex flex-col justify-between h-36 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
                  <Boxes className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Diagrams
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-neutral-100 group-hover:text-emerald-300 transition flex items-center gap-1.5">
                  {t("dashboard.microTitle")}
                  <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                </h3>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                  {t("dashboard.microDesc")}
                </p>
              </div>
            </div>

            {/* Template 3: Sprint Planning Mindmap */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                onCreateFromTemplate(createSprintMindmapTemplate());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onCreateFromTemplate(createSprintMindmapTemplate());
                }
              }}
              className="group bg-neutral-900/50 hover:bg-neutral-900 border border-white/10 hover:border-indigo-500/50 rounded-lg p-4 transition-all cursor-pointer flex flex-col justify-between h-36 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="w-8 h-8 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition">
                  <GitBranch className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Mindmap
                </span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-neutral-100 group-hover:text-indigo-300 transition flex items-center gap-1.5">
                  {t("dashboard.sprintTitle")}
                  <Plus className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                </h3>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                  {t("dashboard.sprintDesc")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Recent Boards */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-neutral-300">
              {t("dashboard.recentBoards")}
            </h2>
          </div>

          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-xs font-mono text-neutral-500">
              Loading recent canvases...
            </div>
          ) : recentBoards.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-lg p-8 text-center text-xs text-neutral-500 font-mono">
              {t("dashboard.noRecent")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recentBoards.map((snapshot) => {
                const isCurrent = snapshot.meta.documentId === currentDocumentId;

                return (
                  <div
                    key={snapshot.meta.documentId}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectBoard(snapshot.meta.documentId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        onSelectBoard(snapshot.meta.documentId);
                      }
                    }}
                    className={`group bg-neutral-900/60 hover:bg-neutral-900 border rounded-lg p-4 transition-all cursor-pointer flex flex-col justify-between h-32 ${
                      isCurrent
                        ? "border-amber-500/50 shadow-md shadow-amber-500/5"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm text-neutral-200 group-hover:text-white transition truncate">
                        {snapshot.meta.name || "Untitled Canvas"}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        <span>{formatRelativeTime(snapshot.meta.updatedAt)}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {snapshot.meta.nodeCount} {t("dashboard.elements")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
