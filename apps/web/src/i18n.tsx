import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

import { I18nContext, type Language } from "./i18nContext.js";

type TranslationSchema = typeof en;
const translations: Record<Language, TranslationSchema> = { en, ru };
const STORAGE_KEY = "talweg_lang";

function resolveTranslation(dictionary: unknown, path: string): string | null {
  const parts = path.split(".");
  let current: unknown = dictionary;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : null;
}

export function LanguageProvider({ children }: { readonly children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ru") return saved;
    return "en";
  });

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: Language = prev === "en" ? "ru" : "en";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const localized = resolveTranslation(translations[language], path);
      if (localized !== null) return localized;
      const defaultVal = resolveTranslation(translations.en, path);
      return defaultVal ?? fallback ?? path;
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
