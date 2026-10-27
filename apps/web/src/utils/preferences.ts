export interface Preferences {
  displayName: string;
  interfaceScale: number;
  grid: boolean;
  snapToGrid: boolean;
  wheel: "auto" | "pan" | "zoom";
  showCursors: boolean;
  reopenLastBoard: boolean;
  guestLimit: number;
  relayUrl: string;
  iceServers: RTCIceServer[];
}
export const DEFAULT_PREFERENCES: Preferences = {
  displayName: "",
  interfaceScale: 1,
  grid: true,
  snapToGrid: false,
  wheel: "auto",
  showCursors: true,
  reopenLastBoard: false,
  guestLimit: 3,
  relayUrl: "",
  iceServers: [],
};
export function normalizePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_PREFERENCES };
  const input = value as Record<string, unknown>;
  const next = { ...DEFAULT_PREFERENCES };
  for (const key of [
    "grid",
    "snapToGrid",
    "showCursors",
    "reopenLastBoard",
  ] as const)
    if (typeof input[key] === "boolean") next[key] = input[key];
  if (typeof input.interfaceScale === "number" && Number.isFinite(input.interfaceScale))
    next.interfaceScale = Math.max(0.8, Math.min(1.5, Math.round(input.interfaceScale * 20) / 20));
  if (typeof input.displayName === "string")
    next.displayName = input.displayName.slice(0, 40);
  if (input.wheel === "pan" || input.wheel === "zoom") next.wheel = input.wheel;
  if (
    typeof input.guestLimit === "number" &&
    Number.isInteger(input.guestLimit)
  )
    next.guestLimit = Math.max(1, Math.min(8, input.guestLimit));
  if (
    typeof input.relayUrl === "string" &&
    input.relayUrl.length < 2048 &&
    input.relayUrl
  ) {
    const url = new URL(input.relayUrl);
    if (
      url.protocol !== "wss:" &&
      !(
        url.protocol === "ws:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      throw new Error("relay");
    if (url.username || url.password || url.hash || url.search)
      throw new Error("relay");
    next.relayUrl = url.href;
  }
  if (input.iceServers !== undefined && !Array.isArray(input.iceServers))
    throw new Error("ice");
  if (Array.isArray(input.iceServers)) {
    if (input.iceServers.length > 8) throw new Error("ice");
    next.iceServers = input.iceServers.map((item: unknown) => {
      if (!item || typeof item !== "object") throw new Error("ice");
      const server = item as Record<string, unknown>;
      const urls =
        typeof server.urls === "string" ? [server.urls] : server.urls;
      if (
        !Array.isArray(urls) ||
        !urls.length ||
        urls.length > 8 ||
        !urls.every(
          (url) =>
            typeof url === "string" &&
            /^(stun|stuns|turn|turns):[^\s]+$/.test(url) &&
            url.length < 2048,
        )
      )
        throw new Error("ice");
      return {
        urls: urls as string[],
        ...(typeof server.username === "string"
          ? { username: server.username.slice(0, 256) }
          : {}),
        ...(typeof server.credential === "string"
          ? { credential: server.credential.slice(0, 1024) }
          : {}),
      };
    });
  }
  return next;
}
const KEY = "talweg_preferences";
let cachedKey: string | undefined;
let cached = { ...DEFAULT_PREFERENCES };
export function readPreferences(): Preferences {
  let raw: string, name: string | null, snap: string | null;
  try {
    raw = localStorage.getItem(KEY) ?? "";
    name = localStorage.getItem("talweg_display_name");
    snap = localStorage.getItem("talweg_snap_to_grid");
  } catch {
    return cached;
  }
  const key = JSON.stringify([raw, name, snap]);
  if (key !== cachedKey) {
    try {
      cached = normalizePreferences(raw ? (JSON.parse(raw) as unknown) : {});
    } catch {
      cached = { ...DEFAULT_PREFERENCES };
    }
    if (name !== null) cached.displayName = name.slice(0, 40);
    if (snap !== null) cached.snapToGrid = snap === "true";
    cachedKey = key;
  }
  return cached;
}
export function persistClientValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    window.dispatchEvent(new Event("talweg:settings-save-error"));
  }
  void window.talwegDesktop
    ?.saveClientState({ [key]: value })
    .catch(() => window.dispatchEvent(new Event("talweg:settings-save-error")));
}
export function updatePreferences(patch: Partial<Preferences>): void {
  const next = normalizePreferences({ ...readPreferences(), ...patch });
  cached = next;
  persistClientValue(KEY, JSON.stringify(next));
  persistClientValue("talweg_display_name", next.displayName);
  persistClientValue("talweg_snap_to_grid", String(next.snapToGrid));
  window.dispatchEvent(new Event("talweg:preferences"));
}
export function subscribePreferences(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener("talweg:preferences", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("talweg:preferences", listener);
  };
}
