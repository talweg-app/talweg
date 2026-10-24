import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw, ArrowLeft, AlertCircle } from "lucide-react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  override componentDidCatch(error: Error, details: ErrorInfo) {
    console.error("[Talweg] Interface could not render", error, details.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const russian = document.documentElement.lang === "ru";
    return (
      <main className="app-recovery" role="alert">
        <div className="app-recovery-content">
          <AlertCircle size={26} strokeWidth={1.4} />
          <p className="app-recovery-brand">Talweg</p>
          <h1>{russian ? "Не удалось отобразить доску" : "The board could not be displayed"}</h1>
          <p>{russian ? "Попробуйте открыть страницу заново. Перезагрузка не очищает сохранённые доски." : "Try opening the page again. Reloading does not clear your saved boards."}</p>
          <div className="app-recovery-actions">
            <button type="button" onClick={() => { window.location.reload(); }}><RotateCcw size={15} />{russian ? "Открыть заново" : "Reload board"}</button>
            <a href="/"><ArrowLeft size={15} />{russian ? "К списку досок" : "Back to boards"}</a>
          </div>
        </div>
      </main>
    );
  }
}
