import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { usePreferences } from "../../hooks/usePreferences.js";
import { useTranslation } from "../../hooks/useTranslation.js";
import { updatePreferences } from "../../utils/preferences.js";
import { ThemePicker } from "../ThemePicker.js";
import { LanguagePicker } from "../LanguagePicker.js";
import {
  useDialogFocus,
  WorkspaceFolder,
  DisplayName,
  Toggle,
} from "./controls.js";
export default function FirstRun({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const prefs = usePreferences();
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, onComplete);
  return (
    <div
      className="first-run"
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.welcome")}
    >
      <div className="first-run-story">
        <div className="first-run-brand">
          <img src="/favicon.svg" alt="" width={32} height={32} />
          Talweg<span>{t("settings.localWorkspace")}</span>
        </div>
        <div>
          <small>{t("settings.firstStep")}</small>
          <h1>{t("settings.welcome")}</h1>
          <p>{t("settings.welcomeHint")}</p>
          <div className="first-run-path" aria-hidden="true">
            <i />
            <span />
            <i />
            <span />
            <i />
          </div>
        </div>
        <small>{t("settings.privateHint")}</small>
      </div>
      <div className="first-run-options">
        <div>
          <h2>{t("settings.makeYours")}</h2>
          <p>{t("settings.setupHint")}</p>
        </div>
        <div className="settings-appearance">
          <ThemePicker />
          <LanguagePicker compact={false} />
        </div>
        <DisplayName />
        <WorkspaceFolder />
        <Toggle
          label={t("settings.reopen")}
          checked={prefs.reopenLastBoard}
          onChange={(value) => {
            updatePreferences({ reopenLastBoard: value });
          }}
        />
        <button className="first-run-start" type="button" onClick={onComplete}>
          {t("settings.start")}
          <ArrowRight size={18} />
        </button>
        <small>{t("settings.changeLater")}</small>
      </div>
    </div>
  );
}
