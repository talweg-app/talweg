import { useEffect } from "react";
import type { PeerEditing, PresencePatch } from "../utils/collaborationPresence.js";

export function useEditorPresence(update: (patch: PresencePatch) => void) {
  useEffect(() => {
    let previous = "";
    let frame = 0;
    const capture = () => {
      const active = document.activeElement;
      if (active instanceof Element && active.closest(".text-selection-toolbar")) return;
      let editing: PeerEditing | null = null;
      if (active instanceof HTMLElement && active.dataset.presenceField) {
        const node = active.closest<HTMLElement>("[data-node-id], [data-presence-node]");
        const id = node?.dataset.nodeId ?? node?.dataset.presenceNode;
        let start = 0, end = 0;
        if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
          start = active.selectionStart ?? 0; end = active.selectionEnd ?? start;
        } else {
          const selection = window.getSelection();
          if (selection?.rangeCount) {
            const range = selection.getRangeAt(0);
            if (active.contains(range.commonAncestorContainer)) {
              const prefix = range.cloneRange(); prefix.selectNodeContents(active); prefix.setEnd(range.startContainer, range.startOffset);
              start = prefix.toString().length; end = start + range.toString().length;
            }
          }
        }
        if (id) editing = { nodeId: id, field: active.dataset.presenceField, start, end };
      }
      const key = JSON.stringify(editing);
      if (key !== previous) { previous = key; update({ editing }); }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(capture); };
    const blur = () => { previous = ""; update({ editing: null }); };
    for (const name of ["focusin", "focusout", "selectionchange", "input", "keyup", "select"]) document.addEventListener(name, schedule);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(frame);
      for (const name of ["focusin", "focusout", "selectionchange", "input", "keyup", "select"]) document.removeEventListener(name, schedule);
      window.removeEventListener("blur", blur); update({ editing: null });
    };
  }, [update]);
}
