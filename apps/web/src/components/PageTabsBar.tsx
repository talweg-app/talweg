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

function buildPagePath(boardId: DocumentId | string | undefined, pageId: PageId): string {
  const hash = window.location.hash;
  const search = window.location.search;
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

  const handleCommitRename = (pageId: PageId) => {
    if (editingPageId === pageId) {
      const trimmed = editingName.trim();
      if (trimmed) {
        onRenamePage(pageId, trimmed);
      }
      setEditingPageId(null);
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
      <div className="flex items-center max-w-[380px] overflow-x-auto no-scrollbar">
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
              onClick={() => {
                handleTabClick(page.id);
              }}
              onDoubleClick={() => {
                handleStartRename(page);
              }}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => {
                    setEditingName(e.target.value);
                  }}
                  onBlur={() => {
                    handleCommitRename(page.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCommitRename(page.id);
                    } else if (e.key === "Escape") {
                      setEditingPageId(null);
                    }
                  }}
                  className="bg-[#0b0c0e] text-neutral-100 px-1 py-0.5 rounded border border-white/[0.15] outline-none w-24 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              ) : (
                <span className="truncate max-w-[110px]">{page.name}</span>
              )}

              {pages.length > 1 && !isEditing && (
                <button
                  type="button"
                  title={t("pages.delete")}
                  aria-label={t("pages.delete")}
                  className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-rose-300 transition cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(page.id);
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
          }
        }}
        className="flex items-center justify-center w-8 h-8 border-l border-white/[0.06] text-neutral-500 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
