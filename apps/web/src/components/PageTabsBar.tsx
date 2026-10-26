import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CanvasPage, DocumentId, PageId } from "@talweg/core";
import { navigate } from "../routes/router.js";

import { useTranslation } from "../hooks/useTranslation.js";

interface PageTabsBarProps {
  pages: readonly CanvasPage[];
  activePageId: PageId;
  boardId?: DocumentId | string | undefined;
  onSelectPage: (pageId: PageId) => void;
  onAddPage: (name?: string) => PageId | undefined;
  onRenamePage: (pageId: PageId, newName: string) => void;
  onDeletePage: (pageId: PageId) => void;
}

function buildPagePath(
  boardId: DocumentId | string | undefined,
  pageId: PageId,
): string {
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);
  params.delete("node");
  const search = params.size ? `?${params.toString()}` : "";
  const bId = boardId ?? "default-doc";
  return `/board/${encodeURIComponent(bId)}/page/${encodeURIComponent(pageId)}${search}${hash}`;
}

export function PageTabsBar({
  pages,
  activePageId,
  boardId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
}: PageTabsBarProps) {
  const { t } = useTranslation();
  const [editingPageId, setEditingPageId] = useState<PageId | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPageId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingPageId]);

  const handleStartRename = (page: CanvasPage) => {
    setEditingPageId(page.id);
    setEditingName(page.name);
  };

  const focusPage = (pageId: PageId) => {
    requestAnimationFrame(() => {
      document.getElementById(`canvas-page-tab-${pageId}`)?.focus();
    });
  };

  const handleCommitRename = (pageId: PageId, restoreFocus = false) => {
    if (editingPageId === pageId) {
      const trimmed = editingName.trim();
      if (trimmed) {
        onRenamePage(pageId, trimmed);
      }
      setEditingPageId(null);
      if (restoreFocus) focusPage(pageId);
    }
  };

  const handleTabClick = (pageId: PageId) => {
    if (editingPageId) return;
    onSelectPage(pageId);
    navigate(buildPagePath(boardId, pageId));
  };

  return (
    <div
      data-testid="page-tabs-bar"
      onPointerDown={(e) => {
        // canvas pointer capture retargets the click away from the tab
        e.stopPropagation();
      }}
      className="canvas-pages-panel absolute bottom-4 left-4 z-30 flex items-center bg-[#131518] border border-white/[0.08] rounded shadow-md select-none"
    >
      <div
        role="tablist"
        aria-label={t("pages.title")}
        className="flex items-center max-w-[380px] overflow-x-auto no-scrollbar"
      >
        {pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const isEditing = editingPageId === page.id;

          return (
            <div
              key={page.id}
              className={`canvas-page-tab group relative flex items-center gap-1 h-8 px-3 text-xs transition cursor-pointer ${
                index > 0 ? "border-l border-white/[0.06]" : ""
              } ${
                isActive
                  ? "text-neutral-100 bg-white/[0.05]"
                  : "text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.03]"
              }`}
              data-active={isActive}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  aria-label={t("pages.name")}
                  value={editingName}
                  onChange={(e) => {
                    setEditingName(e.target.value);
                  }}
                  onBlur={() => {
                    handleCommitRename(page.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      handleCommitRename(page.id, true);
                    } else if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditingPageId(null);
                      focusPage(page.id);
                    }
                  }}
                  className="bg-[#0b0c0e] text-neutral-100 px-1 py-0.5 rounded border border-white/[0.15] outline-none w-24 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              ) : (
                <button
                  id={`canvas-page-tab-${page.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  title={t("pages.rename")}
                  className="h-full min-w-0 text-inherit cursor-pointer"
                  onClick={() => {
                    handleTabClick(page.id);
                  }}
                  onDoubleClick={() => {
                    handleStartRename(page);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "F2") {
                      event.preventDefault();
                      event.stopPropagation();
                      handleStartRename(page);
                      return;
                    }
                    const nextIndex =
                      event.key === "ArrowRight"
                        ? (index + 1) % pages.length
                        : event.key === "ArrowLeft"
                          ? (index - 1 + pages.length) % pages.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? pages.length - 1
                              : undefined;
                    const next =
                      nextIndex === undefined ? undefined : pages[nextIndex];
                    if (!next) return;
                    event.preventDefault();
                    event.stopPropagation();
                    handleTabClick(next.id);
                    focusPage(next.id);
                  }}
                >
                  <span className="block truncate max-w-[110px]">
                    {page.name}
                  </span>
                </button>
              )}

              {pages.length > 1 && !isEditing && (
                <button
                  type="button"
                  title={t("pages.delete")}
                  aria-label={t("pages.delete")}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-neutral-600 hover:text-rose-300 transition cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(page.id);
                    const next =
                      page.id === activePageId
                        ? pages.find((candidate) => candidate.id !== page.id)
                        : pages.find(
                            (candidate) => candidate.id === activePageId,
                          );
                    if (next) {
                      if (page.id === activePageId)
                        navigate(buildPagePath(boardId, next.id));
                      focusPage(next.id);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        title={t("pages.add")}
        aria-label={t("pages.add")}
        onClick={() => {
          const newId = onAddPage();
          if (newId) {
            navigate(buildPagePath(boardId, newId));
            focusPage(newId);
          }
        }}
        className="flex items-center justify-center w-8 h-8 border-l border-white/[0.06] text-neutral-500 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
