import { ChoicePicker } from "./ChoicePicker.js";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme.js";
import { useTranslation } from "../hooks/useTranslation.js";

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const Icon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;
  return <ChoicePicker className={`language-picker theme-picker ${compact ? "language-picker-compact" : ""}`} label={t("theme.label")} value={preference} icon={<Icon size={15} aria-hidden="true" />}
    options={[{ value: "light", label: t("theme.light") }, { value: "dark", label: t("theme.dark") }, { value: "system", label: t("theme.system") }]}
    onChange={value => { if (value === "light" || value === "dark" || value === "system") setPreference(value); }} />;
}
