import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { usePreferences } from "../../hooks/usePreferences.js";
import { useTranslation } from "../../hooks/useTranslation.js";
import { updatePreferences } from "../../utils/preferences.js";
import type { DesktopInfo } from "../../types/desktop.js";
export function useDialogFocus(
  ref: React.RefObject<HTMLDivElement | null>,
  close: () => void,
) {
  useEffect(() => {
    const previous = document.activeElement;
    const first = ref.current?.querySelector<HTMLElement>("[data-initial-focus]") ?? ref.current?.querySelector<HTMLElement>("button, input, select");
    first?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, textarea, a[href]",
        ) ?? []),
      ];
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const panel = ref.current;
    panel?.addEventListener("keydown", key);
    return () => {
      panel?.removeEventListener("keydown", key);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [ref, close]);
}
export function WorkspaceFolder() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<DesktopInfo | undefined>(
    window.talwegDesktopInfo,
  );
  const [path, setPath] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    if (info) return;
    const controller = new AbortController();
    void fetch("/api/projects", { signal: controller.signal })
      .then(async (response) => {
        if (
          response.ok &&
          response.headers.get("content-type")?.includes("application/json")
        ) {
          const data = (await response.json()) as { directory?: string };
          setPath(data.directory ?? "");
        }
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, [info]);
  return (
    <div className="settings-folder">
      <FolderOpen size={20} />
      <div>
        <strong>{t("settings.folder")}</strong>
        <code>
          {info?.nextProjectsDirectory ?? (path || t("settings.browserFolder"))}
        </code>
        <small>
          {info
            ? t(
                info.nextProjectsDirectory !== info.projectsDirectory
                  ? "settings.restartFolder"
                  : "settings.folderHint",
              )
            : t("settings.browserFolderHint")}
        </small>
      </div>
      {window.talwegDesktop && (
        <div className="settings-folder-actions">
          <button
            type="button"
            onClick={() => {
              void window.talwegDesktop
                ?.chooseProjectsDirectory()
                .then((next) => {
                  if (next) {
                    window.talwegDesktopInfo = next;
                    setInfo(next);
                  }
                })
                .catch(() => {
                  setError(true);
                });
            }}
          >
            {t("settings.chooseFolder")}
          </button>
          <button
            type="button"
            onClick={() => {
              void window.talwegDesktop?.openProjectsDirectory().catch(() => {
                setError(true);
              });
            }}
          >
            {t("settings.openFolder")}
          </button>
        </div>
      )}
      {error && <p role="alert">{t("settings.folderError")}</p>}
    </div>
  );
}
export function DisplayName({ initialFocus = false }: { initialFocus?: boolean }) {
  const { t } = useTranslation();
  const prefs = usePreferences();
  return (
    <label className="settings-field">
      <span>{t("settings.displayName")}</span>
      <input
        data-initial-focus={initialFocus || undefined}
        maxLength={40}
        value={prefs.displayName}
        placeholder={t("collaboration.guestName")}
        onChange={(event) => {
          updatePreferences({ displayName: event.target.value });
        }}
      />
    </label>
  );
}
export function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-toggle">
      <span>
        <strong>{label}</strong>
        {help && <small>{help}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </label>
  );
}
