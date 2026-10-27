export function notePreview(source: string, compact: boolean): string {
  if (compact) {
    const formula = (/\$\$[\s\S]*?\$\$/.exec(source))?.[0];
    if (formula && formula.length <= 1200) return formula;
  }
  const blocks = source.trim().split(/\n\s*\n/);
  const selected: string[] = [];
  let length = 0;
  for (const block of blocks.slice(0, 16)) {
    if (length + block.length > 1200) break;
    selected.push(block); length += block.length;
  }
  return selected.join("\n\n");
}
