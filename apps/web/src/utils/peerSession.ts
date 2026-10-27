import { validPresence, type Presence, type PresencePatch } from "./collaborationPresence.js";
export type { Presence } from "./collaborationPresence.js";
import { readPreferences } from "./preferences.js";
import { FRAGMENT_PREFIX, parseFragment } from "./canvasClipboard.js";
import * as Y from "yjs";
import type { MessageAction, Room } from "trystero";
import {
  TRANSACTION_ORIGINS,
  uint8ArrayToBase64,
  base64ToUint8Array,
  yDocToDocument,
  type IndexedDBStorageAdapter,
} from "@talweg/storage";
import { getCachedAssetUrl, setCachedAssetUrl } from "./assets.js";
import {
  decodeKey,
  encodeKey,
  invitationText,
  type Invitation,
} from "./invitation.js";

export type PeerPhase =
  | "off"
  | "connecting"
  | "approval"
  | "waiting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "denied"
  | "full"
  | "incompatible"
  | "unavailable";
export interface PeerState {
  selfId?: string;
  phase: PeerPhase;
  host: boolean;
  room: string;
  invite?: string;
  pending?: { id: string; name: string }[];
  participants?: Presence[];
  unsent?: number;
}
interface SyncPacket {
  update: string;
  assets: { id: string; mimeType: string; bytes: string }[];
  sequence: number;
  full?: boolean;
}
interface Control {
  type: "ended" | "ack" | "members" | "ping" | "pong" | "leave";
  sequence?: number;
  members?: Presence[];
}
const colors = ["#8caecc", "#83b7a3", "#cb8584", "#b09acb", "#e0ad75", "#91b5bd", "#c7b16f", "#df9ec5", "#becd94"];
const colorFor = (id: string) =>
  colors[
    Array.from(id, (char) => char.charCodeAt(0)).reduce(
      (sum, code) => sum + code,
      0,
    ) % colors.length
  ] ?? "#8caecc";

