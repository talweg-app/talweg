import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Search, X } from "lucide-react";
import type { CanvasDocument } from "@talweg/core";
import { useTranslation } from "../hooks/useTranslation.js";
import { useTheme } from "../hooks/useTheme.js";
import { nodeAppearance, connectorAppearance } from "../utils/sceneAppearance.js";
import { TEMPLATE_CATALOG, TEMPLATE_CATEGORIES, createStarterTemplate, type TemplateCategory } from "../utils/templateCatalog.js";
import { useDialogFocus } from "./settings/controls.js";

function TemplateThumbnail({ document }: { document: CanvasDocument }) {
  const { theme } = useTheme();
  const nodes = Object.values(document.nodes).filter(node => node.type !== "arrow" && (!document.activePageId || node.pageId === document.activePageId));
  if (!nodes.length) return <span className="template-library-blank" aria-hidden="true">+</span>;
  const minX = Math.min(...nodes.map(node => node.x)) - 35, minY = Math.min(...nodes.map(node => node.y)) - 35;
  const width = Math.max(...nodes.map(node => node.x + node.width)) - minX + 35;
  const height = Math.max(...nodes.map(node => node.y + node.height)) - minY + 35;
  return <svg viewBox={`${String(minX)} ${String(minY)} ${String(width)} ${String(height)}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
    {Object.values(document.nodes).filter(node => node.type === "arrow").map(node => {
      const a = node.data.sourceId ? document.nodes[node.data.sourceId] : undefined;
      const b = node.data.targetId ? document.nodes[node.data.targetId] : undefined;
      if (!a || !b || (document.activePageId && a.pageId !== document.activePageId)) return null;
      return <line key={node.id} x1={a.x + a.width / 2} y1={a.y + a.height / 2} x2={b.x + b.width / 2} y2={b.y + b.height / 2} stroke={connectorAppearance(node.style.strokeColor ?? "#818cf8", theme)} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
    })}
    {nodes.map(node => {
      const style = nodeAppearance(node.style, theme);
      if (node.type === "text") return <line key={node.id} x1={node.x} y1={node.y + node.height / 2} x2={node.x + node.width * .55} y2={node.y + node.height / 2} stroke="var(--ink-muted)" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
      return <g key={node.id}>
        {node.type === "diamond" ? <polygon points={`${String(node.x + node.width / 2)},${String(node.y)} ${String(node.x + node.width)},${String(node.y + node.height / 2)} ${String(node.x + node.width / 2)},${String(node.y + node.height)} ${String(node.x)},${String(node.y + node.height / 2)}`} fill={style.fillColor ?? "transparent"} stroke={style.strokeColor} vectorEffect="non-scaling-stroke" /> : <rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.type === "capsule" ? node.height / 2 : 8} fill={style.fillColor ?? "transparent"} stroke={style.strokeColor} vectorEffect="non-scaling-stroke" />}
        {node.type === "checklist" && node.data.items.map((item, index) => <line key={item.id} x1={node.x + 24} y1={node.y + 62 + index * 34} x2={node.x + node.width - 32} y2={node.y + 62 + index * 34} stroke={style.textColor} opacity={.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {node.type === "table" && node.data.cells.slice(1).map((_, index) => <line key={index} x1={node.x + 10} y1={node.y + (index + 1) * node.height / node.data.cells.length} x2={node.x + node.width - 10} y2={node.y + (index + 1) * node.height / node.data.cells.length} stroke={style.strokeColor} opacity={.45} vectorEffect="non-scaling-stroke" />)}
      </g>;
    })}
  </svg>;
}

export default function TemplateLibrary({ onClose, onCreate }: { onClose: () => void; onCreate: (document: CanvasDocument) => void }) {
  const { t, language } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  useDialogFocus(panel, onClose);
  const previews = useMemo(() => new Map(TEMPLATE_CATALOG.map(template => [template.id, createStarterTemplate(template.id, language, `preview-${template.id}`)])), [language]);
  const search = query.trim().toLocaleLowerCase(language);
  const templates = TEMPLATE_CATALOG.filter(template => (category === "all" || template.category === category) && `${template.title[language]} ${template.description[language]} ${t(`templateLibrary.${template.category}`)}`.toLocaleLowerCase(language).includes(search));
  return createPortal(<div className="settings-backdrop template-library-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className="template-library" role="dialog" aria-modal="true" aria-label={t("templateLibrary.title")}>
      <header><div><small>Talweg</small><h2>{t("templateLibrary.title")}</h2><p>{t("templateLibrary.hint")}</p></div><button type="button" onClick={onClose} aria-label={t("inspector.close")}><X size={18} /></button></header>
      <div className="template-library-controls">
        <label className="template-library-search"><Search size={16} /><input ref={searchInput} data-initial-focus type="search" value={query} onChange={event => { setQuery(event.target.value); }} placeholder={t("templateLibrary.search")} aria-label={t("templateLibrary.search")} /></label>
        <div className="template-library-filters" role="group" aria-label={t("templateLibrary.categories")}>
          {(["all", ...TEMPLATE_CATEGORIES] as const).map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => { setCategory(value); }}>{t(`templateLibrary.${value}`)}</button>)}
        </div>
      </div>
      <div className="template-library-results" aria-live="polite">{templates.length} {t("templateLibrary.results")}</div>
      <div className="template-library-grid">
        {templates.map(template => {
          const preview = previews.get(template.id);
          return <button type="button" key={template.id} className="template-library-card" onClick={() => { onCreate(createStarterTemplate(template.id, language)); onClose(); }}>
            <span className="template-library-preview">{preview && <TemplateThumbnail document={preview} />}</span>
            <span className="template-library-card-copy"><small>{t(`templateLibrary.${template.category}`)}</small><strong>{template.title[language]}<ArrowUpRight size={16} /></strong><span>{template.description[language]}</span>{preview?.pages && <em>{Object.keys(preview.pages).length} {t("templateLibrary.pages")}</em>}</span>
          </button>;
        })}
        {!templates.length && <div className="template-library-empty"><p>{t("templateLibrary.empty")}</p><button type="button" onClick={() => { setQuery(""); setCategory("all"); searchInput.current?.focus(); }}>{t("templateLibrary.clear")}</button></div>}
      </div>
      <footer>{t("templateLibrary.localHint")}</footer>
    </div>
  </div>, document.body);
}
