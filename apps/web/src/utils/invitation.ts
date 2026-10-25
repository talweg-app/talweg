export interface Invitation {
  version: 1;
  room: string;
  secret: string;
  hostKey: string;
  relay?: string;
}
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
export function decodeKey(encoded: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
    (character) => character.charCodeAt(0),
  );
}
export function encodeKey(bytes: ArrayBuffer): string {
  return encode(new Uint8Array(bytes));
}
export async function createInvitation(
  relay?: string,
): Promise<{ invitation: Invitation; privateKey: CryptoKey }> {
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  );
  return {
    invitation: {
      version: 1,
      room: crypto.randomUUID().replaceAll("-", ""),
      secret: encode(crypto.getRandomValues(new Uint8Array(32))),
      hostKey: encodeKey(await crypto.subtle.exportKey("raw", keys.publicKey)),
      ...(relay ? { relay } : {}),
    },
    privateKey: keys.privateKey,
  };
}
export function invitationText(invitation: Invitation): string {
  const fragment = new URLSearchParams({
    v: "1",
    key: invitation.secret,
    host: invitation.hostKey,
  });
  if (invitation.relay) fragment.set("relay", invitation.relay);
  return `talweg://join/${invitation.room}#${fragment.toString()}`;
}
export function parseInvitation(text: string): Invitation {
  if (text.length > 2048) throw new Error("invalid");
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    throw new Error("invalid");
  }
  if (
    url.protocol !== "talweg:" ||
    url.hostname !== "join" ||
    url.search ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("invalid");
  const room = url.pathname.slice(1);
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (fragment.get("v") !== "1") throw new Error("version");
  const secret = fragment.get("key") ?? "";
  const hostKey = fragment.get("host") ?? "";
  if (
    !/^[a-f0-9]{32}$/.test(room) ||
    !/^[\w-]{43}$/.test(secret) ||
    !/^[\w-]{87}$/.test(hostKey) ||
    decodeKey(hostKey)[0] !== 4
  )
    throw new Error("invalid");
  if (
    new Set(fragment.keys()).size !== [...fragment.keys()].length ||
    [...fragment.keys()].some(
      (key) => !["v", "key", "host", "relay"].includes(key),
    )
  )
    throw new Error("invalid");
  const relay = fragment.get("relay");
  if (relay) {
    const address = new URL(relay);
    if (
      address.username ||
      address.password ||
      address.hash ||
      address.search ||
      !(
        address.protocol === "wss:" ||
        (address.protocol === "ws:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(address.hostname))
      )
    )
      throw new Error("invalid");
  }
  return { version: 1, room, secret, hostKey, ...(relay ? { relay } : {}) };
}
export function rememberInvitation(invitation: Invitation): void {
  sessionStorage.setItem(
    `talweg-session:${invitation.room}`,
    invitationText(invitation),
  );
}
export function storedInvitation(room: string): Invitation | undefined {
  const text = sessionStorage.getItem(`talweg-session:${room}`);
  if (!text) return;
  try {
    return parseInvitation(text);
  } catch {
    return;
  }
}
