import { SettingsTrigger } from "./AppSettings.js";
import { JoinSession } from "./JoinSession.js";
import type { LibraryIndex } from "../types/projectLibrary.js";
import { ProjectStorageAdapter } from "../utils/projectStorage.js";
import * as Y from "yjs";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  FolderOpen,
  GitBranch,
  Layout,
  Boxes,
  X,
  ArrowUpRight,
  Plus,
  Layers,
  Eye,
  EyeOff,
} from "lucide-react";
import type { CanvasDocument, DocumentId } from "@talweg/core";
import {
  createSceneDoc,
  yDocToDocument,
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

import {
  hiddenBoardIds,
  setBoardHidden,
  templateDraftIds,
} from "../utils/boardLibrary.js";
import { ThemePicker } from "./ThemePicker.js";
import { LanguagePicker } from "./LanguagePicker.js";

interface WelcomeDashboardProps {
  isOpen?: boolean;
  isStandalone?: boolean;
  currentDocumentId?: DocumentId;
  onClose?: () => void;
  onSelectBoard: (documentId: DocumentId) => void;
  onCreateFromTemplate: (templateDoc: CanvasDocument) => void;
  onImportSuccess: (doc: CanvasDocument) => void;
}

function formatRelativeTime(
  timestamp: number,
  relative: Intl.RelativeTimeFormat,
  language: string,
): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return relative.format(0, "second");
  if (seconds < 3600)
    return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400)
    return relative.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 604800)
    return relative.format(-Math.floor(seconds / 86400), "day");
  return new Date(timestamp).toLocaleDateString(language, {
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
  const { t, language } = useTranslation();
  const plurals = useMemo(() => new Intl.PluralRules(language), [language]);
  const relativeTime = useMemo(
    () => new Intl.RelativeTimeFormat(language, { numeric: "auto" }),
    [language],
  );
  const [recentBoards, setRecentBoards] = useState<StorageSnapshot["meta"][]>(
    [],
  );
  const [hiddenBoards, setHiddenBoards] = useState(hiddenBoardIds);
  const [showHidden, setShowHidden] = useState(false);
  const [boardQuery, setBoardQuery] = useState("");
  const [libraryInfo, setLibraryInfo] = useState<LibraryIndex | null>(null);
  const [libraryFailed, setLibraryFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isStandalone && !isOpen) return;

    let isMounted = true;
    async function fetchBoards() {
      setIsLoading(true);
      setLibraryFailed(false);
      const adapter = new ProjectStorageAdapter();
      try {
        await adapter.initialize();
        const snapshots = await adapter.listSnapshots();
        if (isMounted) {
          setLibraryInfo(adapter.library);
          setLibraryFailed(adapter.hasPendingWrites);
        }
        {
          const drafts = templateDraftIds();
          const candidates = snapshots.filter(
            (snapshot) => !drafts.has(snapshot.meta.documentId),
          );
          const summaries = await Promise.allSettled(
            candidates.map(async (snapshot) => {
              const deltas = await adapter.loadDeltas(
                snapshot.meta.documentId,
                snapshot.clock,
              );
              if (!deltas.length) return snapshot.meta;
              const scene = createSceneDoc();
              try {
                Y.applyUpdate(scene, snapshot.documentBlob);
                for (const delta of deltas)
                  Y.applyUpdate(scene, delta.updateBlob);
                const current = yDocToDocument(scene);
                return {
                  ...snapshot.meta,
                  name: current.name,
                  nodeCount: Object.keys(current.nodes).length,
                  updatedAt: Math.max(
                    snapshot.meta.updatedAt,
                    ...deltas.map((delta) => delta.timestamp),
                  ),
                };
              } finally {
                scene.destroy();
              }
            }),
          );
          const boards = summaries.flatMap((summary, index) =>
            summary.status === "fulfilled"
              ? [summary.value]
              : candidates[index]
                ? [candidates[index].meta]
                : [],
          );
          boards.sort((a, b) => b.updatedAt - a.updatedAt);
          if (isMounted) setRecentBoards(boards);
        }
      } catch {
        if (isMounted) setLibraryFailed(true);
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
        dialogRef.current?.focus();
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
  }, [isOpen, isStandalone, onClose, refresh]);

  useEffect(() => {
    const reload = () => {
      setRefresh((value) => value + 1);
    };
    window.addEventListener("focus", reload);
    const hot = (
      import.meta as ImportMeta & {
        hot?: {
          on: (event: string, listener: () => void) => void;
          off: (event: string, listener: () => void) => void;
        };
      }
    ).hot;
    hot?.on("talweg:projects-changed", reload);
    return () => {
      window.removeEventListener("focus", reload);
      hot?.off("talweg:projects-changed", reload);
    };
  }, []);

  if (!isStandalone && !isOpen) return null;

  const handleOpenFromFile = async () => {
    const fileResult = await openDocumentFromFileSystem();
    if (!fileResult) return;

    const adapter = new ProjectStorageAdapter();
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

  const handleDelete = async (id: DocumentId, name: string) => {
    if (!window.confirm(t("dashboard.deleteConfirm").replace("{name}", name)))
      return;
    setDeletingId(id);
    setDeleteError(false);
    const adapter = new ProjectStorageAdapter();
    try {
      await adapter.initialize();
      await adapter.deleteProject(id);
      setHiddenBoards(setBoardHidden(id, false));
      setRecentBoards((boards) =>
        boards.filter((board) => board.documentId !== id),
      );
      setRefresh((value) => value + 1);
    } catch {
      setDeleteError(true);
    } finally {
      await adapter.close();
      setDeletingId(null);
    }
  };

  const templates = [
    {
      id: "blank",
      icon: Layout,
      title: t("dashboard.blankTitle"),
      desc: t("dashboard.blankDesc"),
      mode: t("modes.whiteboard"),
      create: () => {
        onCreateFromTemplate(createBlankCanvas());
      },
    },
    {
      id: "micro",
      icon: Boxes,
      title: t("dashboard.microTitle"),
      desc: t("dashboard.microDesc"),
      mode: t("modes.diagrams"),
      create: () => {
        onCreateFromTemplate(createMicroservicesTemplate());
      },
    },
    {
      id: "sprint",
      icon: GitBranch,
      title: t("dashboard.sprintTitle"),
      desc: t("dashboard.sprintDesc"),
      mode: t("modes.mindmap"),
      create: () => {
        onCreateFromTemplate(createSprintMindmapTemplate());
      },
    },
  ];

  const libraryBoards = recentBoards.filter((board) =>
    showHidden
      ? hiddenBoards.has(board.documentId)
      : !hiddenBoards.has(board.documentId),
  );
  const visibleBoards = libraryBoards.filter((board) =>
    board.name.toLocaleLowerCase().includes(boardQuery.toLocaleLowerCase()),
  );
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role={isStandalone ? "region" : "dialog"}
      aria-modal={isStandalone ? undefined : "true"}
      aria-labelledby="welcome-dashboard-title"
      className={`workspace-home ${isStandalone ? "" : "workspace-home-overlay"}`}
    >
      <header className="workspace-header">
        <div className="workspace-brand">
          <img src="/favicon.svg" alt="" width="26" height="26" />
          <span>Talweg</span>
          <span className="workspace-header-divider" />
          <span className="workspace-header-caption">
            {t("dashboard.workspace")}
          </span>
        </div>
        <div className="workspace-header-actions">
          <div className="workspace-preferences">
            <SettingsTrigger />
            <ThemePicker />
            <JoinSession />
            <LanguagePicker />
          </div>
          <button
            type="button"
            onClick={() => {
              void handleOpenFromFile();
            }}
            className="workspace-open-file"
            aria-label={t("dashboard.openFromComputer")}
            title={t("dashboard.openFromComputer")}
          >
            <FolderOpen size={15} />
            <span>{t("dashboard.openFromComputer")}</span>
          </button>
          {!isStandalone && onClose && (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="workspace-close"
              title={t("dashboard.close")}
              aria-label={t("dashboard.close")}
            >
              <X size={17} />
            </button>
          )}
        </div>
      </header>

      <main className="workspace-content">
        <section
          className="project-library-location"
          aria-label={t("library.title")}
        >
          <FolderOpen size={16} aria-hidden="true" />
          <div>
            <strong>
              {t(libraryInfo ? "library.connected" : "library.browserOnly")}
            </strong>
            <span>
              {libraryInfo ? libraryInfo.directory : t("library.browserHint")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setRefresh((value) => value + 1);
            }}
            disabled={isLoading}
          >
            {t("library.refresh")}
          </button>
        </section>
        {(libraryFailed || Boolean(libraryInfo?.issues.length)) && (
          <p className="library-warning" role="alert">
            {t("library.issue")}
            {libraryInfo?.issues.length
              ? ` ${libraryInfo.issues.join(", ")}`
              : ""}
          </p>
        )}
        {deleteError && (
          <p className="library-warning" role="alert">
            {t("dashboard.deleteError")}
          </p>
        )}
        <section className="workspace-intro">
          <div className="workspace-eyebrow">
            <span />
            {t("dashboard.eyebrow")}
          </div>
          <h1 id="welcome-dashboard-title">{t("dashboard.heroTitle")}</h1>
          <p>{t("dashboard.heroDescription")}</p>
        </section>

        <section aria-labelledby="templates-title">
          <div className="workspace-section-heading">
            <h2 id="templates-title">{t("dashboard.templates")}</h2>
            <span>{t("dashboard.chooseStartingPoint")}</span>
          </div>
          <div className="workspace-templates">
            {templates.map((template) => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={template.create}
                  className={`workspace-template workspace-template-${template.id}`}
                >
                  <TemplatePreview variant={template.id} />
                  <span className="workspace-template-body">
                    <span className="workspace-template-title">
                      {template.title}
                      <ArrowUpRight size={17} />
                    </span>
                    <span className="workspace-template-description">
                      {template.desc}
                    </span>
                    <span className="workspace-template-mode">
                      <Icon size={12} />
                      {template.mode}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="workspace-recents"
          aria-labelledby="recent-boards-title"
        >
          <div className="workspace-section-heading">
            <h2 id="recent-boards-title">
              {t("dashboard.recentBoards")}
              <span className="workspace-count">{libraryBoards.length}</span>
            </h2>
            <span>{t("dashboard.onlyOnDevice")}</span>
          </div>
          <div className="workspace-library-options">
            <input
              type="search"
              aria-label={t("dashboard.searchBoards")}
              placeholder={t("dashboard.searchBoards")}
              value={boardQuery}
              onChange={(event) => {
                setBoardQuery(event.target.value);
              }}
            />
            <button
              type="button"
              onClick={() => {
                setShowHidden(!showHidden);
              }}
            >
              {t(showHidden ? "dashboard.showBoards" : "dashboard.showHidden")}{" "}
              {showHidden ? "" : `(${String(hiddenBoards.size)})`}
            </button>
          </div>
          {isLoading && recentBoards.length === 0 ? (
            <div className="workspace-empty" role="status">
              {t("dashboard.loading")}
            </div>
          ) : visibleBoards.length === 0 ? (
            <div className="workspace-empty">
              <Layers size={22} />
              <p>
                {t(
                  boardQuery
                    ? "dashboard.noMatches"
                    : showHidden
                      ? "dashboard.noHidden"
                      : "dashboard.noRecent",
                )}
              </p>
            </div>
          ) : (
            <div className="workspace-board-list">
              {visibleBoards.map((snapshot) => {
                const isCurrent = snapshot.documentId === currentDocumentId;
                return (
                  <div
                    className="workspace-board-row"
                    key={snapshot.documentId}
                  >
                    <button
                      style={{
                        contentVisibility: "auto",
                        containIntrinsicSize: "auto 68px",
                      }}
                      type="button"
                      onClick={() => {
                        onSelectBoard(snapshot.documentId);
                      }}
                      className="workspace-board"
                    >
                      <span className="workspace-board-icon">
                        <Layout size={17} />
                      </span>
                      <span className="workspace-board-title">
                        {snapshot.name || t("canvas.titlePlaceholder")}
                        {isCurrent && (
                          <span className="workspace-current">
                            {t("dashboard.active")}
                          </span>
                        )}
                      </span>
                      <span className="workspace-board-count">
                        {String(snapshot.nodeCount)}{" "}
                        {t(
                          `dashboard.elements_${plurals.select(snapshot.nodeCount)}`,
                        )}
                      </span>
                      <span className="workspace-board-time">
                        <Clock size={12} />
                        {formatRelativeTime(
                          snapshot.updatedAt,
                          relativeTime,
                          language,
                        )}
                      </span>
                      <ArrowUpRight
                        size={16}
                        className="workspace-board-arrow"
                      />
                    </button>
                    <button
                      className="workspace-board-hide"
                      type="button"
                      aria-label={`${t(showHidden ? "dashboard.restoreBoard" : "dashboard.hideBoard")} ${snapshot.name}`}
                      title={t(
                        showHidden
                          ? "dashboard.restoreBoard"
                          : "dashboard.hideBoard",
                      )}
                      disabled={deletingId !== null}
                      onClick={() => {
                        setHiddenBoards(
                          setBoardHidden(snapshot.documentId, !showHidden),
                        );
                      }}
                    >
                      {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      className="workspace-board-hide workspace-board-delete"
                      type="button"
                      aria-label={`${t("dashboard.deleteBoard")} ${snapshot.name}`}
                      title={t("dashboard.deleteBoard")}
                      disabled={deletingId !== null}
                      onClick={() => {
                        void handleDelete(snapshot.documentId, snapshot.name);
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <footer className="workspace-footer">
          <span className="workspace-local-dot" />
          {t(libraryInfo ? "library.footer" : "dashboard.subtitle")}
        </footer>
      </main>
    </div>
  );
}

function TemplatePreview({ variant }: { variant: string }) {
  return (
    <span
      className={`template-preview template-preview-${variant}`}
      aria-hidden="true"
    >
      {variant === "blank" ? (
        <span className="template-blank-mark">
          <Plus size={22} strokeWidth={1.25} />
        </span>
      ) : (
        <svg viewBox="0 0 280 112" fill="none">
          {variant === "micro" ? (
            <>
              <path d="M72 57H107Q113 57 113 51V31Q113 25 119 25H150M113 51V83Q113 89 119 89H150M206 25H226Q232 25 232 31V83Q232 89 226 89H206" />
              <rect x="20" y="42" width="52" height="30" rx="5" />
              <rect x="150" y="10" width="56" height="30" rx="5" />
              <rect x="150" y="74" width="56" height="30" rx="5" />
              <path
                d="M33 54H59M33 61H49M164 22H191M164 29H182M164 86H191M164 93H182"
                className="preview-text-lines"
              />
              <circle cx="232" cy="57" r="4" className="preview-port" />
            </>
          ) : (
            <>
              <path d="M125 56C151 56 149 23 175 23M125 56C151 56 149 89 175 89M72 56C44 56 53 23 28 23M72 56C44 56 53 89 28 89" />
              <rect
                x="72"
                y="40"
                width="53"
                height="32"
                rx="6"
                className="preview-root"
              />
              <rect x="175" y="11" width="68" height="24" rx="4" />
              <rect x="175" y="77" width="68" height="24" rx="4" />
              <path
                d="M87 53H111M87 60H102M188 23H229M188 89H217M9 23H28M9 89H28"
                className="preview-text-lines"
              />
              <circle cx="28" cy="23" r="3" className="preview-port" />
              <circle cx="28" cy="89" r="3" className="preview-port" />
            </>
          )}
        </svg>
      )}
    </span>
  );
}
