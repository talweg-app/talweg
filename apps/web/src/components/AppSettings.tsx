import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Settings, X } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import {
  normalizePreferences,
  persistClientValue,
} from "../utils/preferences.js";
import { flushProjectWrites } from "../utils/projectStorage.js";
import { parseInvitation, rememberInvitation } from "../utils/invitation.js";
import { navigate } from "../routes/router.js";
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
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState(
    () =>
      !!window.talwegDesktop &&
      !localStorage.getItem("talweg_welcome_complete"),
  );
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    const show = () => {
      setOpen(true);
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
    window.addEventListener("talweg:open-settings", show);
    window.addEventListener("keydown", key);
    window.addEventListener("talweg:settings-save-error", error);
    return () => {
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
    const stopClose = window.talwegDesktop.onBeforeClose(async () => {
      const pending: Promise<unknown>[] = [];
      window.dispatchEvent(
        new CustomEvent("talweg:flush", {
          detail: {
            waitUntil: (value: Promise<unknown>) => pending.push(value),
          },
        }),
      );
      await Promise.all(pending);
      await flushProjectWrites();
    });
    return () => {
      stop();
      stopClose();
    };
  }, []);
  const complete = useCallback(() => {
    persistClientValue("talweg_welcome_complete", "1");
    setSetup(false);
  }, []);
  const closeSettings = useCallback(() => {
    setOpen(false);
  }, []);
  const runSetup = useCallback(() => {
    setOpen(false);
    setSetup(true);
  }, []);
  return (
    <>
      <div inert={setup || open ? true : undefined}>{children}</div>
      <Suspense
        fallback={
          <div role="status" className="settings-backdrop">
            {t("settings.title")}…
          </div>
        }
      >
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
