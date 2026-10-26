import { persistClientValue } from "./utils/preferences.js";
import { useLayoutEffect, useState, type ReactNode } from "react";
import {
  ThemeContext,
  type ThemePreference,
  type Theme,
} from "./themeContext.js";

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem("talweg_theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* The theme still works when storage is unavailable. */
  }
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readPreference);
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const theme = preference === "system" ? systemTheme : preference;

  useLayoutEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      setSystemTheme(media.matches ? "dark" : "light");
    };
    update();
    media.addEventListener("change", update);
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== "talweg_theme") return;
      setPreference(
        event.newValue === "dark" || event.newValue === "light"
          ? event.newValue
          : "system",
      );
    };
    window.addEventListener("storage", syncPreference);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    persistClientValue("talweg_theme", preference);
  }, [preference, theme]);

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
