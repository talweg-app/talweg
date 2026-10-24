import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CheckSquare,
  Circle,
  Copy,
  CornerDownRight,
  CreditCard,
  Database,
  Diamond,
  GitBranch,
  Maximize2,
  Pill,
  Search,
  Square,
  StickyNote,
  Table2,
  FileText,
  ImagePlus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import type { CanvasNode, NodeId, NodeStyle } from "@talweg/core";
import { useTranslation } from "../hooks/useTranslation.js";
import type { CanvasMode, Point2D, ToolType } from "../types.js";
import { NodeStylePanel } from "./NodeStylePanel.js";

export interface ContextMenuState {
  clientPoint: Point2D;
  worldPoint: Point2D;
  nodeId: string | null;
  cellKey?: string | null;
}

interface ContextMenuProps {
  state: ContextMenuState;
  mode: CanvasMode;
  nodes: readonly CanvasNode[];
  onClose: () => void;
  onTableScope: () => void;
  onCreateNode: (tool: ToolType) => void;
  onUpdateStyle: (style: NodeStyle) => void;
  onEditNote: (id: NodeId) => void;
  onRemoveNote: (id: NodeId) => void;
  onUpdateLabel: (id: NodeId, label: string) => void;
  onDuplicate: () => void;
  onArrange: (front: boolean) => void;
  onDeleteSelected?: (() => void) | undefined;
  onAddMindmapChild?: (() => void) | undefined;
  onAddMindmapSibling?: (() => void) | undefined;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  onResetZoom: () => void;
}

const ELEMENTS: readonly {
  tool: ToolType;
  icon: typeof Square;
  group: "content" | "shapes";
}[] = [
  { tool: "image", icon: ImagePlus, group: "content" },
  { tool: "markdown", icon: FileText, group: "content" },
  { tool: "sticker", icon: StickyNote, group: "content" },
  { tool: "text", icon: Type, group: "content" },
  { tool: "card", icon: CreditCard, group: "content" },
  { tool: "checklist", icon: CheckSquare, group: "content" },
  { tool: "table", icon: Table2, group: "content" },
  { tool: "rectangle", icon: Square, group: "shapes" },
  { tool: "ellipse", icon: Circle, group: "shapes" },
  { tool: "diamond", icon: Diamond, group: "shapes" },
  { tool: "capsule", icon: Pill, group: "shapes" },
  { tool: "cylinder", icon: Database, group: "shapes" },
];

