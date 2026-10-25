import { createContext } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type Theme = Exclude<ThemePreference, "system">;
export const ThemeContext = createContext<{
  preference: ThemePreference;
  theme: Theme;
  setPreference: (value: ThemePreference) => void;
} | null>(null);

export const canvasBackground = { light: "#f7f7f4", dark: "#101112" };
