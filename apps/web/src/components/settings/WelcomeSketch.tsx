import { memo } from "react";
import { Lightbulb, GitBranch, Check } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation.js";

export const WelcomeSketch = memo(function WelcomeSketch() {
  const { t } = useTranslation();
  return (
    <div className="welcome-sketch" aria-hidden="true">
      <div className="welcome-sketch-grid" />
      <svg className="welcome-sketch-wires" viewBox="0 0 580 290" fill="none">
        <path className="welcome-wire welcome-wire-upper" pathLength="1" d="M204 150H238C272 150 258 63 294 63H324" />
        <path className="welcome-wire welcome-wire-lower" pathLength="1" d="M204 150H238C272 150 258 221 294 221H324" />
        <circle cx="204" cy="150" r="4" />
        <circle cx="324" cy="63" r="4" />
        <circle cx="324" cy="221" r="4" />
      </svg>
      <div className="welcome-thought welcome-thought-origin">
        <span className="welcome-thought-symbol"><Lightbulb size={17} strokeWidth={1.5} /></span>
        <span><small>{t("settings.sketchStart")}</small><strong>{t("settings.sketchIdea")}</strong></span>
      </div>
      <div className="welcome-thought welcome-thought-explore">
        <GitBranch size={17} strokeWidth={1.5} />
        <span>{t("settings.sketchConnect")}</span>
      </div>
      <div className="welcome-thought welcome-thought-plan">
        <span className="welcome-thought-check"><Check size={14} strokeWidth={1.5} /></span>
        <span>{t("settings.sketchPlan")}</span>
      </div>
      <span className="welcome-sketch-caption">{t("settings.sketchCaption")}</span>
    </div>
  );
});
