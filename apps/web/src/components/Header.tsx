import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Languages,
  Network,
  Save,
  Share2,
  StickyNote,
} from "lucide-react";
import type { CameraViewport, CanvasDocument } from "@talweg/core";
import { useTranslation } from "../hooks/useTranslation.js";
import type { CanvasMode } from "../types.js";
import { exportToPng } from "../utils/export.js";

interface HeaderProps {
  document: CanvasDocument | null;
  mode: CanvasMode;
  camera?: CameraViewport;
  onModeChange: (mode: CanvasMode) => void;
  onUpdateTitle?: (title: string) => void;
  onOpenDashboard?: () => void;
  onResetZoom?: () => void;
  onSave?: () => void;
}

export function Header({
  document,
  mode,
  camera,
  onModeChange,
  onUpdateTitle,
  onOpenDashboard,
  onResetZoom,
  onSave,
}: HeaderProps) {
  const { t, language, toggleLanguage } = useTranslation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !modeMenuRef.current?.contains(e.target)) {
        setModeMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModeMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [modeMenuOpen]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 2000);
  };

  const handleSave = () => {
    onSave?.();
    showToast(t("actions.savedLocally") || "Документ сохранен локально");
  };

  const handleShare = async () => {
    const url = new URL(window.location.href);
    let roomId = url.searchParams.get("room");
    if (!roomId) {
      roomId = document?.id ? `room-${document.id}` : `shared-${Math.random().toString(36).slice(2, 8)}`;
      url.searchParams.set("room", roomId);
      window.history.replaceState({}, "", url.toString());
    }
    const shareUrl = url.toString();
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Ignore clipboard write errors in restricted contexts
    }
    showToast(t("actions.linkCopied") || "Ссылка скопирована");
  };

  const handleExport = () => {
    if (!document) return;
    exportToPng(document, `${document.name || "talweg"}.png`);
  };

  const zoomPercent = Math.round((camera?.zoom ?? 1.0) * 100);

  return (
    <header className="h-10 border-b border-white/[0.08] bg-neutral-950/90 backdrop-blur-md px-3 flex items-center justify-between z-30 select-none text-xs">
      {/* Left: Brand, Document Title & Local-First Badge */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="flex items-center gap-1.5 hover:bg-white/[0.06] px-1.5 py-1 -ml-1 rounded transition cursor-pointer group"
          title={t("dashboard.title")}
        >
          <img
            src="/favicon.svg"
            alt="Talweg"
            className="w-4 h-4 rounded shadow-sm opacity-90 group-hover:opacity-100 transition"
          />
          <span className="font-semibold text-xs tracking-tight text-neutral-200 hidden sm:inline font-mono group-hover:text-white transition">
            Talweg
          </span>
        </button>

        <div className="h-3 w-px bg-white/10" />

        <input
          type="text"
          value={document?.name ?? "Talweg Canvas"}
          onChange={(e) => onUpdateTitle?.(e.target.value)}
          placeholder={t("canvas.titlePlaceholder")}
          className="bg-transparent hover:bg-white/[0.04] focus:bg-white/[0.08] text-xs font-mono text-neutral-300 px-1.5 py-0.5 rounded border border-transparent focus:border-white/20 outline-none max-w-[140px] sm:max-w-[200px] truncate transition"
        />

        <div className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Local-First</span>
        </div>
      </div>

      {/* Center: Mode Picker (single dropdown instead of a segmented row) */}
      <div ref={modeMenuRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setModeMenuOpen((open) => !open);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900/90 border border-white/10 shadow-sm text-[11px] font-medium text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          title={t(`tooltips.mode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`)}
          aria-haspopup="menu"
          aria-expanded={modeMenuOpen}
        >
          {mode === "whiteboard" && <StickyNote className="w-3 h-3" />}
          {mode === "diagrams" && <Network className="w-3 h-3" />}
          {mode === "mindmap" && <Share2 className="w-3 h-3" />}
          <span>{t(`modes.${mode}`)}</span>
          <ChevronDown className={`w-3 h-3 text-neutral-500 transition ${modeMenuOpen ? "rotate-180" : ""}`} />
        </button>

        {modeMenuOpen && (
          <div
            role="menu"
            data-testid="mode-picker-menu"
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 min-w-[260px] bg-neutral-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl select-none z-50 overflow-hidden"
          >
            {(["whiteboard", "diagrams", "mindmap"] as const).map((candidate) => {
              const tooltipKey = `tooltips.mode${candidate.charAt(0).toUpperCase()}${candidate.slice(1)}`;
              return (
                <button
                  key={candidate}
                  type="button"
                  role="menuitemradio"
                  aria-checked={mode === candidate}
                  onClick={() => {
                    onModeChange(candidate);
                    setModeMenuOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition cursor-pointer ${
                    mode === candidate
                      ? "bg-neutral-800/80 text-neutral-100"
                      : "text-neutral-300 hover:bg-neutral-800/50 hover:text-white"
                  }`}
                >
                  <span className="mt-0.5">
                    {candidate === "whiteboard" && <StickyNote className="w-3.5 h-3.5 text-amber-400/80" />}
                    {candidate === "diagrams" && <Network className="w-3.5 h-3.5 text-sky-400/80" />}
                    {candidate === "mindmap" && <Share2 className="w-3.5 h-3.5 text-indigo-400/80" />}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium">{t(`modes.${candidate}`)}</span>
                    <span className="text-[10px] text-neutral-500 font-mono leading-snug">
                      {t(tooltipKey)}
                    </span>
                  </span>
                  {mode === candidate && <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Technical Badges, Zoom Monospace & Actions */}
      <div className="flex items-center gap-1.5">
        {mode === "mindmap" && (
          <div className="hidden xl:block text-[10px] text-neutral-400 font-mono bg-neutral-900/80 px-2 py-0.5 rounded border border-white/10">
            {t("tooltips.mindmapTip")}
          </div>
        )}

        {mode === "diagrams" && (
          <div className="hidden xl:block text-[10px] text-sky-400/90 font-mono bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/40">
            16px Grid Snap
          </div>
        )}

        {/* Monospace Zoom Readout / Reset Button */}
        <button
          type="button"
          onClick={onResetZoom}
          className="flex items-center font-mono text-[11px] text-neutral-400 hover:text-neutral-100 px-2 py-0.5 rounded bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 hover:border-white/20 transition cursor-pointer select-none active:scale-95 group relative"
          title={t("actions.resetZoom")}
          aria-label={t("actions.resetZoom")}
        >
          <span>{zoomPercent}%</span>
          <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-neutral-950 text-neutral-300 text-[10px] font-mono border border-white/10 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap shadow-xl z-50">
            {t("actions.resetZoom")}
          </div>
        </button>

        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-neutral-300 hover:bg-neutral-800 border border-white/10 transition cursor-pointer"
          title={t("tooltips.langToggle")}
        >
          <Languages className="w-3 h-3 text-neutral-400" />
          <span className="uppercase">{language}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            void handleShare();
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-white/10 shadow-sm transition cursor-pointer"
          title={t("tooltips.share")}
        >
          <Share2 className="w-3 h-3 text-neutral-300" />
          <span className="hidden sm:inline">{t("actions.share")}</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-white/10 shadow-sm transition cursor-pointer"
          title={t("tooltips.save")}
        >
          <Save className="w-3 h-3 text-neutral-300" />
          <span className="hidden sm:inline">{t("actions.save")}</span>
        </button>

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-white/10 shadow-sm transition cursor-pointer"
          title={t("tooltips.export")}
        >
          <Download className="w-3 h-3" />
          <span className="hidden sm:inline">{t("actions.exportPng")}</span>
        </button>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/95 border border-white/10 shadow-2xl backdrop-blur-md text-xs font-mono text-neutral-200 pointer-events-none transition-all duration-200 animate-in fade-in"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
}

