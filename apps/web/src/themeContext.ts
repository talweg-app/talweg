import { createContext } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type Theme = Exclude<ThemePreference, "system">;
export const ThemeContext = createContext<{
  preference: ThemePreference;
  theme: Theme;
  setPreference: (value: ThemePreference) => void;
} | null>(null);

export const canvasBackground = { light: "#f8f9fa", dark: "#101112" };
