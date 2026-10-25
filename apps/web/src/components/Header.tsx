import { CollaborationPanel } from "./CollaborationPanel.js";
import type { PeerState } from "../utils/peerSession.js";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Network,
  Save,
  Share2,
  StickyNote,
} from "lucide-react";
import type { StorageAdapter } from "@talweg/storage";
import type { CameraViewport, CanvasDocument } from "@talweg/core";
import { useTranslation } from "../hooks/useTranslation.js";
import type { CanvasMode } from "../types.js";

import { getActiveFileName, type FileSaveState } from "../utils/fileSystem.js";
import { useTheme } from "../hooks/useTheme.js";
import { ThemePicker } from "./ThemePicker.js";
import { LanguagePicker } from "./LanguagePicker.js";

interface HeaderProps {
  collaboration: PeerState;
  onStartHosting: () => Promise<void>;
  onApprovePeer: (id: string, accept: boolean) => void;
  onSaveCopy: () => Promise<string>;
  onFocusPeer: (id: string) => void;
  onStopSharing: () => void;
  adapter?: StorageAdapter | null | undefined;
  document: CanvasDocument | null;
  mode: CanvasMode;
  camera?: CameraViewport;
  onModeChange: (mode: CanvasMode) => void;
  onUpdateTitle?: (title: string) => void;
  onOpenDashboard?: () => void;
  onResetZoom?: () => void;
  onSave?: () => Promise<boolean>;
  fileSaveState?: FileSaveState;
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
  collaboration,
  onStartHosting,
  onStopSharing,
  onApprovePeer,
  onSaveCopy,
  onFocusPeer,
  adapter,
  document,
  mode,
  camera,
  onModeChange,
  onUpdateTitle,
  onOpenDashboard,
  onResetZoom,
  onSave,
  fileSaveState = "browser",
}: HeaderProps) {
  const { t } = useTranslation();
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
      if (
        !(e.target instanceof Node) ||
        !modeMenuRef.current?.contains(e.target)
      ) {
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

  const handleSave = async () => {
    try {
      if (await onSave?.()) showToast(t("actions.savedLocally"));
    } catch {
      showToast(t("actions.saveFailed"));
    }
  };

  const handleExport = async () => {
    if (!document) return;
    try {
      const { exportToPng } = await import("../utils/export.js");
      await exportToPng(
        document,
        `${document.name || "talweg"}.png`,
        adapter,
        theme,
      );
    } catch {
      showToast(t("actions.exportFailed"));
    }
  };

  const { theme } = useTheme();
  const zoomPercent = Math.round((camera?.zoom ?? 1.0) * 100);
  const ActiveModeIcon = MODES.find((m) => m.id === mode)?.icon ?? StickyNote;

  return (
    <header className="canvas-header h-12 shrink-0 border-b border-white/[0.08] bg-[#191b1c] px-3 flex items-center justify-between z-30 select-none">
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="canvas-brand flex items-center gap-1.5 h-8 px-1.5 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("dashboard.title")}
        >
          <img src="/favicon.svg" alt="" className="w-4 h-4" />
          <span className="hidden sm:inline text-sm font-semibold tracking-tight">
            Talweg
          </span>
        </button>

        <div className="h-4 w-px bg-white/[0.08]" />

        <div className="canvas-document-heading">
          <input
            type="text"
            value={document?.name ?? ""}
            onChange={(e) => onUpdateTitle?.(e.target.value)}
            placeholder={t("canvas.titlePlaceholder")}
            className="canvas-document-title bg-transparent hover:bg-white/[0.04] focus:bg-white/[0.05] text-xs text-neutral-300 focus:text-neutral-100 px-1.5 h-8 rounded border border-transparent focus:border-white/[0.12] outline-none max-w-[120px] sm:max-w-[220px] truncate transition"
          />
          <span
            className="canvas-save-state"
            data-state={fileSaveState}
            role="status"
            title={
              fileSaveState === "browser"
                ? t("files.chooseHint")
                : (getActiveFileName() ?? "")
            }
          >
            <span />
            {t(`files.${fileSaveState}`)}
          </span>
        </div>
      </div>

      <div ref={modeMenuRef} className="canvas-mode-picker relative">
        <button
          type="button"
          onClick={() => {
            setModeMenuOpen((open) => !open);
          }}
          className={`flex items-center gap-1.5 h-8 px-2 rounded text-xs transition cursor-pointer ${
            modeMenuOpen
              ? "bg-white/[0.07] text-neutral-100"
              : "text-neutral-300 hover:bg-white/[0.05] hover:text-neutral-100"
          }`}
          aria-label={t(`modes.${mode}`)}
          aria-haspopup="menu"
          aria-expanded={modeMenuOpen}
        >
          <ActiveModeIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>{t(`modes.${mode}`)}</span>
          <ChevronDown
            className={`w-3 h-3 text-neutral-500 transition ${modeMenuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {modeMenuOpen && (
          <div
            role="menu"
            data-testid="mode-picker-menu"
            className="canvas-mode-menu absolute top-full left-1/2 -translate-x-1/2 mt-1 min-w-[260px] bg-[var(--panel)] border border-[var(--panel-border)] rounded shadow-md select-none z-50 py-1"
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
                  className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition cursor-pointer ${
                    isActive ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 mt-0.5 ${isActive ? "text-[var(--accent)]" : "text-neutral-500"}`}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span
                      className={`text-xs ${isActive ? "text-neutral-100" : "text-neutral-300"}`}
                    >
                      {t(`modes.${candidate.id}`)}
                    </span>
                    <span className="text-[10px] text-neutral-500 leading-snug">
                      {t(
                        `tooltips.mode${candidate.id.charAt(0).toUpperCase()}${candidate.id.slice(1)}`,
                      )}
                    </span>
                  </span>
                  {isActive && (
                    <Check className="w-3.5 h-3.5 text-[var(--accent)] ml-auto mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="canvas-header-actions flex items-center gap-px">
        <button
          type="button"
          onClick={onResetZoom}
          className="flex items-center justify-center h-8 min-w-[52px] px-1 rounded font-mono text-xs text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("actions.resetZoom")}
          aria-label={t("actions.resetZoom")}
        >
          {zoomPercent}%
        </button>

        <div className="h-4 w-px bg-white/[0.08] mx-0.5" />

        <ThemePicker compact />
        <LanguagePicker compact />

        <CollaborationPanel
          state={collaboration}
          onStart={onStartHosting}
          onStop={onStopSharing}
          onApprove={onApprovePeer}
          onSaveCopy={onSaveCopy}
          onFocusPeer={onFocusPeer}
        />

        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          className="flex items-center justify-center w-8 h-8 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("tooltips.save")}
        >
          <Save className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            void handleExport();
          }}
          className="flex items-center justify-center w-8 h-8 rounded text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.05] transition cursor-pointer"
          title={t("tooltips.export")}
          aria-label={t("tooltips.export")}
          data-action="export"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t("actions.exportPng")}</span>
        </button>
      </div>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 h-8 rounded bg-[var(--panel)] border border-[var(--panel-border)] shadow-md text-xs text-neutral-300 pointer-events-none"
        >
          <Check className="w-3 h-3 text-neutral-500" />
          <span>{toastMessage}</span>
        </div>
      )}
    </header>
  );
}
