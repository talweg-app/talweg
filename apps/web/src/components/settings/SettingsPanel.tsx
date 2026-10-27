import { HistorySettings } from "./HistorySettings.js";
import { useRef, useState } from "react";
import { X, Check, Download, Upload, Minus, Plus } from "lucide-react";
import { usePreferences } from "../../hooks/usePreferences.js";
import { useTranslation } from "../../hooks/useTranslation.js";
import { useTheme } from "../../hooks/useTheme.js";
import {
  normalizePreferences,
  updatePreferences,
} from "../../utils/preferences.js";
import { downloadText } from "../../utils/noteFiles.js";
import { ThemePicker } from "../ThemePicker.js";
import { LanguagePicker } from "../LanguagePicker.js";
import {
  useDialogFocus,
  WorkspaceFolder,
  DisplayName,
  Toggle,
} from "./controls.js";
export default function SettingsPanel({
  onClose,
  onSetup,
}: {
  onClose: () => void;
  onSetup: () => void;
}) {
  const { t, language, setLanguage } = useTranslation();
  const theme = useTheme();
  const prefs = usePreferences();
  const [section, setSection] = useState("general");
  const [error, setError] = useState("");
  const [relay, setRelay] = useState(prefs.relayUrl);
  const [ice, setIce] = useState(JSON.stringify(prefs.iceServers, null, 2));
  const panel = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useDialogFocus(panel, onClose);
  return (
    <div
      className="settings-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        className="app-settings"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
      >
        <header>
          <div>
            <small>Talweg</small>
            <h2>{t("settings.title")}</h2>
          </div>
          <button
            type="button"
            aria-label={t("inspector.close")}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="settings-layout">
          <nav aria-label={t("settings.sections")}>
            {["general", "canvas", "hosting", "storage"].map((id) => (
              <button
                type="button"
                key={id}
                aria-current={section === id ? "page" : undefined}
                onClick={() => {
                  setSection(id);
                  setError("");
                }}
              >
                {t(`settings.${id}`)}
              </button>
            ))}
          </nav>
          <section className="settings-body">
            {section === "general" && (
              <>
                <h3>{t("settings.general")}</h3>
                <p>{t("settings.generalHint")}</p>
                <div className="settings-appearance">
                  <ThemePicker />
                  <LanguagePicker compact={false} />
                </div>
                <div className="settings-interface-scale">
                  <label htmlFor="interface-scale">{t("settings.interfaceScale")}</label>
                  <div className="interface-scale-controls">
                    <button type="button" aria-label={t("settings.smallerInterface")} disabled={prefs.interfaceScale <= 0.8} onClick={() => { updatePreferences({ interfaceScale: prefs.interfaceScale - 0.05 }); }}><Minus size={16} /></button>
                    <input id="interface-scale" type="range" min="80" max="150" step="5" value={Math.round(prefs.interfaceScale * 100)} aria-valuetext={`${String(Math.round(prefs.interfaceScale * 100))}%`} onChange={(event) => { updatePreferences({ interfaceScale: Number(event.target.value) / 100 }); }} />
                    <button type="button" aria-label={t("settings.largerInterface")} disabled={prefs.interfaceScale >= 1.5} onClick={() => { updatePreferences({ interfaceScale: prefs.interfaceScale + 0.05 }); }}><Plus size={16} /></button>
                    <output htmlFor="interface-scale">{Math.round(prefs.interfaceScale * 100)}%</output>
                    <button type="button" className="interface-scale-reset" onClick={() => { updatePreferences({ interfaceScale: 1 }); }}>{t("settings.resetScale")}</button>
                  </div>
                  <small>{t("settings.interfaceScaleHint")}</small>
                </div>
                <DisplayName />
                <Toggle
                  label={t("settings.reopen")}
                  help={t("settings.reopenHint")}
                  checked={prefs.reopenLastBoard}
                  onChange={(value) => {
                    updatePreferences({ reopenLastBoard: value });
                  }}
                />
                <button type="button" onClick={onSetup}>
                  {t("settings.setupAgain")}
                </button>
              </>
            )}
            {section === "canvas" && (
              <>
                <h3>{t("settings.canvas")}</h3>
                <p>{t("settings.canvasHint")}</p>
                <Toggle
                  label={t("settings.grid")}
                  checked={prefs.grid}
                  onChange={(value) => {
                    updatePreferences({ grid: value });
                  }}
                />
                <Toggle
                  label={t("canvasMenu.snap")}
                  help={t("settings.snapHint")}
                  checked={prefs.snapToGrid}
                  onChange={(value) => {
                    updatePreferences({ snapToGrid: value });
                  }}
                />
                <label className="settings-field">
                  <span>{t("settings.wheel")}</span>
                  <select aria-label={t("settings.wheel")}
                    value={prefs.wheel}
                    onChange={(event) => {
                      updatePreferences({
                        wheel: event.target.value as "auto" | "pan" | "zoom",
                      });
                    }}
                  >
                    {["auto", "pan", "zoom"].map((value) => (
                      <option value={value} key={value}>
                        {t(`settings.wheel_${value}`)}
                      </option>
                    ))}
                  </select>
                  <small>{t("settings.pinchHint")}</small>
                </label>
              </>
            )}
            {section === "hosting" && (
              <>
                <h3>{t("settings.hosting")}</h3>
                <p>{t("settings.hostHint")}</p>
                <DisplayName />
                <label className="settings-field">
                  <span>{t("settings.guestLimit")}</span>
                  <select
                    value={prefs.guestLimit}
                    onChange={(event) => {
                      updatePreferences({
                        guestLimit: Number(event.target.value),
                      });
                    }}
                  >
                    {Array.from({ length: 8 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <Toggle
                  label={t("settings.cursors")}
                  checked={prefs.showCursors}
                  onChange={(value) => {
                    updatePreferences({ showCursors: value });
                  }}
                />
                <details className="settings-advanced">
                  <summary>{t("settings.advancedNetwork")}</summary>
                  <p>{t("settings.networkHint")}</p>
                  <label className="settings-field">
                    <span>{t("settings.relay")}</span>
                    <input
                      value={relay}
                      onChange={(event) => {
                        setRelay(event.target.value);
                      }}
                      placeholder="wss://"
                    />
                  </label>
                  <label className="settings-field">
                    <span>ICE / STUN / TURN</span>
                    <textarea aria-label="ICE / STUN / TURN"
                      spellCheck={false}
                      value={ice}
                      onChange={(event) => {
                        setIce(event.target.value);
                      }}
                      rows={6}
                    />
                    <small>{t("settings.credentialsHint")}</small>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        updatePreferences({
                          relayUrl: relay.trim(),
                          iceServers: JSON.parse(ice) as RTCIceServer[],
                        });
                        setError("saved");
                      } catch {
                        setError("networkError");
                      }
                    }}
                  >
                    {t("settings.applyNetwork")}
                  </button>
                </details>
              </>
            )}
            {section === "storage" && (
              <>
                <h3>{t("settings.storage")}</h3>
                <p>{t("settings.storageHint")}</p>
                <WorkspaceFolder />
                <HistorySettings />
                <div className="settings-portable">
                  <h4>{t("settings.portable")}</h4>
                  <p>{t("settings.portableHint")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      downloadText(
                        JSON.stringify(
                          {
                            version: 1,
                            preferences: {
                              ...prefs,
                              iceServers: prefs.iceServers.map((server) => ({
                                urls: server.urls,
                              })),
                            },
                            theme: theme.preference,
                            language,
                          },
                          null,
                          2,
                        ),
                        "talweg-settings.json",
                        "application/json",
                      );
                    }}
                  >
                    <Download size={15} />
                    {t("settings.export")}
                  </button>
                  <button type="button" onClick={() => file.current?.click()}>
                    <Upload size={15} />
                    {t("settings.import")}
                  </button>
                  <input
                    ref={file}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    aria-label={t("settings.import")}
                    onChange={(event) => {
                      const selected = event.target.files?.[0];
                      event.target.value = "";
                      if (!selected) return;
                      void (async () => {
                        try {
                          if (selected.size > 65536) throw new Error();
                          const data = JSON.parse(await selected.text()) as {
                            version?: number;
                            preferences?: unknown;
                            theme?: unknown;
                            language?: unknown;
                          };
                          if (
                            data.version !== 1 ||
                            !data.preferences ||
                            typeof data.preferences !== "object" ||
                            Array.isArray(data.preferences)
                          )
                            throw new Error();
                          const next = normalizePreferences(data.preferences);
                          updatePreferences(next);
                          setRelay(next.relayUrl);
                          setIce(JSON.stringify(next.iceServers, null, 2));
                          if (
                            data.theme === "light" ||
                            data.theme === "dark" ||
                            data.theme === "system"
                          )
                            theme.setPreference(data.theme);
                          if (data.language === "en" || data.language === "ru")
                            setLanguage(data.language);
                          setError("saved");
                        } catch {
                          setError("importError");
                        }
                      })();
                    }}
                  />
                </div>
                <p className="settings-version">
                  {window.talwegDesktopInfo
                    ? `${window.talwegDesktopInfo.platform} · ${window.talwegDesktopInfo.version}`
                    : t("settings.webVersion")}
                </p>
              </>
            )}
            {error && (
              <p
                className={
                  error === "saved" ? "settings-success" : "settings-error"
                }
                role="status"
              >
                {t(`settings.${error}`)}
              </p>
            )}
          </section>
        </div>
        <footer>
          <span>
            <Check size={14} />
            {t("settings.autoSave")}
          </span>
          <button type="button" onClick={onClose}>
            {t("settings.done")}
          </button>
        </footer>
      </div>
    </div>
  );
}
