import { Monitor, Moon, Sun, ChevronDown } from "lucide-react";
import { useTheme } from "../hooks/useTheme.js";
import { useTranslation } from "../hooks/useTranslation.js";

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const Icon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;
  return <label className={`language-picker theme-picker ${compact ? "language-picker-compact" : ""}`}>
    <Icon size={15} aria-hidden="true" />
    <select aria-label={t("theme.label")} value={preference} onChange={event => {
      const value = event.target.value;
      if (value === "light" || value === "dark" || value === "system") setPreference(value);
    }}>
      <option value="light">{t("theme.light")}</option>
      <option value="dark">{t("theme.dark")}</option>
      <option value="system">{t("theme.system")}</option>
    </select>
    <ChevronDown size={11} aria-hidden="true" />
  </label>;
}