export function ContextMenu({
  state,
  mode,
  nodes,
  onClose,
  onTableScope,
  onCreateNode,
  onUpdateStyle,
  onUpdateLabel,
  onEditNote,
  onRemoveNote,
  onDuplicate,
  onArrange,
  onDeleteSelected,
  onAddMindmapChild,
  onAddMindmapSibling,
  onZoomToFit,
}: ContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({
    left: state.clientPoint.x,
    top: state.clientPoint.y,
  });
  const hasSelection = nodes.length > 0;
  const singleArrow = nodes.length === 1 && nodes[0]?.type === "arrow" ? nodes[0] : null;

  useLayoutEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      left: Math.max(
        8,
        Math.min(state.clientPoint.x, window.innerWidth - rect.width - 8),
      ),
      top: Math.max(
        8,
        Math.min(state.clientPoint.y, window.innerHeight - rect.height - 8),
      ),
    });
  }, [state.clientPoint.x, state.clientPoint.y, hasSelection]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !menuRef.current?.contains(e.target))
        onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (e.target instanceof Element && e.target.matches("input, textarea, select")) return;
        const controls = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? [],
        );
        const index = controls.indexOf(
          window.document.activeElement as HTMLButtonElement,
        );
        controls[
          (index + (e.key === "ArrowDown" ? 1 : -1) + controls.length) %
            controls.length
        ]?.focus();
        e.preventDefault();
      }
    };
    const handleWheel = (e: WheelEvent) => {
      if (!(e.target instanceof Node) || !menuRef.current?.contains(e.target))
        onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const action = (
    label: string,
    Icon: typeof Square,
    run: () => void,
    danger = false,
  ) => (
    <button
      type="button"
      className={`context-action ${danger ? "context-danger" : ""}`}
      onClick={() => {
        run();
        onClose();
      }}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      data-testid="canvas-context-menu"
      role="dialog"
      aria-label={t(hasSelection ? "inspector.title" : "insert.title")}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onWheel={(e) => {
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ left: pos.left, top: pos.top }}
      className="canvas-context-menu"
    >
      <div className="context-heading">
        <span>{t(hasSelection ? "inspector.title" : "insert.title")}</span>
        <span className="context-caption">
          {hasSelection
            ? nodes.length > 1
              ? `${String(nodes.length)} ${t("inspector.selected")}`
              : t(`tools.${nodes[0]?.type ?? "rectangle"}`)
            : t("insert.atCursor")}
        </span>
        <button
          type="button"
          aria-label={t("inspector.close")}
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      {hasSelection ? (
        <>
          {state.cellKey && <div className="context-table-scope"><span>{t("inspector.cell")} {state.cellKey.split(":").map((part) => Number(part) + 1).join(", ")}</span><button type="button" onClick={onTableScope}>{t("inspector.wholeTable")}</button></div>}
          {singleArrow && (
            <div className="context-section connector-description">
              <label htmlFor="connector-description">{t("inspector.arrowLabel")}</label>
              <input
                id="connector-description"
                autoFocus
                type="text"
                maxLength={120}
                placeholder={t("inspector.arrowLabelPlaceholder")}
                value={singleArrow.data.label ?? ""}
                onChange={(event) => { onUpdateLabel(singleArrow.id, event.target.value); }}
              />
              <p>{t("inspector.arrowLabelHint")}</p>
            </div>
          )}
        <NodeStylePanel nodes={nodes} onUpdateStyle={onUpdateStyle} />
          <div className="context-section context-actions">
            {nodes.length === 1 && nodes[0] && nodes[0].type !== "arrow" && action(t(typeof nodes[0].note === "string" ? "note.edit" : "note.add"), FileText, () => { const node = nodes[0]; if (node) onEditNote(node.id); })}
            {nodes.length === 1 && nodes[0] && typeof nodes[0].note === "string" && nodes[0].type !== "markdown" && action(t("note.remove"), X, () => { const node = nodes[0]; if (node) onRemoveNote(node.id); })}
            {nodes.some((node) => node.type !== "arrow") &&
              action(t("inspector.duplicate"), Copy, onDuplicate)}
            <div className="context-action-pair">
              {action(t("inspector.bringFront"), ArrowUpToLine, () => {
                onArrange(true);
              })}
              {action(t("inspector.sendBack"), ArrowDownToLine, () => {
                onArrange(false);
              })}
            </div>
            {mode === "mindmap" &&
              onAddMindmapChild &&
              action(t("actions.addChild"), CornerDownRight, onAddMindmapChild)}
            {mode === "mindmap" &&
              onAddMindmapSibling &&
              action(t("actions.addSibling"), GitBranch, onAddMindmapSibling)}
            {onDeleteSelected &&
              action(t("tools.delete"), Trash2, onDeleteSelected, true)}
          </div>
        </>
      ) : (
        <>
          <label className="context-search">
            <Search size={14} />
            <input
              autoFocus
              placeholder={t("insert.search")}
              aria-label={t("insert.search")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
            />
          </label>
          {(["content", "shapes"] as const).map((group) => {
            const entries = ELEMENTS.filter(
              (entry) =>
                entry.group === group &&
                t(`tools.${entry.tool}`)
                  .toLocaleLowerCase()
                  .includes(query.toLocaleLowerCase()),
            );
            return (
              entries.length > 0 && (
                <div key={group} className="context-section">
                  <div className="context-section-label">
                    {t(`insert.${group}`)}
                  </div>
                  <div className="insert-grid">
                    {entries.map(({ tool, icon: Icon }) => (
                      <button
                        type="button"
                        key={tool}
                        onClick={() => {
                          onCreateNode(tool);
                          onClose();
                        }}
                      >
                        <Icon size={19} strokeWidth={1.4} />
                        <span>{t(`tools.${tool}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            );
          })}
          {!ELEMENTS.some((entry) =>
            t(`tools.${entry.tool}`)
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()),
          ) && <div className="context-empty">{t("insert.noResults")}</div>}
          <div className="context-section">
            {action(t("actions.zoomToFit"), Maximize2, onZoomToFit)}
          </div>
          <div className="context-footer">{t("insert.hint")}</div>
        </>
      )}
    </div>
  );
}
