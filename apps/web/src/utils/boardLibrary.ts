const DRAFTS_KEY = "talweg_template_drafts";
const HIDDEN_KEY = "talweg_hidden_boards";
const DELETED_KEY = "talweg_deleted_boards";

function readIds(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function templateDraftIds(): Set<string> { return new Set(readIds(DRAFTS_KEY)); }
export function markTemplateDraft(id: string): void {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify([...templateDraftIds(), id]));
}
export function promoteTemplateDraft(id: string): void {
  const drafts = templateDraftIds();
  if (drafts.delete(id)) localStorage.setItem(DRAFTS_KEY, JSON.stringify([...drafts]));
}
export function hiddenBoardIds(): Set<string> { return new Set(readIds(HIDDEN_KEY)); }
export function deletedBoardIds(): Set<string> { return new Set(readIds(DELETED_KEY)); }
export function markBoardDeleted(id: string): void {
  localStorage.setItem(DELETED_KEY, JSON.stringify([...deletedBoardIds(), id]));
  setBoardHidden(id, false);
  promoteTemplateDraft(id);
}
export function setBoardHidden(id: string, hidden: boolean): Set<string> {
  const ids = hiddenBoardIds();
  if (hidden) ids.add(id);
  else ids.delete(id);
  localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]));
  return ids;
}
