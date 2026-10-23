import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CanvasPage, DocumentId, PageId } from "@talweg/core";
import { navigate } from "../routes/router.js";

function buildPagePath(boardId: DocumentId | string | undefined, pageId: PageId): string {
  const hash = window.location.hash;
  const search = window.location.search;
  const bId = boardId ?? "default-doc";
  return `/board/${encodeURIComponent(bId)}/page/${encodeURIComponent(pageId)}${search}${hash}`;
}

interface PageTabsBarProps {
  pages: readonly CanvasPage[];
  activePageId: PageId;
  boardId?: DocumentId | string | undefined;
  onSelectPage: (pageId: PageId) => void;
  onAddPage: (name?: string) => PageId | undefined;
  onRenamePage: (pageId: PageId, newName: string) => void;
  onDeletePage: (pageId: PageId) => void;
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
      className="absolute bottom-3 left-3 z-30 flex items-center gap-1 bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-lg p-1 text-xs shadow-xl select-none font-sans"
    >
      <div className="flex items-center gap-1 max-w-[400px] overflow-x-auto no-scrollbar">
        {pages.map((page) => {
          const isActive = page.id === activePageId;
          const isEditing = editingPageId === page.id;

          return (
            <div
              key={page.id}
              className={`group relative flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                isActive
                  ? "bg-neutral-800 text-neutral-100 shadow-sm font-medium border border-white/10"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent"
              }`}
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
                  className="bg-neutral-950 text-neutral-100 px-1 py-0.5 rounded border border-sky-400 outline-none w-20 text-xs font-sans"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              ) : (
                <span className="truncate max-w-[120px]">{page.name}</span>
              )}

              {pages.length > 1 && !isEditing && (
                <button
                  type="button"
                  title="Удалить страницу"
                  aria-label="Удалить страницу"
                  className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 p-0.5 -mr-1 rounded transition cursor-pointer"
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
        title="Добавить страницу"
        aria-label="Добавить страницу"
        onClick={() => {
          const newId = onAddPage();
          if (newId) {
            navigate(buildPagePath(boardId, newId));
          }
        }}
        className="flex items-center justify-center w-6 h-6 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer border border-transparent hover:border-white/10"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
