import { useEffect, useRef, useState } from "react";
import {
  Clock,
  FolderOpen,
  GitBranch,
  Layout,
  Boxes,
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
  if (diffSec < 60) return "just now";
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

  const templates = [
    {
      id: "blank",
      icon: Layout,
      title: t("dashboard.blankTitle"),
      desc: t("dashboard.blankDesc"),
      mode: t("modes.whiteboard"),
      create: () => { onCreateFromTemplate(createBlankCanvas()); },
    },
    {
      id: "micro",
      icon: Boxes,
      title: t("dashboard.microTitle"),
      desc: t("dashboard.microDesc"),
      mode: t("modes.diagrams"),
      create: () => { onCreateFromTemplate(createMicroservicesTemplate()); },
    },
    {
      id: "sprint",
      icon: GitBranch,
      title: t("dashboard.sprintTitle"),
      desc: t("dashboard.sprintDesc"),
      mode: t("modes.mindmap"),
      create: () => { onCreateFromTemplate(createSprintMindmapTemplate()); },
    },
  ];

  return (
    <div
      ref={dialogRef}
      role={isStandalone ? "region" : "dialog"}
      aria-modal={isStandalone ? undefined : "true"}
      aria-labelledby="welcome-dashboard-title"
      className={
        isStandalone
          ? "min-h-screen w-full bg-[#0b0c0e] flex flex-col overflow-y-auto antialiased select-none text-neutral-200"
          : "fixed inset-0 z-50 bg-[#0b0c0e] flex flex-col overflow-y-auto antialiased select-none text-neutral-200"
      }
    >
      <div className="h-9 border-b border-white/[0.08] bg-[#0e0f11] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="w-4 h-4" />
          <h1 id="welcome-dashboard-title" className="text-[11px] font-medium tracking-tight text-neutral-200">
            {t("dashboard.title")}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              void handleOpenFromFile();
            }}
            className="flex items-center gap-1.5 h-7 px-2 rounded text-[11px] text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{t("dashboard.openFromComputer")}</span>
          </button>

          {!isStandalone && onClose && (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded text-neutral-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
              title={t("dashboard.close")}
              aria-label={t("dashboard.close")}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl w-full mx-auto flex flex-col px-6 py-10 gap-10">
        <div>
          <h2 className="text-[10px] uppercase tracking-wide text-neutral-500 mb-2">
            {t("dashboard.templates")}
          </h2>
          <div className="border border-white/[0.08] rounded">
            {templates.map((template, index) => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={template.create}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left group transition cursor-pointer hover:bg-white/[0.03] ${
                    index > 0 ? "border-t border-white/[0.06]" : ""
                  }`}
                >
                  <Icon className="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 transition shrink-0" />
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs text-neutral-200 group-hover:text-white transition truncate">
                      {template.title}
                    </span>
                    <span className="text-[11px] text-neutral-500 truncate">
                      {template.desc}
                    </span>
                  </span>
                  <span className="text-[10px] text-neutral-600 shrink-0">{template.mode}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-[10px] uppercase tracking-wide text-neutral-500 mb-2">
            {t("dashboard.recentBoards")}
          </h2>

          {isLoading ? (
            <div className="h-16 flex items-center justify-center text-[11px] text-neutral-500 border border-dashed border-white/[0.08] rounded">
              …
            </div>
          ) : recentBoards.length === 0 ? (
            <div className="border border-dashed border-white/[0.08] rounded px-3 py-6 text-center text-[11px] text-neutral-500">
              {t("dashboard.noRecent")}
            </div>
          ) : (
            <div className="border border-white/[0.08] rounded">
              {recentBoards.map((snapshot, index) => {
                const isCurrent = snapshot.meta.documentId === currentDocumentId;
                return (
                  <button
                    key={snapshot.meta.documentId}
                    type="button"
                    onClick={() => {
                      onSelectBoard(snapshot.meta.documentId);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left group transition cursor-pointer hover:bg-white/[0.03] ${
                      index > 0 ? "border-t border-white/[0.06]" : ""
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrent ? "bg-amber-400" : "bg-transparent"}`} />
                    <span className="text-xs text-neutral-200 group-hover:text-white transition truncate flex-1">
                      {snapshot.meta.name || "Untitled"}
                      {isCurrent && <span className="text-[10px] text-neutral-500 ml-2">{t("dashboard.active")}</span>}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-neutral-600 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(snapshot.meta.updatedAt)}
                    </span>
                    <span className="text-[10px] text-neutral-600 shrink-0 w-14 text-right font-mono">
                      {String(snapshot.meta.nodeCount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-neutral-600">{t("dashboard.subtitle")}</p>
      </div>
    </div>
  );
}
