import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePreferences } from "../hooks/usePreferences.js";
import { Settings, X } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import {
  normalizePreferences,
  readPreferences,
  updatePreferences,
  persistClientValue,
} from "../utils/preferences.js";
import { flushWorkspace } from "../utils/projectStorage.js";
import { parseInvitation, rememberInvitation } from "../utils/invitation.js";
import { navigate } from "../routes/router.js";
const VersionHistory = lazy(() => import("./VersionHistory.js"));
const SettingsPanel = lazy(() => import("./settings/SettingsPanel.js"));
const FirstRun = lazy(() => import("./settings/FirstRun.js"));
function openInvitation(text: string) {
  const invite = parseInvitation(text);
  rememberInvitation(invite);
  navigate(`/board/room-${invite.room}?room=${invite.room}`);
}
export function SettingsTrigger() {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="workspace-utility"
      aria-label={t("settings.title")}
      onClick={() => window.dispatchEvent(new Event("talweg:open-settings"))}
    >
      <Settings size={15} />
      <span>{t("settings.title")}</span>
    </button>
  );
}
export function AppSettings({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { interfaceScale } = usePreferences();
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--interface-scale", String(interfaceScale));
    const resize = () => {
      const width = window.innerWidth / interfaceScale;
      root.dataset.interfaceLayout = width <= 560 ? "compact" : width <= 800 ? "medium" : "wide";
    };
    resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); };
  }, [interfaceScale]);
  useEffect(() => {
    const scaleKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const increase = event.code === "Equal" || event.code === "NumpadAdd" || event.key === "+";
      const decrease = event.code === "Minus" || event.code === "NumpadSubtract" || event.key === "-";
      const reset = event.code === "Digit0" || event.code === "Numpad0";
      if (!increase && !decrease && !reset) return;
      event.preventDefault();
      event.stopPropagation();
      updatePreferences({ interfaceScale: reset ? 1 : readPreferences().interfaceScale + (increase ? 0.05 : -0.05) });
    };
    window.addEventListener("keydown", scaleKey, true);
    return () => { window.removeEventListener("keydown", scaleKey, true); };
  }, []);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<{ id: string; name: string } | null>(null);
  const [setup, setSetup] = useState(
    () =>
      !!window.talwegDesktop &&
      !localStorage.getItem("talweg_welcome_complete"),
  );
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    const show = () => {
      setHistory(null);
      setOpen(true);
    };
    const showHistory = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (!value || typeof value !== "object") return;
      const payload = value as { id?: unknown; name?: unknown };
      if (typeof payload.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(payload.id)) return;
      setOpen(false);
      setHistory({ id: payload.id, name: typeof payload.name === "string" ? payload.name : "" });
    };
    const error = () => {
      setSaveError(true);
    };
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "Comma") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("talweg:open-history", showHistory);
    window.addEventListener("talweg:open-settings", show);
    window.addEventListener("keydown", key);
    window.addEventListener("talweg:settings-save-error", error);
    return () => {
      window.removeEventListener("talweg:open-history", showHistory);
      window.removeEventListener("talweg:open-settings", show);
      window.removeEventListener("keydown", key);
      window.removeEventListener("talweg:settings-save-error", error);
    };
  }, []);
  useEffect(() => {
    if (!window.talwegDesktop) return;
    const invite = sessionStorage.getItem("talweg_start_invitation");
    sessionStorage.removeItem("talweg_start_invitation");
    if (invite) {
      try {
        openInvitation(invite);
      } catch {
        setSaveError(true);
      }
    } else if (
      localStorage.getItem("talweg_welcome_complete") &&
      readReopen()
    ) {
      const id = localStorage.getItem("talweg_active_doc");
      if (id && !location.pathname.startsWith("/board/"))
        navigate(`/board/${encodeURIComponent(id)}`);
    }
    const stop = window.talwegDesktop.onInvitation((text) => {
      try {
        openInvitation(text);
      } catch {
        setSaveError(true);
      }
    });
    const stopClose = window.talwegDesktop.onBeforeClose(flushWorkspace);
    return () => {
      stop();
      stopClose();
    };
  }, []);
  const complete = useCallback(() => {
    persistClientValue("talweg_welcome_complete", "1");
    setSetup(false);
  }, []);
  const closeHistory = useCallback(() => { setHistory(null); }, []);
  const closeSettings = useCallback(() => {
    setOpen(false);
  }, []);
  const runSetup = useCallback(() => {
    setOpen(false);
    setSetup(true);
  }, []);
  return (
    <>
      <div inert={setup || open || history ? true : undefined}>{children}</div>
      <Suspense
        fallback={
          <div role="status" className="settings-backdrop">
            {t(history ? "history.title" : "settings.title")}…
          </div>
        }
      >
        {history && <VersionHistory projectId={history.id} name={history.name} onClose={closeHistory} />}
        {open && <SettingsPanel onClose={closeSettings} onSetup={runSetup} />}
        {setup && <FirstRun onComplete={complete} />}
      </Suspense>
      {saveError && (
        <div role="alert" className="settings-save-warning">
          {t("settings.saveError")}
          <button
            type="button"
            onClick={() => {
              setSaveError(false);
            }}
            aria-label={t("inspector.close")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
function readReopen() {
  try {
    return normalizePreferences(
      JSON.parse(localStorage.getItem("talweg_preferences") ?? "{}") as unknown,
    ).reopenLastBoard;
  } catch {
    return false;
  }
}
