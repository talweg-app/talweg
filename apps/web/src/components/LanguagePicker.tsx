import { Languages } from "lucide-react";
import { ChoicePicker } from "./ChoicePicker.js";
import { useTranslation } from "../hooks/useTranslation.js";

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useTranslation();
  return <ChoicePicker className={`language-picker ${compact ? "language-picker-compact" : ""}`} label="Language / Язык" value={language} icon={<Languages size={15} aria-hidden="true" />}
    options={[{ value: "en", label: compact ? "EN" : "English" }, { value: "ru", label: compact ? "RU" : "Русский" }]}
    onChange={value => { setLanguage(value === "ru" ? "ru" : "en"); }} />;
}
