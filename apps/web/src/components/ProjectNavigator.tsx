import { useEffect, useMemo, useRef, useState } from "react";
import { File, Group, Search, X } from "lucide-react";
import type { CanvasDocument, CanvasPage, NodeId, PageId } from "@talweg/core";
import { useTranslation } from "../hooks/useTranslation.js";
import { searchCanvas } from "../utils/searchCanvas.js";

export function ProjectNavigator({
  document,
  pages,
  activePageId,
  onFocusNode,
  onPage,
}: {
  document: CanvasDocument;
  pages: readonly CanvasPage[];
  activePageId: PageId;
  onFocusNode: (id: NodeId) => void;
  onPage: (id: PageId) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => searchCanvas(document, query),
    [document, query],
  );
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        if (
          event.target instanceof Element &&
          event.target.closest(".note-editor")
        )
          return;
        event.preventDefault();
        setOpen(true);
        input.current?.focus();
        input.current?.select();
      }
    };
    const show = () => {
      setOpen(true);
      input.current?.focus();
    };
    window.addEventListener("talweg:open-search", show);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("talweg:open-search", show);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);
  const groups = Object.values(document.nodes).filter(
    (node) => node.type === "group",
  );
  if (!open) return null;
  return (
    <aside
      className="project-navigator is-open"
      aria-label={t("navigation.title")}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
    >
      <>
        <header>
          <strong>{t("navigation.title")}</strong>
          <button
            type="button"
            aria-label={t("navigation.close")}
            onClick={() => {
              setOpen(false);
            }}
          >
            <X size={16} />
          </button>
        </header>
        <div className="project-search">
          <Search size={14} />
          <input
            ref={input}
            type="search"
            aria-label={t("navigation.search")}
            placeholder={t("navigation.search")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
              }
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                onFocusNode(results[0].node.id);
              }
            }}
          />
        </div>
        <div className="project-navigator-body">
          {query.trim() ? (
            <>
              <p className="project-navigator-caption" role="status">
                {results.length} {t("navigation.results")}
              </p>
              {results.length ? (
                results.slice(0, 100).map((result) => (
                  <button
                    type="button"
                    key={result.node.id}
                    className="project-search-result"
                    onClick={() => {
                      onFocusNode(result.node.id);
                    }}
                  >
                    <span>
                      {pages.find((page) => page.id === result.pageId)?.name ??
                        result.pageId}{" "}
                      · {t(`tools.${result.node.type}`)}
                    </span>
                    <strong>{result.excerpt}</strong>
                  </button>
                ))
              ) : (
                <p className="project-navigator-empty">
                  {t("navigation.noResults")}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="project-navigator-caption">
                {t("navigation.pages")}
              </p>
              {pages.map((page) => (
                <button
                  type="button"
                  key={page.id}
                  className="project-page-link"
                  aria-current={page.id === activePageId ? "page" : undefined}
                  onClick={() => {
                    onPage(page.id);
                  }}
                >
                  <File size={14} />
                  <span>{page.name}</span>
                </button>
              ))}
              <p className="project-navigator-caption">
                {t("navigation.groups")}
              </p>
              {groups.length ? (
                groups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    className="project-page-link"
                    onClick={() => {
                      onFocusNode(group.id);
                    }}
                  >
                    <Group size={14} />
                    <span>
                      {typeof group.meta?.title === "string" && group.meta.title
                        ? group.meta.title
                        : t("organize.group")}
                    </span>
                  </button>
                ))
              ) : (
                <p className="project-navigator-empty">
                  {t("navigation.noGroups")}
                </p>
              )}
            </>
          )}
        </div>
      </>
    </aside>
  );
}