export class PeerSession {
  readonly ready: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (reason: Error) => void;
  private room: Room | undefined;
  private sync: MessageAction<string> | undefined;
  private awareness: MessageAction<string> | undefined;
  private control: MessageAction<string> | undefined;
  private selfId = "";
  private hostId = "";
  private readonly guestLimit = readPreferences().guestLimit;
  private closed = false;
  private terminal = false;
  private phaseValue: PeerPhase = "connecting";
  private members = new Map<string, Presence>();
  private permittedGuestKeys = new Set<string>();
  private guestPeers = new Map<string, string>();
  private approvals = new Map<
    string,
    { name: string; resolve: (accept: boolean) => void }
  >();
  private accepted = new Set<string>();
  private knownAssets = new Map<string, Set<string>>();
  private sending = Promise.resolve();
  private receiving = Promise.resolve();
  private sequence = 0;
  private unacknowledged = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private presenceSent = 0;
  private presenceTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private lastSeen = new Map<string, number>();
  private readonly onUpdate = (update: Uint8Array, origin: unknown) => {
    if (
      !this.inactive() &&
      origin !== TRANSACTION_ORIGINS.REMOTE_SYNC &&
      origin !== TRANSACTION_ORIGINS.STORAGE_HYDRATION
    ) {
      const sequence = ++this.sequence;
      if (!this.state.host) {
        this.unacknowledged.add(sequence);
        this.publishState();
      }
      this.sendUpdate(
        update,
        this.state.host ? [...this.accepted] : this.hostId ? [this.hostId] : [],
        sequence,
      );
    }
  };
  constructor(
    private readonly scene: Y.Doc,
    private readonly adapter: IndexedDBStorageAdapter,
    private readonly state: {
      host: boolean;
      invitation: Invitation;
      privateKey?: CryptoKey;
    },
    private readonly onState: (state: PeerState) => void,
  ) {
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.scene.on("update", this.onUpdate);
    this.publishState();
    void this.connect().catch(() => {
      this.fail("unavailable");
    });
  }
  private publishState() {
    if (!this.closed)
      this.onState({
        selfId: this.selfId,
        phase: this.phaseValue,
        host: this.state.host,
        room: this.state.invitation.room,
        invite: invitationText(this.state.invitation),
        pending: [...this.approvals].map(([id, request]) => ({
          id,
          name: request.name,
        })),
        participants: [...this.members.values()],
        unsent: this.unacknowledged.size,
      });
  }
  private inactive(): boolean {
    return this.closed || this.terminal;
  }
  private phase(phase: PeerPhase) {
    if (this.closed || this.terminal) return;
    this.phaseValue = phase;
    this.publishState();
  }
  private fail(phase: PeerPhase) {
    if (this.closed || this.terminal) return;
    this.terminal = true;
    clearTimeout(this.timer);
    clearInterval(this.heartbeat);
    clearTimeout(this.presenceTimer);
    if (phase === "ended")
      sessionStorage.setItem(`talweg-ended:${this.state.invitation.room}`, "1");
    this.phaseValue = phase;
    this.members.clear();
    this.publishState();
    this.rejectReady(new Error(phase));
    void this.room?.leave();
  }
  approve(id: string, accept: boolean) {
    this.approvals.get(id)?.resolve(accept);
  }
  private async connect() {
    const invitation = this.state.invitation;
    const sdk = invitation.relay
      ? await import("@trystero-p2p/ws-relay")
      : await import("trystero");
    if (this.closed) return;
    this.selfId = sdk.selfId;
    const ownName =
      readPreferences().displayName.trim() ||
      (this.state.host ? "Host" : "Guest");
    this.members.set(this.selfId, {
      id: this.selfId,
      name: ownName,
      color: colorFor(this.selfId),
      pageId: "page-1",
      x: null,
      y: null,
      selected: [],
    });
    let guestKeys: CryptoKeyPair | undefined;
    let guestPublic = "";
    if (!this.state.host) {
      const cached = sessionStorage.getItem(
        `talweg-guest-key:${invitation.room}`,
      );
      if (cached) {
        const stored = JSON.parse(cached) as {
          private: JsonWebKey;
          public: JsonWebKey;
        };
        guestKeys = {
          privateKey: await crypto.subtle.importKey(
            "jwk",
            stored.private,
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["sign"],
          ),
          publicKey: await crypto.subtle.importKey(
            "jwk",
            stored.public,
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["verify"],
          ),
        };
      } else {
        guestKeys = await crypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          true,
          ["sign", "verify"],
        );
        sessionStorage.setItem(
          `talweg-guest-key:${invitation.room}`,
          JSON.stringify({
            private: await crypto.subtle.exportKey("jwk", guestKeys.privateKey),
            public: await crypto.subtle.exportKey("jwk", guestKeys.publicKey),
          }),
        );
      }
      guestPublic = encodeKey(
        await crypto.subtle.exportKey("raw", guestKeys.publicKey),
      );
    }
    const callbacks = {
      handshakeTimeoutMs: 120000,
      // discovery also tries guest-to-guest handshakes, which this topology rejects
      onJoinError: () => undefined,
      onPeerHandshake: async (
        peerId: string,
        send: (packet: string) => Promise<void>,
        receive: () => Promise<{ data: unknown }>,
      ) => {
        const nonce = encodeKey(
          crypto.getRandomValues(new Uint8Array(24)).buffer,
        );
        await send(
          JSON.stringify({
            host: this.state.host,
            nonce,
            name: ownName,
            guestPublic,
            protocol: 1,
          }),
        );
        const hello = JSON.parse(String((await receive()).data)) as {
          host: boolean;
          nonce: string;
          name: string;
          guestPublic: string;
          protocol: number;
        };
        if (
          hello.protocol !== 1 ||
          typeof hello.nonce !== "string" ||
          hello.nonce.length !== 32 ||
          typeof hello.name !== "string"
        ) {
          this.phase("incompatible");
          throw new Error("Protocol mismatch");
        }
        if (this.state.host) {
          if (hello.host || !this.state.privateKey)
            throw new Error("Not a guest");
          const proof = new TextEncoder().encode(
            `${invitation.room}|${hello.nonce}|${nonce}|${peerId}|${this.selfId}`,
          );
          const signature = await crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            this.state.privateKey,
            proof,
          );
          await send(JSON.stringify({ signature: encodeKey(signature) }));
          const guestProof = JSON.parse(String((await receive()).data)) as {
            signature: string;
          };
          const guestKey = await crypto.subtle.importKey(
            "raw",
            decodeKey(hello.guestPublic),
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["verify"],
          );
          if (
            !(await crypto.subtle.verify(
              { name: "ECDSA", hash: "SHA-256" },
              guestKey,
              decodeKey(guestProof.signature),
              new TextEncoder().encode(
                `guest|${invitation.room}|${nonce}|${hello.nonce}|${this.selfId}|${peerId}`,
              ),
            ))
          )
            throw new Error("Unverified guest");
          const previousPeer = this.guestPeers.get(hello.guestPublic);
          if (previousPeer && previousPeer !== peerId) {
            this.room?.getPeers()[previousPeer]?.close();
            this.forgetPeer(previousPeer);
          }
          if (this.accepted.size + this.approvals.size >= this.guestLimit) {
            await send(JSON.stringify({ accepted: false, reason: "full" }));
            throw new Error("Full");
          }
          const allowed =
            this.permittedGuestKeys.has(hello.guestPublic) ||
            (await new Promise<boolean>((resolve) => {
              const deadline = setTimeout(() => {
                resolve(false);
              }, 90000);
              this.approvals.set(peerId, {
                name: hello.name.slice(0, 40),
                resolve: (accept) => {
                  clearTimeout(deadline);
                  resolve(accept);
                },
              });
              this.publishState();
            }));
          this.approvals.delete(peerId);
          this.publishState();
          if (this.closed || !allowed) {
            await send(JSON.stringify({ accepted: false, reason: "denied" }));
            throw new Error("Denied");
          }
          this.permittedGuestKeys.add(hello.guestPublic);
          this.guestPeers.set(hello.guestPublic, peerId);
          this.accepted.add(peerId);
          this.lastSeen.set(peerId, Date.now());
          this.members.set(peerId, {
            id: peerId,
            name: hello.name.slice(0, 40),
            color: colors.find(color => ![...this.members.values()].some(member => member.color === color)) ?? colorFor(peerId),
            pageId: "page-1",
            x: null,
            y: null,
            selected: [],
          });
          await send(JSON.stringify({ accepted: true }));
        } else {
          if (!hello.host) throw new Error("Not the host");
          const proof = JSON.parse(String((await receive()).data)) as {
            signature: string;
          };
          const key = await crypto.subtle.importKey(
            "raw",
            decodeKey(invitation.hostKey),
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["verify"],
          );
          const verified = await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            key,
            decodeKey(proof.signature),
            new TextEncoder().encode(
              `${invitation.room}|${nonce}|${hello.nonce}|${this.selfId}|${peerId}`,
            ),
          );
          if (!verified) throw new Error("Unverified host");
          if (!guestKeys) throw new Error("Missing identity");
          await send(
            JSON.stringify({
              signature: encodeKey(
                await crypto.subtle.sign(
                  { name: "ECDSA", hash: "SHA-256" },
                  guestKeys.privateKey,
                  new TextEncoder().encode(
                    `guest|${invitation.room}|${hello.nonce}|${nonce}|${peerId}|${this.selfId}`,
                  ),
                ),
              ),
            }),
          );
          clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            this.fail("unavailable");
          }, 120000);
          this.phase("approval");
          const admission = JSON.parse(String((await receive()).data)) as {
            accepted: boolean;
            reason?: "full" | "denied";
          };
          if (!admission.accepted) {
            this.fail(admission.reason === "full" ? "full" : "denied");
            throw new Error("Not admitted");
          }
          this.hostId = peerId;
          this.accepted.add(peerId);
          this.lastSeen.set(peerId, Date.now());
        }
      },
    };
    let iceServers: RTCIceServer[] = readPreferences().iceServers;
    try {
      const response = await fetch("/api/peer-config", {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const config = (await response.json()) as {
          iceServers?: RTCIceServer[];
        };
        if (!iceServers.length && Array.isArray(config.iceServers))
          iceServers = config.iceServers;
      }
    } catch {
      /* default STUN servers remain available */
    }
    const config = {
      ...(iceServers.length ? { rtcConfig: { iceServers } } : {}),
      appId: "talweg.collaboration.v1",
      maxReceiveBytes: 64 * 1024 * 1024,
      password: invitation.secret,
      ...(invitation.relay
        ? {
            relayConfig: { urls: [invitation.relay] },
            rtcConfig: { iceServers: [] },
          }
        : {}),
    };
    this.room = invitation.relay
      ? (await import("@trystero-p2p/ws-relay")).joinRoom(
          { ...config, relayConfig: { urls: [invitation.relay] } },
          invitation.room,
          callbacks,
        )
      : (await import("trystero")).joinRoom(config, invitation.room, callbacks);
    this.sync = this.room.makeAction<string>("scene");
    this.awareness = this.room.makeAction<string>("presence");
    this.control = this.room.makeAction<string>("session");
    this.sync.onMessage = (text, { peerId }) => {
      if (!this.accepted.has(peerId)) return;
      this.receiving = this.receiving
        .then(() => this.applyPacket(text, peerId))
        .catch(() => {
          if (this.state.host) {
            this.room?.getPeers()[peerId]?.close();
            this.forgetPeer(peerId);
          } else this.fail("unavailable");
        });
    };
    this.awareness.onMessage = (text, { peerId }) => {
      if (!this.accepted.has(peerId)) return;
      try {
        if (text.length > 512 * 1024) return;
        const presence = JSON.parse(text) as Presence;
        const owner = this.state.host ? peerId : presence.id;
        if (!validPresence(presence)) return;
        const member = this.members.get(owner);
        if (!member) return;
        this.members.set(owner, {
          ...member,
          pageId: presence.pageId,
          x: presence.x,
          y: presence.y,
          selected: presence.selected,
          gesture: presence.gesture ?? null,
          editing: presence.editing ?? null,
        });
        this.publishState();
        if (this.state.host)
          void this.awareness?.send(JSON.stringify(this.members.get(owner)), {
            target: [...this.accepted].filter((id) => id !== peerId),
          });
      } catch {
        /* malformed presence cannot change the document */
      }
    };
    this.control.onMessage = (text, { peerId }) => {
      if (!this.accepted.has(peerId)) return;
      let packet: Control | null;
      try {
        packet = JSON.parse(text) as Control | null;
        if (!packet || typeof packet.type !== "string") return;
      } catch {
        return;
      }
      this.lastSeen.set(peerId, Date.now());
      if (packet.type === "ping") {
        void this.control?.send(JSON.stringify({ type: "pong" }), {
          target: peerId,
        });
        return;
      }
      if (packet.type === "leave") {
        this.forgetPeer(peerId);
        return;
      }
      if (packet.type === "ended" && !this.state.host) this.fail("ended");
      if (
        packet.type === "ack" &&
        !this.state.host &&
        packet.sequence !== undefined
      ) {
        for (const sequence of this.unacknowledged)
          if (sequence <= packet.sequence) this.unacknowledged.delete(sequence);
        this.publishState();
      }
      if (packet.type === "members" && !this.state.host && packet.members) {
        for (const member of packet.members)
          if (validPresence(member)) {
            const own = member.id === this.selfId ? this.members.get(this.selfId) : undefined;
            this.members.set(member.id, own ? { ...own, color: member.color, name: member.name } : member);
          }
        const active = new Set(packet.members.map((member) => member.id));
        for (const id of this.members.keys())
          if (!active.has(id)) this.members.delete(id);
        this.publishState();
      }
    };
    this.room.onPeerJoin = (id) => {
      if (!this.accepted.has(id)) return;
      this.lastSeen.set(id, Date.now());
      if (this.state.host) {
        this.sendUpdate(Y.encodeStateAsUpdate(this.scene), [id], 0, true);
        this.broadcastMembers();
        this.phase("connected");
      } else {
        const sequence = ++this.sequence;
        this.unacknowledged.add(sequence);
        this.sendUpdate(Y.encodeStateAsUpdate(this.scene), [id], sequence);
      }
    };
    this.room.onPeerLeave = (id) => {
      this.forgetPeer(id);
    };
    this.heartbeat = setInterval(() => {
      if (this.closed || this.terminal) return;
      this.sendPresence();
      for (const id of this.accepted) {
        if (Date.now() - (this.lastSeen.get(id) ?? 0) > 8000) {
          this.room?.getPeers()[id]?.close();
          this.forgetPeer(id);
        } else
          void this.control
            ?.send(JSON.stringify({ type: "ping" }), { target: id })
            .catch(() => undefined);
      }
    }, 1000);
    if (this.state.host) {
      this.phase("waiting");
      this.resolveReady();
    } else
      this.timer = setTimeout(() => {
        this.fail("unavailable");
      }, 25000);
  }
  private forgetPeer(id: string) {
    const wasAccepted = this.accepted.delete(id);
    this.approvals.get(id)?.resolve(false);
    this.approvals.get(id)?.resolve(false);
    this.approvals.delete(id);
    for (const [key, peer] of this.guestPeers)
      if (peer === id) this.guestPeers.delete(key);
    this.members.delete(id);
    this.knownAssets.delete(id);
    this.lastSeen.delete(id);
    if (!wasAccepted || this.closed || this.terminal) return;
    if (this.state.host) {
      this.broadcastMembers();
      this.phase(this.accepted.size ? "connected" : "waiting");
    } else if (id === this.hostId) {
      for (const member of this.members.keys()) if (member !== this.selfId) this.members.delete(member);
      this.phase("reconnecting");
    }
  }
  private broadcastMembers() {
    void this.control?.send(
      JSON.stringify({ type: "members", members: [...this.members.values()] }),
      { target: [...this.accepted] },
    );
    this.publishState();
  }
  setPresence(patch: PresencePatch) {
    const own = this.members.get(this.selfId);
    if (!own || this.inactive()) return;
    this.members.set(this.selfId, { ...own, ...patch });
    const immediate = patch.gesture === null || patch.editing === null || patch.selected !== undefined || patch.pageId !== undefined;
    const delay = immediate ? 0 : Math.max(0, 50 - (Date.now() - this.presenceSent));
    if (delay) {
      this.presenceTimer ??= setTimeout(() => { this.sendPresence(); }, delay);
    } else this.sendPresence();
  }
  private sendPresence() {
    clearTimeout(this.presenceTimer);
    this.presenceTimer = undefined;
    const own = this.members.get(this.selfId);
    if (!own || this.inactive()) return;
    this.presenceSent = Date.now();
    void this.awareness?.send(JSON.stringify(own), { target: [...this.accepted] }).catch(() => undefined);
  }
  private async applyPacket(text: string, peerId: string) {
    if (this.closed || this.terminal || text.length > 90 * 1024 * 1024) return;
    const packet = JSON.parse(text) as SyncPacket;
    const update = base64ToUint8Array(packet.update);
    const shadow = new Y.Doc();
    try {
      Y.applyUpdate(shadow, Y.encodeStateAsUpdate(this.scene));
      Y.applyUpdate(shadow, update);
      const current = yDocToDocument(this.scene);
      const next = yDocToDocument(shadow);
      if (
        (current.id && next.id !== current.id) ||
        Object.keys(next.nodes).length > 10000
      )
        throw new Error("Invalid document");
      if (next.id)
        parseFragment(
          FRAGMENT_PREFIX +
            JSON.stringify({
              version: 1,
              source: next.id,
              roots: next.rootNodeIds,
              nodes: Object.values(next.nodes),
              assets: [],
            }),
        );
    } finally {
      shadow.destroy();
    }
    for (const asset of packet.assets) {
      const content = base64ToUint8Array(asset.bytes);
      const actualId = await this.adapter.saveAsset(
        new Blob([content.buffer as ArrayBuffer], { type: asset.mimeType }),
      );
      if (actualId !== asset.id) throw new Error("Invalid image digest");
      if (!getCachedAssetUrl(asset.id))
        setCachedAssetUrl(
          asset.id,
          URL.createObjectURL(
            new Blob([content.buffer as ArrayBuffer], { type: asset.mimeType }),
          ),
        );
    }
    if (this.inactive()) return;
    Y.applyUpdate(this.scene, update, TRANSACTION_ORIGINS.REMOTE_SYNC);
    if (this.state.host) {
      this.sendUpdate(
        update,
        [...this.accepted].filter((id) => id !== peerId),
        0,
      );
      await this.control?.send(
        JSON.stringify({ type: "ack", sequence: packet.sequence }),
        { target: peerId },
      );
    } else if (packet.full) {
      clearTimeout(this.timer);
      this.phase("connected");
      this.resolveReady();
    }
  }
  private sendUpdate(
    update: Uint8Array,
    targets: string[],
    sequence: number,
    full = false,
  ) {
    if (!targets.length) return;
    this.sending = this.sending
      .then(async () => {
        for (const target of targets) {
          if (this.closed || this.terminal || !this.accepted.has(target))
            continue;
          const known = this.knownAssets.get(target) ?? new Set<string>();
          this.knownAssets.set(target, known);
          const document = yDocToDocument(this.scene);
          const ids = new Set(
            Object.values(document.nodes).flatMap((node) => [
              ...(node.type === "image" ? [node.data.assetId] : []),
              ...Array.from(
                (node.note ?? "").matchAll(/asset:([a-f\d]{64})/g),
                (match) => match[1] ?? "",
              ),
            ]),
          );
          const assets: SyncPacket["assets"] = [];
          for (const id of ids)
            if (!known.has(id)) {
              const asset = await this.adapter.getAsset(id);
              if (asset) {
                assets.push({
                  id,
                  mimeType: asset.mimeType,
                  bytes: uint8ArrayToBase64(new Uint8Array(asset.data)),
                });
                known.add(id);
              }
            }
          await this.sync?.send(
            JSON.stringify({
              update: uint8ArrayToBase64(update),
              assets,
              sequence,
              full,
            }),
            { target },
          );
        }
      })
      .catch(() => {
        if (!this.closed) this.phase("reconnecting");
      });
  }
  async end() {
    try {
      await this.sending;
      await this.control?.send(
        JSON.stringify({ type: this.state.host ? "ended" : "leave" }),
        { target: [...this.accepted] },
      );
    } finally {
      this.close();
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.heartbeat);
    clearTimeout(this.presenceTimer);
    this.scene.off("update", this.onUpdate);
    for (const request of this.approvals.values()) request.resolve(false);
    this.rejectReady(new Error("Session closed"));
    void this.room?.leave();
  }
}
