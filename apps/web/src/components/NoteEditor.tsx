import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Markdown, { defaultUrlTransform } from "react-markdown";
import type { CanvasNode } from "@talweg/core";
import type { StorageAdapter } from "@talweg/storage";
import { Download, FileUp, ImagePlus, X } from "lucide-react";
import { useTranslation } from "../hooks/useTranslation.js";
import { AssetImage } from "./AssetImage.js";
import { downloadText, exportNoteMarkdown } from "../utils/noteFiles.js";

interface NoteEditorProps {
  node: CanvasNode;
  adapter?: StorageAdapter | null | undefined;
  onChange: (markdown: string) => void;
  onClose: () => void;
}

export function NoteEditor({
  node,
  adapter,
  onChange,
  onClose,
}: NoteEditorProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const markdownInput = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const markdown = node.note ?? "";
  const labelData = node.data;
  const title =
    node.type === "markdown" ||
    node.type === "card" ||
    node.type === "checklist"
      ? node.data.title
      : labelData && "label" in labelData
        ? (labelData.label ?? t("note.title"))
        : t("note.title");

  useEffect(() => {
    const previous = document.activeElement;
    textareaRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Tab") {
        const controls = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), textarea, input:not([hidden])",
          ) ?? [],
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => {
      window.removeEventListener("keydown", handleKey, true);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [onClose]);

  const addImages = async (files: FileList | null) => {
    if (!files || !adapter) return;
    const images: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024)
          throw new Error(t("note.imageError"));
        const id = await adapter.saveAsset(file);
        images.push(`![${file.name.replace(/[[\]]/g, "")}](asset:${id})`);
      }
      const editor = textareaRef.current;
      const start = editor?.selectionStart ?? markdown.length;
      const end = editor?.selectionEnd ?? start;
      onChange(
        `${markdown.slice(0, start)}\n${images.join("\n")}\n${markdown.slice(end)}`,
      );
      setTab("edit");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("note.imageError"));
    }
  };

  return createPortal(
    <div
      className="note-backdrop"
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("note.title")}
        className="note-editor"
      >
        <header>
          <div>
            <span className="note-eyebrow">MARKDOWN</span>
            <h2>{title || t("note.untitled")}</h2>
          </div>
          <button
            type="button"
            aria-label={t("inspector.close")}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="note-toolbar">
          <div role="tablist" aria-label={t("note.view")}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "edit"}
              onClick={() => {
                setTab("edit");
              }}
            >
              {t("note.edit")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "preview"}
              onClick={() => {
                setTab("preview");
              }}
            >
              {t("note.preview")}
            </button>
          </div>
          <div>
            <button
              type="button"
              aria-label={t("note.addImage")}
              title={t("note.addImage")}
              onClick={() => {
                imageInput.current?.click();
              }}
            >
              <ImagePlus size={16} />
            </button>
            <button
              type="button"
              aria-label={t("note.import")}
              title={t("note.import")}
              onClick={() => {
                markdownInput.current?.click();
              }}
            >
              <FileUp size={16} />
            </button>
            <button
              type="button"
              aria-label={t("note.export")}
              title={t("note.export")}
              onClick={() => {
                void exportNoteMarkdown(markdown, adapter).then((content) => {
                  downloadText(
                    content,
                    `${title || "note"}.md`,
                    "text/markdown",
                  );
                });
              }}
            >
              <Download size={16} />
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="note-error">
            {error}
          </p>
        )}
        {tab === "edit" ? (
          <textarea
            ref={textareaRef}
            aria-label={t("note.body")}
            placeholder={t("note.placeholder")}
            spellCheck
            value={markdown}
            onChange={(event) => {
              onChange(event.target.value);
            }}
            onPaste={(event) => {
              const images = Array.from(event.clipboardData.files).filter(
                (file) => file.type.startsWith("image/"),
              );
              if (images.length) {
                event.preventDefault();
                const transfer = new DataTransfer();
                images.forEach((file) => transfer.items.add(file));
                void addImages(transfer.files);
              }
            }}
          />
        ) : (
          <div className="markdown-preview" role="tabpanel">
            <Markdown
              skipHtml
              urlTransform={(url) =>
                url.startsWith("asset:") ||
                /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url)
                  ? url
                  : defaultUrlTransform(url)
              }
              components={{
                img: ({ src, alt }) =>
                  typeof src === "string" && src.startsWith("asset:") ? (
                    <AssetImage
                      assetId={src.slice(6)}
                      alt={alt ?? ""}
                      adapter={adapter}
                    />
                  ) : typeof src === "string" &&
                    /^data:image\/(png|jpeg|webp|gif);base64,/i.test(src) ? (
                    <img src={src} alt={alt ?? ""} />
                  ) : (
                    <span className="asset-placeholder">
                      {t("note.localImageOnly")}
                    </span>
                  ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {markdown || t("note.empty")}
            </Markdown>
          </div>
        )}
        <footer>
          <span>{t("note.saved")}</span>
          <span>
            {String(markdown.length)} {t("note.characters")}
          </span>
        </footer>
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label={t("note.addImage")}
          onChange={(event) => {
            void addImages(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={markdownInput}
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          hidden
          aria-label={t("note.import")}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              if (file.size > 10 * 1024 * 1024) setError(t("note.fileError"));
              else void file.text().then(onChange);
            }
            event.currentTarget.value = "";
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
