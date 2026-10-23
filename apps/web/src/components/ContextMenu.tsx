import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CornerDownRight,
  CreditCard,
  Database,
  Diamond,
  GitBranch,
  Maximize2,
  Pill,
  Square,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import type { CanvasMode, Point2D, ToolType } from "../types.js";

export interface ContextMenuState {
  clientPoint: Point2D;
  worldPoint: Point2D;
}

interface MenuEntry {
  readonly id: string;
  readonly label: string;
  readonly icon: typeof Square;
  readonly onSelect: () => void;
}

interface ContextMenuProps {
  state: ContextMenuState;
  mode: CanvasMode;
  hasSelection: boolean;
  onClose: () => void;
  onCreateNode: (tool: ToolType) => void;
  onDeleteSelected?: (() => void) | undefined;
  onAddMindmapChild?: (() => void) | undefined;
  onAddMindmapSibling?: (() => void) | undefined;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
  onResetZoom: () => void;
}

export function ContextMenu({
  state,
  mode,
  hasSelection,
  onClose,
  onCreateNode,
  onDeleteSelected,
  onAddMindmapChild,
  onAddMindmapSibling,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onResetZoom,
}: ContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: state.clientPoint.x, top: state.clientPoint.y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(state.clientPoint.x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(state.clientPoint.y, window.innerHeight - rect.height - 8)),
    });
  }, [state.clientPoint.x, state.clientPoint.y]);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // window-targeted events carry a non-Node target; contains() would throw
      if (!(e.target instanceof Node) || !menuRef.current?.contains(e.target)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", onClose, { passive: true });
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const addEntries: MenuEntry[] = (() => {
    if (mode === "diagrams") {
      return [
        { id: "rectangle", label: t("tools.rectangle"), icon: Square, onSelect: () => { onCreateNode("rectangle"); } },
        { id: "diamond", label: t("tools.diamond"), icon: Diamond, onSelect: () => { onCreateNode("diamond"); } },
        { id: "capsule", label: t("tools.capsule"), icon: Pill, onSelect: () => { onCreateNode("capsule"); } },
        { id: "cylinder", label: t("tools.cylinder"), icon: Database, onSelect: () => { onCreateNode("cylinder"); } },
      ];
    }
    if (mode === "mindmap") {
      return [
        { id: "rectangle", label: t("contextMenu.topic"), icon: Square, onSelect: () => { onCreateNode("rectangle"); } },
      ];
    }
    return [
      { id: "sticker", label: t("tools.sticker"), icon: StickyNote, onSelect: () => { onCreateNode("sticker"); } },
      { id: "card", label: t("tools.card"), icon: CreditCard, onSelect: () => { onCreateNode("card"); } },
      { id: "rectangle", label: t("tools.rectangle"), icon: Square, onSelect: () => { onCreateNode("rectangle"); } },
    ];
  })();

  const selectionEntries: MenuEntry[] = (() => {
    const entries: MenuEntry[] = [];
    if (hasSelection && mode === "mindmap") {
      if (onAddMindmapChild) {
        entries.push({
          id: "child",
          label: t("actions.addChild"),
          icon: CornerDownRight,
          onSelect: onAddMindmapChild,
        });
      }
      if (onAddMindmapSibling) {
        entries.push({
          id: "sibling",
          label: t("actions.addSibling"),
          icon: GitBranch,
          onSelect: onAddMindmapSibling,
        });
      }
    }
    if (hasSelection && onDeleteSelected) {
      entries.push({
        id: "delete",
        label: t("tools.delete"),
        icon: Trash2,
        onSelect: onDeleteSelected,
      });
    }
    return entries;
  })();

  const viewEntries: MenuEntry[] = [
    { id: "zoomIn", label: t("actions.zoomIn"), icon: ZoomIn, onSelect: onZoomIn },
    { id: "zoomOut", label: t("actions.zoomOut"), icon: ZoomOut, onSelect: onZoomOut },
    { id: "fit", label: t("actions.zoomToFit"), icon: Maximize2, onSelect: onZoomToFit },
    {
      id: "reset",
      label: t("actions.resetZoom"),
      icon: ArrowUpRight,
      onSelect: onResetZoom,
    },
  ];

  const renderSection = (title: string, entries: MenuEntry[]) => (
    <div className="py-1">
      <div className="px-2.5 pt-1 pb-0.5 text-[10px] uppercase tracking-wide text-neutral-600 select-none">
        {title}
      </div>
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => {
            entry.onSelect();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1 rounded-[3px] mx-1 text-[11px] text-neutral-300 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
        >
          <entry.icon className="w-3.5 h-3.5 text-neutral-500" />
          <span>{entry.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div
      ref={menuRef}
      data-testid="canvas-context-menu"
      role="menu"
      onPointerDown={(e) => {
        // canvas pointer capture retargets the click away from the item
        e.stopPropagation();
      }}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 min-w-[172px] bg-[#16181c] border border-white/[0.08] rounded shadow-md select-none text-xs divide-y divide-white/[0.06]"
    >
      {renderSection(t("contextMenu.add"), addEntries)}
      {selectionEntries.length > 0 && renderSection(t("contextMenu.selection"), selectionEntries)}
      {renderSection(t("contextMenu.view"), viewEntries)}
    </div>
  );
}
