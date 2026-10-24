import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "./components/AppErrorBoundary.js";
import { ThemeProvider } from "./ThemeProvider.js";
import { App } from "./App.js";
import "@fontsource-variable/onest";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider><AppErrorBoundary><App /></AppErrorBoundary></ThemeProvider>
    </StrictMode>,
  );
}
