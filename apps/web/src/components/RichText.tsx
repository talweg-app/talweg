import { usePreferences } from "../hooks/usePreferences.js";
import { navigate } from "../routes/router.js";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { TextRun } from "@talweg/core";
import { ensureTextContrast } from "../utils/colorContrast.js";
import { formatTextRange, normalizeExternalUrl } from "../utils/textRuns.js";
import { useTranslation } from "../hooks/useTranslation.js";

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  Unlink,
} from "lucide-react";
import {
  nodeCaption,
  nodeHref,
  useNodeLinks,
  sessionNodeHref,
} from "./NodeLinks.js";

interface RichTextProps {
  text: string;
  runs?: readonly TextRun[] | undefined;
  label: string;
  placeholder?: string;
  editing?: boolean;
  multiline?: boolean;
  autoFocus?: boolean;
  className?: string;
  style?: CSSProperties;
  backgroundColor?: string;
  onCommit: (text: string, runs: TextRun[]) => void;
  onBlur?: (() => void) | undefined;
  onPasteGrid?: ((text: string) => boolean) | undefined;
}

function readRuns(element: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  const visit = (node: Node, format: Omit<TextRun, "text"> = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push({ text, ...format });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      if (node.parentNode?.childNodes.length !== 1) runs.push({ text: "\n" });
      return;
    }
    const isBlock =
      node !== element && (node.tagName === "DIV" || node.tagName === "P");
    if (isBlock && runs.length && !runs[runs.length - 1]?.text.endsWith("\n"))
      runs.push({ text: "\n" });
    const next = { ...format };
    if (node.dataset.textColor) next.color = node.dataset.textColor;
    for (const key of ["bold", "italic", "underline", "strike"] as const) {
      if (node.dataset[key] !== undefined)
        next[key] = node.dataset[key] === "true";
    }
    if (node.dataset.fontSize) next.fontSize = Number(node.dataset.fontSize);
    if (node instanceof HTMLAnchorElement)
      next.href = node.getAttribute("href") ?? "";
    node.childNodes.forEach((child) => {
      visit(child, next);
    });
    if (
      node !== element &&
      (node.tagName === "DIV" || node.tagName === "P") &&
      node.nextSibling
    )
      runs.push({ text: "\n" });
  };
  visit(element);
  return runs;
}

