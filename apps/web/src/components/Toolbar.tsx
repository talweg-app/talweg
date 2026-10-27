import { useEffect, useRef } from "react";
import { usePreferences } from "../hooks/usePreferences.js";
import {
  ArrowUpRight,
  CornerDownRight,
  Database,
  Diamond,
  GitBranch,
  Hand,
  Plus,
  PenLine,
  Type,
  MousePointer2,
  Pill,
  Redo2,
  Square,
  Trash2,
  Undo2,
} from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import type { CanvasMode, ToolType } from "../types.js";

interface ToolbarProps {
  activeTool: ToolType;
  mode: CanvasMode;
  onSelectTool: (tool: ToolType) => void;
  onOpenInsert: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasSelection: boolean;
  canBranch: boolean;
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
      className={`canvas-tool-button group relative flex items-center justify-center w-9 h-9 rounded-md transition ${
        active
          ? "bg-[#e9dda7] text-[#202223]"
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
  onOpenInsert,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  canBranch,
  onDeleteSelected,
  onAddMindmapChild,
  onAddMindmapSibling,
}: ToolbarProps) {
  const { t } = useTranslation();
  const { interfaceScale } = usePreferences();
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toolbar = dock.current;
    const pages = document.querySelector<HTMLElement>(".canvas-pages-panel");
    const zoom = document.querySelector<HTMLElement>(".canvas-zoom-panel");
    if (!toolbar || !pages || !zoom) return;
    const measure = () => {
      const tools = toolbar.getBoundingClientRect();
      const tabs = pages.getBoundingClientRect();
      const controls = zoom.getBoundingClientRect();
      const crowded = tabs.right + 12 > tools.left || tools.right + 12 > controls.left;
      document.documentElement.dataset.canvasDock = crowded ? "stacked" : "inline";
      document.documentElement.dataset.canvasCorners = tabs.right + 12 > controls.left ? "stacked" : "inline";
      document.documentElement.style.setProperty("--dock-zoom-height", `${String(controls.height / interfaceScale)}px`);
      document.documentElement.style.setProperty("--dock-toolbar-height", `${String(tools.height / interfaceScale)}px`);
    };
    const observer = new ResizeObserver(measure);
    for (const element of [toolbar, pages, zoom]) observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      delete document.documentElement.dataset.canvasDock;
      delete document.documentElement.dataset.canvasCorners;
    };
  }, [interfaceScale, mode, canBranch, hasSelection]);

  const shapeId =
    activeTool === "diamond" ||
    activeTool === "capsule" ||
    activeTool === "cylinder"
      ? activeTool
      : "rectangle";
  const shapeIcons = {
    rectangle: Square,
    diamond: Diamond,
    capsule: Pill,
    cylinder: Database,
  };
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
      {
        id: "pen" as ToolType,
        label: t("tools.pen"),
        tooltip: t("tooltips.pen"),
        icon: PenLine,
      },
    ];

    return [
      ...baseTools,
      {
        id: shapeId as ToolType,
        label: t(`tools.${shapeId}`),
        tooltip: t(`tooltips.${shapeId}`),
        icon: shapeIcons[shapeId],
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
    <div ref={dock} className="canvas-toolbar fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 p-1 bg-[#202223] border border-[#3b3e3e] rounded-xl shadow-lg select-none">
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

      {mode === "mindmap" && canBranch && (
        <>
          <div className="h-4 w-px bg-white/[0.08] mx-0.5" />
          <ToolbarButton
            onClick={onAddMindmapChild}
            label={t("actions.addChild")}
            tooltip={t("actions.addChild")}
          >
            <CornerDownRight className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={onAddMindmapSibling}
            label={t("actions.addSibling")}
            tooltip={t("actions.addSibling")}
          >
            <GitBranch className="w-4 h-4" />
          </ToolbarButton>
        </>
      )}

      <ToolbarButton
        onClick={onOpenInsert}
        label={t("insert.title")}
        tooltip={t("insert.title")}
      >
        <Plus className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          onSelectTool("text");
        }}
        label={t("tools.text")}
        tooltip={t("tooltips.text")}
        active={activeTool === "text"}
      >
        <Type className="w-4 h-4" />
      </ToolbarButton>
      <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

      <ToolbarButton
        onClick={onUndo}
        disabled={!canUndo}
        label={t("actions.undo")}
        tooltip={t("tooltips.undo")}
      >
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={onRedo}
        disabled={!canRedo}
        label={t("actions.redo")}
        tooltip={t("tooltips.redo")}
      >
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      {hasSelection && (
        <>
          <div className="h-4 w-px bg-white/[0.08] mx-0.5" />
          <ToolbarButton
            onClick={onDeleteSelected}
            danger
            label={t("tools.delete")}
            tooltip={t("tooltips.delete")}
          >
            <Trash2 className="w-4 h-4" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
