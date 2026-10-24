import { Languages, ChevronDown } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useTranslation();
  return (
    <label className={`language-picker ${compact ? "language-picker-compact" : ""}`}>
      <Languages size={15} aria-hidden="true" />
      <select
        aria-label="Language / Язык"
        value={language}
        onChange={(event) => {
          setLanguage(event.target.value === "ru" ? "ru" : "en");
        }}
      >
        <option value="en">{compact ? "EN" : "English"}</option>
        <option value="ru">{compact ? "RU" : "Русский"}</option>
      </select>
      <ChevronDown size={11} aria-hidden="true" />
    </label>
  );
}
