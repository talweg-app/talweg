import type { StorageAdapter } from "@talweg/storage";

export function downloadText(
  content: string,
  name: string,
  type = "text/plain",
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name.replace(/[/\\?%*:|"<>]/g, "-");
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export async function exportNoteMarkdown(
  markdown: string,
  adapter?: StorageAdapter | null,
): Promise<string> {
  const ids = [
    ...new Set(
      [...markdown.matchAll(/asset:([a-f\d]{64})/g)].map(
        (match) => match[1] ?? "",
      ),
    ),
  ];
  let content = markdown;
  if (!adapter) return content;
  for (const id of ids) {
    const asset = await adapter.getAsset(id);
    if (!asset) continue;
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : "");
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error("Could not read image"));
      };
      reader.readAsDataURL(new Blob([asset.data], { type: asset.mimeType }));
    });
    content = content.replaceAll(`asset:${id}`, base64);
  }
  return content;
}
