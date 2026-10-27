import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Download, Plus, RotateCcw, X } from "lucide-react";
import { applyDocumentToYDoc, createSceneDoc, serializeTalwegFile, deserializeTalwegFile, type DeserializedTalwegFile } from "@talweg/storage";
import type { DocumentId, PageId } from "@talweg/core";
import type { ProjectHistoryIndex, ProjectVersion } from "../types/projectHistory.js";
import { validProjectId } from "../types/projectHistory.js";
import { useTranslation } from "../hooks/useTranslation.js";
import { useTheme } from "../hooks/useTheme.js";
import { useDialogFocus } from "./settings/controls.js";
import { flushWorkspace } from "../utils/projectStorage.js";
import { promoteTemplateDraft } from "../utils/boardLibrary.js";
import { downloadText } from "../utils/noteFiles.js";
import { historyRequest } from "../utils/projectHistory.js";
import { copyBoard } from "../utils/copyBoard.js";
import { navigate } from "../routes/router.js";

export default function VersionHistory({ projectId, name, onClose }: { projectId: string; name: string; onClose: () => void }) {
  const { t, language } = useTranslation();
  const { theme } = useTheme();
  const panel = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState<ProjectHistoryIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [checkpoint, setCheckpoint] = useState("");
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useDialogFocus(panel, close);
  const [previewRetry, setPreviewRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<{ scene: DeserializedTalwegFile; version: string } | null>(null);
  const [pageId, setPageId] = useState<PageId | undefined>();
  const [image, setImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const formatter = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }), [language]);
  const path = `/projects/${encodeURIComponent(projectId)}`;
  const refresh = useCallback(async (select?: string) => {
    setLoading(true);
    try {
      const result = await historyRequest(path);
      const next = await result.json() as ProjectHistoryIndex;
      setIndex(next);
      setSelected(previous => select ?? (next.versions.some(version => version.id === previous) ? previous : next.versions[0]?.id ?? ""));
      setError("");
    } catch { setError("unavailable"); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    setSnapshot(null); setImage(null); setPageId(undefined);
    if (!selected) return;
    const controller = new AbortController();
    let scene: DeserializedTalwegFile | undefined;
    void (async () => {
      try {
        const result = await historyRequest(`${path}/${encodeURIComponent(selected)}`, { signal: controller.signal });
        const source = await result.text();
        if (controller.signal.aborted) return;
        scene = deserializeTalwegFile(source);
        setSnapshot({ scene, version: selected });
      } catch { if (!controller.signal.aborted) setError("previewError"); }
    })();
    return () => { controller.abort(); scene?.ydoc.destroy(); };
  }, [path, selected, previewRetry]);
  useEffect(() => {
    if (!snapshot) return;
    const previewController = new AbortController();
    const urls = new Map<string, string>();
    setPreviewLoading(true); setImage(null);
    void (async () => {
      try {
        for (const asset of Object.values(snapshot.scene.assets)) urls.set(asset.id, URL.createObjectURL(new Blob([asset.data], { type: asset.mimeType })));
        const { renderCanvasImage } = await import("../utils/export.js");
        const doc = pageId ? { ...snapshot.scene.doc, activePageId: pageId } : snapshot.scene.doc;
        const canvas = await renderCanvasImage(doc, null, theme, { maxDimension: 1400, assetUrls: urls });
        if (!previewController.signal.aborted) setImage(canvas?.toDataURL("image/png") ?? null);
      } catch { if (!previewController.signal.aborted) setError("previewError"); }
      finally { for (const url of urls.values()) URL.revokeObjectURL(url); if (!previewController.signal.aborted) setPreviewLoading(false); }
    })();
    return () => { previewController.abort(); };
  }, [snapshot, pageId, theme]);
  const saveCheckpoint = async () => {
    setBusy(true); setError("");
    try {
      promoteTemplateDraft(projectId);
      await flushWorkspace();
      const result = await historyRequest(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: checkpoint.trim() }) });
      const version = await result.json() as ProjectVersion;
      setCheckpoint(""); await refresh(version.id);
    } catch { setError("checkpointError"); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (snapshot?.version !== selected) return;
    setBusy(true); setError("");
    try {
      await flushWorkspace();
      const result = await historyRequest(`${path}/${encodeURIComponent(selected)}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `${snapshot.scene.doc.name} ${t("history.restoredSuffix")}`.slice(0, 200) }) });
      const copy = await result.json() as { id: string };
      if (!validProjectId(copy.id)) throw new Error("Invalid project");
      onClose(); navigate(`/board/${encodeURIComponent(copy.id)}`);
    } catch { setError("restoreError"); }
    finally { setBusy(false); }
  };
  const downloadVersion = () => {
    if (!snapshot) return;
    const scene = createSceneDoc();
    try {
      const copy = copyBoard(snapshot.scene.doc, `doc-${crypto.randomUUID()}` as DocumentId);
      copy.name = `${snapshot.scene.doc.name} ${t("history.restoredSuffix")}`;
      applyDocumentToYDoc(copy, scene);
      downloadText(serializeTalwegFile(copy, scene, snapshot.scene.assets), `${snapshot.scene.doc.name}.talweg`, "application/json");
    } catch { setError("downloadError"); }
    finally { scene.destroy(); }
  };
  const pages = Object.values(snapshot?.scene.doc.pages ?? {}).sort((a, b) => a.order - b.order);
  const active = index?.versions.find(version => version.id === selected);
  return <div className="settings-backdrop" onPointerDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={t("history.title")} className="version-history">
      <header><div><span><Clock3 size={15} />{t("history.title")}</span><h2>{name || t("canvas.titlePlaceholder")}</h2></div>
        <button type="button" onClick={close} disabled={busy} aria-label={t("inspector.close")}><X size={18} /></button></header>
      <form className="history-checkpoint" onSubmit={event => { event.preventDefault(); if (!busy) void saveCheckpoint(); }}>
        <input maxLength={100} aria-label={t("history.checkpointName")} placeholder={t("history.checkpointName")} value={checkpoint} onChange={event => { setCheckpoint(event.target.value); }} />
        <button type="submit" disabled={busy || loading || !index}><Plus size={14} />{t(busy ? "history.saving" : "history.checkpoint")}</button>
      </form>
      {error && <div className="history-message" role="alert">{t(`history.${error}`)}<button type="button" onClick={() => { if (error === "previewError") { setPreviewRetry(value => value + 1); setError(""); } else void refresh(); }} disabled={busy}>{t("library.retry")}</button></div>}
      {!!index && (index.warning || index.issues > 0) && <p className="history-message" role="alert">{t(index.warning ? "history.warning" : "history.damaged")}</p>}
      <div className="history-layout">
        <nav aria-label={t("history.versions")}>
          {loading && !index ? <p role="status">{t("dashboard.loading")}</p> : index?.versions.length ? index.versions.map(version => <button type="button" key={version.id} aria-current={selected === version.id ? "true" : undefined} onClick={() => { setSelected(version.id); setError(""); }} disabled={busy}>
            <strong>{version.label || t(version.kind === "checkpoint" ? "history.checkpointLabel" : "history.automatic")}</strong><span>{formatter.format(version.createdAt)}</span><small>{version.name}</small>
          </button>) : <p>{t("history.empty")}</p>}
        </nav>
        <section className="history-preview" aria-label={t("history.preview")} aria-busy={previewLoading}>
          {snapshot && pages.length > 1 && <label className="history-page"><span>{t("navigation.pages")}</span><select aria-label={t("history.previewPage")} value={pageId ?? snapshot.scene.doc.activePageId ?? pages[0]?.id} onChange={event => { setPageId(event.target.value); }}>{pages.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label>}
          <div className="history-preview-image">{image ? <img src={image} alt={t("history.preview")} /> : <span>{t(previewLoading || (!!selected && !snapshot && !error) ? "history.loadingPreview" : snapshot ? "history.emptyPage" : "history.selectVersion")}</span>}</div>
          {active && <div className="history-preview-meta"><span>{t("history.elements")}: {active.nodeCount}</span><span>{t("navigation.pages")}: {active.pageCount}</span><span>{formatter.format(active.createdAt)}</span></div>}
        </section>
      </div>
      <footer><div><p>{t("history.restoreHint")}</p>{index && <small>{t("history.location")}<code>{index.directory}</code></small>}</div><div className="history-footer-actions">
        <button type="button" disabled={busy || snapshot?.version !== selected} onClick={downloadVersion}><Download size={14} />{t("history.download")}</button>
        <button type="button" className="history-restore" disabled={busy || snapshot?.version !== selected} onClick={() => { void restore(); }}><RotateCcw size={14} />{t(busy ? "history.saving" : "history.restore")}</button>
      </div></footer>
    </div>
  </div>;
}
