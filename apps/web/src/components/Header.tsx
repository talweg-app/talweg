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

const MODES: readonly {
  id: CanvasMode;
  icon: typeof StickyNote;
}[] = [
  { id: "whiteboard", icon: StickyNote },
  { id: "diagrams", icon: Network },
  { id: "mindmap", icon: Share2 },
];

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
  const { t, toggleLanguage } = useTranslation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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
    showToast(t("actions.savedLocally"));
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
    showToast(t("actions.linkCopied"));
  };

  const handleExport = () => {
    if (!document) return;
    exportToPng(document, `${document.name || "talweg"}.png`);
  };

  const zoomPercent = Math.round((camera?.zoom ?? 1.0) * 100);
  const ActiveModeIcon = MODES.find((m) => m.id === mode)?.icon ?? StickyNote;

  return (
    <header className="h-9 border-b border-white/[0.08] bg-[#0e0f11] px-2 flex items-center justify-between z-30 select-none">
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="flex items-center gap-1.5 h-7 px-1.5 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("dashboard.title")}
        >
          <img src="/favicon.svg" alt="" className="w-4 h-4" />
          <span className="hidden sm:inline text-[11px] font-medium tracking-tight">Talweg</span>
        </button>

        <div className="h-4 w-px bg-white/[0.08]" />

        <input
          type="text"
          value={document?.name ?? ""}
          onChange={(e) => onUpdateTitle?.(e.target.value)}
          placeholder={t("canvas.titlePlaceholder")}
          className="bg-transparent hover:bg-white/[0.04] focus:bg-white/[0.05] text-[11px] text-neutral-300 focus:text-neutral-100 px-1.5 h-7 rounded border border-transparent focus:border-white/[0.12] outline-none max-w-[120px] sm:max-w-[220px] truncate transition"
        />
      </div>

      <div ref={modeMenuRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setModeMenuOpen((open) => !open);
          }}
          className={`flex items-center gap-1.5 h-7 px-2 rounded text-[11px] transition cursor-pointer ${
            modeMenuOpen
              ? "bg-white/[0.07] text-neutral-100"
              : "text-neutral-300 hover:bg-white/[0.05] hover:text-neutral-100"
          }`}
          aria-haspopup="menu"
          aria-expanded={modeMenuOpen}
        >
          <ActiveModeIcon className="w-3.5 h-3.5 text-amber-400/90" />
          <span>{t(`modes.${mode}`)}</span>
          <ChevronDown className={`w-3 h-3 text-neutral-500 transition ${modeMenuOpen ? "rotate-180" : ""}`} />
        </button>

        {modeMenuOpen && (
          <div
            role="menu"
            data-testid="mode-picker-menu"
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1 min-w-[240px] bg-[#16181c] border border-white/[0.08] rounded shadow-md select-none z-50 py-1"
          >
            {MODES.map((candidate) => {
              const Icon = candidate.icon;
              const isActive = mode === candidate.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onModeChange(candidate.id);
                    setModeMenuOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 px-2.5 py-1.5 text-left transition cursor-pointer ${
                    isActive ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mt-0.5 ${isActive ? "text-amber-400/90" : "text-neutral-500"}`} />
                  <span className="flex flex-col gap-0.5">
                    <span className={`text-[11px] ${isActive ? "text-neutral-100" : "text-neutral-300"}`}>
                      {t(`modes.${candidate.id}`)}
                    </span>
                    <span className="text-[10px] text-neutral-500 leading-snug">
                      {t(`tooltips.mode${candidate.id.charAt(0).toUpperCase()}${candidate.id.slice(1)}`)}
                    </span>
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-amber-400/90 ml-auto mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-px">
        <button
          type="button"
          onClick={onResetZoom}
          className="flex items-center justify-center h-7 min-w-[46px] px-1 rounded font-mono text-[11px] text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("actions.resetZoom")}
          aria-label={t("actions.resetZoom")}
        >
          {zoomPercent}%
        </button>

        <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center justify-center w-7 h-7 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("tooltips.langToggle")}
        >
          <Languages className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            void handleShare();
          }}
          className="flex items-center justify-center w-7 h-7 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("tooltips.share")}
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center justify-center w-7 h-7 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("tooltips.save")}
        >
          <Save className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center justify-center w-7 h-7 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("tooltips.export")}
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-2.5 h-7 rounded bg-[#16181c] border border-white/[0.08] shadow-md text-[11px] text-neutral-300 pointer-events-none"
        >
          <Check className="w-3 h-3 text-neutral-500" />
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
}
