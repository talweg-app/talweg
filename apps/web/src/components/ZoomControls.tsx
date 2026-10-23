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
      className="fixed bottom-5 right-5 z-30 flex items-center bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-lg p-0.5 shadow-2xl select-none"
    >
      <button
        type="button"
        onClick={onZoomOut}
        className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 transition cursor-pointer"
        title={t("actions.zoomOut")}
        aria-label={t("actions.zoomOut")}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={onResetZoom}
        className="px-1.5 h-7 rounded flex items-center justify-center font-mono text-[11px] text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer min-w-[44px]"
        title={t("actions.resetZoom")}
      >
        {percentage}%
      </button>

      <button
        type="button"
        onClick={onZoomIn}
        className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 transition cursor-pointer"
        title={t("actions.zoomIn")}
        aria-label={t("actions.zoomIn")}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      <div className="h-3.5 w-px bg-white/10 mx-0.5" />

      <button
        type="button"
        onClick={onZoomToFit}
        className="w-7 h-7 rounded flex items-center justify-center text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 transition cursor-pointer"
        title={t("actions.zoomToFit")}
        aria-label={t("actions.zoomToFit")}
      >
        <Maximize2 className="w-3 h-3" />
      </button>
    </div>
  );
}
