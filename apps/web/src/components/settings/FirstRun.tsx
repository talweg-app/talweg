import { useRef } from "react";
import { ArrowRight, ShieldCheck, MoveUpRight } from "lucide-react";
import { usePreferences } from "../../hooks/usePreferences.js";
import { useTranslation } from "../../hooks/useTranslation.js";
import { updatePreferences } from "../../utils/preferences.js";
import { ThemePicker } from "../ThemePicker.js";
import { LanguagePicker } from "../LanguagePicker.js";
import { WelcomeSketch } from "./WelcomeSketch.js";
import { useDialogFocus, WorkspaceFolder, DisplayName, Toggle } from "./controls.js";

export default function FirstRun({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const prefs = usePreferences();
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, onComplete);
  return (
    <div className="first-run" ref={panel} role="dialog" aria-modal="true" aria-labelledby="first-run-title">
      <header className="first-run-header">
        <div className="first-run-brand">
          <img src="/favicon.svg" alt="" width={34} height={34} />
          <span>Talweg<small>{t("settings.localWorkspace")}</small></span>
        </div>
        <div className="first-run-appearance">
          <ThemePicker />
          <LanguagePicker compact={false} />
        </div>
      </header>
      <div className="first-run-main">
        <section className="first-run-story">
          <div className="first-run-intro">
            <span className="first-run-eyebrow"><i />{t("settings.firstStep")}</span>
            <h1 id="first-run-title">{t("settings.welcome")}</h1>
            <p>{t("settings.welcomeHint")}</p>
          </div>
          <WelcomeSketch />
          <div className="first-run-capabilities">
            <span>{t("settings.canvasFeature")}</span><i />
            <span>{t("settings.notesFeature")}</span><i />
            <span>{t("settings.sharingFeature")}</span>
          </div>
        </section>
        <div className="first-run-form-area">
          <form className="first-run-options" onSubmit={(event) => { event.preventDefault(); onComplete(); }}>
            <div className="first-run-form-heading">
              <span className="first-run-eyebrow">{t("settings.setupEyebrow")}</span>
              <h2>{t("settings.makeYours")}</h2>
              <p>{t("settings.setupHint")}</p>
            </div>
            <DisplayName initialFocus />
            <WorkspaceFolder />
            <Toggle label={t("settings.reopen")} checked={prefs.reopenLastBoard}
              onChange={(value) => { updatePreferences({ reopenLastBoard: value }); }} />
            <button className="first-run-start" type="submit">
              {t("settings.start")}<span><ArrowRight size={18} strokeWidth={1.5} /></span>
            </button>
            <small className="first-run-change-later">{t("settings.changeLater")}</small>
          </form>
          <div className="first-run-form-note"><MoveUpRight size={13} strokeWidth={1.5} />{t("settings.yourPace")}</div>
        </div>
      </div>
      <footer className="first-run-footer">
        <span><ShieldCheck size={15} strokeWidth={1.5} />{t("settings.privateHint")}</span>
        <span className="first-run-footer-mark">{t("settings.madeForThinking")}</span>
      </footer>
    </div>
  );
}
