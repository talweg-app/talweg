import type {} from "./types/desktop.js";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "./components/AppErrorBoundary.js";
import { ThemeProvider } from "./ThemeProvider.js";
import { App } from "./App.js";
import "@fontsource-variable/onest";
import "./index.css";

const rootElement = document.getElementById("root");
async function mount() {
  if (window.talwegDesktop) {
    const bootstrap = await window.talwegDesktop.bootstrap();
    window.talwegDesktopInfo = bootstrap.info;
    for (const [key, value] of Object.entries(bootstrap.clientState))
      localStorage.setItem(key, value);
    if (bootstrap.invitation)
      sessionStorage.setItem("talweg_start_invitation", bootstrap.invitation);
  }
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <ThemeProvider>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </ThemeProvider>
      </StrictMode>,
    );
  }
}
void mount().catch(() => {
  if (rootElement)
    rootElement.textContent =
      "Talweg could not start. Please reopen the application.";
});
