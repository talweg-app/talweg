export async function historyRequest(path: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(`/api/history${path}`, { ...options, cache: "no-store", signal: options?.signal ?? AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("History unavailable");
  return response;
}

export function openVersionHistory(id: string, name = ""): void {
  window.dispatchEvent(new CustomEvent("talweg:open-history", { detail: { id, name } }));
}
