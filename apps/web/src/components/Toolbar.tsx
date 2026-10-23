import {
  ArrowUpRight,
  CornerDownRight,
  Database,
  Diamond,
  GitBranch,
  Hand,
  MousePointer2,
  Pill,
  Redo2,
  Square,
  StickyNote,
  CreditCard,
  Trash2,
  Undo2,
} from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import type { CanvasMode, ToolType } from "../types.js";

interface ToolbarProps {
  activeTool: ToolType;
  mode: CanvasMode;
  onSelectTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  onAddMindmapChild?: () => void;
  onAddMindmapSibling?: () => void;
}

export function Toolbar({
  activeTool,
  mode,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  onDeleteSelected,
  onAddMindmapChild,
  onAddMindmapSibling,
}: ToolbarProps) {
  const { t } = useTranslation();

  // Mode-specialized primary tools
  const tools = (() => {
    const baseTools = [
      {
        id: "select" as ToolType,
        label: t("tools.select"),
        tooltip: t("tooltips.select"),
        icon: MousePointer2,
      },
      {
        id: "pan" as ToolType,
        label: t("tools.pan"),
        tooltip: t("tooltips.pan"),
        icon: Hand,
      },
    ];

    if (mode === "diagrams") {
      return [
        ...baseTools,
        {
          id: "rectangle" as ToolType,
          label: t("tools.rectangle"),
          tooltip: t("tooltips.rectangle"),
          icon: Square,
        },
        {
          id: "diamond" as ToolType,
          label: t("tools.diamond"),
          tooltip: t("tooltips.diamond"),
          icon: Diamond,
        },
        {
          id: "capsule" as ToolType,
          label: t("tools.capsule"),
          tooltip: t("tooltips.capsule"),
          icon: Pill,
        },
        {
          id: "cylinder" as ToolType,
          label: t("tools.cylinder"),
          tooltip: t("tooltips.cylinder"),
          icon: Database,
        },
        {
          id: "arrow" as ToolType,
          label: t("tools.arrow"),
          tooltip: t("tooltips.arrow"),
          icon: ArrowUpRight,
        },
      ];
    }

    if (mode === "mindmap") {
      return [
        ...baseTools,
        {
          id: "rectangle" as ToolType,
          label: t("tools.rectangle"),
          tooltip: t("tooltips.rectangle"),
          icon: Square,
        },
        {
          id: "arrow" as ToolType,
          label: t("tools.arrow"),
          tooltip: t("tooltips.arrow"),
          icon: ArrowUpRight,
        },
      ];
    }

    // Default Whiteboard Mode
    return [
      ...baseTools,
      {
        id: "sticker" as ToolType,
        label: t("tools.sticker"),
        tooltip: t("tooltips.sticker"),
        icon: StickyNote,
      },
      {
        id: "card" as ToolType,
        label: t("tools.card"),
        tooltip: t("tooltips.card"),
        icon: CreditCard,
      },
      {
        id: "rectangle" as ToolType,
        label: t("tools.rectangle"),
        tooltip: t("tooltips.rectangle"),
        icon: Square,
      },
      {
        id: "arrow" as ToolType,
        label: t("tools.arrow"),
        tooltip: t("tooltips.arrow"),
        icon: ArrowUpRight,
      },
    ];
  })();

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-neutral-900/90 backdrop-blur-md border border-white/10 p-1 rounded-lg shadow-2xl select-none text-xs">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;

        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => {
              onSelectTool(tool.id);
            }}
            className={`flex items-center justify-center w-8 h-8 rounded transition cursor-pointer relative group ${
              isActive
                ? "bg-neutral-800 text-neutral-100 border border-white/15 shadow-sm"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
            }`}
            title={tool.tooltip}
            aria-label={tool.label}
          >
            <Icon className="w-4 h-4" />
            <div className="absolute -top-8 px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-300 text-[10px] font-mono border border-white/10 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xl">
              {tool.tooltip}
            </div>
          </button>
        );
      })}

      {/* Mindmap specific quick action buttons */}
      {mode === "mindmap" && hasSelection && (
        <>
          <div className="h-4 w-px bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={onAddMindmapChild}
            className="flex items-center justify-center w-8 h-8 rounded text-indigo-400 hover:bg-indigo-950/50 hover:text-indigo-200 transition cursor-pointer relative group"
            title={t("actions.addChild")}
          >
            <CornerDownRight className="w-4 h-4" />
            <div className="absolute -top-8 px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-300 text-[10px] font-mono border border-white/10 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xl">
              {t("actions.addChild")}
            </div>
          </button>
          <button
            type="button"
            onClick={onAddMindmapSibling}
            className="flex items-center justify-center w-8 h-8 rounded text-indigo-400 hover:bg-indigo-950/50 hover:text-indigo-200 transition cursor-pointer relative group"
            title={t("actions.addSibling")}
          >
            <GitBranch className="w-4 h-4" />
            <div className="absolute -top-8 px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-300 text-[10px] font-mono border border-white/10 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xl">
              {t("actions.addSibling")}
            </div>
          </button>
        </>
      )}

      <div className="h-4 w-px bg-white/10 mx-0.5" />

      {/* Undo & Redo */}
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className={`flex items-center justify-center w-8 h-8 rounded transition relative group ${
          canUndo
            ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 cursor-pointer"
            : "text-neutral-600 cursor-not-allowed"
        }`}
        title={t("tooltips.undo")}
        aria-label={t("actions.undo")}
      >
        <Undo2 className="w-4 h-4" />
        <div className="absolute -top-8 px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-300 text-[10px] font-mono border border-white/10 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xl">
          {t("tooltips.undo")}
        </div>
      </button>

      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className={`flex items-center justify-center w-8 h-8 rounded transition relative group ${
          canRedo
            ? "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 cursor-pointer"
            : "text-neutral-600 cursor-not-allowed"
        }`}
        title={t("tooltips.redo")}
        aria-label={t("actions.redo")}
      >
        <Redo2 className="w-4 h-4" />
        <div className="absolute -top-8 px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-300 text-[10px] font-mono border border-white/10 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xl">
          {t("tooltips.redo")}
        </div>
      </button>

      {/* Delete button (when selection exists) */}
      {hasSelection && (
        <>
          <div className="h-4 w-px bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={onDeleteSelected}
            className="flex items-center justify-center w-8 h-8 rounded text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition cursor-pointer relative group"
            title={t("tooltips.delete")}
            aria-label={t("tools.delete")}
          >
            <Trash2 className="w-4 h-4" />
            <div className="absolute -top-8 px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-300 text-[10px] font-mono border border-white/10 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xl">
              {t("tooltips.delete")}
            </div>
          </button>
        </>
      )}
    </div>
  );
}