export function RichText({
  text,
  runs,
  label,
  placeholder = "",
  editing = true,
  multiline = true,
  autoFocus = false,
  className = "",
  style,
  backgroundColor,
  onCommit,
  onBlur,
  onPasteGrid,
}: RichTextProps) {
  const { t } = useTranslation();
  const { interfaceScale } = usePreferences();
  const canvasDocument = useNodeLinks();
  const [externalUrl, setExternalUrl] = useState("");
  const [linkError, setLinkError] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
    x: number;
    y: number;
  } | null>(null);
  const savedRuns = runs ?? [{ text }];
  const content =
    savedRuns.map((run) => run.text).join("") === text ? savedRuns : [{ text }];

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const current = readRuns(editor);
    if (JSON.stringify(current) !== JSON.stringify(content)) {
      editor.replaceChildren(
        ...content
          .filter((run) => run.text)
          .map((run) => {
            const safeHref =
              run.href &&
              (run.href.startsWith("/board/") || /^https?:\/\//.test(run.href))
                ? run.href
                : "";
            const span = document.createElement(safeHref ? "a" : "span");
            if (safeHref) {
              span.setAttribute("href", safeHref);
              if (/^https?:\/\//.test(safeHref)) {
                span.setAttribute("target", "_blank");
                span.setAttribute("rel", "noopener noreferrer");
              }
            }
            span.textContent = run.text;
            if (run.color) {
              span.style.color = run.color;
              span.dataset.textColor = run.color;
            }
            for (const key of [
              "bold",
              "italic",
              "underline",
              "strike",
            ] as const) {
              if (run[key] !== undefined) span.dataset[key] = String(run[key]);
            }
            if (run.bold !== undefined)
              span.style.fontWeight = run.bold ? "700" : "400";
            if (run.italic !== undefined)
              span.style.fontStyle = run.italic ? "italic" : "normal";
            if (run.underline || run.strike)
              span.style.textDecoration = [
                run.underline ? "underline" : "",
                run.strike ? "line-through" : "",
              ]
                .filter(Boolean)
                .join(" ");
            if (run.fontSize) {
              span.style.fontSize = `${String(run.fontSize)}px`;
              span.dataset.fontSize = String(run.fontSize);
            }
            return span;
          }),
      );
      if (editing && selection) {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let offset = 0;
        let started = false;
        let cursor = walker.nextNode();
        while (cursor) {
          const length = cursor.textContent?.length ?? 0;
          if (!started && selection.start <= offset + length) {
            range.setStart(cursor, Math.max(0, selection.start - offset));
            started = true;
          }
          if (started && selection.end <= offset + length) {
            range.setEnd(cursor, Math.max(0, selection.end - offset));
            const selected = window.getSelection();
            selected?.removeAllRanges();
            selected?.addRange(range);
            break;
          }
          offset += length;
          cursor = walker.nextNode();
        }
      }
    }
    for (const span of editor.querySelectorAll<HTMLElement>(
      "[data-text-color]",
    )) {
      const color = span.dataset.textColor;
      if (color)
        span.style.color = backgroundColor
          ? ensureTextContrast(color, backgroundColor)
          : color;
    }
  }, [content, editing, selection, backgroundColor]);

  useLayoutEffect(() => {
    if (autoFocus && editing) editorRef.current?.focus();
  }, [autoFocus, editing]);

  useLayoutEffect(() => {
    if (!editing) return;
    window.dispatchEvent(new Event("talweg:text-edit-boundary"));
    return () => {
      window.dispatchEvent(new Event("talweg:text-edit-boundary"));
    };
  }, [editing]);

  useEffect(() => {
    if (!selection) return;
    const dismiss = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        (!editorRef.current?.contains(event.target) &&
          !event.target.closest(".text-selection-toolbar"))
      ) {
        setSelection(null);
        onBlur?.();
      }
    };
    window.addEventListener("pointerdown", dismiss, true);
    return () => {
      window.removeEventListener("pointerdown", dismiss, true);
    };
  }, [selection, onBlur]);

  const commit = () => {
    if (!editorRef.current) return;
    const nextRuns = readRuns(editorRef.current);
    onCommit(nextRuns.map((run) => run.text).join(""), nextRuns);
  };
  const captureSelection = () => {
    const editor = editorRef.current;
    const selected = window.getSelection();
    if (!editor || !selected || selected.isCollapsed || !selected.rangeCount) {
      setSelection(null);
      return;
    }
    const range = selected.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(editor);
    prefix.setEnd(range.startContainer, range.startOffset);
    const rect = range.getBoundingClientRect();
    setSelection({
      start: prefix.toString().length,
      end: prefix.toString().length + range.toString().length,
      x: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(300 * interfaceScale, window.innerWidth - 16) - 8)),
      y: rect.top > 130 * interfaceScale ? rect.top - 120 * interfaceScale : rect.bottom + 8,
    });
  };
  const applyFormat = (format: Partial<Omit<TextRun, "text">>) => {
    if (!selection || !editorRef.current) return;
    const nextRuns = formatTextRange(
      readRuns(editorRef.current),
      selection.start,
      selection.end,
      format,
    );
    onCommit(nextRuns.map((run) => run.text).join(""), nextRuns);
  };
  const formatActive = (key: "bold" | "italic" | "underline" | "strike") => {
    if (!selection || !editorRef.current) return false;
    let offset = 0;
    return readRuns(editorRef.current)
      .filter((run) => {
        const start = offset;
        offset += run.text.length;
        return start < selection.end && offset > selection.start;
      })
      .every((run) => run[key]);
  };

  return (
    <>
      <div
        ref={editorRef}
        role={editing ? "textbox" : undefined}
        aria-label={editing ? label : undefined}
        aria-multiline={editing ? multiline : undefined}
        contentEditable={editing}
        suppressContentEditableWarning
        data-rich-text
        data-placeholder={placeholder}
        className={`rich-text ${className}`}
        style={style}
        onInput={commit}
        onPointerDown={(event) => {
          if (
            (editing ||
              (event.target instanceof Element && event.target.closest("a"))) &&
            event.button === 0
          )
            event.stopPropagation();
        }}
        onClick={(event) => {
          const anchor =
            event.target instanceof Element ? event.target.closest("a") : null;
          const href = anchor?.getAttribute("href");
          if (
            href?.startsWith("/board/") &&
            (!editing || event.ctrlKey || event.metaKey)
          ) {
            event.preventDefault();
            navigate(sessionNodeHref(href, canvasDocument));
          } else if (editing && !event.ctrlKey && !event.metaKey && anchor)
            event.preventDefault();
        }}
        onPointerUp={captureSelection}
        onKeyUp={captureSelection}
        onBlur={(event) => {
          commit();
          if (
            event.relatedTarget instanceof Element &&
            !event.relatedTarget.closest(".text-selection-toolbar")
          ) {
            setSelection(null);
            onBlur?.();
          } else if (!selection) onBlur?.();
        }}
        onContextMenu={(event) => {
          const selected = window.getSelection();
          if (
            editing &&
            selected &&
            !selected.isCollapsed &&
            editorRef.current?.contains(selected.anchorNode)
          ) {
            event.preventDefault();
            event.stopPropagation();
            captureSelection();
          }
        }}
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            ["b", "i", "u"].includes(event.key.toLowerCase())
          ) {
            event.preventDefault();
            event.stopPropagation();
            const key =
              event.key.toLowerCase() === "b"
                ? "bold"
                : event.key.toLowerCase() === "i"
                  ? "italic"
                  : "underline";
            applyFormat({ [key]: !formatActive(key) });
          }
          if (!multiline && event.key === "Enter") {
            event.preventDefault();
            setSelection(null);
            commit();
            onBlur?.();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            const selected = window.getSelection();
            if (
              selected?.rangeCount &&
              editorRef.current?.contains(selected.anchorNode)
            )
              selected.collapseToEnd();
            setSelection(null);
            onBlur?.();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          if (onPasteGrid?.(event.clipboardData.getData("text/plain"))) return;
          const selected = window.getSelection();
          if (!selected?.rangeCount) return;
          const range = selected.getRangeAt(0);
          range.deleteContents();
          const pasted = document.createTextNode(
            event.clipboardData.getData("text/plain"),
          );
          range.insertNode(pasted);
          range.setStartAfter(pasted);
          range.collapse(true);
          selected.removeAllRanges();
          selected.addRange(range);
          commit();
        }}
      />
      {editing &&
        selection &&
        createPortal(
          <div
            role="toolbar"
            aria-label={t("richText.selectionColor")}
            className="text-selection-toolbar"
            style={{ left: selection.x / interfaceScale, top: selection.y / interfaceScale }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <div className="text-format-actions">
              {(
                [
                  ["bold", Bold],
                  ["italic", Italic],
                  ["underline", Underline],
                  ["strike", Strikethrough],
                ] as const
              ).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  className="text-format-button"
                  aria-label={t(`richText.${key}`)}
                  title={t(`richText.${key}`)}
                  aria-pressed={formatActive(key)}
                  onClick={() => {
                    applyFormat({ [key]: !formatActive(key) });
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
              <select
                className="text-format-size"
                aria-label={t("richText.fontSize")}
                defaultValue=""
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onChange={(event) => {
                  applyFormat({ fontSize: Number(event.target.value) });
                }}
              >
                <option value="" disabled>
                  Aa
                </option>
                {[10, 12, 14, 18, 24, 32, 48].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-format-button"
                aria-label={t("richText.link")}
                title={t("richText.link")}
                onClick={() => {
                  setLinkPickerOpen(!linkPickerOpen);
                }}
              >
                <Link2 size={14} />
              </button>
              <button
                type="button"
                className="text-format-button"
                aria-label={t("richText.unlink")}
                title={t("richText.unlink")}
                onClick={() => {
                  applyFormat({ href: "" });
                }}
              >
                <Unlink size={14} />
              </button>
            </div>
            {linkPickerOpen && (
              <div className="text-link-options">
                <form
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const address = normalizeExternalUrl(externalUrl);
                    if (!address) {
                      setLinkError(true);
                      return;
                    }
                    applyFormat({ href: address });
                    setLinkError(false);
                    setLinkPickerOpen(false);
                  }}
                >
                  <label htmlFor="text-link-url">
                    {t("richText.externalUrl")}
                  </label>
                  <div className="text-link-input-row">
                    <input
                      id="text-link-url"
                      className="text-link-url"
                      type="text"
                      inputMode="url"
                      placeholder="https://example.com"
                      value={externalUrl}
                      onChange={(event) => {
                        setExternalUrl(event.target.value);
                        setLinkError(false);
                      }}
                    />
                    <button type="submit">{t("richText.applyLink")}</button>
                  </div>
                  {linkError && <p role="alert">{t("richText.invalidUrl")}</p>}
                </form>
                {canvasDocument && (
                  <select
                    className="text-node-link-picker"
                    aria-label={t("richText.linkTarget")}
                    defaultValue=""
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onChange={(event) => {
                      const target =
                        canvasDocument.nodes[
                          event.target
                            .value as keyof typeof canvasDocument.nodes
                        ];
                      if (target)
                        applyFormat({ href: nodeHref(canvasDocument, target) });
                      setLinkPickerOpen(false);
                    }}
                  >
                    <option value="" disabled>
                      {t("richText.linkTarget")}
                    </option>
                    {Object.values(canvasDocument.nodes)
                      .filter(
                        (node) =>
                          node.type !== "arrow" && node.type !== "group",
                      )
                      .map((node) => (
                        <option key={node.id} value={node.id}>
                          {canvasDocument.pages?.[node.pageId ?? "page-1"]
                            ?.name ?? "Page 1"}{" "}
                          · {nodeCaption(node).slice(0, 70)}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}
            <span>{t("richText.color")}</span>
            {[
              "#eeeeeb",
              "#202223",
              "#cb8584",
              "#e9dda7",
              "#83b7a3",
              "#8caecc",
            ].map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${t("richText.fragment")} ${color}`}
                title={color}
                style={{ backgroundColor: color }}
                onClick={() => {
                  applyFormat({ color });
                }}
              />
            ))}
            <input
              type="color"
              aria-label={t("richText.customColor")}
              defaultValue="#cb8584"
              onChange={(event) => {
                applyFormat({ color: event.target.value });
              }}
            />
            <button
              type="button"
              aria-label={t("inspector.close")}
              className="text-color-close"
              onClick={() => {
                setSelection(null);
              }}
            >
              ×
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
