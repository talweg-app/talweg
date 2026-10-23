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

const tooltipClass =
  "absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#1b1e23] text-neutral-300 text-[10px] border border-white/[0.08] opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-50";

function ToolbarButton({
  onClick,
  label,
  tooltip,
  active,
  disabled,
  danger,
  children,
}: {
  onClick?: (() => void) | undefined;
  label: string;
  tooltip: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={tooltip}
      className={`group relative flex items-center justify-center w-7 h-7 rounded transition ${
        active
          ? "bg-white/[0.09] text-neutral-50"
          : disabled
            ? "text-neutral-600 cursor-default"
            : danger
              ? "text-neutral-400 hover:text-rose-300 hover:bg-rose-400/10 cursor-pointer"
              : "text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] cursor-pointer"
      }`}
    >
      {children}
      <span className={tooltipClass}>{tooltip}</span>
    </button>
  );
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

  const tools = (() => {
    const baseTools = [
      { id: "select" as ToolType, label: t("tools.select"), tooltip: t("tooltips.select"), icon: MousePointer2 },
      { id: "pan" as ToolType, label: t("tools.pan"), tooltip: t("tooltips.pan"), icon: Hand },
    ];

    if (mode === "diagrams") {
      return [
        ...baseTools,
        { id: "rectangle" as ToolType, label: t("tools.rectangle"), tooltip: t("tooltips.rectangle"), icon: Square },
        { id: "diamond" as ToolType, label: t("tools.diamond"), tooltip: t("tooltips.diamond"), icon: Diamond },
        { id: "capsule" as ToolType, label: t("tools.capsule"), tooltip: t("tooltips.capsule"), icon: Pill },
        { id: "cylinder" as ToolType, label: t("tools.cylinder"), tooltip: t("tooltips.cylinder"), icon: Database },
        { id: "arrow" as ToolType, label: t("tools.arrow"), tooltip: t("tooltips.arrow"), icon: ArrowUpRight },
      ];
    }

    if (mode === "mindmap") {
      return [
        ...baseTools,
        { id: "rectangle" as ToolType, label: t("tools.rectangle"), tooltip: t("tooltips.rectangle"), icon: Square },
        { id: "arrow" as ToolType, label: t("tools.arrow"), tooltip: t("tooltips.arrow"), icon: ArrowUpRight },
      ];
    }

    return [
      ...baseTools,
      { id: "sticker" as ToolType, label: t("tools.sticker"), tooltip: t("tooltips.sticker"), icon: StickyNote },
      { id: "card" as ToolType, label: t("tools.card"), tooltip: t("tooltips.card"), icon: CreditCard },
      { id: "rectangle" as ToolType, label: t("tools.rectangle"), tooltip: t("tooltips.rectangle"), icon: Square },
      { id: "arrow" as ToolType, label: t("tools.arrow"), tooltip: t("tooltips.arrow"), icon: ArrowUpRight },
    ];
  })();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-px bg-[#131518] border border-white/[0.08] rounded shadow-md select-none">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <ToolbarButton
            key={tool.id}
            onClick={() => {
              onSelectTool(tool.id);
            }}
            label={tool.label}
            tooltip={tool.tooltip}
            active={activeTool === tool.id}
          >
            <Icon className="w-4 h-4" />
          </ToolbarButton>
        );
      })}

      {mode === "mindmap" && hasSelection && (
        <>
          <div className="h-4 w-px bg-white/[0.08] mx-0.5" />
          <ToolbarButton onClick={onAddMindmapChild} label={t("actions.addChild")} tooltip={t("actions.addChild")}>
            <CornerDownRight className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={onAddMindmapSibling} label={t("actions.addSibling")} tooltip={t("actions.addSibling")}>
            <GitBranch className="w-4 h-4" />
          </ToolbarButton>
        </>
      )}

      <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

      <ToolbarButton onClick={onUndo} disabled={!canUndo} label={t("actions.undo")} tooltip={t("tooltips.undo")}>
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onRedo} disabled={!canRedo} label={t("actions.redo")} tooltip={t("tooltips.redo")}>
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      {hasSelection && (
        <>
          <div className="h-4 w-px bg-white/[0.08] mx-0.5" />
          <ToolbarButton onClick={onDeleteSelected} danger label={t("tools.delete")} tooltip={t("tooltips.delete")}>
            <Trash2 className="w-4 h-4" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
