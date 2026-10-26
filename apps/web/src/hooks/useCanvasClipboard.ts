import { useEffect, useRef } from "react";
import type { CanvasDocument, NodeId, PageId, Point2D } from "@talweg/core";
import type { IndexedDBStorageAdapter } from "@talweg/storage";
import {
  copyFragment,
  FRAGMENT_PREFIX,
  parseFragment,
  pasteFragment,
  storeFragmentAssets,
} from "../utils/canvasClipboard.js";
import { deleteSelection } from "../utils/organizeCanvas.js";

interface ClipboardCanvas {
  document: CanvasDocument | null;
  selected: ReadonlySet<NodeId>;
  page: PageId;
  adapter: IndexedDBStorageAdapter | null;
  point: () => Point2D;
  edit: (edit: (document: CanvasDocument) => CanvasDocument) => void;
  select: (ids: ReadonlySet<NodeId>) => void;
  error: (message: string) => void;
}
function textInput(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}
export function useCanvasClipboard(canvas: ClipboardCanvas): void {
  const current = useRef(canvas);
  current.current = canvas;
  const pasteCount = useRef(0);
  useEffect(() => {
    let middleGesture = false;
    const pointerIntent = (event: MouseEvent) => {
      middleGesture =
        event.button === 1 &&
        event.target instanceof Element &&
        !!event.target.closest('[data-testid="canvas"]');
    };
    const keyboardIntent = () => {
      middleGesture = false;
    };
    const transfer = (event: Event, cut: boolean) => {
      const source = current.current;
      if (
        textInput() ||
        !source.document ||
        !source.adapter ||
        !source.selected.size
      )
        return;
      event.preventDefault();
      const selected = new Set(source.selected);
      const documentId = source.document.id;
      void copyFragment(source.document, selected, source.adapter)
        .then(async (text) => {
          await navigator.clipboard.writeText(text);
          if (cut && current.current.document?.id === documentId)
            source.edit((document) => deleteSelection(document, selected));
        })
        .catch(() => {
          source.error("copyFailed");
        });
    };
    const copy = (event: ClipboardEvent) => {
      transfer(event, false);
    };
    const cut = (event: ClipboardEvent) => {
      transfer(event, true);
    };
    const insert = (text: string) => {
      const target = current.current;
      if (!target.document || !target.adapter) return;
      const id = target.document.id;
      const page = target.page;
      const adapter = target.adapter;
      const at = target.point();
      const offset = (pasteCount.current++ % 8) * 16;
      if (!text.startsWith(FRAGMENT_PREFIX)) {
        if (!text.trim() || text.length > 1000000) return;
        const nodeId = `text-${crypto.randomUUID()}` as NodeId;
        const node = {
          id: nodeId,
          type: "text" as const,
          pageId: page,
          x: at.x,
          y: at.y,
          width: 280,
          height: Math.max(60, Math.min(500, text.split("\n").length * 24)),
          rotation: 0,
          zIndex: 10,
          opacity: 1,
          parentId: null,
          isLocked: false,
          isVisible: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          style: { fontSize: 16 },
          data: { text },
        };
        target.edit((document) => ({
          ...document,
          nodes: { ...document.nodes, [nodeId]: node },
          rootNodeIds: [...document.rootNodeIds, nodeId],
        }));
        target.select(new Set([nodeId]));
        return;
      }
      void (async () => {
        const fragment = parseFragment(text);
        await storeFragmentAssets(fragment, adapter);
        if (
          current.current.document?.id !== id ||
          current.current.page !== page
        )
          throw new Error("Destination changed");
        target.edit((document) => {
          const next = pasteFragment(document, fragment, page, {
            x: at.x + offset,
            y: at.y + offset,
          });
          target.select(next.selected);
          return next.document;
        });
      })().catch(() => {
        target.error("pasteFailed");
      });
    };
    const paste = (event: ClipboardEvent) => {
      // primary-selection paste may arrive after pointerup, so clear this only on a new user action
      if (middleGesture) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (textInput()) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!text || event.clipboardData?.files.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      insert(text);
    };
    const menuCopy = (event: Event) => {
      transfer(event, false);
    };
    const menuCut = (event: Event) => {
      transfer(event, true);
    };
    const menuPaste = () => {
      void navigator.clipboard
        .readText()
        .then(insert)
        .catch(() => {
          current.current.error("pasteFailed");
        });
    };
    const drop = (event: DragEvent) => {
      const file = Array.from(event.dataTransfer?.files ?? []).find((file) =>
        file.name.endsWith(".talweg-fragment"),
      );
      if (file) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void file
          .text()
          .then(insert)
          .catch(() => {
            current.current.error("pasteFailed");
          });
      }
    };
    const exportFragment = () => {
      const source = current.current;
      if (!source.document || !source.adapter) return;
      void copyFragment(source.document, source.selected, source.adapter)
        .then((text) => {
          const url = URL.createObjectURL(
            new Blob([text], { type: "application/json" }),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "selection.talweg-fragment";
          link.click();
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 1000);
        })
        .catch(() => {
          source.error("copyFailed");
        });
    };
    window.addEventListener("pointerdown", pointerIntent, true);
    window.addEventListener("mousedown", pointerIntent, true);
    window.addEventListener("keydown", keyboardIntent, true);
    window.addEventListener("blur", keyboardIntent);
    window.addEventListener("talweg:copy", menuCopy);
    window.addEventListener("talweg:cut", menuCut);
    window.addEventListener("talweg:paste", menuPaste);
    window.addEventListener("talweg:export-fragment", exportFragment);
    window.addEventListener("drop", drop, true);
    window.addEventListener("copy", copy);
    window.addEventListener("cut", cut);
    window.addEventListener("paste", paste, true);
    return () => {
      window.removeEventListener("pointerdown", pointerIntent, true);
      window.removeEventListener("mousedown", pointerIntent, true);
      window.removeEventListener("keydown", keyboardIntent, true);
      window.removeEventListener("blur", keyboardIntent);
      window.removeEventListener("talweg:copy", menuCopy);
      window.removeEventListener("talweg:cut", menuCut);
      window.removeEventListener("talweg:paste", menuPaste);
      window.removeEventListener("talweg:export-fragment", exportFragment);
      window.removeEventListener("drop", drop, true);
      window.removeEventListener("copy", copy);
      window.removeEventListener("cut", cut);
      window.removeEventListener("paste", paste, true);
    };
  }, []);
}
