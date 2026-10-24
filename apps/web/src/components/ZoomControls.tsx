import { Maximize2, Minus, Plus } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomToFit: () => void;
}

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onZoomToFit,
}: ZoomControlsProps) {
  const { t } = useTranslation();
  const percentage = Math.round(zoom * 100);

  return (
    <div
      onPointerDown={(e) => {
        // canvas pointer capture retargets the click away from the button
        e.stopPropagation();
      }}
      className="canvas-zoom-panel absolute bottom-4 right-4 z-30 flex items-center bg-[#131518] border border-white/[0.08] rounded shadow-md select-none"
    >
      <button
        type="button"
        onClick={onZoomOut}
        className="flex items-center justify-center w-8 h-8 rounded-l text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
        title={t("actions.zoomOut")}
        aria-label={t("actions.zoomOut")}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={onResetZoom}
        className="flex items-center justify-center h-8 min-w-[52px] px-1 font-mono text-xs text-neutral-300 hover:text-white hover:bg-white/[0.05] border-x border-white/[0.08] transition cursor-pointer"
        title={t("actions.resetZoom")}
      >
        {percentage}%
      </button>

      <button
        type="button"
        onClick={onZoomIn}
        className="flex items-center justify-center w-8 h-8 text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
        title={t("actions.zoomIn")}
        aria-label={t("actions.zoomIn")}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

      <button
        type="button"
        onClick={onZoomToFit}
        className="flex items-center justify-center w-8 h-8 rounded-r text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
        title={t("actions.zoomToFit")}
        aria-label={t("actions.zoomToFit")}
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
