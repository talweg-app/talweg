export function textOffsetRange(root: HTMLElement, start: number, end: number): Range {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(true);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let started = false;
  let last: Node | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    last = node;
    const length = node.textContent?.length ?? 0;
    if (!started && start <= offset + length) { range.setStart(node, Math.max(0, start - offset)); started = true; }
    if (started && end <= offset + length) { range.setEnd(node, Math.max(0, end - offset)); return range; }
    offset += length;
  }
  if (last) { if (!started) range.setStart(last, last.textContent?.length ?? 0); range.setEnd(last, last.textContent?.length ?? 0); }
  return range;
}

export function rebaseTextOffset(previous: string, next: string, offset: number): number {
  let start = 0, end = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
  while (end < previous.length - start && end < next.length - start && previous[previous.length - end - 1] === next[next.length - end - 1]) end++;
  if (offset < start) return offset;
  if (offset >= previous.length - end) return Math.max(start, offset + next.length - previous.length);
  return next.length - end;
}

export function editableRangeRects(root: HTMLElement, start: number, end: number): DOMRect[] {
  if (!(root instanceof HTMLTextAreaElement) && !(root instanceof HTMLInputElement)) {
    const range = textOffsetRange(root, start, end);
    const rects = [...range.getClientRects()];
    if (rects.length) return rects;
    const fallback = [...textOffsetRange(root, Math.max(0, start - 1), start).getClientRects()].slice(-1);
    return fallback.length ? fallback : [root.getBoundingClientRect()];
  }
  if (end > 200000) return [];
  const bounds = root.getBoundingClientRect();
  const computed = getComputedStyle(root);
  const mirror = document.createElement("div");
  for (const key of ["font", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textAlign", "padding", "border", "boxSizing", "tabSize"] as const) mirror.style[key] = computed[key];
  Object.assign(mirror.style, { position: "fixed", visibility: "hidden", pointerEvents: "none", left: `${String(bounds.left - root.scrollLeft)}px`, top: `${String(bounds.top - root.scrollTop)}px`, width: `${String(bounds.width)}px`, whiteSpace: root instanceof HTMLTextAreaElement ? "pre-wrap" : "pre", overflowWrap: "break-word" });
  const scale = bounds.width / Math.max(1, root.offsetWidth);
  Object.assign(mirror.style, { width: `${String(root.offsetWidth)}px`, left: `${String(bounds.left - root.scrollLeft * scale)}px`, top: `${String(bounds.top - root.scrollTop * scale)}px`, transform: `scale(${String(scale)})`, transformOrigin: "0 0" });
  mirror.textContent = root.value.slice(0, start);
  const marker = document.createElement("span"); marker.textContent = root.value.slice(start, end) || "\u200b";
  mirror.append(marker); document.body.append(mirror);
  const rects = [...marker.getClientRects()].filter(rect => rect.bottom > bounds.top && rect.top < bounds.bottom);
  mirror.remove();
  return rects;
}
