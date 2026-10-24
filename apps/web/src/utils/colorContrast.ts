type RGB = readonly [number, number, number];

function parseColor(color: string): readonly [number, number, number, number] | null {
  const hex = /^#([\da-f]{3,8})$/i.exec(color)?.[1];
  if (hex && [3, 4, 6, 8].includes(hex.length)) {
    const expanded = hex.length < 5 ? hex.replace(/[\da-f]/gi, value => value + value) : hex;
    return [parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16), expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1];
  }
  if (color === "transparent") return [0, 0, 0, 0];
  if (color === "white") return [255, 255, 255, 1];
  if (color === "black") return [0, 0, 0, 1];
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(color);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4] ?? 1)] : null;
}

function hexColor(rgb: RGB): string {
  return `#${rgb.map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

export function resolveFillColor(fill: string, background: string): string {
  const foreground = parseColor(fill);
  const behind = parseColor(background) ?? [16, 17, 18, 1];
  if (!foreground) return background;
  const alpha = foreground[3];
  const blend = (index: 0 | 1 | 2) => foreground[index] * alpha + behind[index] * (1 - alpha);
  return hexColor([blend(0), blend(1), blend(2)]);
}

function luminance(color: string): number {
  const rgb = parseColor(color) ?? [0, 0, 0, 1];
  const linear = rgb.slice(0, 3).map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return (linear[0] ?? 0) * .2126 + (linear[1] ?? 0) * .7152 + (linear[2] ?? 0) * .0722;
}

export function contrastRatio(text: string, background: string): number {
  const first = luminance(resolveFillColor(text, background));
  const second = luminance(background);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

export function readableTextColor(background: string): string {
  const dark = contrastRatio("#000000", background) > contrastRatio("#ffffff", background);
  const preferred = dark ? "#202223" : "#eeeeeb";
  return contrastRatio(preferred, background) >= 4.5 ? preferred : dark ? "#000000" : "#ffffff";
}

export function ensureTextContrast(color: string, background: string): string {
  const original = parseColor(color);
  if (!original) return readableTextColor(background);
  if (contrastRatio(color, background) >= 4.5) return color;
  const channels = original.slice(0, 3);
  if (Math.max(...channels) - Math.min(...channels) < 8 && (Math.min(...channels) > 220 || Math.max(...channels) < 40)) return readableTextColor(background);
  const target = contrastRatio("#000000", background) > contrastRatio("#ffffff", background) ? 0 : 255;
  for (let step = 1; step <= 20; step++) {
    const weight = step / 20;
    const adjusted = hexColor([original[0] * (1 - weight) + target * weight, original[1] * (1 - weight) + target * weight, original[2] * (1 - weight) + target * weight]);
    if (contrastRatio(adjusted, background) >= 4.5) return adjusted;
  }
  return target === 0 ? "#000000" : "#ffffff";
}
