import type { TextRun } from "@talweg/core";

export function formatTextRange(
  runs: readonly TextRun[],
  start: number,
  end: number,
  format: Partial<Omit<TextRun, "text">>,
): TextRun[] {
  let offset = 0;
  const formatted: TextRun[] = [];
  for (const run of runs) {
    const from = Math.max(0, start - offset);
    const to = Math.min(run.text.length, end - offset);
    if (from < to) {
      if (from > 0) formatted.push({ ...run, text: run.text.slice(0, from) });
      formatted.push({ ...run, ...format, text: run.text.slice(from, to) });
      if (to < run.text.length) formatted.push({ ...run, text: run.text.slice(to) });
    } else formatted.push({ ...run });
    offset += run.text.length;
  }
  return formatted.reduce<TextRun[]>((merged, run) => {
    const previous = merged[merged.length - 1];
    const sameFormat = previous && (["color", "bold", "italic", "underline", "strike", "fontSize", "href"] as const).every((key) => previous[key] === run[key]);
    if (previous && sameFormat) previous.text += run.text;
    else if (run.text) merged.push(run);
    return merged;
  }, []);
}

export function colorTextRange(runs: readonly TextRun[], start: number, end: number, color: string): TextRun[] {
  return formatTextRange(runs, start, end, { color });
}

export function readableTextColor(fill: string): string {
  const hex = /^#([\da-f]{6})$/i.exec(fill)?.[1];
  if (!hex) return "#eeeeeb";
  const rgb = [0, 2, 4]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return (rgb[0] ?? 0) * 0.2126 +
    (rgb[1] ?? 0) * 0.7152 +
    (rgb[2] ?? 0) * 0.0722 >
    0.35
    ? "#202223"
    : "#eeeeeb";
}

export function normalizeExternalUrl(value: string): string | null {
  const address = value.trim();
  if (!address || (/^[a-z][a-z\d+.-]*:/i.test(address) && !/^https?:\/\//i.test(address))) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
