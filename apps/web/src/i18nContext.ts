import { createContext } from "react";

export type Language = "en" | "ru";

export interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (path: string, fallback?: string) => string;
}

// translation updates must not replace the context used by mounted consumers
export const I18nContext = createContext<I18nContextValue | null>(null);
