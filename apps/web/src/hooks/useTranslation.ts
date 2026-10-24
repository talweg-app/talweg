import { useContext } from "react";
import { I18nContext, type I18nContextValue } from "../i18nContext.js";
export type { Language } from "../i18nContext.js";

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useTranslation must be used within a LanguageProvider");
  return context;
}
